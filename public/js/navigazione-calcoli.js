// =====================================================================
//  NAVIGAZIONE – i calcoli (funzioni "pure": niente pagina, niente mappa, niente GPS).
//  Si possono provare da soli, con numeri inventati.
//
//  Idea: la traccia è una fila di punti [lat, lon, quota]. Per sapere "a che punto sei"
//  cerchiamo il punto della linea più vicino alla tua posizione (lo "agganciamo"),
//  e da lì contiamo quanti metri sono già alle spalle e quanti ne mancano.
// =====================================================================

// Distanze piccole (qualche km) su un piano: x verso est, y verso nord, in metri.
// 1° di latitudine ≈ 110,5 km; 1° di longitudine ≈ 111,3 km × cos(latitudine) (più si va a nord, più è corto)
function inMetri([lat, lon], lat0, lon0) {
  return [(lon - lon0) * 111_320 * Math.cos((lat0 * Math.PI) / 180), (lat - lat0) * 110_540];
}

// Una volta sola, all'inizio: lunghezze e salite accumulate lungo la traccia
//   cum[i]    = metri dalla partenza al punto i
//   salita[i] = metri di salita dalla partenza al punto i (si sommano solo i tratti in su)
export function preparaTraccia(linea) {
  const cum = [0];
  const salita = [0];
  for (let i = 1; i < linea.length; i++) {
    const [x, y] = inMetri(linea[i], linea[i - 1][0], linea[i - 1][1]);
    cum.push(cum[i - 1] + Math.hypot(x, y));
    const su = linea[i][2] != null && linea[i - 1][2] != null ? Math.max(0, linea[i][2] - linea[i - 1][2]) : 0;
    salita.push(salita[i - 1] + su);
  }
  return { linea, cum, salita, totale: cum.at(-1) };
}

// Aggancia la posizione alla traccia: per ogni tratto (da un punto al successivo) cerca il punto più vicino,
// e tiene il migliore. "precedente" = i metri fatti all'aggiornamento prima: nell'anello partenza e arrivo
// sono vicini, e senza questo appena partita ti darebbe "quasi arrivata". Preferiamo quindi, a parità
// di distanza, il punto più vicino a dove eri prima (oltre 300 m di salto si paga una piccola penalità).
// → { metri_fatti, distanza_m (quanto sei lontana dalla traccia), indice, frazione }
export function aggancia(prep, posizione, precedente = null) {
  const { linea, cum } = prep;
  let migliore = null;
  for (let i = 0; i < linea.length - 1; i++) {
    const a = inMetri(linea[i], posizione[0], posizione[1]);       // la posizione è l'origine (0, 0)
    const b = inMetri(linea[i + 1], posizione[0], posizione[1]);
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const lungo2 = dx * dx + dy * dy;
    // t = dove cade la perpendicolare dalla posizione al tratto (0 = inizio, 1 = fine), tenuta dentro il tratto
    const t = lungo2 === 0 ? 0 : Math.min(1, Math.max(0, -(a[0] * dx + a[1] * dy) / lungo2));
    const distanza = Math.hypot(a[0] + t * dx, a[1] + t * dy);
    const metriFatti = cum[i] + t * (cum[i + 1] - cum[i]);
    const salto = precedente == null ? 0 : Math.max(0, Math.abs(metriFatti - precedente) - 300);
    const punteggio = distanza + 0.1 * salto;
    if (!migliore || punteggio < migliore.punteggio) {
      migliore = { punteggio, metri_fatti: metriFatti, distanza_m: distanza, indice: i, frazione: t };
    }
  }
  const { punteggio, ...risultato } = migliore;
  return risultato;
}

// Da dove sei all'arrivo: metri e salita che mancano, ore stimate (stessa regola del resto dell'app:
// 4 km all'ora in piano, più un'ora ogni 400 m di salita)
export function riepilogo(prep, agganciata) {
  const { linea, salita, totale } = prep;
  const { indice, frazione, metri_fatti: fatti } = agganciata;
  const quotaA = linea[indice][2];
  const quotaB = linea[indice + 1]?.[2];
  const suNelTratto = quotaA != null && quotaB != null ? Math.max(0, quotaB - quotaA) : 0;
  const salitaFatta = salita[indice] + frazione * suNelTratto;
  const mancano = Math.max(0, totale - fatti);
  const salitaRestante = Math.max(0, salita.at(-1) - salitaFatta);
  return {
    metri_fatti: fatti,
    metri_mancanti: mancano,
    salita_restante_m: salitaRestante,
    ore_restanti: mancano / 1000 / 4 + salitaRestante / 400,
  };
}

// Fuori percorso? Più di 50 m dalla traccia, ma solo se il GPS è abbastanza preciso
// (con una precisione di ±80 m "sei a 60 m" non vuol dire niente)
export function fuoriPercorso(distanzaM, precisioneM, soglia = 50) {
  return precisioneM <= 60 && distanzaM > soglia;
}
