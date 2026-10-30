import { api } from "./api.js";
import "./menu.js";
import { attivaDisegnoMappa } from "./mappa-disegno.js";
import { staccaPostItScrivendo } from "./post-it.js";

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
  campi: { km: campi.distanza_km, dislivello: campi.dislivello_m, quotaMax: campi.quota_max_m, quotaMin: campi.quota_min_m },
  coordinate: { latPartenza: campi.lat_partenza, lonPartenza: campi.lon_partenza, latArrivo: campi.lat_arrivo, lonArrivo: campi.lon_arrivo },
  suModifica: () => { daSalvare = true; messaggioEl.hidden = true; },
});

// Scrivendo a mano il post-it si stacca (e la pagina ha modifiche da salvare)
staccaPostItScrivendo(CAMPI.map((nome) => campi[nome]));
form.addEventListener("input", () => { daSalvare = true; messaggioEl.hidden = true; });
window.addEventListener("beforeunload", (e) => { if (daSalvare) e.preventDefault(); });

// Riempie i campi con l'uscita salvata. Non sappiamo chi aveva scritto i valori, quindi indoviniamo nel modo più utile:
// coordinate dalla mappa se c'è una traccia, altrimenti dal luogo (così disegnando si aggiornano);
// i quattro valori dalla mappa solo se c'è una traccia, altrimenti sono tuoi.
function riempi(v) {
  for (const nome of CAMPI) {
    campi[nome].value = v[nome] ?? "";
    delete campi[nome].dataset.auto;
  }
  for (const nome of ["lat_partenza", "lon_partenza", "lat_arrivo", "lon_arrivo"]) {
    if (campi[nome].value !== "") campi[nome].dataset.auto = v.traccia ? "mappa" : "luogo";
  }
  if (v.traccia) {
    for (const nome of ["distanza_km", "dislivello_m", "quota_min_m", "quota_max_m"]) {
      if (campi[nome].value !== "") campi[nome].dataset.auto = "mappa";
    }
  }
}

// --- Salva il percorso ---
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  erroreEl.hidden = true;
  const numero = (nome) => (campi[nome].value === "" ? null : Number(campi[nome].value));
  const dati = Object.fromEntries(CAMPI.map((nome) => [nome, numero(nome)]));
  dati.traccia = disegno.traccia(); // { tappe, linea } oppure null
  if (dati.quota_min_m != null && dati.quota_max_m != null && dati.quota_min_m > dati.quota_max_m) {
    erroreEl.textContent = "La quota minima non può superare la quota massima";
    erroreEl.hidden = false;
    return;
  }
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
