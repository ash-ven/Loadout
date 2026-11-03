// =====================================================================
//  DISEGNO DEL PERCORSO SULLA MAPPA (fase 5) – lo usa la pagina della mappa (mappa.js).
//  La logica è quella della pagina di prova (sezioni 4–7), con due differenze:
//  - il percorso lo chiede il NOSTRO server (/api/percorso), che a sua volta chiama BRouter;
//  - la mappa scrive nei campi veri della pagina (km, dislivello positivo, quote, coordinate) con il post-it.
//  Lezione di giovedì: Leaflet misura il contenitore quando nasce: la mappa nasce con apri(),
//  quando il contenitore è già visibile.
// =====================================================================
import { api } from "./api.js";
import { discesaDellaTraccia, preparaTraccia, aggancia } from "./navigazione-calcoli.js";
import { proponi } from "./post-it.js";
import { creaMappa, icona, tipoDelPunto, disegnaTracciato, disegnaProvvisoria, disegnaCollegamenti, disegnaFrecce, disegnaDifficolta, eUnAnello, metriTra, scriviStato } from "./mappa-base.js";

const arrotonda = (n) => Math.round(n * 1e5) / 1e5; // 5 decimali ≈ 1 metro

// suModifica: chiamata ogni volta che il percorso cambia (la pagina la usa per "modifiche non salvate")
// suCalcolo(dati): chiamata con i valori calcolati dalla mappa ({ distanza_km, dislivello_m, quota_min_m, quota_max_m })
//                  oppure con null quando non c'è un percorso (A2: la pagina li mostra sotto i valori scritti a mano)
// legenda e notaAnello (B11, facoltativi): la legenda mostra solo quello che c'è, la nota spiega l'anello con una sola tappa
// sceltaProfilo (facoltativo): il gruppo di pulsanti «Sentieri / Più breve» (data-profilo="sentieri" | "breve")
// elencoTappe (facoltativo): la lista <ol> dove mostrare i punti in ordine, con ↑ ↓ per cambiarlo e ✕ per toglierne uno
// avvisoImportata (facoltativo): il riquadro ocra "hai modificato la traccia importata" (B8)
// messaggioImport (facoltativo): il messaggio "Traccia importata: …", da togliere quando la traccia viene modificata
// notaProfilo (facoltativo): la riga sotto «Sentieri / Più breve» che spiega cosa fanno (o che la traccia viene da un file)
// annuncio (facoltativo): una zona aria-live, per dire ai lettori di schermo cosa è cambiato nell'elenco dei punti
export function attivaDisegnoMappa({ contenitore, conteggio, stato, interruttoreAnello, bottoneTogli, bottoneRicomincia, campi, coordinate,
                                     legenda = null, notaAnello = null, sceltaProfilo = null, elencoTappe = null, avvisoImportata = null, messaggioImport = null, notaProfilo = null, annuncio = null, suModifica = () => {}, suCalcolo = () => {} }) {
  let mappa = null;            // nasce con apri()
  let livelloPercorso = null;  // le linee: si svuota e si ridisegna
  let punti = [];              // le puntine (L.marker trascinabili), nell'ordine in cui le hai messe
  let linea = null;            // la traccia dell'ultimo percorso calcolato: [[lat, lon, quota], ...]
  let discesa = null;          // il dislivello negativo dell'ultimo percorso calcolato (metri), o null
  let avvisi = null;           // gli avvisi sul percorso (tratti T3, attrezzati…) dell'ultimo calcolo, o null
  let profilo = "sentieri";    // come chiedere il percorso: "sentieri" (preferisce i sentieri) o "breve" (il più corto)
  let attivita = null;         // l'attività del viaggio: con ferrata e alpinismo il server accetta i passaggi difficili
  let discesaRiaperta = null;  // D− ricavato dalla pagina per le mappe salvate senza (vedi carica)
  let bloccata = false;
  let importata = false;       // B8: la linea viene da un file GPX (non da BRouter)
  let ultimiKm = null;         // i km dell'ultimo percorso calcolato (per dire cosa cambia con «Più breve», collaudo B2)
  let confronto = null;        // B2: { da: profilo di prima, km: km di prima } dopo un cambio di profilo
  let inquadraDopo = false;    // B4: dopo il prossimo calcolo, inquadra tutto il percorso        // durante la navigazione col GPS la mappa non si modifica (niente tappe nuove, puntine ferme)
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
    // B8: se la linea veniva da un GPX, da qui in poi il percorso lo ricalcola BRouter sui sentieri: lo diciamo
    if (importata) {
      importata = false;
      if (avvisoImportata) avvisoImportata.hidden = false;
      if (messaggioImport) messaggioImport.hidden = true; // collaudo B6: niente due messaggi che si contraddicono
      aggiornaSelettore();
    }
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
    aggiornaElenco();
  }

  // B11: la legenda mostra solo i tipi di puntina presenti (e "Sui sentieri" se c'è il percorso). Senza punti, tutto: fa da guida
  function aggiornaLegenda() {
    if (!legenda) return;
    const presenti = new Set(punti.map((p, i) => tipoDelPunto(i, punti.length, interruttoreAnello.checked)));
    if (linea) { presenti.add("sentieri"); presenti.add("verso"); }
    for (const a of avvisi?.avvisi ?? []) presenti.add(a.tipo === "t3" || a.tipo === "roccia" || a.tipo === "traccia" ? "attenzione" : "difficile");
    legenda.querySelectorAll("[data-tipo]").forEach((voce) => {
      voce.hidden = punti.length === 0 ? voce.dataset.tipo === "anello" : !presenti.has(voce.dataset.tipo);
    });
  }

  // L'elenco dei punti in ordine: «Partenza», «Tappa 2», «Arrivo»… con le coordinate e i pulsanti.
  // ↑ e ↓ scambiano un punto con quello prima o dopo (il ruolo segue la posizione: chi va in fondo diventa l'arrivo),
  // ✕ toglie proprio quel punto. Costruito con createElement e textContent: niente innerHTML.
  const NOMI = { partenza: "Partenza", anello: "Partenza e arrivo", arrivo: "Arrivo" };
  function aggiornaElenco() {
    if (!elencoTappe) return;
    const coord = (n) => n.toLocaleString("it-IT", { maximumFractionDigits: 5 });
    elencoTappe.replaceChildren(...punti.map((p, i) => {
      const tipo = tipoDelPunto(i, punti.length, interruttoreAnello.checked);
      const riga = document.createElement("li");
      riga.dataset.indice = i;
      const nome = document.createElement("span");
      nome.className = "tappa-nome";
      nome.textContent = NOMI[tipo] ?? `Tappa ${i}`;
      const dove = document.createElement("span");
      dove.className = "muto tappa-coordinate-testo";
      dove.textContent = `${coord(p.getLatLng().lat)} · ${coord(p.getLatLng().lng)}`;
      const bottone = (azione, testo, etichetta, disattivo) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "tappa-bottone";
        b.dataset.azione = azione;
        b.textContent = testo;
        b.setAttribute("aria-label", `${etichetta}: ${nome.textContent}`);
        b.title = etichetta;
        b.disabled = disattivo;
        return b;
      };
      riga.append(nome, dove,
        bottone("su", "↑", "Sposta prima", i === 0),
        bottone("giu", "↓", "Sposta dopo", i === punti.length - 1),
        bottone("togli", "✕", "Togli questo punto", false));
      return riga;
    }));
    elencoTappe.hidden = punti.length < 2; // con un punto solo non c'è niente da riordinare
  }
  elencoTappe?.addEventListener("click", (e) => {
    const b = e.target.closest("button[data-azione]");
    if (!b || bloccata) return;
    const i = Number(b.closest("li").dataset.indice);
    const azione = b.dataset.azione;
    const nomePrima = nomePunto(i);
    let destinazione;
    if (azione === "togli") {
      mappa.removeLayer(punti[i]);
      punti.splice(i, 1);
      destinazione = Math.min(i, punti.length - 1);
      inquadraDopo = true; // B4: tolto un punto (magari lontano), si torna a vedere tutto il percorso
    } else {
      destinazione = azione === "su" ? i - 1 : i + 1;
      [punti[i], punti[destinazione]] = [punti[destinazione], punti[i]]; // scambio
    }
    ridisegna(); // icone, coordinate di partenza e arrivo, percorso: tutto rifatto con il nuovo ordine
    // B3 (collaudo 3/11): il cursore resta sulla riga spostata. Se il suo pulsante ora è spento
    // (es. ↑ su chi è diventato la partenza), va sull'altra freccia o sulla ✕; senza righe, sulla lista
    const riga = elencoTappe.querySelector(`li[data-indice="${destinazione}"]`);
    const ordine = azione === "togli" ? ["togli"] : [azione, azione === "su" ? "giu" : "su", "togli"];
    const prossimo = ordine.map((a) => riga?.querySelector(`[data-azione="${a}"]`)).find((x) => x && !x.disabled);
    (prossimo ?? elencoTappe).focus();
    if (annuncio) annuncio.textContent = azione === "togli"
      ? `${nomePrima} tolto. Ora: ${conteggio.textContent}.`
      : `${nomePrima} è ora ${nomePunto(destinazione).toLowerCase()}.`;
  });

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
    avvisi = null;
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
      disegnaDifficolta(livelloPercorso, dati.traccia, dati.avvisi_percorso); // i tratti difficili, sopra la linea verde
      disegnaCollegamenti(livelloPercorso, giro.map((p) => [p.lat, p.lng]), dati.traccia); // B11
      disegnaFrecce(livelloPercorso, dati.traccia); // il verso di percorrenza
      linea = dati.traccia;
      discesa = dati.discesa_m ?? null;
      avvisi = dati.avvisi_percorso ?? null;
      aggiornaLegenda();
      compilaDati(dati);
      // B2 (collaudo 3/11): dopo un cambio Sentieri ↔ Più breve diciamo cosa è cambiato (anche "niente")
      if (confronto) {
        const NOMI_PROFILO = { sentieri: "Sentieri", breve: "Più breve" };
        const km1 = (n) => n.toLocaleString("it-IT", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
        const prima = confronto.km;
        scriviStato(stato, prima == null ? `${NOMI_PROFILO[profilo]}: ${km1(dati.distanza_km)} km.`
          : Math.abs(dati.distanza_km - prima) < 0.05
            ? `${NOMI_PROFILO[profilo]}: ${km1(dati.distanza_km)} km, lo stesso percorso di «${NOMI_PROFILO[confronto.da]}» (qui non c'è una strada diversa).`
            : `${NOMI_PROFILO[profilo]}: ${km1(dati.distanza_km)} km (con «${NOMI_PROFILO[confronto.da]}» erano ${km1(prima)} km).`);
        confronto = null;
      } else {
        scriviStato(stato, "");
      }
      ultimiKm = dati.distanza_km;
      if (inquadraDopo) { inquadraDopo = false; inquadraTutto(); } // B4: dopo una tappa lontana o tolta, si vede tutto
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
    discesa = traccia.discesa_m ?? discesaRiaperta; // le mappe vecchie non l'hanno salvato: lo ricava la pagina
    avvisi = traccia.avvisi_percorso ?? null;       // le mappe salvate prima degli avvisi non li hanno
    disegnaTracciato(livelloPercorso, linea.map(([lat, lon]) => [lat, lon]));
    disegnaDifficolta(livelloPercorso, linea, avvisi);
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
    if (!bottone || bottone.disabled || bottone.dataset.profilo === profilo) return;
    const da = profilo;
    mostraProfilo(bottone.dataset.profilo);
    if (mappa && daRipristinare === null && punti.length >= 2) {
      confronto = { da, km: ultimiKm }; // B2: dopo il calcolo diciamo cosa è cambiato
      ridisegna();
    }
  });

  // B2 (collaudo 3/11): con una traccia da file il selettore non vale (la linea è quella del file): spento, e la nota lo dice
  const NOTA_PROFILO = "Sentieri preferisce i sentieri ed evita l'asfalto; Più breve cerca la strada più corta. " +
    "Cambiando, il percorso si ricalcola.";
  function aggiornaSelettore() {
    sceltaProfilo?.querySelectorAll("button[data-profilo]").forEach((b) => { b.disabled = importata; });
    if (notaProfilo) notaProfilo.textContent = importata
      ? "Traccia da file GPX: la linea è quella del file. Se sposti o aggiungi un punto, viene ricalcolata con «Sentieri» o «Più breve»."
      : NOTA_PROFILO;
  }
  aggiornaSelettore();

  // Il nome di un punto nell'elenco, come lo vedi: «Partenza», «Tappa 2», «Arrivo»…
  function nomePunto(i) {
    const tipo = tipoDelPunto(i, punti.length, interruttoreAnello.checked);
    return NOMI[tipo] ?? `Tappa ${i}`;
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
    // La mappa di Leaflet (la usa la navigazione per disegnare la tua posizione); null se non è ancora nata
    mappaLeaflet: () => mappa,
    // Una tappa da coordinate scritte (o incollate). Va nel punto del giro dove ALLUNGA MENO il percorso:
    // per ogni posto possibile (tra due punti vicini) calcoliamo quanto si allunga la strada in linea d'aria,
    //   allungamento = A→tappa + tappa→B − A→B
    // e scegliamo il più piccolo. Partenza e arrivo restano dove sono (nell'anello si può andare anche dopo l'ultima tappa).
    // Con 0 o 1 punti la tappa diventa la partenza o il secondo punto. → null se va bene, altrimenti il motivo
    // B4 (collaudo 3/11): una tappa molto lontana (più di 5 km dal percorso, o che allunga il giro di più della metà)
    // non entra subito: torna { domanda } e la pagina chiede conferma; confermata = true la aggiunge comunque.
    aggiungiTappa(lat, lon, confermata = false) {
      if (!mappa) return "La mappa non è ancora pronta";
      if (bloccata) return "Durante la navigazione il percorso non si modifica";
      const nuova = L.latLng(lat, lon);
      const giro = puntiDelGiro().map((p) => [p.lat, p.lng]);
      const qui = [lat, lon];
      let posto = punti.length;                          // 0 o 1 punti: in fondo
      let minimo = Infinity;
      if (punti.length >= 2) {
        const ultimoPosto = interruttoreAnello.checked ? punti.length : punti.length - 1; // senza anello l'arrivo resta ultimo
        for (let i = 1; i <= ultimoPosto; i++) {
          const a = giro[i - 1], b = giro[i];
          const allungamento = metriTra(a, qui) + metriTra(qui, b) - metriTra(a, b);
          if (allungamento < minimo) { minimo = allungamento; posto = i; }
        }
      }
      if (!confermata && giro.length >= 2) {
        const lontananza = linea?.length >= 2 ? aggancia(preparaTraccia(linea), qui).distanza_m
          : Math.min(...giro.map((p) => metriTra(p, qui)));
        const lungo = giro.slice(1).reduce((somma, p, i) => somma + metriTra(giro[i], p), 0);
        if (lontananza > 5000 || (lungo > 0 && minimo > lungo * 0.5)) {
          const km = (lontananza / 1000).toLocaleString("it-IT", { maximumFractionDigits: 1 });
          return { domanda: `Questa tappa è a circa ${km} km dal percorso: il giro si allungherebbe di molto. La aggiungo lo stesso?` };
        }
      }
      punti.splice(posto, 0, nuovaPuntina(nuova));
      inquadraDopo = true; // dopo il calcolo si vede tutto il percorso, nuova tappa compresa
      ridisegna();
      return null;
    },
    // B8: una traccia letta da un file GPX (preparaImport in gpx-lettura.js). La linea è quella del file,
    // NON ricalcolata da BRouter; le puntine vanno su partenza e arrivo (o a metà, per l'anello).
    // I valori (km, D+, quote) entrano nei campi con il post-it "dalla mappa", come dopo un calcolo.
    importa({ linea: lineaFile, tappe, anello, dati }) {
      if (!mappa) return "La mappa non è ancora pronta";
      if (bloccata) return "Durante la navigazione il percorso non si modifica";
      ultimaRichiesta++;                                   // una richiesta a BRouter in corso non deve sovrascriverla
      punti.forEach((p) => mappa.removeLayer(p));
      interruttoreAnello.checked = anello;
      punti = tappe.map(([lat, lon]) => nuovaPuntina(L.latLng(lat, lon)));
      punti.forEach((p, i) => p.setIcon(icona(tipoDelPunto(i, punti.length, anello))));
      daRipristinare = null;
      linea = lineaFile;
      discesa = dati.discesa_m;
      avvisi = null;                                       // un file GPX non ha le etichette dei sentieri
      importata = true;                                    // prima di compilaDati: la pagina legge subito traccia()
      livelloPercorso.clearLayers();
      disegnaTracciato(livelloPercorso, linea.map(([lat, lon]) => [lat, lon]));
      disegnaFrecce(livelloPercorso, linea);
      suModifica();
      aggiornaConteggio();
      aggiornaCoordinate();
      compilaDati(dati);
      inquadraTutto();
      importata = true;
      ultimiKm = dati.distanza_km;
      aggiornaSelettore();
      if (avvisoImportata) avvisoImportata.hidden = true;
      scriviStato(stato, "");
      return null;
    },
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
      avvisi = null;
      daRipristinare = null;
      centro = null;
      mostraProfilo("sentieri");
      importata = false;
      ultimiKm = null;
      aggiornaSelettore();
      livelloPercorso?.clearLayers();
      interruttoreAnello.checked = false;
      aggiornaConteggio();
      scriviStato(stato, mappa ? "Tocca la mappa per mettere la partenza." : "");
    },
    // La traccia salvata del viaggio (se c'è): da chiamare PRIMA di apri()
    carica(viaggio) {
      this.svuota();
      attivita = viaggio.attivita ?? null;
      discesaRiaperta = discesaDellaTraccia(viaggio.traccia, viaggio.dislivello_m);
      if (viaggio.lat_partenza != null && viaggio.lon_partenza != null) centro = [viaggio.lat_partenza, viaggio.lon_partenza];
      if (!viaggio.traccia?.tappe?.length || !viaggio.traccia?.linea?.length) return;
      mostraProfilo(viaggio.traccia.profilo ?? "sentieri"); // le mappe di prima non lo dicono: erano tutte "sentieri"
      importata = viaggio.traccia.origine === "gpx";            // B2: una traccia da file resta "da file" anche riaprendo
      ultimiKm = viaggio.distanza_km ?? null;
      aggiornaSelettore();
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
               ...(discesa != null ? { discesa_m: discesa } : {}),
               ...(avvisi ? { avvisi_percorso: avvisi } : {}),
               ...(importata ? { origine: "gpx" } : {}) };          // B2: si ricorda che la linea viene da un file
    },
  };
}
