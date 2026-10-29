// C3: percorso a piedi lungo i sentieri tra due o più punti, calcolato da BRouter
// (servizio gratuito basato su OpenStreetMap, profilo "hiking-mountain" = escursionismo in montagna).
// Come per alba e meteo, il servizio esterno lo chiama il SERVER, non il browser.

const BROUTER = "https://brouter.de/brouter";

// Errore "nessun sentiero vicino a quel punto": la rotta lo traduce in 404
export class NessunPercorso extends Error {}

// punti: [[lat, lon], [lat, lon], ...]  →  { distanza_km, dislivello_m, traccia: [[lat, lon], ...] }
export async function calcola(punti) {
  const lonlats = punti.map(([lat, lon]) => `${lon},${lat}`).join("|"); // BRouter vuole lon,lat separati da |
  const url = `${BROUTER}?lonlats=${lonlats}&profile=hiking-mountain&alternativeidx=0&format=geojson`;

  const risposta = await fetch(url, { signal: AbortSignal.timeout(10_000) }); // massimo 10 secondi
  if (!risposta.ok) {
    const testo = await risposta.text(); // BRouter spiega l'errore in testo semplice
    if (/not mapped|no track|target island|from-position|to-position/i.test(testo)) throw new NessunPercorso(testo);
    throw new Error(`BRouter HTTP ${risposta.status}: ${testo.slice(0, 120)}`);
  }

  const geojson = await risposta.json();
  const linea = geojson.features[0];
  const coordinate = linea.geometry.coordinates; // [lon, lat, quota]
  return {
    distanza_km: Math.round(Number(linea.properties["track-length"]) / 100) / 10, // metri → km con 1 decimale
    dislivello_m: Math.round(Number(linea.properties["filtered ascend"])),        // salita totale in metri
    traccia: semplifica(coordinate.map(([lon, lat]) => [arrotonda(lat), arrotonda(lon)])),
  };
}

const arrotonda = (n) => Math.round(n * 1e5) / 1e5; // 5 decimali ≈ 1 metro

// Tiene un punto solo se dista almeno ~20 m dal precedente tenuto (più l'ultimo):
// la linea sulla mappa resta uguale, ma i punti da salvare diventano molti meno.
function semplifica(punti, minimoMetri = 20) {
  const metri = ([lat1, lon1], [lat2, lon2]) => {
    const x = (lon2 - lon1) * 111_320 * Math.cos((lat1 * Math.PI) / 180);
    const y = (lat2 - lat1) * 110_540;
    return Math.hypot(x, y);
  };
  const tenuti = [punti[0]];
  for (const p of punti.slice(1, -1)) {
    if (metri(tenuti.at(-1), p) >= minimoMetri) tenuti.push(p);
  }
  tenuti.push(punti.at(-1));
  return tenuti;
}
