import { api, esc, formattaData, oggiISO } from "./api.js";
import "./menu.js";
import { creaMappa, punto, linea, numeroDa } from "./mappa.js";

// --- Elementi della pagina ---
const lista = document.querySelector("#lista");
const segmenti = document.querySelector(".segmenti");
const riepilogo = document.querySelector("#riepilogo");
const form = document.querySelector("#form-viaggio");
const campi = form.elements;
const erroreForm = document.querySelector("#form-errore");
const bottoneSalva = document.querySelector("#salva");
const bottoneAnnulla = document.querySelector("#annulla");
const finestra = document.querySelector("#finestra");          // il <dialog> con il form
const bottoneNuovo = document.querySelector("#apri-nuovo");    // "Nuovo viaggio" nella testata
const bottoneChiudi = document.querySelector("#chiudi");       // la X in alto nella finestra

// --- Stato ---
let viaggi = [];
let filtro = "tutti"; // "tutti" | "da-fare" | "organizzati"

// --- Caricamento: tutti i viaggi, il filtro dei segmenti lo applichiamo qui (così i conteggi restano giusti).
//     Nota: lo stesso filtro esiste anche nell'API (?pianificato=true), utile per curl o per altri client.
async function carica() {
  viaggi = await api("/api/viaggi");
  render();
}

// --- Render: i viaggi divisi in gruppi ---
function render() {
  riepilogo.innerHTML = `<strong>${viaggi.length} ${viaggi.length === 1 ? "viaggio" : "viaggi"}</strong>`;
  segmenti.querySelector('[data-filtro="tutti"]').textContent = `Tutti · ${viaggi.length}`;

  const visibili = viaggi.filter((v) =>
    filtro === "tutti" ? true : filtro === "da-fare" ? v.pianificato : !v.pianificato
  );
  if (visibili.length === 0) {
    lista.innerHTML = `<p class="vuoto">${
      viaggi.length === 0 ? "Nessun viaggio qui. Premi «Nuovo viaggio» per prepararne uno." : "Nessun viaggio con questo filtro."
    }</p>`;
    return;
  }

  // Tre gruppi: in arrivo (data da oggi in poi), senza data, già fatti.
  // Le date ISO ("2026-11-08") si confrontano come testo: l'ordine alfabetico è quello cronologico.
  const oggi = oggiISO();
  const data = (v) => v.data_partenza?.slice(0, 10);
  const gruppi = [
    ["In arrivo", visibili.filter((v) => data(v) && data(v) >= oggi)],
    ["Senza data", visibili.filter((v) => !data(v))],
    ["Già fatti", visibili.filter((v) => data(v) && data(v) < oggi).reverse()], // il più recente in alto
  ];

  lista.innerHTML = gruppi.map(([titolo, elenco]) => elenco.length === 0 ? "" : `
    <section class="gruppo">
      <div class="gruppo-testa"><h2>${titolo}</h2><span>${elenco.length}</span></div>
      <div class="gruppo-righe">${elenco.map(rigaViaggio).join("")}</div>
    </section>`).join("");
}

// Una riga: è un link alla scheda del viaggio
function rigaViaggio(v) {
  const dettagli = [
    v.attivita,
    `${v.n_persone} ${v.n_persone === 1 ? "persona" : "persone"}`,
    `${v.n_giorni} ${v.n_giorni === 1 ? "giorno" : "giorni"}`,
  ].join(", ");
  return `
    <a class="riga" href="/scheda-viaggio.html?id=${v.id}">
      <span class="riquadro-icona"><img src="/img/icone/viaggi.svg" alt="" width="22" height="22"></span>
      <span class="riga-testo">
        <span class="riga-nome">${esc(v.nome)}</span>
        <span class="riga-dettagli">
          <span class="riga-nota">${esc(dettagli)}</span>
          ${v.pianificato ? '<span class="badge preferito">Da fare</span>' : ""}
        </span>
      </span>
      <span class="riga-valore">${v.data_partenza ? formattaData(v.data_partenza) : "—"}</span>
    </a>`;
}

// --- Segmenti Tutti / Da fare / Organizzati ---
segmenti.addEventListener("click", (e) => {
  const bottone = e.target.closest("button[data-filtro]");
  if (!bottone) return;
  filtro = bottone.dataset.filtro;
  segmenti.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b === bottone)));
  render();
});

// --- La finestra (dialog) con il form ---
// showModal() la apre sopra la pagina (il resto non è cliccabile); close() la chiude.
// Il browser la chiude da solo anche con il tasto Esc.
function apriFinestra() {
  finestra.showModal();
  campi.nome.focus(); // il cursore va nel primo campo
}

bottoneNuovo.addEventListener("click", () => {
  svuotaForm();
  apriFinestra();
});
bottoneChiudi.addEventListener("click", () => finestra.close());
bottoneAnnulla.addEventListener("click", () => finestra.close());

// Clic sullo sfondo scuro fuori dalla finestra: chiude.
// (Il contenuto è dentro .finestra-contenuto, quindi e.target è il dialog solo se clicchi fuori.)
finestra.addEventListener("click", (e) => {
  if (e.target === finestra) finestra.close();
});

// Quando la finestra si chiude, il form torna pulito per la prossima volta
function svuotaForm() {
  form.reset(); // rimette i valori iniziali scritti nell'HTML (1 persona, 1 giorno, "genera" spuntato)
  erroreForm.hidden = true;
  disegnaPunti(); // campi vuoti → mappa senza punti
}

// =====================================================================
//  C3: MAPPA PER SCEGLIERE PARTENZA E ARRIVO
//  Lo "stato" sono i 4 campi delle coordinate: il clic sulla mappa li compila,
//  e disegnaPunti() ridisegna la mappa leggendo i campi (anche se li scrivi a mano).
// =====================================================================
let mappa = null;      // creata solo la prima volta che apri la sezione (Leaflet vuole un contenitore visibile)
let livelloPunti = null; // gruppo con i punti e la linea: si svuota e si ridisegna

const sezionePercorso = form.querySelector("details");
sezionePercorso.addEventListener("toggle", () => {
  if (!sezionePercorso.open) return;
  if (!mappa) {
    mappa = creaMappa("mappa-scelta");
    livelloPunti = L.layerGroup().addTo(mappa);
    mappa.on("click", sceltaSullaMappa);
  }
  mappa.invalidateSize(); // il contenitore era nascosto: Leaflet ricalcola le sue misure
  disegnaPunti();
});

function sceltaSullaMappa(e) {
  const { lat, lng } = e.latlng;
  const haPartenza = campi.lat_partenza.value !== "";
  const haArrivo = campi.lat_arrivo.value !== "";
  if (!haPartenza || haArrivo) {
    // primo tocco, oppure terzo (si ricomincia): questo è la partenza
    impostaCoordinate("partenza", lat, lng);
    impostaCoordinate("arrivo", null, null);
  } else {
    impostaCoordinate("arrivo", lat, lng);
  }
  disegnaPunti();
}

function impostaCoordinate(tipo, lat, lon) {
  campi[`lat_${tipo}`].value = lat == null ? "" : lat.toFixed(5); // 5 decimali ≈ 1 metro
  campi[`lon_${tipo}`].value = lon == null ? "" : lon.toFixed(5);
}

function disegnaPunti() {
  if (!mappa) return;
  livelloPunti.clearLayers();
  const partenza = [numeroDa(campi.lat_partenza), numeroDa(campi.lon_partenza)];
  const arrivo = [numeroDa(campi.lat_arrivo), numeroDa(campi.lon_arrivo)];
  const ok = (p) => p[0] !== null && p[1] !== null;
  if (ok(partenza)) punto(...partenza, "partenza").addTo(livelloPunti);
  if (ok(arrivo)) punto(...arrivo, "arrivo").addTo(livelloPunti);
  if (ok(partenza) && ok(arrivo)) linea(partenza, arrivo).addTo(livelloPunti);
}

// Se scrivi le coordinate a mano, la mappa si aggiorna
for (const nome of ["lat_partenza", "lon_partenza", "lat_arrivo", "lon_arrivo"]) {
  campi[nome].addEventListener("change", disegnaPunti);
}
document.querySelector("#ricomincia-mappa").addEventListener("click", () => {
  impostaCoordinate("partenza", null, null);
  impostaCoordinate("arrivo", null, null);
  disegnaPunti();
});
finestra.addEventListener("close", svuotaForm);

// --- Lettura e validazione del form ---
function leggiForm() {
  // campo numerico facoltativo: vuoto → undefined (non viene mandato), altrimenti numero
  const numero = (nome) => (campi[nome].value === "" ? undefined : Number(campi[nome].value));
  return {
    nome: campi.nome.value.trim(),
    attivita: campi.attivita.value,
    n_persone: numero("n_persone"),
    n_giorni: numero("n_giorni"),
    pernotto: campi.pernotto.value,
    serve_cucina: campi.serve_cucina.checked,
    data_partenza: campi.data_partenza.value || undefined,
    distanza_km: numero("distanza_km"),
    dislivello_m: numero("dislivello_m"),
    lat_partenza: numero("lat_partenza"),
    lon_partenza: numero("lon_partenza"),
    lat_arrivo: numero("lat_arrivo"),
    lon_arrivo: numero("lon_arrivo"),
    note: campi.note.value.trim(),
    pianificato: campi.pianificato.checked,
  };
}

function validaLatoClient(d) {
  const errori = [];
  if (!d.nome) errori.push("Il nome dell'uscita è obbligatorio");
  if (d.n_persone !== undefined && (!Number.isInteger(d.n_persone) || d.n_persone < 1 || d.n_persone > 50)) {
    errori.push("Le persone devono essere tra 1 e 50");
  }
  if (d.n_giorni !== undefined && (!Number.isInteger(d.n_giorni) || d.n_giorni < 1 || d.n_giorni > 60)) {
    errori.push("I giorni devono essere tra 1 e 60");
  }
  return errori;
}

// --- Salvataggio ---
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  erroreForm.hidden = true;

  const dati = leggiForm();
  const errori = validaLatoClient(dati);
  if (errori.length) return mostraErrore(errori.join("; "));

  bottoneSalva.disabled = true;
  try {
    const url = campi.genera.checked ? "/api/viaggi?genera=true" : "/api/viaggi";
    const nuovo = await api(url, { method: "POST", body: dati });
    location.href = `/scheda-viaggio.html?id=${nuovo.id}`; // si va subito alla scheda del nuovo viaggio
  } catch (err) {
    mostraErrore(err.message); // US3 CA2: gli errori del server mostrati nel form
    bottoneSalva.disabled = false;
  }
});

function mostraErrore(testo) {
  erroreForm.textContent = testo;
  erroreForm.hidden = false;
}

carica();