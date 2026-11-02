// Mappe, fase 4: percorso a piedi lungo i sentieri tra due o più punti, calcolato da BRouter
// (servizio gratuito basato su OpenStreetMap). Due profili, scelti sulla mappa con l'interruttore:
//   "sentieri" → hiking-mountain: preferisce i sentieri, evita l'asfalto, pesa le salite (a volte allunga);
//   "breve"    → shortest: la strada più corta, anche se passa da strade e carrozzabili.
// Come per alba, meteo e luoghi, il servizio esterno lo chiama il SERVER, non il browser:
// così la CSP resta chiusa (connect-src 'self'), abbiamo un timeout e messaggi d'errore in italiano.
// (Ripreso dal commit 893a42b di giovedì e ampliato con le quote e il punto più alto.)

const BROUTER = "https://brouter.de/brouter";

// Errore "nessun sentiero vicino a quel punto": la rotta lo traduce in 404
export class NessunPercorso extends Error {}

export const PROFILI = { sentieri: "hiking-mountain", breve: "shortest" };

// Ferrate e alpinismo: il profilo dei sentieri, di serie, VIETA i passaggi sopra T3 della scala SAC
// (T1 sentiero facile … T6 alpinismo difficile), e le ferrate su OpenStreetMap sono quasi sempre T4–T6:
// BRouter le aggirava. Per queste attività gli chiediamo di accettare fino a T6 e di preferire T4.
// BRouter permette di cambiare i parametri del profilo nella richiesta: &profile:NOME=VALORE
export const ATTIVITA_IMPEGNATIVE = ["ferrata", "alpinismo"];
export function parametriDifficolta(profilo, attivita) {
  if (profilo !== "sentieri" || !ATTIVITA_IMPEGNATIVE.includes(attivita)) return "";
  return "&profile:SAC_scale_limit=6&profile:SAC_scale_preferred=4";
}

// punti: [[lat, lon], [lat, lon], ...] (per l'anello il browser rimette la partenza in fondo)
// profilo: "sentieri" (predefinito) oppure "breve"; attivita: quella del viaggio (per ferrate e alpinismo)
export async function calcola(punti, profilo = "sentieri", attivita = null) {
  const lonlats = punti.map(([lat, lon]) => `${lon},${lat}`).join("|"); // BRouter vuole PRIMA la longitudine, separati da |
  const url = `${BROUTER}?lonlats=${lonlats}&profile=${PROFILI[profilo]}&alternativeidx=0&format=geojson`
    + parametriDifficolta(profilo, attivita);

  const risposta = await fetch(url, { signal: AbortSignal.timeout(10_000) }); // massimo 10 secondi
  if (!risposta.ok) {
    const testo = await risposta.text(); // BRouter spiega l'errore in testo semplice
    if (/not mapped|no track|target island|from-position|to-position|via-position/i.test(testo)) throw new NessunPercorso(testo);
    throw new Error(`BRouter HTTP ${risposta.status}: ${testo.slice(0, 120)}`);
  }
  return daBRouter(await risposta.json());
}

// --- Funzioni "pure" (le provano i test in test/percorsi.test.js, con risposte finte) ---

// La risposta GeoJSON di BRouter → quello che serve all'app:
//   { distanza_km, dislivello_m, quota_min_m, quota_max_m, punto_piu_alto: [lat, lon], traccia: [[lat, lon, quota], ...] }
// BRouter dà le coordinate come [lon, lat, quota]: qui le giriamo in [lat, lon, quota], come le usa Leaflet.
export function daBRouter(geojson) {
  const linea = geojson?.features?.[0];
  const coordinate = linea?.geometry?.coordinates;
  if (!Array.isArray(coordinate) || coordinate.length < 2) throw new NessunPercorso("risposta senza percorso");

  // la quota (terzo valore) c'è quasi sempre; se manca, il punto resta [lat, lon] (il server non accetta quote "null")
  const punti = coordinate.map(([lon, lat, quota]) =>
    Number.isFinite(quota) ? [arrotonda(lat), arrotonda(lon), Math.round(quota)] : [arrotonda(lat), arrotonda(lon)]);
  const quote = punti.map((p) => p[2]).filter((q) => q != null);
  const indiceAlto = quote.length ? punti.findIndex((p) => p[2] === Math.max(...quote)) : -1;

  return {
    distanza_km: Math.round(Number(linea.properties["track-length"]) / 100) / 10, // metri → km con 1 decimale
    dislivello_m: Math.round(Number(linea.properties["filtered ascend"])),        // dislivello positivo in metri
    discesa_m: discesa(linea.properties),                                          // dislivello negativo in metri
    quota_min_m: quote.length ? Math.min(...quote) : null,
    quota_max_m: quote.length ? Math.max(...quote) : null,
    punto_piu_alto: indiceAlto >= 0 ? punti[indiceAlto].slice(0, 2) : null,      // per il meteo in vetta
    traccia: semplifica(punti, 20, indiceAlto),
  };
}

// Il dislivello negativo (D−): BRouter non lo dà, ma dà la salita totale ("filtered ascend") e la differenza
// di quota tra arrivo e partenza ("plain-ascend", negativa se arrivi più in basso). Siccome
//   arrivo − partenza = salite − discese   →   discese = salite − (arrivo − partenza)
// Esempio: sali 650 m e arrivi 200 m più in alto → scendi 450 m. In un anello D− = D+.
export function discesa(proprieta) {
  const salita = Number(proprieta?.["filtered ascend"]);
  const netto = Number(proprieta?.["plain-ascend"]);
  if (!Number.isFinite(salita) || !Number.isFinite(netto)) return null;
  return Math.max(0, Math.round(salita - netto)); // max 0: per i piccoli arrotondamenti di BRouter
}

const arrotonda = (n) => Math.round(n * 1e5) / 1e5; // 5 decimali ≈ 1 metro

// Tiene un punto solo se dista almeno ~20 m dal precedente tenuto (più il primo, l'ultimo e il punto più alto):
// la linea sulla mappa resta uguale, ma i punti da salvare diventano molti meno (giovedì: 466 → 156).
// Il punto più alto si tiene SEMPRE: il meteo in vetta lo cerca nella traccia salvata.
export function semplifica(punti, minimoMetri = 20, indiceDaTenere = -1) {
  const metri = ([lat1, lon1], [lat2, lon2]) => {
    const x = (lon2 - lon1) * 111_320 * Math.cos((lat1 * Math.PI) / 180);
    const y = (lat2 - lat1) * 110_540;
    return Math.hypot(x, y);
  };
  const tenuti = [punti[0]];
  for (let i = 1; i < punti.length - 1; i++) {
    if (i === indiceDaTenere || metri(tenuti.at(-1), punti[i]) >= minimoMetri) tenuti.push(punti[i]);
  }
  tenuti.push(punti.at(-1));
  return tenuti;
}
