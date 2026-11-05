// =====================================================================
//  MAPPA – i pezzi comuni al form (mappa-form.js) e alla pagina della mappa (mappa.js).
//  Presi dalla pagina di prova approvata (prova-mappe-maptiler.html, sezioni 2, 3 e 5).
//  Leaflet (public/vendor/leaflet-1.9.4) arriva come script "classico" e crea la variabile globale L:
//  per questo nella pagina il suo <script> sta PRIMA dei moduli.
// =====================================================================
import { coloreAvviso } from "./avvisi-percorso.js";

const FONTE = '<a href="https://www.maptiler.com/copyright/" target="_blank" rel="noopener">© MapTiler</a> ' +
              '<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© OpenStreetMap</a> · ' +
              'percorsi <a href="https://brouter.de" target="_blank" rel="noopener">BRouter</a>';

// Tessere da 512 pixel: tileSize 512 + zoomOffset -1 → un quarto delle richieste
function sfondo(url, chiave, suErrore) {
  const livello = L.tileLayer(`${url}?key=${encodeURIComponent(chiave)}`, {
    tileSize: 512, zoomOffset: -1, minZoom: 1, maxZoom: 18, attribution: FONTE, crossOrigin: true,
  });
  livello.on("tileerror", suErrore);
  return livello;
}

// La mappa con i quattro sfondi MapTiler e il selettore a "pillole".
// suTessereSbagliate: chiamata una volta se le tessere non arrivano (di solito: chiave sbagliata)
// opzioni (facoltative): altre opzioni di Leaflet (es. la Home: dragging false = la mappa non si sposta, si ingrandisce soltanto);
// toccoUnDito: il messaggio quando sul telefono scorri la mappa con un dito
// sfondoIniziale: con quale sfondo si apre ("Outdoor", "Topo", "Inverno" o "Satellite").
// (Non si chiama "sfondo": è già il nome della funzione qui sopra, e dentro creaMappa la nasconderebbe)
export function creaMappa(elemento, chiave, { centro = [44.1380, 10.5960], zoom = 14, suTessereSbagliate = () => {},
                                              opzioni = {}, toccoUnDito = "Usa due dita per spostare la mappa", sfondoIniziale = "Outdoor" } = {}) {
  let errori = 0;
  const suErrore = () => { errori += 1; if (errori === 3) suTessereSbagliate(); };
  const sfondi = {
    "Outdoor":   sfondo("https://api.maptiler.com/maps/outdoor-v4/{z}/{x}/{y}.png", chiave, suErrore),
    "Topo":      sfondo("https://api.maptiler.com/maps/topo-v4/{z}/{x}/{y}.png", chiave, suErrore),
    "Inverno":   sfondo("https://api.maptiler.com/maps/winter-v2/{z}/{x}/{y}.png", chiave, suErrore),
    "Satellite": sfondo("https://api.maptiler.com/tiles/satellite-v2/{z}/{x}/{y}", chiave, suErrore),
  };
  // A9 (revisione UX 2): sui dispositivi touch (telefono, tablet) un dito fa scorrere la PAGINA, non la mappa:
  // la mappa si sposta e si ingrandisce con due dita (il "pizzico" di Leaflet, touchZoom). Un tocco aggiunge ancora la tappa.
  const touch = window.matchMedia("(pointer: coarse)").matches;
  // 5/11 (accessibilità, WCAG 3.1.2): i pulsanti + e − in italiano (quelli di serie di Leaflet dicono «Zoom in» / «Zoom out»)
  const mappa = L.map(elemento, { dragging: !touch, ...opzioni, zoomControl: false }).setView(centro, zoom);
  if (opzioni.zoomControl !== false) L.control.zoom({ zoomInTitle: "Ingrandisci", zoomOutTitle: "Rimpicciolisci" }).addTo(mappa);
  gestiComodi(elemento, toccoUnDito);
  (sfondi[sfondoIniziale] ?? sfondi["Outdoor"]).addTo(mappa);
  // A8 (revisione UX 2, scelta di Asiha): il selettore degli sfondi parte SEMPRE chiuso (icona a strati),
  // su qualsiasi schermo: aperto copriva un pezzo di mappa e la puntina di partenza. Si apre con un tocco.
  L.control.layers(sfondi, null, { collapsed: true }).addTo(mappa);
  return mappa;
}

// A9 (revisione UX 2): niente zoom o spostamenti per sbaglio mentre scorri la pagina.
// - Rotella SENZA Ctrl sopra la mappa: la fermiamo prima che arrivi a Leaflet (fase di "cattura" sul contenitore),
//   così la pagina scorre normalmente e compare la scritta. Con Ctrl (o ⌘ su Mac) passa a Leaflet, che ingrandisce.
// - Un dito che scorre sulla mappa (non su una puntina): la pagina scorre e ricordiamo che servono due dita.
// (Esiste un componente già fatto, GestureHandling, ma mostra l'avviso anche mentre trascini una puntina.)
function gestiComodi(elemento, toccoUnDito) {
  const avviso = document.createElement("div");
  avviso.className = "avviso-gesti";
  avviso.hidden = true;
  elemento.append(avviso);
  let timer = null;
  const mostra = (testo) => {
    avviso.textContent = testo;
    avviso.hidden = false;
    clearTimeout(timer);
    timer = setTimeout(() => { avviso.hidden = true; }, 1500);
  };
  const tasto = /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘" : "Ctrl";
  elemento.addEventListener("wheel", (e) => {
    if (e.ctrlKey || e.metaKey) return;       // Ctrl + rotella (o il pizzico del touchpad): zoom di Leaflet
    e.stopPropagation();                      // Leaflet non la vede, e senza preventDefault la pagina scorre
    mostra(`Usa ${tasto} + rotella per ingrandire la mappa`);
  }, { capture: true });
  elemento.addEventListener("touchmove", (e) => {
    if (e.touches.length === 1 && !e.target.closest(".leaflet-marker-icon")) mostra(toccoUnDito);
  }, { passive: true });
}

// Le puntine: piccoli SVG dentro un divIcon. Goccia per partenza / arrivo / anello
// (la punta tocca il punto esatto: iconAnchor in basso al centro), pallino per le tappe.
const GOCCIA = "M15 38.5S28 24.5 28 14.5a13 13 0 0 0-26 0C2 24.5 15 38.5 15 38.5Z";
const DISEGNI = {
  partenza: `<path d="${GOCCIA}" fill="#31503f" stroke="#f6efdf" stroke-width="2.5"/><circle cx="15" cy="14.5" r="5" fill="#f6efdf"/>`,
  arrivo:   `<path d="${GOCCIA}" fill="#c8962b" stroke="#f6efdf" stroke-width="2.5"/>` +
            `<path d="M11.5 9v11" stroke="#2b1f05" stroke-width="2" stroke-linecap="round"/><path d="M12.3 9H19l-1.8 2.4L19 13.8h-6.7Z" fill="#2b1f05"/>`,
  anello:   `<path d="${GOCCIA}" fill="#31503f" stroke="#f6efdf" stroke-width="2.5"/><circle cx="15" cy="14.5" r="5.2" fill="none" stroke="#c8962b" stroke-width="3"/>`,
};

export function icona(tipo) {
  if (tipo === "tappa") {
    // 5/11 (accessibilità, WCAG 2.5.8 – prova di Asiha): la zona da toccare è 24×24 px, il cerchio disegnato resta
    // quello di prima (16 px): il viewBox è più grande e il cerchio sta al centro, con un bordo trasparente intorno
    return L.divIcon({ className: "puntina", iconSize: [24, 24], iconAnchor: [12, 12],
      html: '<svg width="24" height="24" viewBox="-4 -4 24 24"><circle cx="8" cy="8" r="5.5" fill="#f6efdf" stroke="#31503f" stroke-width="3"/></svg>' });
  }
  return L.divIcon({ className: "puntina", iconSize: [30, 40], iconAnchor: [15, 39],
    html: `<svg width="30" height="40" viewBox="0 0 30 40">${DISEGNI[tipo]}</svg>` });
}

// Il ruolo della puntina numero i si RICAVA (non si salva): posizione nella lista + interruttore dell'anello
export function tipoDelPunto(i, quanti, anello) {
  if (i === 0) return anello ? "anello" : "partenza";
  if (i === quanti - 1 && !anello) return "arrivo";
  return "tappa";
}

// Il tratto: due linee sovrapposte, come un pennarello con il contorno.
// Sotto una linea lana larga (l'"alone") che stacca il percorso da qualsiasi sfondo, sopra la linea muschio.
// interactive: false → toccare la linea è come toccare la mappa (nel form aggiunge una tappa)
export function disegnaTracciato(livello, punti) {
  const comune = { lineCap: "round", lineJoin: "round", interactive: false };
  L.polyline(punti, { ...comune, color: "#f6efdf", weight: 10, opacity: .92 }).addTo(livello);
  L.polyline(punti, { ...comune, color: "#31503f", weight: 5, opacity: 1 }).addTo(livello);
}

// Il verso di percorrenza: piccole frecce lungo la linea, che puntano verso l'arrivo (nell'anello: il senso del giro).
// Una ogni tanto: la distanza tra due frecce è 1/6 del percorso, ma almeno 300 m e al massimo 1 km.
// La rotazione sta nell'attributo transform dell'SVG (disegno), non in uno style="" (la CSP non lo permetterebbe).
export function disegnaFrecce(livello, linea) {
  if (!linea || linea.length < 2) return;
  const tratti = [];
  let totale = 0;
  for (let i = 0; i < linea.length - 1; i++) {
    const m = metriTra(linea[i], linea[i + 1]);
    tratti.push({ da: linea[i], a: linea[i + 1], inizio: totale, lungo: m });
    totale += m;
  }
  const passo = Math.min(1000, Math.max(300, totale / 6));
  for (let d = passo / 2; d < totale; d += passo) {   // la prima a metà passo: non sopra la puntina di partenza
    const t = tratti.find((x) => d <= x.inizio + x.lungo) ?? tratti.at(-1);
    const f = t.lungo ? (d - t.inizio) / t.lungo : 0;
    const punto = [t.da[0] + (t.a[0] - t.da[0]) * f, t.da[1] + (t.a[1] - t.da[1]) * f];
    L.marker(punto, { icon: iconaFreccia(direzione(t.da, t.a)), interactive: false, keyboard: false }).addTo(livello);
  }
}

// La direzione da un punto all'altro in gradi, 0 = nord, 90 = est (la longitudine "pesa" meno andando verso nord)
function direzione([lat1, lon1], [lat2, lon2]) {
  const x = (lon2 - lon1) * Math.cos((lat1 * Math.PI) / 180);
  const y = lat2 - lat1;
  return (Math.atan2(x, y) * 180) / Math.PI;
}

function iconaFreccia(gradi) {
  return L.divIcon({ className: "freccia-verso", iconSize: [16, 16], iconAnchor: [8, 8],
    html: `<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><g transform="rotate(${gradi.toFixed(0)} 8 8)">` +
          '<path d="M8 2.5 13 12.5 8 10 3 12.5Z" fill="#f6efdf" stroke="#31503f" stroke-width="1.6" stroke-linejoin="round"/></g></svg>' });
}

// B11 (revisione UX 2): se la puntina è lontana dall'inizio (o dalla fine) del sentiero, una linea tratteggiata sottile
// le collega, così si vede che partenza e arrivo fanno parte del percorso. giro = i punti [lat, lon] toccati, linea = la traccia
export function disegnaCollegamenti(livello, giro, linea) {
  if (!giro.length || !linea?.length) return;
  const coppie = [[giro[0], linea[0]], [giro.at(-1), linea.at(-1)]];
  for (const [puntina, sentiero] of coppie) {
    if (metriTra(puntina, sentiero) > 30) {
      L.polyline([puntina, sentiero.slice(0, 2)], { color: "#6d6553", weight: 2, dashArray: "4 6", opacity: .9, interactive: false }).addTo(livello);
    }
  }
}

// Avvisi sul percorso: i tratti difficili colorati SOPRA la linea verde (senape = attenzione, rosso = difficile).
// Il server li dà come frazioni del percorso (0 = partenza, 1 = arrivo): qui le trasformiamo in metri lungo la linea
// e ritagliamo i pezzi. Così funziona anche con la linea semplificata (meno punti di quella di BRouter).
export function disegnaDifficolta(livello, linea, avvisiPercorso) {
  if (!avvisiPercorso?.avvisi?.length || !linea || linea.length < 2) return;
  const cumulati = [0];                       // cumulati[i] = metri dalla partenza al punto i
  for (let i = 1; i < linea.length; i++) cumulati.push(cumulati[i - 1] + metriTra(linea[i - 1], linea[i]));
  const totale = cumulati.at(-1);
  if (!totale) return;
  // Il punto che sta a "m" metri dalla partenza (a metà strada tra due punti della linea, se serve)
  const puntoA = (m) => {
    let i = 1;
    while (i < linea.length - 1 && cumulati[i] < m) i++;
    const lungo = cumulati[i] - cumulati[i - 1];
    const f = lungo ? (m - cumulati[i - 1]) / lungo : 0;
    return [linea[i - 1][0] + (linea[i][0] - linea[i - 1][0]) * f, linea[i - 1][1] + (linea[i][1] - linea[i - 1][1]) * f];
  };
  // Dal meno serio al più serio: dove due avvisi si sovrappongono, il rosso resta sopra il senape
  for (const avviso of [...avvisiPercorso.avvisi].reverse()) {
    for (const [da, a] of avviso.tratti) {
      const mDa = da * totale, mA = a * totale;
      const dentro = linea.filter((_, i) => cumulati[i] > mDa && cumulati[i] < mA).map(([lat, lon]) => [lat, lon]);
      L.polyline([puntoA(mDa), ...dentro, puntoA(mA)], { color: coloreAvviso(avviso.tipo), weight: 5, opacity: 1,
        lineCap: "round", lineJoin: "round", interactive: false }).addTo(livello);
    }
  }
}

// Linea provvisoria mentre BRouter risponde: puntini senape (si capisce che è "in attesa")
export function disegnaProvvisoria(livello, punti) {
  L.polyline(punti, { color: "#c8962b", weight: 4, dashArray: "1 9", lineCap: "round", opacity: .95, interactive: false }).addTo(livello);
}

// Distanza approssimata in metri tra due punti [lat, lon] (basta per dire "vicini o no")
export function metriTra([lat1, lon1], [lat2, lon2]) {
  const x = (lon2 - lon1) * 111_320 * Math.cos((lat1 * Math.PI) / 180);
  const y = (lat2 - lat1) * 110_540;
  return Math.hypot(x, y);
}

// L'anello non si salva: si ricava dalla traccia. È un anello se la linea torna alla partenza
// e l'ultima tappa NON è sulla partenza (altrimenti è un percorso normale che finisce dove è iniziato).
export function eUnAnello(traccia) {
  const { tappe, linea } = traccia;
  return tappe.length >= 2 && metriTra(linea[0], linea.at(-1)) < 50 && metriTra(tappe[0], tappe.at(-1)) >= 50;
}

// Scrive la riga di stato: "" (normale), "attesa" (pallino che pulsa), "errore" (riquadro ocra)
export function scriviStato(el, testo, tipo = "") {
  el.textContent = testo;
  el.hidden = testo === "";
  el.className = "stato" + (tipo ? " " + tipo : "");
}
