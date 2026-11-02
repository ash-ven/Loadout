import { api, esc } from "./api.js";
import "./menu.js";
import { mostraErroriCampi, pulisciErroriCampi, pulisciScrivendo } from "./errori-campi.js";
import { CATEGORIE } from "./categorie.js";
import { segno, iconaSegno } from "./segni.js";

// --- Elementi della pagina ---
const lista = document.querySelector("#lista");
const q = document.querySelector("#q");
const segmenti = document.querySelector(".segmenti");
const riepilogo = document.querySelector("#riepilogo");
const form = document.querySelector("#form-oggetto");
const campi = form.elements; // i campi del form, per nome: campi.nome, campi.peso_g, ...
const titoloForm = document.querySelector("#titolo-form");
const erroreForm = document.querySelector("#form-errore");
const bottoneSalva = document.querySelector("#salva");
const bottoneAnnulla = document.querySelector("#annulla");
const bottoneElimina = document.querySelector("#elimina-oggetto"); // dentro la finestra, solo in modifica
const finestra = document.querySelector("#finestra");              // il <dialog> con il form
const bottoneNuovo = document.querySelector("#apri-nuovo");        // il + fisso in basso a destra
const bottoneScansiona = document.querySelector("#scansiona");     // "Scansiona etichetta" nella testata
const bottoneChiudi = document.querySelector("#chiudi");           // la X in alto nella finestra
// La scheda di dettaglio (B1): un secondo <dialog>, in sola lettura
const dettaglio = document.querySelector("#dettaglio");
const dettaglioIcona = document.querySelector("#dettaglio-icona");
const dettaglioNome = document.querySelector("#dettaglio-nome");
const dettaglioMarchio = document.querySelector("#dettaglio-marchio");
const dettaglioBadge = document.querySelector("#dettaglio-badge");
const dettaglioDati = document.querySelector("#dettaglio-dati");
const dettaglioNota = document.querySelector("#dettaglio-nota");
const infoForm = document.querySelector("#form-info");
// La finestra della fotocamera (stretch 2)
const finestraScanner = document.querySelector("#finestra-scanner");
const statoScanner = document.querySelector("#stato-scanner");
const bottoneCercaProdotto = document.querySelector("#cerca-prodotto");

// --- Stato ---
let oggetti = [];        // gli oggetti arrivati dall'API (già filtrati dalla ricerca)
let tutti = [];          // B2: TUTTO l'armadio, per il totale della testata (che non cambia mentre cerchi)
let filtro = "tutti";    // "tutti" | "indispensabili" | "preferiti"
let inModifica = null;   // id dell'oggetto in modifica, oppure null se stiamo creando
let aperto = null;       // l'oggetto mostrato nella scheda di dettaglio
let perUscita = null;    // B6: id dell'uscita da cui sei arrivata con "Aggiungi all'armadio" (dopo il salvataggio si torna lì)

// --- Caricamento dall'API: aggiorna lo stato e ridisegna ---
async function carica() {
  const parametri = new URLSearchParams({ q: q.value, limit: 200 });
  // B2: mentre cerchi chiediamo anche l'armadio intero (in parallelo), per il totale; senza ricerca è la stessa lista
  const [trovati, interi] = await Promise.all([
    api(`/api/oggetti?${parametri}`),
    q.value.trim() ? api("/api/oggetti?limit=200") : null,
  ]);
  oggetti = trovati;
  tutti = interi ?? trovati;
  render();
}

// 1860 → "1.860 g". useGrouping: "always" serve perché in italiano, di base, i numeri di 4 cifre
// non hanno il punto delle migliaia. &nbsp; = niente a capo tra il numero e "g".
const grammi = (g) => `${g.toLocaleString("it-IT", { useGrouping: "always" })}&nbsp;g`;


// Le checkbox "Adatto a" hanno tutte lo stesso name: querySelectorAll le prende tutte

// Peso di un oggetto contando tutti i pezzi che possiedi (B2): 3 paia di calze da 60 g = 180 g
const pesoTuttiIPezzi = (o) => o.peso_g * (o.quantita_posseduta ?? 1);

// --- Render: dallo stato all'HTML ---
function render() {
  // Riepilogo nella testata: "23 oggetti, 9,60 kg in tutto". B2: sempre l'armadio INTERO, anche mentre cerchi
  const pesoTotale = tutti.reduce((somma, o) => somma + pesoTuttiIPezzi(o), 0);
  const kg = (pesoTotale / 1000).toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  riepilogo.innerHTML = `<strong>${tutti.length} ${tutti.length === 1 ? "oggetto" : "oggetti"}</strong>, ${kg} kg in tutto`;
  // B2: sopra la lista, solo mentre cerchi: "1 di 23 oggetti"
  const conteggioRicerca = document.querySelector("#conteggio-ricerca");
  conteggioRicerca.hidden = !q.value.trim();
  conteggioRicerca.textContent = `${oggetti.length} di ${tutti.length} ${tutti.length === 1 ? "oggetto" : "oggetti"}`;
  segmenti.querySelector('[data-filtro="tutti"]').textContent = `Tutti · ${oggetti.length}`;

  // Filtro dei segmenti: si applica qui, senza richiamare l'API (i dati li abbiamo già)
  const visibili = oggetti.filter((o) =>
    filtro === "tutti" ? true : filtro === "indispensabili" ? o.is_indispensabile : o.is_preferito
  );

  if (visibili.length === 0) {
    const cercato = q.value.trim();
    if (cercato && oggetti.length === 0) {
      // La ricerca non ha trovato niente: lo diciamo, e offriamo di cancellarla
      lista.innerHTML = `<p class="vuoto">Nessun oggetto contiene «${esc(cercato)}» nel nome, nel marchio o nelle note.
        <button type="button" class="btn-piccolo secondario" id="cancella-ricerca">Cancella la ricerca</button>
        <button type="button" class="btn-piccolo" id="aggiungi-cercato">Aggiungi «${esc(cercato)}» all'armadio</button></p>`;
    } else {
      lista.innerHTML = `<p class="vuoto">${
        oggetti.length === 0 ? "Nessun oggetto qui. Premi + in basso a destra per inserire il primo." : "Nessun oggetto con questo filtro."
      }</p>`;
    }
    return;
  }

  // Un gruppo per ogni categoria che ha almeno un oggetto, con il peso totale del gruppo
  lista.innerHTML = Object.keys(CATEGORIE).map((categoria) => {
    const delGruppo = visibili.filter((o) => o.categoria === categoria);
    if (delGruppo.length === 0) return "";
    const pesoGruppo = delGruppo.reduce((somma, o) => somma + pesoTuttiIPezzi(o), 0);
    return `
      <section class="gruppo">
        <div class="gruppo-testa"><h2>${CATEGORIE[categoria]}</h2><span>${grammi(pesoGruppo)}</span></div>
        <div class="gruppo-righe">${delGruppo.map(rigaOggetto).join("")}</div>
      </section>`;
  }).join("");
}

// Una riga della lista: è un <button>, così si può aprire anche da tastiera (Tab + Invio)
function rigaOggetto(o) {
  return `
    <button type="button" class="riga" data-id="${o.id}">
      <span class="riquadro-icona"><img src="/img/icone/categorie/${o.categoria}.svg" alt="" width="22" height="22"></span>
      <span class="riga-testo">
        <span class="riga-nome">${esc(o.nome)}</span>
        <span class="riga-dettagli">
          ${sottotitolo(o) ? `<span class="riga-nota">${esc(sottotitolo(o))}</span>` : ""}
          ${o.is_indispensabile ? segno("indispensabile") : ""}
          ${o.is_preferito ? segno("preferito") : ""}
        </span>
      </span>
      <span class="riga-valore">${grammi(o.peso_g)}</span>
    </button>`;
}

// Sotto il nome: marchio e pezzi posseduti (B1, B2); se non ci sono, la nota
function sottotitolo(o) {
  const parti = [o.marchio, o.quantita_posseduta > 1 ? `${o.quantita_posseduta} pezzi` : null].filter(Boolean);
  return parti.length ? parti.join(" · ") : o.note;
}

// --- Clic su un oggetto della lista (event delegation: UN solo listener per tutte le righe) ---
lista.addEventListener("click", (e) => {
  // B2: la ricerca non ha trovato niente → "Aggiungi «ramponi» all'armadio" apre il form con il nome già scritto
  if (e.target.id === "aggiungi-cercato") {
    const nome = q.value.trim();
    svuotaForm();
    campi.nome.value = nome;
    apriFinestra(campi.categoria); // il nome c'è già: si parte dalla categoria
    return;
  }
  if (e.target.id === "cancella-ricerca") {
    q.value = "";
    carica();
    q.focus();
    return;
  }
  const riga = e.target.closest(".riga[data-id]");
  if (!riga) return;
  apriDettaglio(oggetti.find((o) => o.id === Number(riga.dataset.id)));
});

// --- Scheda di dettaglio (B1): tutto quello che sappiamo dell'oggetto, in sola lettura ---
function apriDettaglio(o, nota = "") {
  aperto = o;
  dettaglioNota.textContent = nota;
  dettaglioNota.hidden = !nota;
  dettaglioIcona.innerHTML = `<img src="/img/icone/categorie/${o.categoria}.svg" alt="" width="22" height="22">`;
  dettaglioNome.textContent = o.nome;
  dettaglioMarchio.textContent = o.marchio ?? "";
  dettaglioMarchio.hidden = !o.marchio;
  dettaglioBadge.innerHTML =
    (o.is_indispensabile ? segno("indispensabile", true) : "") +
    (o.is_preferito ? segno("preferito", true) : "");

  // Solo le voci che hanno un valore: [etichetta, valore]
  const voci = [
    ["Categoria", CATEGORIE[o.categoria]],
    ["Peso", `${o.peso_g.toLocaleString("it-IT", { useGrouping: "always" })} g`],
    ["Pezzi", o.quantita_posseduta],
    ["Caratteristiche", o.caratteristiche],
    ["Codice a barre", o.codice_etichetta],
    ["Note", o.note],
  ].filter(([, valore]) => valore !== null && valore !== undefined && valore !== "");
  dettaglioDati.innerHTML = voci.map(([etichetta, valore]) => `<dt>${etichetta}</dt><dd>${esc(valore)}</dd>`).join("");

  dettaglio.showModal();
}

document.querySelector("#dettaglio-modifica").addEventListener("click", () => {
  dettaglio.close();
  riempiForm(aperto); // dalla scheda alla finestra con il form, già compilato
});
document.querySelector("#dettaglio-elimina").addEventListener("click", () => elimina(aperto.id));
document.querySelector("#chiudi-dettaglio").addEventListener("click", () => dettaglio.close());
dettaglio.addEventListener("click", (e) => {
  if (e.target === dettaglio) dettaglio.close(); // clic sullo sfondo scuro
});

// --- Segmenti Tutti / Indispensabili / Preferiti ---
// Le stesse icone della lista accanto ai nomi dei filtri: fanno anche da "legenda" (puntina = indispensabile, stella = preferito)
segmenti.querySelector('[data-filtro="indispensabili"]').insertAdjacentHTML("afterbegin", iconaSegno("indispensabile"));
segmenti.querySelector('[data-filtro="preferiti"]').insertAdjacentHTML("afterbegin", iconaSegno("preferito"));
segmenti.addEventListener("click", (e) => {
  const bottone = e.target.closest("button[data-filtro]");
  if (!bottone) return;
  filtro = bottone.dataset.filtro;
  // aria-pressed dice (anche ai lettori di schermo) quale segmento è attivo; il CSS lo usa per colorarlo
  segmenti.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b === bottone)));
  render();
});

async function elimina(id) {
  const oggetto = oggetti.find((o) => o.id === id);
  if (!confirm(`Eliminare "${oggetto.nome}"?\nSparirà anche dagli zaini in cui si trova.`)) return;
  try {
    await api(`/api/oggetti/${id}`, { method: "DELETE" });
    finestra.close();  // la chiusura svuota anche il form (evento "close")
    dettaglio.close(); // se l'hai eliminato dalla scheda di dettaglio (chiudere un dialog già chiuso non fa nulla)
    await carica();
  } catch (err) {
    alert(err.message);
  }
}

// --- Form: modalità "modifica" e modalità "nuovo" ---
function riempiForm(o) {
  inModifica = o.id;
  campi.nome.value = o.nome;
  campi.categoria.value = o.categoria;
  campi.peso_g.value = o.peso_g;
  campi.marchio.value = o.marchio ?? "";
  campi.quantita_posseduta.value = o.quantita_posseduta ?? 1;
  campi.caratteristiche.value = o.caratteristiche ?? "";
  campi.is_indispensabile.checked = o.is_indispensabile;
  campi.is_preferito.checked = o.is_preferito;
  campi.codice_etichetta.value = o.codice_etichetta ?? "";
  campi.note.value = o.note ?? "";
  titoloForm.textContent = `Modifica: ${o.nome}`;
  bottoneElimina.hidden = false;
  nascondiErrore();
  apriFinestra();
}

function svuotaForm() {
  inModifica = null;
  form.reset();
  titoloForm.textContent = "Nuovo oggetto";
  bottoneElimina.hidden = true;
  infoForm.hidden = true;
  delete campi.categoria.dataset.scelta; // nessuna categoria scelta a mano (vedi cercaProdotto)
  perUscita = null; // B6
  nascondiErrore();
  pulisciErroriCampi(form); // B1
}

// --- La finestra (dialog) con il form ---
// showModal() la apre sopra la pagina (il resto non è cliccabile); close() la chiude.
// Il browser la chiude da solo anche con il tasto Esc.
function apriFinestra(campoIniziale = campi.nome) {
  finestra.showModal();
  campoIniziale.focus(); // il cursore va nel campo indicato (di solito il nome)
}

bottoneNuovo.addEventListener("click", () => {
  svuotaForm();
  apriFinestra();
});
// =====================================================================
//  STRETCH 2: SCANSIONE DELL'ETICHETTA CON LA FOTOCAMERA
//  La libreria html5-qrcode accende la fotocamera, guarda i fotogrammi e ci chiama
//  quando legge un codice. Usa il BarcodeDetector del browser dove esiste (Chrome Android, Mac),
//  altrimenti decodifica da sola (es. Chrome su Windows).
// =====================================================================
let lettore = null;  // l'oggetto Html5Qrcode mentre la fotocamera è accesa
let giaLetto = false; // la libreria può chiamarci più volte di fila con lo stesso codice: teniamo solo il primo

bottoneScansiona.addEventListener("click", apriScanner);
document.querySelector("#chiudi-scanner").addEventListener("click", () => finestraScanner.close());
document.querySelector("#scrivi-a-mano").addEventListener("click", () => {
  finestraScanner.close();
  apriNuovoConCodice("");
});
finestraScanner.addEventListener("close", spegniFotocamera); // comunque si chiuda, la fotocamera si spegne

async function apriScanner() {
  // La fotocamera c'è solo in un "contesto sicuro" (https o localhost) e se la libreria è arrivata
  if (!navigator.mediaDevices?.getUserMedia || typeof Html5Qrcode === "undefined") {
    apriNuovoConCodice("", "Qui la fotocamera non è disponibile (serve https, o localhost sul computer): scrivi il codice a mano.");
    return;
  }
  giaLetto = false;
  statoScanner.textContent = "Accendo la fotocamera…";
  finestraScanner.showModal();
  const f = Html5QrcodeSupportedFormats;
  const questo = new Html5Qrcode("lettore", {
    formatsToSupport: [f.EAN_13, f.EAN_8, f.UPC_A, f.UPC_E, f.CODE_128, f.CODE_39, f.QR_CODE], // codici delle etichette
    useBarCodeDetectorIfSupported: true, // il lettore del browser, dove c'è (è più veloce)
    verbose: false,
  });
  lettore = questo;
  try {
    await questo.start(
      { facingMode: "environment" }, // sul telefono la fotocamera posteriore; sul computer la webcam
      { fps: 10, qrbox: (larghezza, altezza) => ({ width: Math.min(larghezza * 0.85, 340), height: Math.min(altezza * 0.45, 170) }) },
      codiceLetto,
      () => {} // chiamata per ogni fotogramma senza codice: non ci interessa
    );
    statoScanner.textContent = "Inquadra il codice a barre…";
    // Se la finestra è stata chiusa mentre la fotocamera si accendeva, la spegniamo subito
    if (!finestraScanner.open) { await questo.stop(); questo.clear(); }
  } catch (err) {
    statoScanner.textContent = messaggioFotocamera(err);
  }
}

async function spegniFotocamera() {
  try {
    if (lettore?.isScanning) await lettore.stop(); // spegne la fotocamera (si spegne anche la lucina)
    lettore?.clear();
  } catch { /* già spenta */ }
  lettore = null;
}

async function codiceLetto(testo) {
  if (giaLetto) return;
  giaLetto = true;
  const codice = testo.trim();
  finestraScanner.close(); // → spegniFotocamera
  // L'etichetta serve anche a RITROVARE le cose: se il codice è già nell'armadio, apro quell'oggetto
  let esistente = null;
  try {
    const tutti = await api("/api/oggetti?limit=200");
    esistente = tutti.find((o) => o.codice_etichetta === codice);
  } catch { /* se la ricerca fallisce, apriamo comunque il form con il codice */ }
  if (esistente) {
    apriDettaglio(esistente, `Codice ${codice}: questo oggetto è già nel tuo armadio.`);
  } else {
    apriNuovoConCodice(codice);
    cercaProdotto(); // e intanto chiediamo al server che prodotto è
  }
}

function apriNuovoConCodice(codice, messaggio = "") {
  svuotaForm();
  campi.codice_etichetta.value = codice;
  infoForm.textContent = messaggio;
  infoForm.hidden = !messaggio;
  apriFinestra(codice ? campi.nome : campi.codice_etichetta); // con il codice: si parte dal nome
}

// =====================================================================
//  CHE PRODOTTO È? Il codice a barre è solo un numero: chiediamo al server (GET /api/prodotti/:codice),
//  che cerca nelle banche dati gratuite (Open Facts, UPCitemdb).
//  Regola: riempiamo SOLO i campi ancora vuoti. Quello che hai scritto tu non si tocca.
// =====================================================================
bottoneCercaProdotto.addEventListener("click", cercaProdotto);
// Invio nel campo del codice = "Cerca" (senza, Invio salverebbe tutto il form, ancora mezzo vuoto)
campi.codice_etichetta.addEventListener("keydown", (e) => {
  if (e.key !== "Enter") return;
  e.preventDefault();
  cercaProdotto();
});
// Se scegli tu la categoria, la ricerca non la cambia più
campi.categoria.addEventListener("change", () => { campi.categoria.dataset.scelta = "1"; });

async function cercaProdotto() {
  const codice = campi.codice_etichetta.value.trim();
  if (!/^\d{8,14}$/.test(codice)) {
    mostraInfo("Per cercare il prodotto serve un codice a barre di 8–14 cifre (quello sotto le barre).");
    return;
  }
  bottoneCercaProdotto.disabled = true;
  bottoneCercaProdotto.textContent = "Cerco…";
  mostraInfo(`Codice ${codice}: cerco il prodotto nelle banche dati…`);
  try {
    const p = await api(`/api/prodotti/${codice}`);
    // Nel frattempo la finestra è stata chiusa o il codice è cambiato? Allora la risposta non serve più
    if (!finestra.open || campi.codice_etichetta.value.trim() !== codice) return;

    if (!p.trovato) {
      mostraInfo(p.irraggiungibile
        ? "Non riesco a raggiungere le banche dati dei prodotti (connessione?): completa a mano."
        : `Codice ${codice}: prodotto non trovato nelle banche dati. Completa nome, categoria e peso a mano.`);
      return;
    }
    const riempiti = [];
    if (riempiSeVuoto(campi.nome, p.nome)) riempiti.push("nome");
    if (riempiSeVuoto(campi.marchio, p.marchio)) riempiti.push("marchio");
    if (riempiSeVuoto(campi.peso_g, p.peso_g)) riempiti.push("peso");
    if (p.categoria && !inModifica && !campi.categoria.dataset.scelta) {
      campi.categoria.value = p.categoria;
      riempiti.push("categoria");
    }
    const mancano = ["nome", "peso"].filter((c) => !riempiti.includes(c) && !campi[c === "peso" ? "peso_g" : c].value);
    mostraInfo(`Trovato su ${p.fonte}: «${p.nome}». `
      + (riempiti.length ? `Ho compilato: ${riempiti.join(", ")}. Controlla che sia giusto.` : "I campi erano già compilati: non ho cambiato nulla.")
      + (mancano.length ? ` Manca ancora: ${mancano.join(", ")}.` : ""));
  } catch (err) {
    mostraInfo(err.message);
  } finally {
    bottoneCercaProdotto.disabled = false;
    bottoneCercaProdotto.textContent = "Cerca";
  }
}

// Mette il valore nel campo solo se il campo è vuoto e il valore esiste. Ritorna true se l'ha messo.
function riempiSeVuoto(campo, valore) {
  if (campo.value.trim() || valore == null || valore === "") return false;
  campo.value = valore;
  return true;
}

function mostraInfo(testo) {
  infoForm.textContent = testo;
  infoForm.hidden = false;
}

// La libreria segnala gli errori con testi tecnici in inglese: li traduciamo in qualcosa di utile
function messaggioFotocamera(err) {
  const testo = String(err);
  if (/NotAllowed|Permission/i.test(testo)) return "Accesso alla fotocamera negato. Riattivalo dall'icona accanto all'indirizzo, oppure scrivi il codice a mano.";
  if (/NotFound|Requested device not found/i.test(testo)) return "Nessuna fotocamera trovata su questo dispositivo: scrivi il codice a mano.";
  if (/NotReadable|in use/i.test(testo)) return "La fotocamera è usata da un'altra app: chiudila e riprova.";
  return "Non riesco ad accendere la fotocamera: scrivi il codice a mano.";
}

bottoneChiudi.addEventListener("click", () => finestra.close());
bottoneAnnulla.addEventListener("click", () => finestra.close());
bottoneElimina.addEventListener("click", () => elimina(inModifica));

// Clic sullo sfondo scuro fuori dalla finestra: chiude.
// (Il contenuto è dentro .finestra-contenuto, quindi e.target è il dialog solo se clicchi fuori.)
finestra.addEventListener("click", (e) => {
  if (e.target === finestra) finestra.close();
});

// Comunque venga chiusa (X, Annulla, Esc, sfondo, dopo il salvataggio) la finestra
// lancia l'evento "close": è il posto giusto per rimettere il form in modalità "nuovo".
finestra.addEventListener("close", svuotaForm);

// --- Lettura e validazione dei dati del form ---
function leggiForm() {
  return {
    nome: campi.nome.value.trim(),
    categoria: campi.categoria.value,
    peso_g: Number(campi.peso_g.value),
    marchio: campi.marchio.value.trim(),
    quantita_posseduta: Number(campi.quantita_posseduta.value || 1),
    caratteristiche: campi.caratteristiche.value.trim(),
    is_indispensabile: campi.is_indispensabile.checked,
    is_preferito: campi.is_preferito.checked,
    codice_etichetta: campi.codice_etichetta.value.trim(),
    note: campi.note.value.trim(),
  };
}

// B1 (revisione UX 2): ogni errore dice a quale campo si riferisce, e il messaggio compare sotto quel campo
function validaLatoClient(dati) {
  const errori = [];
  if (!dati.nome) errori.push({ campo: "nome", testo: "Scrivi il nome dell'oggetto" });
  if (!dati.categoria) errori.push({ campo: "categoria", testo: "Scegli una categoria" });
  if (!Number.isInteger(dati.peso_g) || dati.peso_g < 1) errori.push({ campo: "peso_g", testo: "Il peso va scritto in grammi: un numero intero, almeno 1" });
  if (!Number.isInteger(dati.quantita_posseduta) || dati.quantita_posseduta < 1 || dati.quantita_posseduta > 99) {
    errori.push({ campo: "quantita_posseduta", testo: "I pezzi posseduti vanno da 1 a 99" });
  }
  return errori;
}

// --- Salvataggio: POST se nuovo, PUT se in modifica ---
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  nascondiErrore();

  const dati = leggiForm();
  const errori = validaLatoClient(dati);
  if (mostraErroriCampi(form, errori)) return; // B1: sotto i campi sbagliati, e il cursore va al primo

  bottoneSalva.disabled = true;
  const eraNuovo = !inModifica; // dopo close() inModifica si azzera: ce lo segniamo prima
  let salvato;
  try {
    if (inModifica) {
      salvato = await api(`/api/oggetti/${inModifica}`, { method: "PUT", body: dati });
    } else {
      const nuovo = await api("/api/oggetti", { method: "POST", body: dati });
      salvato = nuovo;
      // B6 (revisione UX 2): arrivata dallo zaino? l'oggetto entra anche nello zaino e si torna lì
      if (perUscita) {
        await api(`/api/viaggi/${perUscita}/zaino`, { method: "POST", body: { oggetto_id: nuovo.id, quantita: 1 } });
        location.href = `/zaino.html?id=${perUscita}&aggiunto=${encodeURIComponent(nuovo.nome)}`;
        return;
      }
    }
    finestra.close(); // la chiusura svuota anche il form (evento "close")
    await carica();
    mostraSalvato(salvato, eraNuovo); // C11
  } catch (err) {
    mostraErrore(err.message); // es. "Hai già un oggetto con questo nome nell'armadio" (409)
  } finally {
    bottoneSalva.disabled = false;
  }
});

// --- C11 (revisione UX 2): dopo "Salva" si vede COSA è successo ---
// La lista scorre fino all'oggetto, la sua riga si illumina per un attimo e in basso compare la conferma.
const avvisoSalvato = document.querySelector("#avviso-salvato");
let timerSalvato = null;

function mostraSalvato(oggetto, eraNuovo) {
  const riga = lista.querySelector(`.riga[data-id="${oggetto.id}"]`);
  let testo = eraNuovo ? `«${oggetto.nome}» aggiunto all'armadio` : `«${oggetto.nome}» salvato`;
  if (riga) {
    // chi ha chiesto meno animazioni nel sistema non vede lo scorrimento morbido
    const morbido = !matchMedia("(prefers-reduced-motion: reduce)").matches;
    riga.scrollIntoView({ block: "center", behavior: morbido ? "smooth" : "auto" });
    riga.classList.add("appena-salvato"); // l'animazione è nel CSS
    riga.addEventListener("animationend", () => riga.classList.remove("appena-salvato"), { once: true });
  } else {
    testo += " (con la ricerca o il filtro di adesso non si vede)";
  }
  avvisoSalvato.textContent = testo;
  avvisoSalvato.hidden = false;
  clearTimeout(timerSalvato);
  timerSalvato = setTimeout(() => { avvisoSalvato.hidden = true; }, 4000);
}

function mostraErrore(testo) {
  erroreForm.textContent = testo;
  erroreForm.hidden = false;
}

function nascondiErrore() {
  erroreForm.hidden = true;
}

// --- Ricerca: ogni volta che cambia il testo, si ricarica dall'API ---
q.addEventListener("input", carica);

pulisciScrivendo(form); // B1: correggendo un campo (o scegliendo la categoria), il suo messaggio d'errore sparisce

await carica(); // primo caricamento all'apertura della pagina

// B1: arrivo dallo zaino con ?apri=ID ("Aggiorna i pezzi"): apro la scheda di quell'oggetto
const daAprire = Number(new URLSearchParams(location.search).get("apri"));
if (daAprire) {
  history.replaceState(null, "", location.pathname);
  const oggetto = oggetti.find((o) => o.id === daAprire);
  if (oggetto) apriDettaglio(oggetto);
}

// B5: arrivo dal riquadro "Per questo viaggio" con ?nuovo=Casco&categoria=sicurezza:
// apro il form del nuovo oggetto con nome e categoria già scritti (poi tolgo i parametri dall'indirizzo)
const richiesta = new URLSearchParams(location.search);
if (richiesta.has("nuovo")) {
  history.replaceState(null, "", location.pathname);
  svuotaForm();
  campi.nome.value = richiesta.get("nuovo");
  if (CATEGORIE[richiesta.get("categoria")]) campi.categoria.value = richiesta.get("categoria");
  // B6 (revisione UX 2): salvando, l'oggetto entra anche nello zaino dell'uscita e si torna lì
  perUscita = Number(richiesta.get("uscita")) || null;
  if (perUscita) {
    const torna = document.createElement("a");
    torna.href = `/zaino.html?id=${perUscita}`;
    torna.textContent = "← Torna allo zaino";
    infoForm.replaceChildren(torna, document.createElement("br"),
      "Completa peso e dettagli e salva: l'oggetto entra anche nello zaino del viaggio.");
  } else {
    infoForm.textContent = "Dal tuo viaggio: completa peso e dettagli, poi salva. Torna al viaggio e premi «Genera zaino».";
  }
  infoForm.hidden = false;
  apriFinestra(campi.peso_g); // nome e categoria ci sono già: si parte dal peso
}
