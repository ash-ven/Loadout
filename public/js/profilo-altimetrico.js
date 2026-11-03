// =====================================================================
//  PROFILO ALTIMETRICO: il disegno delle salite e delle discese sotto la mappa (come nelle app di trekking).
//  In orizzontale i km, in verticale la quota. Area colorata dal salvia (in basso) al muschio (in alto),
//  solo con i colori dell'app (le variabili di style.css, usate dalle classi qui sotto),
//  pallini sulle tappe, la vetta in senape, quota più alta e più bassa a sinistra, km totali a destra.
//  Passando il dito o il mouse: km e quota di quel punto, e il punto si accende anche sulla mappa (suPunto).
//  Disegnato a mano in SVG (niente librerie). Le posizioni sono ATTRIBUTI dell'SVG, non style="": la CSP è contenta.
// =====================================================================
import { preparaTraccia, aggancia } from "./navigazione-calcoli.js";

const ALTO = 170;                                  // altezza del disegno in pixel
const SOPRA = 22, SOTTO = 22;                      // spazio per le scritte sopra e sotto
const nf = (n) => Math.round(n).toLocaleString("it-IT", { useGrouping: "always" });
const kmTesto = (m) => `${(m / 1000).toLocaleString("it-IT", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} km`; // un decimale, come il campo Lunghezza

// contenitore: il <div> dove disegnare; riepilogo: il <p> con i numeri sotto; suPunto([lat, lon] | null)
export function attivaProfilo({ contenitore, riepilogo, sezione, suPunto = () => {} }) {
  let dati = null;        // { prep, quote, tappeM, min, max }
  let posizioneM = null;  // in navigazione: i metri fatti (pallino blu sul profilo)

  // Nuova traccia (o nessuna): prepara i numeri e ridisegna
  // kmCampo (facoltativo): i km del campo Lunghezza (calcolati da BRouter). Collaudo 3/11, C2: il profilo mostra
  // gli stessi km del campo; le distanze lungo il grafico si scalano in proporzione (la linea semplificata è un po' più corta)
  let scalaKm = 1;
  function mostra(traccia, kmCampo = null) {
    const linea = traccia?.linea;
    const conQuote = linea?.filter((p) => p[2] != null) ?? [];
    if (!linea || linea.length < 2 || conQuote.length < 2) { dati = null; sezione.hidden = true; return; }
    const prep = preparaTraccia(linea);
    const quote = linea.map((p, i) => p[2] ?? quotaVicina(linea, i));
    // le tappe (le tue puntine) sul profilo: dove cadono lungo la linea
    const tappeM = (traccia.tappe ?? []).map(([lat, lon]) => aggancia(prep, [lat, lon]).metri_fatti);
    dati = { prep, quote, tappeM, min: Math.min(...quote), max: Math.max(...quote) };
    scalaKm = kmCampo > 0 && prep.totale > 0 ? (kmCampo * 1000) / prep.totale : 1;
    sezione.hidden = false;
    disegna();
    scriviRiepilogo();
  }

  function disegna() {
    if (!dati) return;
    const largo = contenitore.clientWidth || 600;
    const { prep, quote, tappeM, min, max } = dati;
    const margine = Math.max(10, (max - min) * 0.08);          // un po' d'aria sopra e sotto la linea
    const qMin = min - margine, qMax = max + margine;
    const x = (m) => (m / prep.totale) * largo;
    const y = (q) => SOPRA + (1 - (q - qMin) / (qMax - qMin)) * (ALTO - SOPRA - SOTTO);
    const punti = prep.cum.map((m, i) => `${x(m).toFixed(1)},${y(quote[i]).toFixed(1)}`);
    const base = ALTO - SOTTO;
    const pallini = tappeM.map((m) => {
      const q = quotaA(m);
      return `<circle cx="${x(m).toFixed(1)}" cy="${y(q).toFixed(1)}" r="5" class="profilo-tappa"/>`;
    }).join("");
    const iMax = quote.indexOf(max);
    contenitore.innerHTML = `
      <svg width="${largo}" height="${ALTO}" viewBox="0 0 ${largo} ${ALTO}" role="img"
           aria-label="Profilo altimetrico: da ${nf(quote[0])} m a ${nf(quote.at(-1))} m, punto più alto ${nf(max)} m, ${kmTesto(prep.totale * scalaKm)}">
        <defs>
          <linearGradient id="profilo-colore" x1="0" y1="${y(max)}" x2="0" y2="${base}" gradientUnits="userSpaceOnUse">
            <stop offset="0" class="profilo-colore-alto"/>
            <stop offset="1" class="profilo-colore-basso"/>
          </linearGradient>
        </defs>
        <line x1="0" y1="${y(max)}" x2="${largo}" y2="${y(max)}" class="profilo-griglia"/>
        <line x1="0" y1="${y(min)}" x2="${largo}" y2="${y(min)}" class="profilo-griglia"/>
        <path d="M0,${base} L${punti.join(" L")} L${largo},${base} Z" fill="url(#profilo-colore)"/>
        <path d="M${punti.join(" L")}" class="profilo-linea"/>
        ${pallini}
        <text x="4" y="${y(max) - 6}" class="profilo-testo">${nf(max)} m</text>
        <text x="4" y="${ALTO - 6}" class="profilo-testo">${nf(min)} m</text>
        <text x="${largo - 4}" y="${ALTO - 6}" text-anchor="end" class="profilo-testo profilo-km">${kmTesto(prep.totale * scalaKm)}</text>
        <circle cx="${x(prep.cum[iMax]).toFixed(1)}" cy="${y(max).toFixed(1)}" r="3.5" class="profilo-vetta"/>
        <g class="profilo-cursore" visibility="hidden">
          <line y1="${SOPRA - 6}" y2="${base}" class="profilo-cursore-linea"/>
          <circle r="5" class="profilo-cursore-punto"/>
          <text y="${SOPRA - 8}" class="profilo-testo profilo-cursore-testo"></text>
        </g>
        <g class="profilo-io" visibility="hidden"><circle r="6" class="profilo-io-punto"/></g>
      </svg>`;
    segnaIo();
  }

  // D+ e D− qui NON li ricalcoliamo: sono già nelle caselle sopra (calcolati da BRouter, che filtra i piccoli saliscendi);
  // ricalcolati dai punti della linea verrebbero un po' diversi, e due numeri diversi confondono
  function scriviRiepilogo() {
    const { quote, min, max } = dati;
    riepilogo.textContent = `Partenza ${nf(quote[0])} m · Arrivo ${nf(quote.at(-1))} m · ` +
      `Punto più alto ${nf(max)} m · Punto più basso ${nf(min)} m`;
  }

  // La quota a una certa distanza dalla partenza (tra due punti: in proporzione)
  function quotaA(metri) {
    const { prep, quote } = dati;
    const i = Math.max(0, prep.cum.findIndex((m) => m >= metri) - 1);
    const tratto = prep.cum[i + 1] - prep.cum[i] || 1;
    const f = Math.min(1, Math.max(0, (metri - prep.cum[i]) / tratto));
    return quote[i] + f * ((quote[i + 1] ?? quote[i]) - quote[i]);
  }
  function puntoA(metri) {
    const { prep } = dati;
    const i = Math.max(0, prep.cum.findIndex((m) => m >= metri) - 1);
    const a = prep.linea[i], b = prep.linea[i + 1] ?? a;
    const f = Math.min(1, Math.max(0, (metri - prep.cum[i]) / ((prep.cum[i + 1] - prep.cum[i]) || 1)));
    return [a[0] + f * (b[0] - a[0]), a[1] + f * (b[1] - a[1])];
  }

  // Dito o mouse sul profilo: cursore con km e quota, e il punto acceso sulla mappa
  contenitore.addEventListener("pointermove", (e) => {
    if (!dati) return;
    const svg = contenitore.querySelector("svg");
    const largo = svg.width.baseVal.value;
    const px = Math.min(largo, Math.max(0, e.clientX - svg.getBoundingClientRect().left));
    const metri = (px / largo) * dati.prep.totale;
    const q = quotaA(metri);
    const { y } = scala(largo);
    const cursore = svg.querySelector(".profilo-cursore");
    cursore.setAttribute("visibility", "visible");
    cursore.querySelector("line").setAttribute("x1", px);
    cursore.querySelector("line").setAttribute("x2", px);
    cursore.querySelector("circle").setAttribute("cx", px);
    cursore.querySelector("circle").setAttribute("cy", y(q));
    const testo = cursore.querySelector("text");
    testo.textContent = `${kmTesto(metri * scalaKm)} · ${nf(q)} m`;
    testo.setAttribute("x", px);
    testo.setAttribute("text-anchor", px < largo * 0.15 ? "start" : px > largo * 0.85 ? "end" : "middle");
    suPunto(puntoA(metri));
  });
  contenitore.addEventListener("pointerleave", () => {
    contenitore.querySelector(".profilo-cursore")?.setAttribute("visibility", "hidden");
    suPunto(null);
  });

  function scala(largo) {
    const { prep, min, max } = dati;
    const margine = Math.max(10, (max - min) * 0.08);
    const qMin = min - margine, qMax = max + margine;
    return { x: (m) => (m / prep.totale) * largo, y: (q) => SOPRA + (1 - (q - qMin) / (qMax - qMin)) * (ALTO - SOPRA - SOTTO) };
  }

  // In navigazione: il pallino blu anche sul profilo
  function segnaIo() {
    const io = contenitore.querySelector(".profilo-io");
    if (!io || !dati) return;
    if (posizioneM == null) { io.setAttribute("visibility", "hidden"); return; }
    const largo = contenitore.querySelector("svg").width.baseVal.value;
    const { x, y } = scala(largo);
    io.setAttribute("visibility", "visible");
    io.querySelector("circle").setAttribute("cx", x(posizioneM));
    io.querySelector("circle").setAttribute("cy", y(quotaA(posizioneM)));
  }

  // Se cambia la larghezza (finestra, telefono girato), si ridisegna
  new ResizeObserver(() => disegna()).observe(contenitore);

  return {
    mostra,
    posizione(metri) { posizioneM = metri; segnaIo(); },
  };
}

// Un punto senza quota (raro): prende quella del punto più vicino che ce l'ha
function quotaVicina(linea, i) {
  for (let d = 1; d < linea.length; d++) {
    if (linea[i - d]?.[2] != null) return linea[i - d][2];
    if (linea[i + d]?.[2] != null) return linea[i + d][2];
  }
  return 0;
}
