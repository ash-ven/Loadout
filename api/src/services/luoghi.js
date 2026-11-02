// =====================================================================
//  RICERCA DEI LUOGHI PER NOME (rifugi, malghe, cime, paesi…)
//  Usa Nominatim, il motore di ricerca di OpenStreetMap: gratuito e senza chiave.
//  Le sue regole d'uso: presentarsi con il nome dell'app (User-Agent) e fare
//  AL MASSIMO UNA richiesta al secondo. Per questo le richieste passano dal server,
//  una alla volta, e i risultati restano in memoria.
// =====================================================================

const NOMINATIM = "https://nominatim.openstreetmap.org/search";
const QUOTE = "https://api.open-meteo.com/v1/elevation"; // A5: la quota dei luoghi trovati, tutti insieme in una richiesta
const INTESTAZIONI = { "User-Agent": "Loadout/1.0 (progetto di stage ITS Futura)", Accept: "application/json" };
const PAUSA_MS = 1100;          // poco più di un secondo tra una richiesta e l'altra
const ATTESA_MAX_MS = 6000;

const memoria = new Map();      // testo cercato → risultati (al massimo 300 ricerche)
const MEMORIA_MAX = 300;
let coda = Promise.resolve();   // le richieste aspettano il loro turno, una dopo l'altra
let ultima = 0;                 // quando è partita l'ultima richiesta (millisecondi)

// Alcuni tipi di luogo di OpenStreetMap, tradotti per l'utente
const TIPI = {
  peak: "cima", saddle: "passo", mountain_pass: "passo", ridge: "cresta", valley: "valle", alpine_hut: "rifugio", wilderness_hut: "bivacco", hut: "baita",
  village: "paese", town: "paese", city: "città", hamlet: "frazione", locality: "località",
  parking: "parcheggio", lake: "lago", water: "lago", camp_site: "campeggio", viewpoint: "punto panoramico",
  shelter: "riparo", spring: "sorgente", waterfall: "cascata", hotel: "albergo", guest_house: "albergo", chalet: "baita",
};

// --- A5 (revisione UX 2): la quota di ogni luogo, per distinguere gli omonimi ("passo · 1.402 m") ---
// Funzione "pura": unisce ai luoghi le quote della risposta di Open-Meteo ({ elevation: [1402.3, …] }, nello stesso ordine)
export function conQuote(luoghi, risposta) {
  const quote = Array.isArray(risposta?.elevation) ? risposta.elevation : [];
  return luoghi.map((l, i) => ({ ...l, quota_m: Number.isFinite(quote[i]) ? Math.round(quote[i]) : null }));
}

// Chiede a Open-Meteo le quote di tutti i luoghi in una volta. Se non risponde, la ricerca funziona lo stesso (quota null)
async function aggiungiQuote(luoghi) {
  if (luoghi.length === 0) return luoghi;
  try {
    const url = `${QUOTE}?latitude=${luoghi.map((l) => l.lat).join(",")}&longitude=${luoghi.map((l) => l.lon).join(",")}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) throw new Error(`Open-Meteo HTTP ${res.status}`);
    return conQuote(luoghi, await res.json());
  } catch (err) {
    console.error("quote dei luoghi non disponibili:", err.message);
    return conQuote(luoghi, null);
  }
}

// --- Funzione "pura" (niente rete): la risposta di Nominatim → il nostro formato. La provano i test ---
export function daNominatim(risultati) {
  if (!Array.isArray(risultati)) return [];
  return risultati.map((r) => {
    const a = r.address ?? {};
    const nome = (r.name || String(r.display_name ?? "").split(",")[0]).trim();
    const comune = a.village || a.town || a.city || a.hamlet || a.municipality || "";
    // La sigla della provincia: "IT-TN" → "TN" (solo in Italia); altrove la regione e lo stato
    const sigla = (a["ISO3166-2-lvl6"] ?? "").startsWith("IT-") ? a["ISO3166-2-lvl6"].slice(3) : "";
    const zona = [comune !== nome ? comune : "", sigla || a.state || "", a.country_code && a.country_code !== "it" ? a.country : ""]
      .filter(Boolean).join(", ");
    return {
      etichetta: zona ? `${nome} (${zona})` : nome,
      tipo: TIPI[r.type] ?? null,
      lat: Math.round(Number(r.lat) * 1e6) / 1e6, // 6 decimali: circa 10 cm, più che sufficiente
      lon: Math.round(Number(r.lon) * 1e6) / 1e6,
    };
  }).filter((l) => l.etichetta && Number.isFinite(l.lat) && Number.isFinite(l.lon));
}

// Aspetta il proprio turno nella coda, rispettando la pausa tra una richiesta e l'altra
function inCoda(lavoro) {
  const turno = coda.then(async () => {
    const attesa = ultima + PAUSA_MS - Date.now();
    if (attesa > 0) await new Promise((r) => setTimeout(r, attesa));
    ultima = Date.now();
    return lavoro();
  });
  coda = turno.catch(() => {}); // un errore non deve bloccare chi viene dopo
  return turno;
}

export async function cerca(testo) {
  const chiave = testo.toLowerCase();
  if (memoria.has(chiave)) return memoria.get(chiave);

  // A5: fino a 8 luoghi (prima 6), così tra gli omonimi è più facile trovare quello giusto
  const url = `${NOMINATIM}?format=jsonv2&addressdetails=1&limit=8&accept-language=it&q=${encodeURIComponent(testo)}`;
  const trovati = await inCoda(async () => {
    const res = await fetch(url, { headers: INTESTAZIONI, signal: AbortSignal.timeout(ATTESA_MAX_MS) });
    if (!res.ok) throw new Error(`Nominatim HTTP ${res.status}`);
    return daNominatim(await res.json());
  });
  const risultati = await aggiungiQuote(trovati); // fuori dalla coda: la regola "1 al secondo" vale solo per Nominatim

  if (memoria.size >= MEMORIA_MAX) memoria.delete(memoria.keys().next().value);
  memoria.set(chiave, risultati);
  return risultati;
}
