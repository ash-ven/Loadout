// =====================================================================
//  CONTROLLI NEL BROWSER condivisi tra form dell'uscita (viaggi.js) e pagina della mappa (mappa.js).
//  A3 (revisione UX 2): messaggi leggibili prima ancora di chiedere al server.
// =====================================================================

const COORDINATE = [
  ["lat_partenza", "La latitudine di partenza", 90, "in Italia circa 36–47, es. 44,19"],
  ["lon_partenza", "La longitudine di partenza", 180, "in Italia circa 6–19, es. 10,70"],
  ["lat_arrivo", "La latitudine di arrivo", 90, "in Italia circa 36–47, es. 44,19"],
  ["lon_arrivo", "La longitudine di arrivo", 180, "in Italia circa 6–19, es. 10,70"],
];

// d = i dati letti dal form (numeri, oppure undefined/null se il campo è vuoto) → elenco di messaggi
export function erroriCoordinate(d) {
  const errori = [];
  for (const [campo, nome, limite, aiuto] of COORDINATE) {
    const v = d[campo];
    if (v == null) continue; // facoltative
    if (!Number.isFinite(v) || v < -limite || v > limite) errori.push(`${nome} va da −${limite} a ${limite} (${aiuto})`);
  }
  return errori;
}
