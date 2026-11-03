import { query } from "../db.js";

// 1. Ore di cammino AL GIORNO stimate dal percorso.
//    Regola escursionistica semplificata: 4 km/h in piano + 1 ora ogni 400 m di salita.
export function oreStimate(viaggio) {
  if (viaggio.distanza_km == null) return null;
  const oreTotali = viaggio.distanza_km / 4 + (viaggio.dislivello_m ?? 0) / 400;
  const oreGiorno = oreTotali / viaggio.n_giorni;
  return Math.round(oreGiorno * 2) / 2; // arrotonda alla mezz'ora
}

// 2. Distanza in km tra due punti [lat, lon] (formula di haversine).
//    Serve a misurare la traccia fino alla vetta (la "distanza in linea d'aria" nella scheda è stata tolta).
export function kmTra([lat1, lon1], [lat2, lon2]) {
  const R = 6371; // raggio medio della Terra in km
  const rad = (gradi) => (gradi * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// 3. Acqua consigliata (B4: la formula sta nel database, vedi loadout_stretch_acqua.sql).
//    Restituisce i litri a persona al giorno e il totale del viaggio.
//    Tiene conto di ore di cammino, salita del giorno, temperatura prevista e cucina.
export async function acqua(viaggio, oreGiorno, temperaturaMax = null) {
  // il dislivello inserito è quello di tutto il percorso: lo dividiamo per i giorni
  const dislivelloGiorno = viaggio.dislivello_m == null ? 0 : viaggio.dislivello_m / viaggio.n_giorni;
  const { rows } = await query(
    `SELECT fn_acqua_persona_giorno($3, $5, $4, $6)       AS persona_giorno,
            fn_acqua_consigliata($1, $2, $3, $4, $5, $6)  AS totale`,
    [viaggio.n_giorni, viaggio.n_persone, oreGiorno, temperaturaMax, dislivelloGiorno, viaggio.serve_cucina]
  );
  return rows[0];
}

// 4. Alba e tramonto dal servizio esterno sunrise-sunset.org (US6 CA2, CA3)
export async function sole(viaggio) {
  const { lat_partenza: lat, lon_partenza: lng, data_partenza: data } = viaggio;
  if (lat == null || lng == null || !data) {
    return { disponibile: false, motivo: "servono coordinate e data di partenza" };
  }
  try {
    const url = `https://api.sunrise-sunset.org/json?lat=${lat}&lng=${lng}&date=${data}&formatted=0`;
    const risposta = await fetch(url, { signal: AbortSignal.timeout(3000) });
    if (!risposta.ok) throw new Error(`HTTP ${risposta.status}`);
    const json = await risposta.json();
    if (json.status !== "OK") throw new Error(`risposta ${json.status}`);
    return { disponibile: true, alba: oraItaliana(json.results.sunrise), tramonto: oraItaliana(json.results.sunset) };
  } catch (err) {
    console.error("sunrise-sunset non disponibile:", err.message);
    return { disponibile: false, motivo: "servizio esterno non disponibile" };
  }
}

// B2: entro che ora partire per arrivare con UN'ORA DI LUCE di margine.
//   ora limite = tramonto − ore di cammino − margine
// Funzione "pura" (lavora solo sui dati che riceve): la provano i test in test/consigli.test.js
//   oraPartenza (facoltativa, "HH:MM") = l'ora scritta nel form: se è dopo il limite, in_ritardo = true
export function oraLimitePartenza(alba, tramonto, oreCammino, margineOre = 1, oraPartenza = null) {
  if (!alba || !tramonto || oreCammino == null) return null;
  const minuti = (hhmm) => { const [h, m] = hhmm.split(":").map(Number); return h * 60 + m; }; // "16:55" → 1015
  // B7 (revisione UX 2): arrotondata al quarto d'ora PRIMA ("entro le 12:00", non "entro le 12:01")
  const limite = Math.floor((minuti(tramonto) - Math.round((oreCammino + margineOre) * 60)) / 15) * 15;
  const dueCifre = (n) => String(n).padStart(2, "0");
  return {
    ora: limite >= 0 ? `${dueCifre(Math.floor(limite / 60))}:${dueCifre(limite % 60)}` : null,
    prima_dell_alba: limite < minuti(alba), // il cammino è più lungo delle ore di luce
    margine_ore: margineOre,
    ora_partenza: oraPartenza,
    in_ritardo: oraPartenza != null && limite >= 0 && minuti(oraPartenza) > limite,
  };
}

function oraItaliana(iso) {
  return new Date(iso).toLocaleTimeString("it-IT", { timeZone: "Europe/Rome", hour: "2-digit", minute: "2-digit" });
}

// 5. Avviso se lo zaino è troppo pesante rispetto al peso corporeo (stretch 5)
//    B4: la soglia dipende dall'uscita: 10% in giornata, 20% con pernotto.
//    Conta il PESO BASE: lo zaino senza acqua e cibo (cambiano a ogni uscita e calano mentre cammini).
export function sogliaPeso(pesoCorporeoKg, pernotto) {
  const percento = pernotto === "nessuno" ? 10 : 20;
  return { percento, soglia_kg: Math.round(pesoCorporeoKg * percento) / 100 };
}

export async function avvisoPeso(utenteId, pesoZainoKg, pernotto) {
  const { rows } = await query("SELECT peso_corporeo_kg FROM utente WHERE id = $1", [utenteId]);
  const pesoCorporeo = rows[0]?.peso_corporeo_kg ?? null;
  if (pesoCorporeo == null) {
    return { disponibile: false, motivo: "imposta il tuo peso corporeo nel profilo" };
  }
  const { percento, soglia_kg } = sogliaPeso(pesoCorporeo, pernotto);
  return {
    disponibile: true,
    peso_corporeo_kg: pesoCorporeo,
    soglia_percento: percento,
    soglia_kg,
    troppo_pesante: pesoZainoKg > soglia_kg,
  };
}

const DISLIVELLO_MINIMO_VETTA = 100; // A4: sotto i 100 m di differenza, partenza e vetta sono "lo stesso posto"
const memoriaMeteo = new Map(); // indirizzo della richiesta → { quando, json }

// 6. Meteo da Open-Meteo: in PARTENZA (coordinate di partenza) e IN VETTA (parametro elevation = quota massima,
//    sulle coordinate del punto più alto della traccia, oppure su quelle di partenza se non c'è la mappa).
//    In vetta prendiamo i valori dell'ORA in cui stimiamo che arrivi (ora di partenza + tempo fino alla vetta).
//    sensibilita = la sensibilità al freddo del profilo; oreGiorno = le ore di cammino del giorno (per la stima)
export async function meteo(viaggio, sensibilita = null, oreGiorno = null) {
  const { lat_partenza: lat, lon_partenza: lon, data_partenza: data } = viaggio;
  if (lat == null || lon == null || !data) {
    return { disponibile: false, motivo: "servono coordinate e data di partenza" };
  }

  // Open-Meteo dà previsioni solo da oggi fino a 16 giorni avanti
  const oggi = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Rome" }); // es. "2026-10-28"
  const giorniMancanti = (Date.parse(`${data}T00:00:00Z`) - Date.parse(`${oggi}T00:00:00Z`)) / 86_400_000;
  if (giorniMancanti < 0) return { disponibile: false, motivo: "la data di partenza è già passata" };
  if (giorniMancanti > 15) return { disponibile: false, motivo: "previsioni disponibili solo nei 16 giorni prima della partenza" };

  const giorno = `&timezone=Europe%2FRome&start_date=${data}&end_date=${data}`;
  // Collaudo 3/11, A4: la quota della partenza la prendiamo dalla TRACCIA (primo punto), se c'è: è quella vera.
  // Prima usavamo quella del modello meteo, che in montagna può sbagliare di decine di metri
  // (e la "partenza" risultava più alta della "vetta"). La passiamo anche a Open-Meteo (elevation), che la usa per i calcoli.
  const quotaDallaTraccia = Number.isFinite(viaggio.traccia?.linea?.[0]?.[2]) ? Math.round(viaggio.traccia.linea[0][2]) : null;
  const urlPartenza = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    (quotaDallaTraccia != null ? `&elevation=${quotaDallaTraccia}` : "") +
    `&daily=temperature_2m_max,temperature_2m_min,apparent_temperature_min,apparent_temperature_max,precipitation_probability_max,wind_speed_10m_max,wind_gusts_10m_max${giorno}`;

  // La vetta: il punto più alto della traccia (se c'è la mappa), altrimenti la partenza con la quota scritta a mano
  const quota = viaggio.quota_max_m;
  // A1: la traccia vale solo se arriva davvero alla quota massima scritta (altrimenti dice un punto e un'ora sbagliati)
  const alto = vettaDallaTraccia(viaggio.traccia, quota);
  const [latV, lonV] = alto ? [alto.lat, alto.lon] : [lat, lon];
  // A4: se la vetta è a meno di 100 m sopra la partenza, una "vetta" a parte non ha senso: una colonna sola
  const vettaVicina = (q) => quota != null && q != null && quota - q < DISLIVELLO_MINIMO_VETTA;
  const urlVetta = quota == null || vettaVicina(quotaDallaTraccia) ? null : `https://api.open-meteo.com/v1/forecast?latitude=${latV}&longitude=${lonV}&elevation=${quota}` +
    `&daily=temperature_2m_max,temperature_2m_min,apparent_temperature_min,wind_gusts_10m_max,weather_code` +
    `&hourly=temperature_2m,apparent_temperature,wind_gusts_10m,weather_code,freezing_level_height${giorno}`;

  try {
    // Le due richieste partono insieme (Promise.all). Se la vetta non risponde, resta la stima (−6 °C/1000 m).
    const [jsonPartenza, jsonVetta] = await Promise.all([
      scaricaMeteo(urlPartenza),
      urlVetta ? scaricaMeteo(urlVetta).catch((err) => { console.error("meteo in vetta non disponibile:", err.message); return null; }) : null,
    ]);
    const { daily, elevation } = jsonPartenza; // elevation = la quota del punto di partenza (m)
    const tMax = daily.temperature_2m_max[0];
    const tMin = daily.temperature_2m_min[0];
    const pioggia = daily.precipitation_probability_max[0];
    const vento = daily.wind_speed_10m_max?.[0] ?? null;    // km/h
    const raffiche = daily.wind_gusts_10m_max?.[0] ?? null; // km/h
    const quotaPartenza = quotaDallaTraccia ?? (elevation != null ? Math.round(elevation) : null);
    const unaQuota = vettaVicina(quotaPartenza); // A4: percorso quasi in piano → niente colonna "vetta"

    // A che ora arrivi in vetta: ora di partenza (8:00 se non l'hai scritta) + tempo stimato fino al punto più alto
    const ore = oreFinoAllaVetta(alto ? viaggio.traccia : null, oreGiorno); // senza traccia affidabile: metà delle ore del giorno
    const arrivo = minuti(viaggio.ora_partenza || "08:00") + (ore != null ? Math.round(ore * 60) : 4 * 60);
    const oraArrivo = Math.min(Math.round(arrivo / 60), 23); // l'ora intera più vicina, per i dati "ora per ora"

    let vetta = null;
    if (unaQuota) {
      vetta = null;
    } else if (quota != null && jsonVetta) {
      vetta = daMeteoVetta(jsonVetta, quota, oraArrivo, alto ? "traccia" : "quota_scritta");
    } else if (quota != null && quotaPartenza != null) {
      const stima = stimaInCima(tMin, tMax, quotaPartenza, quota); // riserva: la stima di prima
      if (stima) vetta = { ...stima, fonte: "stima", ora_arrivo: null };
    }
    if (vetta) vetta.ora_arrivo_stimata = orario(Math.min(arrivo, 23 * 60));

    return {
      disponibile: true,
      temp_max: tMax,
      temp_min: tMin,
      prob_pioggia: pioggia,
      quota_partenza_m: quotaPartenza,
      // Collaudo 3/11, C3: la percepita anche in partenza (prima c'era solo in vetta)
      percepita_min: daily.apparent_temperature_min?.[0] ?? null,
      percepita_max: daily.apparent_temperature_max?.[0] ?? null,
      una_quota: unaQuota, // A4: true = la vetta è a meno di 100 m sopra la partenza (la scheda mostra "Sul percorso")
      vento_kmh: vento,
      raffiche_kmh: raffiche,
      vetta, // { quota_m, fonte, ora_arrivo_stimata, temp, percepita, raffiche_kmh, temp_min, temp_max, percepita_min, raffiche_max_kmh, zero_termico_m, temporali } oppure null
      avvisi: avvisiVetta(vetta, raffiche),
      // il vestiario si decide sul punto più freddo: la percepita minima in vetta, se la conosciamo
      vestiario: consigliVestiario(vetta?.percepita_min ?? vetta?.temp_min ?? tMin, tMax, pioggia, sensibilita, vento),
    };
  } catch (err) {
    console.error("open-meteo non disponibile:", err.message);
    return { disponibile: false, motivo: "servizio meteo non disponibile" };
  }
}

// Una richiesta a Open-Meteo, con la memoria di 30 minuti (il meteo lo chiedono il dettaglio e il kit)
async function scaricaMeteo(url) {
  const inMemoria = memoriaMeteo.get(url);
  if (inMemoria && Date.now() - inMemoria.quando < 30 * 60 * 1000) return inMemoria.json;
  const risposta = await fetch(url, { signal: AbortSignal.timeout(4000) });
  if (!risposta.ok) throw new Error(`HTTP ${risposta.status}`);
  const json = await risposta.json();
  if (memoriaMeteo.size > 200) memoriaMeteo.clear();
  memoriaMeteo.set(url, { quando: Date.now(), json });
  return json;
}

// --- Funzioni "pure" del meteo in vetta (le provano i test in test/consigli.test.js) ---

// "08:30" → 510 minuti dalla mezzanotte; 690 → "11:30"
export function minuti(hhmm) { const [h, m] = String(hhmm).split(":").map(Number); return h * 60 + (m || 0); }
export function orario(min) { return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(Math.round(min % 60)).padStart(2, "0")}`; }

// Il punto più alto della traccia: { lat, lon, quota, indice } oppure null (niente traccia o niente quote)
export function puntoPiuAlto(traccia) {
  const linea = traccia?.linea;
  if (!Array.isArray(linea)) return null;
  let migliore = null;
  linea.forEach(([lat, lon, quota], indice) => {
    if (Number.isFinite(quota) && (!migliore || quota > migliore.quota)) migliore = { lat, lon, quota, indice };
  });
  return migliore;
}

// A1 (revisione UX 2): il punto più alto della traccia, ma SOLO se corrisponde alla quota massima dell'uscita
// (al massimo 100 m di differenza). Se hai scritto a mano 2.165 m e la traccia arriva a 1.511 m, la traccia
// non dice dove né quando sei in vetta: meglio la quota scritta sulle coordinate di partenza, e l'ora stimata.
export function vettaDallaTraccia(traccia, quotaMax, tolleranza = 100) {
  const alto = puntoPiuAlto(traccia);
  if (!alto || quotaMax == null) return null;
  return Math.abs(alto.quota - quotaMax) <= tolleranza ? alto : null;
}

// Ore di cammino dalla partenza alla vetta.
//   Con la traccia: km e dislivello positivo FINO al punto più alto, con la regola delle ore (4 km/h + 1 h ogni 400 m).
//   Senza traccia: metà delle ore del giorno (andata e ritorno o anello: di solito la vetta è a metà).
export function oreFinoAllaVetta(traccia, oreGiorno = null) {
  const alto = puntoPiuAlto(traccia);
  if (alto && alto.indice > 0) {
    let km = 0, salita = 0;
    for (let i = 1; i <= alto.indice; i++) {
      const [prima, dopo] = [traccia.linea[i - 1], traccia.linea[i]];
      km += kmTra(prima, dopo);
      if (Number.isFinite(prima[2]) && Number.isFinite(dopo[2]) && dopo[2] > prima[2]) salita += dopo[2] - prima[2];
    }
    return km / 4 + salita / 400;
  }
  return oreGiorno != null ? oreGiorno / 2 : null;
}

// La risposta di Open-Meteo per la vetta → i valori che ci servono.
// oraArrivo = l'ora intera (0–23) in cui stimiamo che arrivi: da lì i valori "ora per ora".
export function daMeteoVetta(json, quota, oraArrivo, fonte) {
  const { daily, hourly } = json;
  const allOra = (nome) => hourly?.[nome]?.[oraArrivo] ?? null;
  // lo zero termico più basso nelle ore di luce (7–18): se scende sotto la vetta, può esserci ghiaccio
  const zeri = (hourly?.freezing_level_height ?? []).slice(7, 19).filter(Number.isFinite);
  const unDecimale = (n) => (n == null ? null : Math.round(n * 10) / 10);
  return {
    quota_m: quota,
    fonte,                                              // "traccia" | "quota_scritta" (| "stima" se Open-Meteo non risponde)
    temp: unDecimale(allOra("temperature_2m")),
    percepita: unDecimale(allOra("apparent_temperature")),
    raffiche_kmh: allOra("wind_gusts_10m"),
    temp_min: daily.temperature_2m_min?.[0] ?? null,
    temp_max: daily.temperature_2m_max?.[0] ?? null,
    percepita_min: daily.apparent_temperature_min?.[0] ?? null,
    raffiche_max_kmh: daily.wind_gusts_10m_max?.[0] ?? null,
    zero_termico_m: zeri.length ? Math.round(Math.min(...zeri)) : null,
    temporali: (daily.weather_code?.[0] ?? 0) >= 95,    // codici 95–99 = temporale
  };
}

// Soglie del vento sulle raffiche massime in vetta (approvate da Asiha, provvisorie),
// agganciate all'allerta vento dell'Emilia-Romagna (verde sotto 62 km/h, rosso da 88 km/h)
export function avvisoVento(raffiche) {
  if (raffiche == null || raffiche < 40) return null;
  if (raffiche < 62) return { tipo: "vento", livello: "sostenuto", testo: "Vento sostenuto in vetta: porta uno strato antivento" };
  if (raffiche < 88) return { tipo: "vento", livello: "forte", testo: "Vento forte in vetta: sulle creste camminare è faticoso e si può perdere l'equilibrio" };
  return { tipo: "vento", livello: "molto_forte", testo: "Vento molto forte in vetta: sconsigliati creste e tratti esposti" };
}

// Tutti gli avvisi della vetta (testi provvisori: la formulazione finale la sceglie Asiha)
export function avvisiVetta(vetta, raffichePartenza = null) {
  const avvisi = [];
  const vento = avvisoVento(vetta?.raffiche_max_kmh ?? raffichePartenza);
  if (vento) avvisi.push(vento);
  if (vetta?.zero_termico_m != null && vetta.zero_termico_m < vetta.quota_m) {
    avvisi.push({ tipo: "zero_termico", livello: "attenzione",
      testo: `Zero termico intorno ai ${vetta.zero_termico_m.toLocaleString("it-IT", { useGrouping: "always" })} m, sotto la vetta: possibile ghiaccio` });
  }
  if (vetta?.temporali) {
    avvisi.push({ tipo: "temporali", livello: "attenzione", testo: "Possibili temporali: in montagna sono pericolosi, parti presto o valuta di rimandare" });
  }
  return avvisi;
}

// La sensibilità al freddo del profilo: chi soffre il freddo "sente" 4 gradi in meno,
// chi lo sente poco 4 gradi in più. Le soglie dei consigli si confrontano con la temperatura PERCEPITA.
const GRADI_PERCEPITI = { alta: -4, normale: 0, bassa: +4 };

// Funzione "pura" (niente rete né database): la provano i test in test/consigli.test.js
export function consigliVestiario(tMin, tMax, pioggia, sensibilita = null, ventoKmh = null) {
  const spostamento = GRADI_PERCEPITI[sensibilita] ?? 0;
  const minPercepita = tMin + spostamento;
  const maxPercepita = tMax + spostamento;
  const consigli = [];
  if (tMin < 0) consigli.push("Strati termici, guanti e berretto: si va sotto zero");
  else if (minPercepita < 0) consigli.push("Strati termici, guanti e berretto: per te sarà molto freddo");
  else if (minPercepita < 8) consigli.push("Pile o piumino leggero per le ore più fresche");
  if (maxPercepita > 25) consigli.push("Abbigliamento traspirante, cappello e crema solare");
  if (pioggia >= 50) consigli.push("Giacca impermeabile e copri-zaino");
  if (ventoKmh != null && ventoKmh >= 30) consigli.push("Giacca antivento: il vento fa sentire più freddo");
  if (consigli.length === 0) consigli.push("Abbigliamento a strati: temperature miti");
  if (spostamento < 0) consigli.push("Consigli adattati al tuo profilo: soffri il freddo");
  if (spostamento > 0) consigli.push("Consigli adattati al tuo profilo: senti poco il freddo");
  return consigli;
}

// B3: temperature stimate in cima. In montagna l'aria si raffredda di circa 6 °C ogni 1000 m di salita.
// È una stima (d'inverno, con l'inversione termica, in quota può fare anche più caldo che a valle).
export function stimaInCima(tMin, tMax, quotaPartenza, quotaCima, gradiOgni1000 = 6) {
  const salita = quotaCima - quotaPartenza;
  if (salita <= 0) return null; // la cima non è più in alto della partenza: niente da stimare
  const calo = (gradiOgni1000 * salita) / 1000;
  const unDecimale = (n) => Math.round(n * 10) / 10;
  return { quota_m: quotaCima, temp_min: unDecimale(tMin - calo), temp_max: unDecimale(tMax - calo) };
}

// B3: neve o ghiaccio possibili? Sopra i 2000 m, tra ottobre e maggio, oppure con la minima in cima sotto zero.
// Senza data non possiamo escluderlo: meglio avvisare.
export function rischioNeve(quotaMax, dataISO, tempMinCima = null) {
  if (quotaMax == null || quotaMax < 2000) return false;
  if (!dataISO) return true;
  const mese = Number(dataISO.slice(5, 7));
  return mese >= 10 || mese <= 5 || (tempMinCima != null && tempMinCima <= 0);
}

// La sensibilità al freddo dell'utente (null se non l'ha indicata)
export async function sensibilitaFreddo(utenteId) {
  const { rows } = await query("SELECT sensibilita_freddo FROM utente WHERE id = $1", [utenteId]);
  return rows[0]?.sensibilita_freddo ?? null;
}