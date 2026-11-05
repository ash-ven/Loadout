// =====================================================================
//  QUOTE DEI LUOGHI (A5, revisione UX 2) – per distinguere gli omonimi nei suggerimenti ("passo · 1.402 m")
//  5/11: la ricerca dei luoghi per nome NON passa più da qui. Prima usavamo Nominatim (OpenStreetMap), ma la sua
//  policy vieta la ricerca mentre scrivi; ora la fa il browser con MapTiler (public/js/cerca-luoghi.js), che la permette.
//  Il server dà solo le quote dei luoghi trovati, chiedendole a Open-Meteo (tutte insieme, in una richiesta).
// =====================================================================

const QUOTE = "https://api.open-meteo.com/v1/elevation";
const MAX_PUNTI = 10;

// --- Funzione "pura": "44.19,10.70;46.41,11.62" → [[44.19, 10.7], [46.41, 11.62]], oppure null se non va bene ---
export function leggiPunti(testo) {
  const pezzi = String(testo ?? "").split(";").filter(Boolean);
  if (pezzi.length === 0 || pezzi.length > MAX_PUNTI) return null;
  const punti = pezzi.map((p) => p.split(",").map(Number));
  const valido = ([lat, lon]) => Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;
  return punti.every((p) => p.length === 2 && valido(p)) ? punti : null;
}

// --- Funzione "pura": la risposta di Open-Meteo ({ elevation: [1402.3, …] }, nello stesso ordine) → quote intere o null ---
export function quoteDaRisposta(quanti, risposta) {
  const quote = Array.isArray(risposta?.elevation) ? risposta.elevation : [];
  return Array.from({ length: quanti }, (_, i) => (Number.isFinite(quote[i]) ? Math.round(quote[i]) : null));
}

// Chiede a Open-Meteo le quote. Se non risponde, tutte null: la ricerca funziona lo stesso, solo senza quota
export async function quote(punti) {
  try {
    const url = `${QUOTE}?latitude=${punti.map((p) => p[0]).join(",")}&longitude=${punti.map((p) => p[1]).join(",")}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) throw new Error(`Open-Meteo HTTP ${res.status}`);
    return quoteDaRisposta(punti.length, await res.json());
  } catch (err) {
    console.error("quote dei luoghi non disponibili:", err.message);
    return quoteDaRisposta(punti.length, null);
  }
}
