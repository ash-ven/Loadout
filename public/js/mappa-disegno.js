// =====================================================================
//  DISEGNO DEL PERCORSO SULLA MAPPA (fase 5) – lo usa la pagina della mappa (mappa.js).
//  La logica è quella della pagina di prova (sezioni 4–7), con due differenze:
//  - il percorso lo chiede il NOSTRO server (/api/percorso), che a sua volta chiama BRouter;
//  - la mappa scrive nei campi veri della pagina (km, dislivello positivo, quote, coordinate) con il post-it.
//  Lezione di giovedì: Leaflet misura il contenitore quando nasce: la mappa nasce con apri(),
//  quando il contenitore è già visibile.
// =====================================================================
import { api } from "./api.js";
import { proponi } from "./post-it.js";
import { creaMappa, icona, tipoDelPunto, disegnaTracciato, disegnaProvvisoria, disegnaCollegamenti, disegnaFrecce, eUnAnello, scriviStato } from "./mappa-base.js";

const arrotonda = (n) => Math.round(n * 1e5) / 1e5; // 5 decimali ≈ 1 metro

// suModifica: chiamata ogni volta che il percorso cambia (la pagina la usa per "modifiche non salvate")
// suCalcolo(dati): chiamata con i valori calcolati dalla mappa ({ distanza_km, dislivello_m, quota_min_m, quota_max_m })
//                  oppure con null quando non c'è un percorso (A2: la pagina li mostra sotto i valori scritti a mano)
// legenda e notaAnello (B11, facoltativi): la legenda mostra solo quello che c'è, la nota spiega l'anello con una sola tappa
// sceltaProfilo (facoltativo): il gruppo di pulsanti «Sentieri / Più breve» (data-profilo="sentieri" | "breve")
export function attivaDisegnoMappa({ contenitore, conteggio, stato, interruttoreAnello, bottoneTogli, bottoneRicomincia, campi, coordinate,
                                     legenda = null, notaAnello = null, sceltaProfilo = null, suModifica = () => {}, suCalcolo = () => {} }) {
  let mappa = null;            // nasce con apri()
  let livelloPercorso = null;  // le linee: si svuota e si ridisegna
  let punti = [];              // le puntine (L.marker trascinabili), nell'ordine in cui le hai messe
  let linea = null;            // la traccia dell'ultimo percorso calcolato: [[lat, lon, quota], ...]
  let discesa = null;          // il dislivello negativo dell'ultimo percorso calcolato (metri), o null
  let profilo = "sentieri";    // come chiedere il percorso: "sentieri" (preferisce i sentieri) o "breve" (il più corto)
  let attivita = null;         // l'attività del viaggio: con ferrata e alpinismo il server accetta i passaggi difficili
  let bloccata = false;        // durante la navigazione col GPS la mappa non si modifica (niente tappe nuove, puntine ferme)
  let daRipristinare = null;   // in modifica: la traccia salvata, da rimettere quando la mappa nasce
  let centro = null;           // dove aprire la mappa (il luogo scelto, o la partenza)
  let ultimaRichiesta = 0;     // se tocchi in fretta partono più richieste: vale solo la risposta dell'ultima

  // --- La mappa nasce (una volta sola); chiamandola di nuovo si rimisura ---
  async function apri() {
    if (mappa) { requestAnimationFrame(() => mappa.invalidateSize()); return; }
    let chiave;
    try {
      ({ chiave } = await api("/api/mappe/config"));
    } catch (err) {
      scriviStato(stato, `${err.message}. Puoi scrivere i dati del percorso a mano.`, "errore");
      return false;
    }
    if (mappa) return true; // due chiamate veloci: la mappa è già nata con la prima
    mappa = creaMappa(contenitore, chiave, {
      centro: centro ?? undefined,
      suTessereSbagliate: () => scriviStato(stato, "Le tessere della mappa non arrivano: controlla la chiave MapTiler nel file .env.", "errore"),
    });
    livelloPercorso = L.layerGroup().addTo(mappa);
    // A8: il selettore degli sfondi è chiuso; aperto, si richiude toccando la mappa (o uscendo col mouse).
    // Quel tocco serve solo a richiuderlo, non deve mettere una tappa. Controllo finale: Leaflet a volte lo chiude
    // un attimo PRIMA che arrivi il tocco, quindi non basta guardare se è aperto: ricordiamo QUANDO si è chiuso
    // (un MutationObserver guarda la sua classe) e ignoriamo i tocchi arrivati entro mezzo secondo.
    const selettore = contenitore.querySelector(".leaflet-control-layers");
    let apertoFinoA = 0; // l'ultimo momento in cui il selettore era aperto (millisecondi)
    const segnaSeAperto = () => {
      if (selettore.classList.contains("leaflet-control-layers-expanded")) apertoFinoA = Infinity;
      else if (apertoFinoA === Infinity) apertoFinoA = Date.now(); // si è appena chiuso
    };
    new MutationObserver(segnaSeAperto).observe(selettore, { attributes: true, attributeFilter: ["class"] });
    // Toccare la mappa aggiunge un punto (toccare una puntina no: Leaflet non lo passa alla mappa)
    mappa.on("click", (e) => {
      if (bloccata) return; // in navigazione un tocco non aggiunge tappe
      if (Date.now() - apertoFinoA < 500) return; // tocco per chiudere il selettore: niente tappa
      punti.push(nuovaPuntina(e.latlng));
      ridisegna();
    });
    if (daRipristinare) ripristina(daRipristinare);
    else if (leggiCoppia(coordinate.latPartenza, coordinate.lonPartenza)) {
      // C'è già la partenza (dal luogo o scritta a mano): la puntina nasce lì, e tu tocchi subito le tappe.
      // Non è una modifica da salvare (niente suModifica): la mostriamo e basta.
      punti.push(nuovaPuntina(leggiCoppia(coordinate.latPartenza, coordinate.lonPartenza)));
      punti[0].setIcon(icona(tipoDelPunto(0, 1, interruttoreAnello.checked)));
      aggiornaConteggio();
      scriviStato(stato, "Ora tocca la prossima tappa (o l'arrivo).");
    } else scriviStato(stato, "Tocca la mappa per mettere la partenza.");
    requestAnimationFrame(() => mappa.invalidateSize());
    return true;
  }

  function nuovaPuntina(latlng) {
    const puntina = L.marker(latlng, { draggable: true, icon: icona("tappa"), riseOnHover: true }).addTo(mappa);
    puntina.on("dragend", ridisegna); // spostare un punto ricalcola il percorso
    return puntina;
  }

  // Una coppia di campi lat/lon → un punto di Leaflet, oppure null se i numeri mancano o sono fuori dal mondo
  function leggiCoppia(campoLat, campoLon) {
    if (campoLat.value === "" || campoLon.value === "") return null;
    const lat = Number(campoLat.value);
    const lon = Number(campoLon.value);
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
    return L.latLng(lat, lon);
  }

  // Coordinate scritte a mano nei campi sotto la mappa → la puntina nasce o si sposta lì (e il percorso si ricalcola).
  // È la strada inversa del post-it: lì la mappa scrive nei campi, qui i campi muovono la mappa.
  function daCoordinate(quale) {
    if (!mappa) return;
    let punto;
    if (quale === "partenza") {
      punto = leggiCoppia(coordinate.latPartenza, coordinate.lonPartenza);
      if (!punto) return;
      if (punti.length) punti[0].setLatLng(punto);
      else punti.push(nuovaPuntina(punto));
    } else {
      if (interruttoreAnello.checked) return;              // con l'anello l'arrivo è la partenza
      punto = leggiCoppia(coordinate.latArrivo, coordinate.lonArrivo);
      if (!punto || punti.length === 0) return;             // senza partenza l'arrivo non si mette
      if (punti.length >= 2) punti.at(-1).setLatLng(punto);
      else punti.push(nuovaPuntina(punto));
    }
    if (!mappa.getBounds().contains(punto)) mappa.panTo(punto); // se il punto è fuori dalla vista, la mappa ci va
    ridisegna();
  }
  // "change" = quando hai finito di scrivere (uscendo dal campo o con Invio), non a ogni tasto
  coordinate.latPartenza.addEventListener("change", () => daCoordinate("partenza"));
  coordinate.lonPartenza.addEventListener("change", () => daCoordinate("partenza"));
  coordinate.latArrivo.addEventListener("change", () => daCoordinate("arrivo"));
  coordinate.lonArrivo.addEventListener("change", () => daCoordinate("arrivo"));

  // I punti del giro: con l'anello, in fondo si aggiunge di nuovo la partenza
  function puntiDelGiro() {
    const posizioni = punti.map((p) => p.getLatLng());
    if (interruttoreAnello.checked && posizioni.length >= 2) posizioni.push(posizioni[0]);
    return posizioni;
  }

  // Stato → disegno: icone, conteggio, coordinate, percorso
  function ridisegna() {
    suModifica();
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
    // B11: con l'anello e una sola tappa si torna dalla stessa strada: è un'andata e ritorno, non un anello
    const andataRitorno = interruttoreAnello.checked && n === 2;
    if (n >= 2 && interruttoreAnello.checked) testo = (andataRitorno ? "Andata e ritorno · " : "Anello · ") + testo.toLowerCase();
    conteggio.textContent = testo;
    conteggio.classList.toggle("in-evidenza", n >= 2 && interruttoreAnello.checked);
    if (notaAnello) notaAnello.hidden = !andataRitorno;
    aggiornaLegenda();
  }

  // B11: la legenda mostra solo i tipi di puntina presenti (e "Sui sentieri" se c'è il percorso). Senza punti, tutto: fa da guida
  function aggiornaLegenda() {
    if (!legenda) return;
    const presenti = new Set(punti.map((p, i) => tipoDelPunto(i, punti.length, interruttoreAnello.checked)));
    if (linea) { presenti.add("sentieri"); presenti.add("verso"); }
    legenda.querySelectorAll("[data-tipo]").forEach((voce) => {
      voce.hidden = punti.length === 0 ? voce.dataset.tipo === "anello" : !presenti.has(voce.dataset.tipo);
    });
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
    discesa = null;
    if (giro.length < 2) {
      ultimaRichiesta++;            // un'eventuale risposta in arrivo non serve più
      compilaDati(null);            // niente percorso: i valori della mappa si svuotano (i tuoi restano)
      scriviStato(stato, punti.length === 0 ? "Tocca la mappa per mettere la partenza." : "Ora tocca la prossima tappa (o l'arrivo).");
      return;
    }

    disegnaProvvisoria(livelloPercorso, giro);
    scriviStato(stato, profilo === "breve" ? "Cerco il percorso più breve…" : "Cerco il percorso sui sentieri…", "attesa");
    const numero = ++ultimaRichiesta;
    const parametro = giro.map((p) => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`).join(";");

    try {
      const conAttivita = attivita ? `&attivita=${encodeURIComponent(attivita)}` : "";
      const dati = await api(`/api/percorso?punti=${parametro}&profilo=${profilo}${conAttivita}`);
      if (numero !== ultimaRichiesta) return;           // nel frattempo è partita una richiesta più nuova
      livelloPercorso.clearLayers();
      disegnaTracciato(livelloPercorso, dati.traccia.map(([lat, lon]) => [lat, lon]));
      disegnaCollegamenti(livelloPercorso, giro.map((p) => [p.lat, p.lng]), dati.traccia); // B11
      disegnaFrecce(livelloPercorso, dati.traccia); // il verso di percorrenza
      linea = dati.traccia;
      discesa = dati.discesa_m ?? null;
      aggiornaLegenda();
      compilaDati(dati);
      scriviStato(stato, "");
    } catch (err) {
      if (numero !== ultimaRichiesta) return;
      // 404: un punto lontano dai sentieri; 502: BRouter non risponde. Il messaggio in italiano arriva dal server
      suCalcolo(null); // niente percorso calcolato: niente confronto con i tuoi valori
      scriviStato(stato, `${err.message}. Resta la linea provvisoria: puoi scrivere i dati a mano.`, "errore");
    }
  }

  // I quattro valori del percorso nei campi veri del form, con il post-it "mappa"
  function compilaDati(dati) {
    suCalcolo(dati);
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
    discesa = traccia.discesa_m ?? null;
    disegnaTracciato(livelloPercorso, linea.map(([lat, lon]) => [lat, lon]));
    const tappe = traccia.tappe.map(([lat, lon]) => [lat, lon]);
    disegnaCollegamenti(livelloPercorso, interruttoreAnello.checked ? [...tappe, tappe[0]] : tappe, linea); // B11
    disegnaFrecce(livelloPercorso, linea); // il verso di percorrenza
    aggiornaConteggio();
    inquadraTutto();
    scriviStato(stato, "");
  }

  // A8 (revisione UX 2): alla riapertura si vede SEMPRE tutto il percorso. Lo rifacciamo anche dopo che la mappa
  // ha preso la sua misura definitiva (invalidateSize): prima la misura può essere sbagliata e l'inquadratura pure.
  function inquadraTutto() {
    if (!linea?.length) return;
    const confini = L.latLngBounds(linea.map(([lat, lon]) => [lat, lon]));
    mappa.fitBounds(confini, { padding: [30, 30] });
    requestAnimationFrame(() => { mappa.invalidateSize(); mappa.fitBounds(confini, { padding: [30, 30] }); });
  }

  // «Sentieri / Più breve»: segna il pulsante scelto (aria-pressed) e, se c'è già un percorso, lo ricalcola
  function mostraProfilo(nuovo) {
    profilo = nuovo;
    sceltaProfilo?.querySelectorAll("button[data-profilo]")
      .forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.profilo === profilo)));
  }
  sceltaProfilo?.addEventListener("click", (e) => {
    const bottone = e.target.closest("button[data-profilo]");
    if (!bottone || bottone.dataset.profilo === profilo) return;
    mostraProfilo(bottone.dataset.profilo);
    if (mappa && daRipristinare === null && punti.length >= 2) ridisegna();
  });

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
    // La mappa di Leaflet (la usa la navigazione per disegnare la tua posizione); null se non è ancora nata
    mappaLeaflet: () => mappa,
    // Navigazione: blocca (true) o sblocca (false) le modifiche al percorso
    blocca(si) {
      bloccata = si;
      punti.forEach((p) => (si ? p.dragging?.disable() : p.dragging?.enable()));
    },
    // Mappa vuota
    svuota() {
      ultimaRichiesta++;
      punti.forEach((p) => mappa?.removeLayer(p));
      punti = [];
      linea = null;
      discesa = null;
      daRipristinare = null;
      centro = null;
      mostraProfilo("sentieri");
      livelloPercorso?.clearLayers();
      interruttoreAnello.checked = false;
      aggiornaConteggio();
      scriviStato(stato, mappa ? "Tocca la mappa per mettere la partenza." : "");
    },
    // La traccia salvata del viaggio (se c'è): da chiamare PRIMA di apri()
    carica(viaggio) {
      this.svuota();
      attivita = viaggio.attivita ?? null;
      if (viaggio.lat_partenza != null && viaggio.lon_partenza != null) centro = [viaggio.lat_partenza, viaggio.lon_partenza];
      if (!viaggio.traccia?.tappe?.length || !viaggio.traccia?.linea?.length) return;
      mostraProfilo(viaggio.traccia.profilo ?? "sentieri"); // le mappe di prima non lo dicono: erano tutte "sentieri"
      if (mappa) ripristina(viaggio.traccia);
      else {
        daRipristinare = viaggio.traccia;
        interruttoreAnello.checked = eUnAnello(viaggio.traccia);
        punti = []; // le puntine nascono con la mappa
        conteggio.textContent = `Percorso salvato (${viaggio.traccia.tappe.length} punti)`;
      }
    },
    // Quello da salvare nel viaggio: { tappe, linea, profilo, discesa_m } oppure null (niente percorso calcolato)
    traccia() {
      if (daRipristinare) return daRipristinare;           // la mappa non è mai stata aperta: resta quella salvata
      if (punti.length < 2 || !linea) return null;
      return { tappe: punti.map((p) => [arrotonda(p.getLatLng().lat), arrotonda(p.getLatLng().lng)]), linea, profilo,
               ...(discesa != null ? { discesa_m: discesa } : {}) };
    },
  };
}
