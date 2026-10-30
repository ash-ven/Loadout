import { query } from "../db.js";

// 1. Ore di cammino AL GIORNO stimate dal percorso.
//    Regola escursionistica semplificata: 4 km/h in piano + 1 ora ogni 400 m di salita.
export function oreStimate(viaggio) {
  if (viaggio.distanza_km == null) return null;
  const oreTotali = viaggio.distanza_km / 4 + (viaggio.dislivello_m ?? 0) / 400;
  const oreGiorno = oreTotali / viaggio.n_giorni;
  return Math.round(oreGiorno * 2) / 2; // arrotonda alla mezz'ora
}

// 2. Distanza in linea d'aria tra partenza e arrivo, in km (formula di haversine)
export function distanzaLineaAria(viaggio) {
  const { lat_partenza: lat1, lon_partenza: lon1, lat_arrivo: lat2, lon_arrivo: lon2 } = viaggio;
  if ([lat1, lon1, lat2, lon2].some((x) => x == null)) return null;
  const R = 6371; // raggio medio della Terra in km
  const rad = (gradi) => (gradi * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(a)) * 10) / 10;
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

function oraItaliana(iso) {
  return new Date(iso).toLocaleTimeString("it-IT", { timeZone: "Europe/Rome", hour: "2-digit", minute: "2-digit" });
}

// 5. Avviso se lo zaino supera il 20% del peso corporeo (stretch 5)
export async function avvisoPeso(utenteId, pesoZainoKg) {
  const { rows } = await query("SELECT peso_corporeo_kg FROM utente WHERE id = $1", [utenteId]);
  const pesoCorporeo = rows[0]?.peso_corporeo_kg ?? null;
  if (pesoCorporeo == null) {
    return { disponibile: false, motivo: "imposta il tuo peso corporeo nel profilo" };
  }
  const soglia = Math.round(pesoCorporeo * 0.2 * 100) / 100;
  return {
    disponibile: true,
    peso_corporeo_kg: pesoCorporeo,
    soglia_kg: soglia,
    troppo_pesante: pesoZainoKg > soglia,
  };
}

// 6. Meteo del giorno di partenza da Open-Meteo + suggerimenti sul vestiario (stretch 1)
//    sensibilita = la sensibilità al freddo del profilo ("alta", "normale", "bassa" o null)
export async function meteo(viaggio, sensibilita = null) {
  const { lat_partenza: lat, lon_partenza: lon, data_partenza: data } = viaggio;
  if (lat == null || lon == null || !data) {
    return { disponibile: false, motivo: "servono coordinate e data di partenza" };
  }

  // Open-Meteo dà previsioni solo da oggi fino a 16 giorni avanti
  const oggi = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Rome" }); // es. "2026-10-28"
  const giorniMancanti = (Date.parse(`${data}T00:00:00Z`) - Date.parse(`${oggi}T00:00:00Z`)) / 86_400_000;
  if (giorniMancanti < 0) return { disponibile: false, motivo: "la data di partenza è già passata" };
  if (giorniMancanti > 15) return { disponibile: false, motivo: "previsioni disponibili solo nei 16 giorni prima della partenza" };

  try {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      `&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max` +
      `&timezone=Europe%2FRome&start_date=${data}&end_date=${data}`;
    const risposta = await fetch(url, { signal: AbortSignal.timeout(3000) });
    if (!risposta.ok) throw new Error(`HTTP ${risposta.status}`);
    const { daily } = await risposta.json();
    const tMax = daily.temperature_2m_max[0];
    const tMin = daily.temperature_2m_min[0];
    const pioggia = daily.precipitation_probability_max[0];
    return {
      disponibile: true,
      temp_max: tMax,
      temp_min: tMin,
      prob_pioggia: pioggia,
      vestiario: consigliVestiario(tMin, tMax, pioggia, sensibilita),
    };
  } catch (err) {
    console.error("open-meteo non disponibile:", err.message);
    return { disponibile: false, motivo: "servizio meteo non disponibile" };
  }
}

// La sensibilità al freddo del profilo: chi soffre il freddo "sente" 4 gradi in meno,
// chi lo sente poco 4 gradi in più. Le soglie dei consigli si confrontano con la temperatura PERCEPITA.
const GRADI_PERCEPITI = { alta: -4, normale: 0, bassa: +4 };

// Funzione "pura" (niente rete né database): la provano i test in test/consigli.test.js
export function consigliVestiario(tMin, tMax, pioggia, sensibilita = null) {
  const spostamento = GRADI_PERCEPITI[sensibilita] ?? 0;
  const minPercepita = tMin + spostamento;
  const maxPercepita = tMax + spostamento;
  const consigli = [];
  if (tMin < 0) consigli.push("Strati termici, guanti e berretto: si va sotto zero");
  else if (minPercepita < 0) consigli.push("Strati termici, guanti e berretto: per te sarà molto freddo");
  else if (minPercepita < 8) consigli.push("Pile o piumino leggero per le ore più fresche");
  if (maxPercepita > 25) consigli.push("Abbigliamento traspirante, cappello e crema solare");
  if (pioggia >= 50) consigli.push("Giacca impermeabile e copri-zaino");
  if (consigli.length === 0) consigli.push("Abbigliamento a strati: temperature miti");
  if (spostamento < 0) consigli.push("Consigli adattati al tuo profilo: soffri il freddo");
  if (spostamento > 0) consigli.push("Consigli adattati al tuo profilo: senti poco il freddo");
  return consigli;
}

// La sensibilità al freddo dell'utente (null se non l'ha indicata)
export async function sensibilitaFreddo(utenteId) {
  const { rows } = await query("SELECT sensibilita_freddo FROM utente WHERE id = $1", [utenteId]);
  return rows[0]?.sensibilita_freddo ?? null;
}