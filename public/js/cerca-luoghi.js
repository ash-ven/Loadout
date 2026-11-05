// =====================================================================
//  RICERCA DEI LUOGHI PER NOME (rifugi, malghe, cime, paesi…) – 5/11
//  Prima passava dal nostro server a Nominatim (OpenStreetMap), ma la policy di Nominatim vieta la ricerca
//  mentre scrivi. Ora la fa il browser con il Geocoding di MapTiler, che la permette (incluso nel piano gratuito).
//  La chiede direttamente il browser perché le condizioni di MapTiler vogliono richieste dirette dall'utente
//  (niente passaggi dal nostro server). La chiave è la stessa delle mappe, limitata al nostro sito nel pannello MapTiler.
//  Il server dà solo le quote dei luoghi trovati (/api/luoghi/quote, da Open-Meteo), per distinguere gli omonimi.
// =====================================================================
import { api } from "./api.js";

const GEOCODING = "https://api.maptiler.com/geocoding";

// Alcuni tipi di luogo, tradotti (MapTiler li dà nelle "categorie" del punto, con i nomi di OpenStreetMap)
const TIPI = {
  peak: "cima", mountain_peak: "cima", volcano: "cima", saddle: "passo", mountain_pass: "passo", ridge: "cresta", valley: "valle",
  alpine_hut: "rifugio", wilderness_hut: "bivacco", hut: "baita", shelter: "riparo", chalet: "baita",
  parking: "parcheggio", lake: "lago", water: "lago", camp_site: "campeggio", viewpoint: "punto panoramico",
  spring: "sorgente", waterfall: "cascata", hotel: "albergo", guest_house: "albergo", glacier: "ghiacciaio",
};
// …oppure dal tipo di risultato (comune, località…)
const TIPI_LUOGO = { municipality: "paese", municipal_district: "paese", locality: "località", neighbourhood: "frazione",
                     place: "località", county: "provincia", region: "regione", country: "stato" };

// --- Funzione "pura" (niente rete): la risposta di MapTiler → il nostro formato ---
// { etichetta: "Rifugio Vajolet (Pozza di Fassa, Trento)", nome: "Rifugio Vajolet", tipo: "rifugio", lat, lon }
export function daMapTiler(risposta) {
  const features = Array.isArray(risposta?.features) ? risposta.features : [];
  return features.map((f) => {
    const nome = String(f.text ?? "").trim();
    const contesto = Array.isArray(f.context) ? f.context : [];
    const tipoDi = (c) => (Array.isArray(c.place_type) ? c.place_type[0] : String(c.id ?? "").split(".")[0]);
    const testoDi = (tipo) => contesto.find((c) => tipoDi(c) === tipo)?.text ?? "";
    const comune = testoDi("municipality");
    const paese = testoDi("country");
    const zona = [comune !== nome ? comune : "", testoDi("county") || testoDi("region"), paese && paese !== "Italia" ? paese : ""]
      .filter(Boolean).join(", ");
    const categoria = (f.properties?.categories ?? []).map((c) => TIPI[c]).find(Boolean);
    const [lon, lat] = Array.isArray(f.center) ? f.center.map(Number) : [];
    return {
      etichetta: zona ? `${nome} (${zona})` : nome,
      nome,
      tipo: categoria ?? TIPI_LUOGO[f.place_type?.[0]] ?? null,
      lat: Math.round(lat * 1e6) / 1e6, // 6 decimali: circa 10 cm
      lon: Math.round(lon * 1e6) / 1e6,
    };
  }).filter((l) => l.nome && Number.isFinite(l.lat) && Number.isFinite(l.lon));
}

let chiave = null; // la chiave di MapTiler, chiesta una volta sola al nostro server
const memoria = new Map(); // testo cercato → risultati (non rifacciamo la stessa ricerca)

// Cerca "testo" e restituisce fino a 8 luoghi, ognuno con la sua quota (quota_m, o null)
export async function cercaLuoghi(testo) {
  const k = testo.toLowerCase();
  if (memoria.has(k)) return memoria.get(k);
  chiave ??= (await api("/api/mappe/config")).chiave;
  const url = `${GEOCODING}/${encodeURIComponent(testo)}.json?key=${encodeURIComponent(chiave)}&language=it&limit=8&autocomplete=true`;
  let risposta;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`MapTiler HTTP ${res.status}`);
    risposta = await res.json();
  } catch {
    throw new Error("La ricerca dei luoghi non risponde: inserisci le coordinate a mano o riprova tra poco");
  }
  const luoghi = daMapTiler(risposta);
  if (luoghi.length > 0) {
    try {
      const punti = luoghi.map((l) => `${l.lat},${l.lon}`).join(";");
      const { quote } = await api(`/api/luoghi/quote?punti=${encodeURIComponent(punti)}`);
      luoghi.forEach((l, i) => { l.quota_m = quote[i] ?? null; });
    } catch { /* senza quote la ricerca funziona lo stesso */ }
  }
  if (memoria.size > 100) memoria.delete(memoria.keys().next().value);
  memoria.set(k, luoghi);
  return luoghi;
}
