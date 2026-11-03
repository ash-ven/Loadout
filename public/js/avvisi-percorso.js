// =====================================================================
//  AVVISI SUL PERCORSO – l'elenco sotto la mappa (mappa.js) e nella scheda del viaggio (scheda-viaggio.js),
//  e i colori dei tratti sulla mappa (mappa-base.js, disegnaDifficolta).
//  I dati li calcola il server dai sentieri di OpenStreetMap (api/src/services/percorsi.js, avvisiDalPercorso)
//  e restano nella traccia salvata del viaggio:
//    avvisi_percorso = { copertura: % del percorso con la difficoltà segnata,
//                        avvisi: [{ tipo, metri, tratti: [[da, a], ...] }] }   (da e a: frazioni, 0 = partenza, 1 = arrivo)
//  Scelte di Asiha (3/11): senape = attenzione, rosso = difficile; etichette brevi, la spiegazione nel glossario.
// =====================================================================
const SENAPE = "#c8962b"; // le stesse di --senape e --rosso in style.css (Leaflet vuole il colore scritto, non la variabile CSS)
const ROSSO = "#a3312a";

// Nell'ordine del server: prima i più seri
export const AVVISI = {
  t56:        { testo: "Tratti T5–T6",          grave: true,  glossario: "sac" },
  t4:         { testo: "Tratti T4",             grave: true,  glossario: "sac" },
  attrezzato: { testo: "Tratti attrezzati",     grave: true,  glossario: "avvisi" },
  t3:         { testo: "Tratti T3",             grave: false, glossario: "sac" },
  roccia:     { testo: "Fondo roccioso",        grave: false, glossario: "avvisi" },
  traccia:    { testo: "Traccia poco visibile", grave: false, glossario: "avvisi" },
};
export const coloreAvviso = (tipo) => (AVVISI[tipo]?.grave ? ROSSO : SENAPE);

// 350 → "350 m", 1240 → "1,2 km"
function lunghezza(metri) {
  return metri >= 1000
    ? `${(metri / 1000).toLocaleString("it-IT", { maximumFractionDigits: 1 })} km`
    : `${Math.round(metri)} m`;
}

// Riempie il contenitore con l'elenco degli avvisi della traccia. Restituisce true se c'è qualcosa da mostrare
// (chi chiama decide se nascondere la sezione intorno). Costruito con createElement e textContent: niente innerHTML.
export function mostraAvvisi(contenitore, traccia) {
  if (!contenitore) return false;
  const dati = traccia?.avvisi_percorso;
  const daFile = traccia?.origine === "gpx";
  const paragrafo = (testo) => {
    const p = document.createElement("p");
    p.className = "muto avvisi-nota";
    p.textContent = testo;
    return p;
  };

  if (daFile) {   // una traccia da file GPX non ha le etichette dei sentieri
    contenitore.replaceChildren(paragrafo("La traccia viene da un file GPX: non ha i dati sulla difficoltà dei sentieri."));
    return true;
  }
  if (!dati) {    // nessun percorso, o una mappa salvata prima degli avvisi
    contenitore.replaceChildren();
    return false;
  }

  const parti = [];
  const conosciuti = dati.avvisi.filter((a) => AVVISI[a.tipo]);
  if (conosciuti.length) {
    const elenco = document.createElement("ul");
    elenco.className = "avvisi-percorso-elenco";
    for (const a of conosciuti) {
      const voce = AVVISI[a.tipo];
      const riga = document.createElement("li");
      const pallino = document.createElement("span");
      pallino.className = `pallino-avviso ${voce.grave ? "grave" : "attenzione"}`; // il colore viene dal CSS: la CSP non permette style=""
      pallino.setAttribute("aria-hidden", "true");
      const nome = document.createElement("span");
      nome.textContent = `${voce.testo} · ${lunghezza(a.metri)}`;
      const link = document.createElement("a");
      link.className = "aiuto";
      link.href = `/consigli.html#g-${voce.glossario}`;
      link.textContent = "?";
      link.title = `Cosa vuol dire ${voce.testo.toLowerCase()}?`;
      link.setAttribute("aria-label", link.title);
      riga.append(pallino, nome, " ", link);
      elenco.append(riga);
    }
    parti.push(elenco);
  } else {
    parti.push(paragrafo("Nessun tratto difficile segnato sui sentieri."));
  }
  // Quanto ci si può fidare: i dati di OpenStreetMap non sono completi
  let fiducia = `La difficoltà è segnata per il ${dati.copertura}% del percorso.`;
  if (dati.copertura < 50) fiducia += " Nessun avviso non vuol dire nessun pericolo.";
  parti.push(paragrafo(fiducia));
  contenitore.replaceChildren(...parti);
  return true;
}
