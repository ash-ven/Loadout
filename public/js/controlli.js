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

// d = i dati letti dal form (numeri, oppure undefined/null se il campo è vuoto)
// → elenco di errori { campo, testo } (B1: ogni messaggio va sotto il suo campo)
export function erroriCoordinate(d) {
  const errori = [];
  for (const [campo, nome, limite, aiuto] of COORDINATE) {
    const v = d[campo];
    if (v == null) continue; // facoltative
    if (!Number.isFinite(v) || v < -limite || v > limite) errori.push({ campo, testo: `${nome} va da −${limite} a ${limite} (${aiuto})` });
  }
  return errori;
}

// Quota minima e massima: insieme ai limiti, la minima non può superare la massima
export function erroriQuote(d) {
  const errori = [];
  const intero = (v, min, max) => Number.isInteger(v) && v >= min && v <= max;
  if (d.quota_max_m != null && !intero(d.quota_max_m, 0, 9000)) {
    errori.push({ campo: "quota_max_m", testo: "La quota massima va da 0 a 9.000 m (numero intero)" });
  }
  if (d.quota_min_m != null && !intero(d.quota_min_m, -500, 9000)) {
    errori.push({ campo: "quota_min_m", testo: "La quota minima va da −500 a 9.000 m (numero intero)" });
  }
  if (d.quota_min_m != null && d.quota_max_m != null && d.quota_min_m > d.quota_max_m) {
    errori.push({ campo: "quota_min_m",
      testo: `La quota minima non può superare la quota massima (${d.quota_max_m.toLocaleString("it-IT", { useGrouping: "always" })} m)` });
  }
  return errori;
}

// C1 (revisione UX 2): il browser mostra «44,15» quando il valore lo scrive il programma (mappa, luogo),
// ma lascia «44.15» se lo scrivi tu col punto. Quando esci dal campo lo riscriviamo da programma:
// così si vede sempre la virgola. Si può scrivere con il punto o con la virgola, il numero è lo stesso.
export function uniformaDecimali(campi) {
  for (const campo of campi) {
    campo.addEventListener("change", () => {
      if (campo.value === "" || campo.readOnly) return;
      const valore = campo.value; // per il programma il valore ha sempre il punto: «44.15»
      campo.value = "";           // svuotare e riscrivere obbliga il browser a ridisegnarlo con la virgola
      campo.value = valore;
    });
  }
}
