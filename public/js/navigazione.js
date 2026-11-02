// =====================================================================
//  NAVIGAZIONE CON IL GPS (pagina della mappa del viaggio), "stile Komoot":
//  - il pallino blu della tua posizione, con il cerchio di precisione e la direzione;
//  - la mappa ti segue (finché non la sposti tu: allora compare «Centra su di me»);
//  - km fatti e mancanti, salita restante, ora di arrivo stimata;
//  - avviso (e vibrazione, dove il telefono la permette) se esci dal percorso;
//  - schermo sempre acceso mentre navighi (Wake Lock).
//  PRIVACY: la posizione resta nel browser. Non viene mai mandata al server.
// =====================================================================
import { preparaTraccia, aggancia, riepilogo, fuoriPercorso } from "./navigazione-calcoli.js";

const km = (metri) => `${(metri / 1000).toLocaleString("it-IT", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} km`;
const metri = (m) => `${Math.round(m).toLocaleString("it-IT", { useGrouping: "always" })} m`;
const orario = (data) => data.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });

// Il pallino "sei qui": senape con il bordo crema, i colori dell'app (scelta di Asiha: niente blu),
// ben visibile sopra la linea muschio del percorso; con una punta se il GPS sa dove vai
function iconaPosizione(direzione) {
  const punta = direzione == null ? "" : `<g transform="rotate(${Math.round(direzione)} 14 14)"><path d="M14 1.5 19 9H9Z" fill="#a97b1c"/></g>`;
  return L.divIcon({ className: "posizione-gps", iconSize: [28, 28], iconAnchor: [14, 14],
    html: `<svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true">${punta}<circle cx="14" cy="14" r="7.5" fill="#c8962b" stroke="#f6efdf" stroke-width="3"/></svg>` });
}

// el = gli elementi della pagina; ottieniMappa() e ottieniLinea() li dà la pagina; blocca(sì/no) ferma le modifiche
// suProgresso(metri | null): i metri fatti a ogni posizione (la pagina li segna sul profilo altimetrico)
export function attivaNavigazione({ el, ottieniMappa, ottieniLinea, blocca, suProgresso = () => {} }) {
  let osservatore = null;     // l'id di watchPosition (per fermarlo)
  let prep = null;            // la traccia preparata (lunghezze e salite accumulate)
  let precedente = null;      // metri fatti all'ultimo aggiornamento (vedi aggancia)
  let segui = true;           // la mappa ti segue?
  let pallino = null, cerchio = null;
  let schermoAcceso = null;   // il "Wake Lock"
  let fuori = false;          // ultimo stato "fuori percorso" (per vibrare una volta sola quando esci)
  let primaPosizione = true;

  async function inizia() {
    const linea = ottieniLinea();
    el.erroreAvvio.hidden = true;
    const problema = !linea || linea.length < 2 ? "Prima disegna il percorso sulla mappa: serve una traccia da seguire."
      : !("geolocation" in navigator) ? "Questo browser non sa leggere la posizione."
      : !window.isSecureContext ? "Il GPS funziona solo su https:// (o su localhost)."
      : null;
    if (problema) {
      el.erroreAvvio.textContent = problema;
      el.erroreAvvio.hidden = false;
      return;
    }
    prep = preparaTraccia(linea);
    precedente = null;
    segui = true;
    primaPosizione = true;
    fuori = false;
    blocca(true);
    document.body.classList.add("in-navigazione");
    el.pannello.hidden = false;
    el.bottone.hidden = true;
    el.centra.hidden = true;
    el.fuori.hidden = true;
    scrivi("Cerco il segnale GPS…", "attesa");
    requestAnimationFrame(() => ottieniMappa().invalidateSize()); // la mappa è diventata più alta: Leaflet la rimisura
    osservatore = navigator.geolocation.watchPosition(suPosizione, suErrore,
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 30000 }); // il GPS vero, non la posizione dal Wi-Fi
    await accendiSchermo();
  }

  function termina() {
    if (osservatore != null) navigator.geolocation.clearWatch(osservatore);
    osservatore = null;
    pallino?.remove(); cerchio?.remove();
    pallino = cerchio = null;
    schermoAcceso?.release().catch(() => {});
    schermoAcceso = null;
    blocca(false);
    suProgresso(null);
    document.body.classList.remove("in-navigazione");
    el.pannello.hidden = true;
    el.bottone.hidden = false;
    requestAnimationFrame(() => ottieniMappa().invalidateSize());
  }

  // Ogni volta che il GPS ha una posizione nuova
  function suPosizione(pos) {
    const { latitude: lat, longitude: lon, accuracy, heading, speed } = pos.coords;
    const mappa = ottieniMappa();
    const qui = [lat, lon];
    const direzione = speed > 0.3 && Number.isFinite(heading) ? heading : null; // da fermi la direzione non è affidabile
    if (!pallino) {
      cerchio = L.circle(qui, { radius: accuracy, color: "#c8962b", weight: 1, fillOpacity: 0.15, interactive: false }).addTo(mappa);
      pallino = L.marker(qui, { icon: iconaPosizione(direzione), interactive: false, keyboard: false, zIndexOffset: 1000 }).addTo(mappa);
    } else {
      cerchio.setLatLng(qui).setRadius(accuracy);
      pallino.setLatLng(qui).setIcon(iconaPosizione(direzione));
    }
    if (segui) {
      if (primaPosizione) mappa.setView(qui, Math.max(mappa.getZoom(), 15));
      else mappa.panTo(qui);
    }
    primaPosizione = false;

    const agganciata = aggancia(prep, qui, precedente);
    precedente = agganciata.metri_fatti;
    suProgresso(agganciata.metri_fatti);
    const r = riepilogo(prep, agganciata);
    el.fatti.textContent = km(r.metri_fatti);
    el.mancano.textContent = km(r.metri_mancanti);
    el.salita.textContent = metri(r.salita_restante_m);
    el.arrivo.textContent = r.metri_mancanti < 30 ? "ci sei!" : orario(new Date(Date.now() + r.ore_restanti * 3_600_000));

    const oraFuori = fuoriPercorso(agganciata.distanza_m, accuracy);
    el.fuori.hidden = !oraFuori;
    if (oraFuori) el.testoFuori.textContent = `Sei fuori percorso: la traccia è a circa ${metri(agganciata.distanza_m)}.`;
    if (oraFuori && !fuori) navigator.vibrate?.([200, 100, 200]); // vibra quando esci (Android; l'iPhone non lo permette)
    fuori = oraFuori;
    scrivi(`GPS preciso a ±${metri(accuracy)}`);
  }

  function suErrore(err) {
    // 1 = permesso negato, 2 = posizione non disponibile, 3 = troppo tempo
    const testi = {
      1: "Non hai dato il permesso di usare la posizione: puoi darlo dall'icona accanto all'indirizzo del sito.",
      2: "Posizione non disponibile: prova all'aperto, lontano dagli edifici.",
      3: "Il GPS non risponde: prova all'aperto, ci vuole qualche secondo.",
    };
    scrivi(testi[err.code] ?? err.message, "errore");
  }

  // Schermo sempre acceso (dove il browser lo permette). Se cambi app e torni, lo riaccendiamo
  async function accendiSchermo() {
    try { schermoAcceso = await navigator.wakeLock?.request("screen"); } catch { schermoAcceso = null; }
  }
  document.addEventListener("visibilitychange", () => {
    if (osservatore != null && document.visibilityState === "visible") accendiSchermo();
  });

  function scrivi(testo, tipo = "") {
    el.stato.textContent = testo;
    el.stato.dataset.tipo = tipo;
  }

  el.bottone.addEventListener("click", inizia);
  el.termina.addEventListener("click", termina);
  el.centra.addEventListener("click", () => {
    segui = true;
    el.centra.hidden = true;
    if (pallino) ottieniMappa().panTo(pallino.getLatLng());
  });
  // Se sposti tu la mappa, smette di seguirti (se no ti riporterebbe indietro a ogni passo)
  return {
    collegaMappa(mappa) {
      mappa.on("dragstart", () => {
        if (osservatore == null) return;
        segui = false;
        el.centra.hidden = false;
      });
    },
  };
}
