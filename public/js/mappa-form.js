// =====================================================================
//  MAPPA NEL FORM DELL'USCITA (fase 5) – facoltativa, dentro «Percorso».
//  La logica è quella della pagina di prova (sezioni 4–7), con due differenze:
//  - il percorso lo chiede il NOSTRO server (/api/percorso), che a sua volta chiama BRouter;
//  - la mappa scrive nei campi veri del form (km, dislivello positivo, quote, coordinate) con il post-it.
//  Lezione di giovedì: Leaflet misura il contenitore quando nasce, e dentro un <dialog> o un <details>
//  chiuso misura zero. Per questo la mappa nasce solo quando apri «Percorso» (apri()).
// =====================================================================
import { api } from "./api.js";
import { proponi } from "./post-it.js";
import { creaMappa, icona, tipoDelPunto, disegnaTracciato, disegnaProvvisoria, eUnAnello, scriviStato } from "./mappa-base.js";

const arrotonda = (n) => Math.round(n * 1e5) / 1e5; // 5 decimali ≈ 1 metro

export function attivaMappaForm({ contenitore, conteggio, stato, interruttoreAnello, bottoneTogli, bottoneRicomincia, campi, coordinate }) {
  let mappa = null;            // nasce alla prima apertura di «Percorso»
  let livelloPercorso = null;  // le linee: si svuota e si ridisegna
  let punti = [];              // le puntine (L.marker trascinabili), nell'ordine in cui le hai messe
  let linea = null;            // la traccia dell'ultimo percorso calcolato: [[lat, lon, quota], ...]
  let daRipristinare = null;   // in modifica: la traccia salvata, da rimettere quando la mappa nasce
  let centro = null;           // dove aprire la mappa (il luogo scelto, o la partenza)
  let ultimaRichiesta = 0;     // se tocchi in fretta partono più richieste: vale solo la risposta dell'ultima

  // --- La mappa nasce (una volta sola), poi a ogni apertura si rimisura ---
  async function apri() {
    if (mappa) { requestAnimationFrame(() => mappa.invalidateSize()); return; }
    let chiave;
    try {
      ({ chiave } = await api("/api/mappe/config"));
    } catch (err) {
      scriviStato(stato, `${err.message}. Puoi scrivere i dati del percorso a mano.`, "errore");
      return;
    }
    if (mappa) return; // due aperture veloci: la mappa è già nata con la prima
    mappa = creaMappa(contenitore, chiave, {
      centro: centro ?? undefined,
      suTessereSbagliate: () => scriviStato(stato, "Le tessere della mappa non arrivano: controlla la chiave MapTiler nel file .env.", "errore"),
    });
    livelloPercorso = L.layerGroup().addTo(mappa);
    // Toccare la mappa aggiunge un punto (toccare una puntina no: Leaflet non lo passa alla mappa)
    mappa.on("click", (e) => {
      punti.push(nuovaPuntina(e.latlng));
      ridisegna();
    });
    if (daRipristinare) ripristina(daRipristinare);
    else scriviStato(stato, "Tocca la mappa per mettere la partenza.");
    requestAnimationFrame(() => mappa.invalidateSize());
  }

  function nuovaPuntina(latlng) {
    const puntina = L.marker(latlng, { draggable: true, icon: icona("tappa"), riseOnHover: true }).addTo(mappa);
    puntina.on("dragend", ridisegna); // spostare un punto ricalcola il percorso
    return puntina;
  }

  // I punti del giro: con l'anello, in fondo si aggiunge di nuovo la partenza
  function puntiDelGiro() {
    const posizioni = punti.map((p) => p.getLatLng());
    if (interruttoreAnello.checked && posizioni.length >= 2) posizioni.push(posizioni[0]);
    return posizioni;
  }

  // Stato → disegno: icone, conteggio, coordinate, percorso
  function ridisegna() {
    punti.forEach((p, i) => p.setIcon(icona(tipoDelPunto(i, punti.length, interruttoreAnello.checked))));
    aggiornaConteggio();
    aggiornaCoordinate();
    calcolaPercorso();
  }

  // "Partenza + 2 tappe" sopra la mappa; pillola ocra quando è un anello
  function aggiornaConteggio() {
    const n = punti.length;
    const tappe = interruttoreAnello.checked ? n - 1 : n - 2;
    let testo = "Nessun punto";
    if (n === 1) testo = "Solo la partenza";
    else if (n >= 2) testo = tappe > 0 ? `Partenza + ${tappe} ${tappe === 1 ? "tappa" : "tappe"}` : "Partenza e arrivo";
    if (n >= 2 && interruttoreAnello.checked) testo = "Anello · " + testo.toLowerCase();
    conteggio.textContent = testo;
    conteggio.classList.toggle("in-evidenza", n >= 2 && interruttoreAnello.checked);
  }

  // Le coordinate di partenza e arrivo le propone la mappa (post-it "mappa"): con l'anello, arrivo = partenza.
  // Il NOME del luogo non si tocca mai: se sposti di poco la partenza, resta quello che hai scelto.
  function aggiornaCoordinate() {
    const giro = puntiDelGiro();
    const partenza = giro[0];
    const arrivo = giro.length >= 2 ? giro.at(-1) : null;
    proponi(coordinate.latPartenza, partenza ? arrotonda(partenza.lat) : null, "mappa");
    proponi(coordinate.lonPartenza, partenza ? arrotonda(partenza.lng) : null, "mappa");
    proponi(coordinate.latArrivo, arrivo ? arrotonda(arrivo.lat) : null, "mappa");
    proponi(coordinate.lonArrivo, arrivo ? arrotonda(arrivo.lng) : null, "mappa");
  }

  // Il percorso sui sentieri: lo chiede il nostro server (/api/percorso → BRouter)
  async function calcolaPercorso() {
    const giro = puntiDelGiro();
    livelloPercorso.clearLayers();
    linea = null;
    if (giro.length < 2) {
      ultimaRichiesta++;            // un'eventuale risposta in arrivo non serve più
      compilaDati(null);            // niente percorso: i valori della mappa si svuotano (i tuoi restano)
      scriviStato(stato, punti.length === 0 ? "Tocca la mappa per mettere la partenza." : "Ora tocca la prossima tappa (o l'arrivo).");
      return;
    }

    disegnaProvvisoria(livelloPercorso, giro);
    scriviStato(stato, "Cerco il percorso sui sentieri…", "attesa");
    const numero = ++ultimaRichiesta;
    const parametro = giro.map((p) => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`).join(";");

    try {
      const dati = await api(`/api/percorso?punti=${parametro}`);
      if (numero !== ultimaRichiesta) return;           // nel frattempo è partita una richiesta più nuova
      livelloPercorso.clearLayers();
      disegnaTracciato(livelloPercorso, dati.traccia.map(([lat, lon]) => [lat, lon]));
      linea = dati.traccia;
      compilaDati(dati);
      scriviStato(stato, "");
    } catch (err) {
      if (numero !== ultimaRichiesta) return;
      // 404: un punto lontano dai sentieri; 502: BRouter non risponde. Il messaggio in italiano arriva dal server
      scriviStato(stato, `${err.message}. Resta la linea provvisoria: puoi scrivere i dati a mano.`, "errore");
    }
  }

  // I quattro valori del percorso nei campi veri del form, con il post-it "mappa"
  function compilaDati(dati) {
    proponi(campi.km, dati ? dati.distanza_km : null, "mappa");
    proponi(campi.dislivello, dati ? dati.dislivello_m : null, "mappa");
    proponi(campi.quotaMax, dati?.quota_max_m ?? null, "mappa");
    proponi(campi.quotaMin, dati?.quota_min_m ?? null, "mappa");
  }

  // In modifica: rimette puntine e traccia salvate SENZA richiedere il percorso (i campi sono già compilati)
  function ripristina(traccia) {
    daRipristinare = null;
    interruttoreAnello.checked = eUnAnello(traccia);
    punti = traccia.tappe.map(([lat, lon]) => nuovaPuntina(L.latLng(lat, lon)));
    punti.forEach((p, i) => p.setIcon(icona(tipoDelPunto(i, punti.length, interruttoreAnello.checked))));
    linea = traccia.linea;
    disegnaTracciato(livelloPercorso, linea.map(([lat, lon]) => [lat, lon]));
    aggiornaConteggio();
    mappa.fitBounds(L.latLngBounds(linea.map(([lat, lon]) => [lat, lon])), { padding: [30, 30] });
    scriviStato(stato, "");
  }

  // --- Pulsanti ---
  interruttoreAnello.addEventListener("change", () => { if (mappa) ridisegna(); else aggiornaConteggio(); });
  bottoneTogli.addEventListener("click", () => {
    const ultimo = punti.pop();
    if (ultimo) mappa.removeLayer(ultimo);
    if (mappa) ridisegna();
  });
  bottoneRicomincia.addEventListener("click", () => {
    punti.forEach((p) => mappa.removeLayer(p));
    punti = [];
    if (mappa) ridisegna();
  });

  return {
    apri,
    // Scegliendo un luogo la mappa si centra lì (le puntine non si spostano)
    centra(lat, lon) {
      centro = [lat, lon];
      if (mappa) mappa.setView(centro, 14);
    },
    // Nuovo viaggio: mappa vuota
    svuota() {
      ultimaRichiesta++;
      punti.forEach((p) => mappa?.removeLayer(p));
      punti = [];
      linea = null;
      daRipristinare = null;
      centro = null;
      livelloPercorso?.clearLayers();
      interruttoreAnello.checked = false;
      aggiornaConteggio();
      scriviStato(stato, mappa ? "Tocca la mappa per mettere la partenza." : "");
    },
    // Modifica: la traccia salvata del viaggio (se c'è)
    carica(viaggio) {
      this.svuota();
      if (viaggio.lat_partenza != null && viaggio.lon_partenza != null) centro = [viaggio.lat_partenza, viaggio.lon_partenza];
      if (!viaggio.traccia?.tappe?.length || !viaggio.traccia?.linea?.length) return;
      if (mappa) ripristina(viaggio.traccia);
      else {
        daRipristinare = viaggio.traccia;
        interruttoreAnello.checked = eUnAnello(viaggio.traccia);
        punti = []; // le puntine nascono con la mappa
        conteggio.textContent = `Percorso salvato (${viaggio.traccia.tappe.length} punti)`;
      }
    },
    // Quello da salvare nel viaggio: { tappe, linea } oppure null (niente percorso calcolato)
    traccia() {
      if (daRipristinare) return daRipristinare;           // la mappa non è mai stata aperta: resta quella salvata
      if (punti.length < 2 || !linea) return null;
      return { tappe: punti.map((p) => [arrotonda(p.getLatLng().lat), arrotonda(p.getLatLng().lng)]), linea };
    },
  };
}
