import { api } from "./api.js";
import "./menu.js";
import { attivaDisegnoMappa } from "./mappa-disegno.js";
import { staccaPostItScrivendo } from "./post-it.js";
import { erroriCoordinate, erroriQuote, uniformaDecimali } from "./controlli.js";
import { mostraErroriCampi, pulisciScrivendo } from "./errori-campi.js";

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
  campi: { km: campi.distanza_km, dislivello: campi.dislivello_m, quotaMax: campi.quota_max_m, quotaMin: campi.quota_min_m },
  coordinate: { latPartenza: campi.lat_partenza, lonPartenza: campi.lon_partenza, latArrivo: campi.lat_arrivo, lonArrivo: campi.lon_arrivo },
  suModifica: () => { daSalvare = true; messaggioEl.hidden = true; },
  suCalcolo: (dati) => { calcolati = dati; mostraCalcoli(); },
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
        daSalvare = true;
        mostraCalcoli();
      });
      riga.replaceChildren(`La mappa calcola ${formatta(nome, dellaMappa)} · `, bottone);
    }
  }
}
// Se scrivi in un campo, il confronto si aggiorna subito
QUATTRO.forEach((nome) => campi[nome].addEventListener("input", mostraCalcoli));

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
  // A3 + B1: coordinate e quote controllate prima di salvare, con il messaggio sotto il campo sbagliato
  if (mostraErroriCampi(form, [...erroriCoordinate(dati), ...erroriQuote(dati)])) return;
  const bottone = document.querySelector("#salva-percorso");
  bottone.disabled = true;
  try {
    await api(`/api/viaggi/${id}/percorso`, { method: "PUT", body: dati });
    daSalvare = false;
    messaggioEl.textContent = "Percorso salvato. Il meteo in vetta e i consigli dell'uscita lo usano già.";
    messaggioEl.hidden = false;
  } catch (err) {
    erroreEl.textContent = err.message;
    erroreEl.hidden = false;
  } finally {
    bottone.disabled = false;
  }
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
    document.querySelector("#intestazione").hidden = false;
    document.querySelector("#corpo-mappa").hidden = false; // prima visibile, poi la mappa (Leaflet misura il contenitore)
    riempi(v);
    disegno.carica(v);
    await disegno.apri();
  } catch (err) {
    document.querySelector("#intestazione").hidden = false;
    titolo.textContent = err.status === 404 ? "Questa uscita non esiste più o è stata eliminata" : err.message;
  }
}
