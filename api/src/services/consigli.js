import { query } from "../db.js";

// 1. Ore di cammino AL GIORNO stimate dal percorso.
//    Regola escursionistica semplificata: 4 km/h in piano + 1 ora ogni 400 m di salita.
export function oreStimate(viaggio) {
  if (viaggio.distanza_km == null) return null;
  const oreTotali = viaggio.distanza_km / 4 + (viaggio.dislivello_m ?? 0) / 400;
  const oreGiorno = oreTotali / viaggio.n_giorni;
  return Math.round(oreGiorno * 2) / 2; // arrotonda alla mezz'ora
}

// 2. Distanza in linea d'aria tra partenza e arrivo, in km (formula dell'emisenoverso / haversine)
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

// 3. Acqua consigliata in litri (la formula sta nel database)
export async function acqua(viaggio, oreGiorno) {
  const { rows } = await query("SELECT fn_acqua_consigliata($1, $2, $3) AS litri", [
    viaggio.n_giorni,
    viaggio.n_persone,
    oreGiorno,
  ]);
  return rows[0].litri;
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