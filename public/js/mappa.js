import { api } from "./api.js";
import "./menu.js";
import { attivaDisegnoMappa } from "./mappa-disegno.js";
import { staccaPostItScrivendo } from "./post-it.js";
import { erroriCoordinate, erroriQuote, uniformaDecimali } from "./controlli.js";
import { mostraErroriCampi, pulisciScrivendo } from "./errori-campi.js";
import { scaricaGpx } from "./gpx.js";
import { leggiGpx, preparaImport } from "./gpx-lettura.js";
import { attivaNavigazione } from "./navigazione.js";
import { attivaProfilo } from "./profilo-altimetrico.js";
import { discesaDellaTraccia } from "./navigazione-calcoli.js";

// Pagina della mappa di un'uscita: mappa.html?id=7 (come la pagina dello zaino).
// Qui si disegna il percorso; «Salva il percorso» salva traccia, km, dislivello positivo, quote e coordinate
// con PUT /api/viaggi/:id/percorso (il resto dell'uscita non si tocca).
const id = Number(new URLSearchParams(location.search).get("id"));
const titolo = document.querySelector("#titolo");
const form = document.querySelector("#form-percorso");
const campi = form.elements;
const erroreEl = document.querySelector("#errore-percorso");
const messaggioEl = document.querySelector("#messaggio-percorso");
const CAMPI = ["distanza_km", "dislivello_m", "quota_min_m", "quota_max_m", "lat_partenza", "lon_partenza", "lat_arrivo", "lon_arrivo"];

let daSalvare = false; // modifiche non ancora salvate: se esci, il browser chiede conferma

const disegno = attivaDisegnoMappa({
  contenitore: document.querySelector("#mappa"),
  conteggio: document.querySelector("#conteggio-punti"),
  stato: document.querySelector("#stato-mappa"),
  interruttoreAnello: document.querySelector("#anello"),
  bottoneTogli: document.querySelector("#togli-punto"),
  bottoneRicomincia: document.querySelector("#ricomincia"),
  legenda: document.querySelector(".legenda"),          // B11
  notaAnello: document.querySelector("#nota-anello"),   // B11
  sceltaProfilo: document.querySelector("#scelta-profilo"), // «Sentieri / Più breve»
  elencoTappe: document.querySelector("#elenco-tappe"),     // l'ordine dei punti, con ↑ ↓ ✕
  avvisoImportata: document.querySelector("#avviso-importata"), // B8
  messaggioImport: document.querySelector("#messaggio-gpx"),      // collaudo B6
  notaProfilo: document.querySelector("#nota-profilo"),           // collaudo B2
  annuncio: document.querySelector("#annuncio-tappe"),            // collaudo B3
  campi: { km: campi.distanza_km, dislivello: campi.dislivello_m, quotaMax: campi.quota_max_m, quotaMin: campi.quota_min_m },
  coordinate: { latPartenza: campi.lat_partenza, lonPartenza: campi.lon_partenza, latArrivo: campi.lat_arrivo, lonArrivo: campi.lon_arrivo },
  suModifica: () => { daSalvare = true; messaggioEl.hidden = true; },
  suCalcolo: (dati) => { calcolati = dati; mostraCalcoli(); mostraDiscesa(dati?.discesa_m); profilo.mostra(dati ? disegno.traccia() : null, dati?.distanza_km); },
});

// =====================================================================
//  A2 (revisione UX 2): sotto un valore scritto a mano, quanto calcola la mappa (se è diverso) e "Usa questo"
// =====================================================================
let calcolati = null; // l'ultimo percorso calcolato: { distanza_km, dislivello_m, quota_min_m, quota_max_m } o null
const QUATTRO = ["distanza_km", "dislivello_m", "quota_min_m", "quota_max_m"];
const formatta = (nome, n) => nome === "distanza_km"
  ? `${n.toLocaleString("it-IT", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} km`
  : `${Math.round(n).toLocaleString("it-IT", { useGrouping: "always" })} m`;
// "Diversi" = almeno 0,1 km per la lunghezza, almeno 1 m per dislivello e quote
const diversi = (nome, a, b) => nome === "distanza_km" ? Math.round(a * 10) !== Math.round(b * 10) : Math.round(a) !== Math.round(b);

function mostraCalcoli() {
  for (const nome of QUATTRO) {
    const riga = document.querySelector(`.calcolo-mappa[data-per="${nome}"]`);
    const campo = campi[nome];
    const dellaMappa = calcolati?.[nome];
    const tuo = campo.value !== "" && campo.dataset.auto === undefined; // scritto da te (niente post-it)
    const mostra = dellaMappa != null && tuo && diversi(nome, Number(campo.value), dellaMappa);
    riga.hidden = !mostra;
    if (mostra) {
      // createElement + textContent: niente innerHTML
      const bottone = document.createElement("button");
      bottone.type = "button";
      bottone.className = "usa-mappa";
      bottone.textContent = "Usa questo";
      bottone.addEventListener("click", () => {
        campo.value = nome === "distanza_km" ? dellaMappa : Math.round(dellaMappa);
        campo.dataset.auto = "mappa"; // torna "dalla mappa": la mappa lo aggiornerà di nuovo
        aggiornaDiscesa(); // A3: con il D+ della mappa torna anche il D− della mappa
        daSalvare = true;
        mostraCalcoli();
      });
      riga.replaceChildren(`La mappa calcola ${formatta(nome, dellaMappa)} · `, bottone);
    }
  }
}
// Il dislivello negativo: non si scrive a mano, sta nella sua casella accanto al D+ (null = vuota).
// Collaudo 3/11, A3: se il D+ l'hai scritto TU, il D− della mappa non c'entra più con il tuo D+:
// lo stimiamo con la stessa regola (D− = D+ − (quota d'arrivo − quota di partenza)) e la casella dice «stimato».
const campoDiscesa = document.querySelector("#campo-discesa");
let discesaMappa = null; // quello che ha calcolato la mappa (o che era salvato)
function mostraDiscesa(metri) {
  discesaMappa = metri ?? null;
  aggiornaDiscesa();
}
// → il D− da mostrare e da salvare
function aggiornaDiscesa() {
  const dPiu = campi.dislivello_m;
  const tuo = dPiu.value !== "" && dPiu.dataset.auto === undefined;
  const linea = disegno.traccia()?.linea;
  const stima = tuo && linea ? discesaDellaTraccia({ linea }, Number(dPiu.value)) : null;
  const valore = stima ?? discesaMappa;
  campoDiscesa.value = valore == null ? "" : Math.round(valore);
  if (valore == null) delete campoDiscesa.dataset.auto;
  else campoDiscesa.dataset.auto = stima != null ? "stima" : "mappa"; // post-it «stimato» oppure «dalla mappa»
  return valore == null ? null : Math.round(valore);
}

// Se scrivi in un campo, il confronto si aggiorna subito (e il D−, se cambi il D+: A3)
QUATTRO.forEach((nome) => campi[nome].addEventListener("input", () => { mostraCalcoli(); aggiornaDiscesa(); }));

// Scrivendo a mano il post-it si stacca (e la pagina ha modifiche da salvare)
staccaPostItScrivendo(CAMPI.map((nome) => campi[nome]));
pulisciScrivendo(form); // B1: correggendo un campo, il suo messaggio d'errore sparisce
uniformaDecimali(CAMPI.map((nome) => campi[nome])); // C1: sempre la virgola
form.addEventListener("input", () => { daSalvare = true; messaggioEl.hidden = true; });
window.addEventListener("beforeunload", (e) => { if (daSalvare) e.preventDefault(); });

// Riempie i campi con l'uscita salvata e rimette i post-it com'erano.
// A1 (revisione UX 2): la traccia salvata ricorda quali valori aveva compilato la mappa o il luogo (traccia.origini);
// tutti gli altri li hai scritti tu, e la mappa non li tocca più, nemmeno dopo aver riaperto la pagina.
function riempi(v) {
  for (const nome of CAMPI) {
    campi[nome].value = v[nome] ?? "";
    delete campi[nome].dataset.auto;
  }
  const origini = v.traccia?.origini;
  if (origini) {
    for (const [nome, da] of Object.entries(origini)) {
      if (campi[nome] && campi[nome].value !== "") campi[nome].dataset.auto = da;
    }
    return;
  }
  // Uscite salvate prima che esistessero le origini: per le coordinate indoviniamo (mappa se c'è una traccia,
  // altrimenti luogo); i quattro valori del percorso, NEL DUBBIO, sono tuoi: così la mappa non può cancellarli.
  for (const nome of ["lat_partenza", "lon_partenza", "lat_arrivo", "lon_arrivo"]) {
    if (campi[nome].value !== "") campi[nome].dataset.auto = v.traccia ? "mappa" : "luogo";
  }
}

// Quali campi sono compilati in automatico adesso: { campo: "mappa" | "luogo" } (gli altri sono tuoi)
function originiAttuali() {
  return Object.fromEntries(CAMPI
    .filter((nome) => campi[nome].dataset.auto && campi[nome].value !== "")
    .map((nome) => [nome, campi[nome].dataset.auto]));
}

// --- Salva il percorso ---
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  erroreEl.hidden = true;
  const numero = (nome) => (campi[nome].value === "" ? null : Number(campi[nome].value));
  const dati = Object.fromEntries(CAMPI.map((nome) => [nome, numero(nome)]));
  const traccia = disegno.traccia(); // { tappe, linea } oppure null
  // A1: con la traccia si salva anche chi ha scritto ogni valore, così alla riapertura i post-it tornano giusti
  dati.traccia = traccia ? { ...traccia, origini: originiAttuali() } : null;
  // A3: si salva il D− che vedi (stimato, se il D+ è tuo), così la scheda mostra gli stessi numeri
  const discesa = aggiornaDiscesa();
  if (dati.traccia) {
    if (discesa != null) dati.traccia.discesa_m = discesa;
    else delete dati.traccia.discesa_m;
  }
  // A3 + B1: coordinate e quote controllate prima di salvare, con il messaggio sotto il campo sbagliato
  if (mostraErroriCampi(form, [...erroriCoordinate(dati), ...erroriQuote(dati)])) return;
  const bottone = document.querySelector("#salva-percorso");
  bottone.disabled = true;
  try {
    await api(`/api/viaggi/${id}/percorso`, { method: "PUT", body: dati });
    daSalvare = false;
    messaggioEl.textContent = "Percorso salvato. Il meteo in vetta e i consigli del viaggio lo usano già.";
    messaggioEl.hidden = false;
  } catch (err) {
    erroreEl.textContent = err.message;
    erroreEl.hidden = false;
  } finally {
    bottone.disabled = false;
  }
});

// --- Profilo altimetrico: passando sul grafico, il punto si accende anche sulla mappa ---
let puntoSullaMappa = null;
function accendiPunto(punto) {
  const mappa = disegno.mappaLeaflet();
  if (!mappa) return;
  if (!punto) { puntoSullaMappa?.remove(); puntoSullaMappa = null; return; }
  if (!puntoSullaMappa) {
    // senape e su-senape, come il cursore del profilo
    puntoSullaMappa = L.circleMarker(punto, { radius: 7, color: "#2b1f05", weight: 2, fillColor: "#c8962b", fillOpacity: 1, interactive: false }).addTo(mappa);
  } else puntoSullaMappa.setLatLng(punto);
}
const profilo = attivaProfilo({
  sezione: document.querySelector("#profilo"),
  contenitore: document.querySelector("#profilo-grafico"),
  riepilogo: document.querySelector("#profilo-riepilogo"),
  suPunto: accendiPunto,
});

// --- Navigazione con il GPS: segue la traccia che vedi sulla mappa ---
const $ = (sel) => document.querySelector(sel);
const navigazione = attivaNavigazione({
  el: {
    bottone: $("#naviga"), erroreAvvio: $("#errore-naviga"), pannello: $("#pannello-navigazione"),
    fatti: $("#nav-fatti"), mancano: $("#nav-mancano"), salita: $("#nav-salita"), arrivo: $("#nav-arrivo"),
    fuori: $("#fuori-percorso"), testoFuori: $("#testo-fuori-percorso"), stato: $("#stato-navigazione"),
    centra: $("#centra"), termina: $("#termina-navigazione"),
  },
  ottieniMappa: () => disegno.mappaLeaflet(),
  ottieniLinea: () => disegno.traccia()?.linea ?? null,
  blocca: (si) => disegno.blocca(si),
  suProgresso: (metri) => profilo.posizione(metri), // il pallino blu anche sul profilo
});

// --- Tappa da coordinate ---
const tappaLat = document.querySelector("#tappa-lat");
const tappaLon = document.querySelector("#tappa-lon");
const erroreTappa = document.querySelector("#errore-tappa");
uniformaDecimali([tappaLat, tappaLon]); // C1: sempre la virgola
// Incollare "44.1934, 10.7012" (o "44,1934 10,7012") nel primo campo: un campo numerico rifiuterebbe il testo,
// quindi lo leggiamo noi, prendiamo i due numeri e riempiamo tutti e due i campi
tappaLat.addEventListener("paste", (e) => {
  const numeri = (e.clipboardData.getData("text").match(/-?\d+(?:[.,]\d+)?/g) ?? []).map((n) => Number(n.replace(",", ".")));
  if (numeri.length < 2) return; // un numero solo: lo incolla il browser, come sempre
  e.preventDefault();
  [tappaLat.value, tappaLon.value] = numeri;
});
const confermaTappa = document.querySelector("#conferma-tappa");
let inAttesa = null; // B4: la tappa lontana in attesa di conferma: [lat, lon]
function provaTappa(lat, lon, confermata = false) {
  const esito = disegno.aggiungiTappa(lat, lon, confermata);
  if (esito?.domanda) { // B4: troppo lontana → chiediamo conferma
    inAttesa = [lat, lon];
    document.querySelector("#testo-conferma-tappa").textContent = esito.domanda;
    confermaTappa.hidden = false;
    document.querySelector("#conferma-si").focus();
    return;
  }
  confermaTappa.hidden = true;
  inAttesa = null;
  erroreTappa.hidden = !esito;
  if (esito) { erroreTappa.textContent = esito; return; }
  tappaLat.value = "";
  tappaLon.value = "";
}
document.querySelector("#aggiungi-tappa").addEventListener("click", () => {
  const lat = tappaLat.value === "" ? NaN : Number(tappaLat.value);
  const lon = tappaLon.value === "" ? NaN : Number(tappaLon.value);
  const problema = !Number.isFinite(lat) || lat < -90 || lat > 90 ? "La latitudine va da −90 a 90 (in Italia circa 36–47, es. 44,19)"
    : !Number.isFinite(lon) || lon < -180 || lon > 180 ? "La longitudine va da −180 a 180 (in Italia circa 6–19, es. 10,70)"
    : null;
  erroreTappa.hidden = !problema;
  confermaTappa.hidden = true;
  if (problema) { erroreTappa.textContent = problema; return; }
  provaTappa(lat, lon);
});
document.querySelector("#conferma-si").addEventListener("click", () => { if (inAttesa) provaTappa(...inAttesa, true); });
document.querySelector("#conferma-no").addEventListener("click", () => {
  confermaTappa.hidden = true;
  inAttesa = null;
  document.querySelector("#aggiungi-tappa").focus();
});

// --- B8: Importa GPX. Il file lo legge il browser (file.text()), non va al server ---
const fileGpx = document.querySelector("#file-gpx");
const messaggioGpx = document.querySelector("#messaggio-gpx");
fileGpx.addEventListener("change", async () => {
  const file = fileGpx.files[0];
  fileGpx.value = ""; // così si può reimportare lo stesso file
  if (!file) return;
  messaggioGpx.hidden = false;
  messaggioGpx.classList.remove("errore");
  try {
    if (file.size > 20 * 1024 * 1024) throw new Error("Il file è troppo grande (più di 20 MB)");
    const { nome, punti } = leggiGpx(await file.text());
    const importo = preparaImport(punti);
    const eraAnello = document.querySelector("#anello").checked;
    const problema = disegno.importa(importo);
    if (problema) throw new Error(problema);
    const d = importo.dati;
    // B6 (collaudo 3/11): se l'import cambia "Percorso ad anello", lo diciamo
    const anello = importo.anello === eraAnello ? ""
      : importo.anello ? " La traccia torna alla partenza: ho acceso «Percorso ad anello»."
      : " La traccia del file non è un anello: ho spento «Percorso ad anello».";
    messaggioGpx.textContent = `Traccia importata${nome ? ` («${nome}»)` : ""}: ${d.distanza_km.toLocaleString("it-IT")} km` +
      (d.dislivello_m != null ? `, D+ ${d.dislivello_m} m, D− ${d.discesa_m} m` : ", senza quote nel file") +
      `.${anello} Controlla e premi «Salva il percorso».`;
  } catch (err) {
    messaggioGpx.textContent = err.message;
    messaggioGpx.classList.add("errore");
  }
});

// --- Senza rete: un avviso sopra la mappa (online/offline sono eventi del browser) ---
const senzaRete = document.querySelector("#senza-rete");
const aggiornaRete = () => { senzaRete.hidden = navigator.onLine; };
window.addEventListener("online", aggiornaRete);
window.addEventListener("offline", aggiornaRete);
aggiornaRete();

// --- Scarica GPX: il percorso che vedi sulla mappa (anche se non l'hai ancora salvato) ---
let nomeViaggio = "percorso";
const erroreGpx = document.querySelector("#errore-gpx");
document.querySelector("#scarica-gpx").addEventListener("click", () => {
  const traccia = disegno.traccia();
  erroreGpx.hidden = Boolean(traccia);
  if (!traccia) {
    erroreGpx.textContent = "Prima disegna il percorso sulla mappa: servono almeno la partenza e un altro punto.";
    return;
  }
  scaricaGpx(nomeViaggio, traccia);
});

// =====================================================================
//  AVVIO
// =====================================================================
if (!Number.isInteger(id) || id <= 0) {
  location.href = "/mappe.html";
} else {
  document.querySelector("#torna").href = `/scheda-viaggio.html?id=${id}`;
  try {
    const v = await api(`/api/viaggi/${id}`);
    document.title = `Loadout – Mappa: ${v.nome}`;
    titolo.textContent = `Mappa: ${v.nome}`;
    nomeViaggio = v.nome;
    document.querySelector("#intestazione").hidden = false;
    document.querySelector("#corpo-mappa").hidden = false; // prima visibile, poi la mappa (Leaflet misura il contenitore)
    riempi(v);
    mostraDiscesa(discesaDellaTraccia(v.traccia, v.dislivello_m)); // anche per le mappe salvate prima del D−
    profilo.mostra(v.traccia, v.distanza_km); // C2: gli stessi km del campo Lunghezza
    disegno.carica(v);
    await disegno.apri();
    if (disegno.mappaLeaflet()) navigazione.collegaMappa(disegno.mappaLeaflet());
    aggiornaDiscesa(); // ora la traccia c'è: se il D+ salvato era tuo, il D− è la stima (A3)
  } catch (err) {
    document.querySelector("#intestazione").hidden = false;
    titolo.textContent = err.status === 404 ? "Questo viaggio non esiste più o è stato eliminato" : err.message;
  }
}
