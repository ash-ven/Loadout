// =====================================================================
//  B8 – IMPORTA UN FILE GPX nella mappa del viaggio (il contrario di gpx.js, che lo scarica).
//  Tutto nel BROWSER: il file non va al server, niente rotte nuove e niente CSP da cambiare.
//  Qui solo i calcoli ("puri", si provano da soli); la pagina usa leggiGpx() e preparaImport().
// =====================================================================
import { preparaTraccia } from "./navigazione-calcoli.js";

const LIMITE_PUNTI = 5000; // quanti punti accetta il server nella traccia

// Il testo XML del file → { nome, punti: [[lat, lon, quota?], …] }.
// Prende i punti della traccia (<trkpt>); se non ci sono, quelli di un percorso (<rtept>).
// DOMParser è il "lettore di XML" del browser (nei test se ne può passare un altro).
export function leggiGpx(testo, Parser = globalThis.DOMParser) {
  const doc = new Parser().parseFromString(testo, "application/xml");
  if (doc.getElementsByTagName("parsererror").length) throw new Error("Il file non è un GPX leggibile");
  let nodi = [...doc.getElementsByTagName("trkpt")];
  if (nodi.length < 2) nodi = [...doc.getElementsByTagName("rtept")];
  const punti = nodi.map((n) => {
    const lat = Number(n.getAttribute("lat"));
    const lon = Number(n.getAttribute("lon"));
    const ele = n.getElementsByTagName("ele")[0];
    const quota = ele ? Number(ele.textContent) : NaN;
    // 5 decimali ≈ 1 metro (come il server): i file hanno spesso 8–9 decimali, e la traccia salvata peserebbe il doppio
    const arrotondato = [Math.round(lat * 1e5) / 1e5, Math.round(lon * 1e5) / 1e5];
    return Number.isFinite(quota) ? [...arrotondato, Math.round(quota)] : arrotondato;
  }).filter(([lat, lon]) => Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180);
  if (punti.length < 2) throw new Error("Nel file non c'è una traccia: servono almeno due punti");
  const nome = doc.getElementsByTagName("name")[0]?.textContent?.trim() || null;
  return { nome, punti };
}

// Salite e discese con una "soglia" (isteresi): la quota del GPS balla di qualche metro anche in piano,
// e sommare ogni ballo gonfierebbe il dislivello. Contiamo un cambio solo quando supera 5 m
// rispetto all'ultima quota "presa per buona" (fa qualcosa di simile anche BRouter, con il suo filtro).
export function saliteDiscese(quote, soglia = 5) {
  const valide = quote.filter((q) => q != null);
  let su = 0, giu = 0;
  let riferimento = valide[0];
  for (const q of valide.slice(1)) {
    const d = q - riferimento;
    if (d >= soglia) { su += d; riferimento = q; } else if (d <= -soglia) { giu -= d; riferimento = q; }
  }
  return { su: Math.round(su), giu: Math.round(giu) };
}

// Meno punti, stessa forma: tiene un punto solo se è ad almeno "metri" dal precedente tenuto
// (sempre il primo, l'ultimo e quello da tenere: il punto più alto). Come semplifica() del server.
export function semplifica(punti, metri, indiceDaTenere = -1) {
  const prep = preparaTraccia(punti);
  const tenuti = [punti[0]];
  let ultimo = 0;
  for (let i = 1; i < punti.length - 1; i++) {
    if (i === indiceDaTenere || prep.cum[i] - prep.cum[ultimo] >= metri) { tenuti.push(punti[i]); ultimo = i; }
  }
  tenuti.push(punti.at(-1));
  return tenuti;
}

// Tutto quello che serve alla mappa: { linea, tappe, anello, dati: { distanza_km, dislivello_m, discesa_m, quote… } }
//   tappe: partenza e arrivo; se la traccia torna alla partenza (anello) partenza e un punto a metà strada
export function preparaImport(punti) {
  const quote = punti.map((p) => p[2] ?? null);
  // minimo, massimo e dove sta il massimo, con un ciclo: Math.max(...lista) con centinaia di migliaia
  // di punti va in errore (passerebbe ogni punto come argomento di una funzione)
  let min = Infinity, max = -Infinity, iAlto = -1;
  quote.forEach((q, i) => {
    if (q == null) return;
    if (q < min) min = q;
    if (q > max) { max = q; iAlto = i; }
  });
  const conQuota = iAlto >= 0;
  // la linea per la mappa: un punto ogni 15 m, e se sono ancora troppi si allarga il passo
  let metri = 15;
  let linea = semplifica(punti, metri, iAlto);
  while (linea.length > LIMITE_PUNTI) { metri *= 1.5; linea = semplifica(punti, metri, iAlto); }
  const prep = preparaTraccia(punti);
  const { su, giu } = saliteDiscese(quote);
  const primo = punti[0], ultimo = punti.at(-1);
  const anello = punti.length > 2 && distanzaM(primo, ultimo) < 50;
  const metà = linea[Math.floor(linea.length / 2)];
  return {
    linea,
    anello,
    tappe: (anello ? [primo, metà] : [primo, ultimo]).map(([lat, lon]) => [lat, lon]),
    dati: {
      distanza_km: Math.round(prep.totale / 100) / 10,
      dislivello_m: conQuota ? su : null,
      discesa_m: conQuota ? giu : null,
      quota_min_m: conQuota ? min : null,
      quota_max_m: conQuota ? max : null,
      punto_piu_alto: iAlto >= 0 ? punti[iAlto].slice(0, 2) : null,
      traccia: linea,
    },
  };
}

function distanzaM(a, b) {
  return preparaTraccia([a, b]).totale;
}
