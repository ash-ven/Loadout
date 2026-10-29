import { api, esc, formattaData, oggiISO } from "./api.js";
import "./menu.js";
import { creaMappa, punto, tracciato, lineaDritta, numeroDa } from "./mappa.js";

// --- Elementi della pagina ---
const lista = document.querySelector("#lista");
const segmenti = document.querySelector(".segmenti");
const riepilogo = document.querySelector("#riepilogo");
const form = document.querySelector("#form-viaggio");
const campi = form.elements;
const erroreForm = document.querySelector("#form-errore");
const bottoneSalva = document.querySelector("#salva");
const bottoneAnnulla = document.querySelector("#annulla");
const titoloForm = document.querySelector("#titolo-form");
const rigaGenera = document.querySelector("#riga-genera"); // "Genera subito lo zaino": solo quando crei
const finestra = document.querySelector("#finestra");          // il <dialog> con il form
const bottoneNuovo = document.querySelector("#apri-nuovo");    // "Nuovo viaggio" nella testata
const bottoneChiudi = document.querySelector("#chiudi");       // la X in alto nella finestra

// --- Stato ---
let viaggi = [];
let filtro = "tutti"; // "tutti" | "da-fare" | "organizzati"
let inModifica = null; // id del viaggio in modifica (arrivo dalla scheda con ?modifica=ID), oppure null se creo

// "Modifica viaggio" nella scheda porta qui con ?modifica=7: apriamo la finestra già compilata
const daModificare = Number(new URLSearchParams(location.search).get("modifica")) || null;

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
  preparaMappa(); // C3: ora la finestra è visibile e Leaflet può misurare la mappa
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
  inModifica = null;
  titoloForm.textContent = "Prepara il tuo cammino";
  bottoneSalva.textContent = "Crea il viaggio";
  rigaGenera.hidden = false;
  punti = [];      // via anche il percorso sulla mappa
  traccia = null;
  mostraRiepilogo("");
  disegna();
}

finestra.addEventListener("close", () => {
  // Se eri arrivata dalla scheda per modificare il viaggio, chiudendo (Annulla, X, Esc) ci torni
  if (daModificare) {
    location.href = `/scheda-viaggio.html?id=${daModificare}`;
    return;
  }
  svuotaForm();
});

// --- Modifica: riempie il form con i dati del viaggio e apre la finestra ---
function apriModifica(v) {
  svuotaForm();
  inModifica = v.id;
  titoloForm.textContent = `Modifica: ${v.nome}`;
  bottoneSalva.textContent = "Salva le modifiche";
  rigaGenera.hidden = true; // lo zaino c'è già: "genera" lo trovi nella scheda
  for (const nome of ["nome", "attivita", "n_persone", "n_giorni", "pernotto", "data_partenza", "distanza_km",
                      "dislivello_m", "lat_partenza", "lon_partenza", "lat_arrivo", "lon_arrivo", "note"]) {
    campi[nome].value = v[nome] ?? "";
  }
  campi.serve_cucina.checked = v.serve_cucina;
  campi.pianificato.checked = v.pianificato;
  apriFinestra();
  // Sulla mappa: il percorso salvato (se c'è) con partenza e arrivo
  const ok = (lat, lon) => lat != null && lon != null;
  punti = [[v.lat_partenza, v.lon_partenza], [v.lat_arrivo, v.lon_arrivo]].filter(([lat, lon]) => ok(lat, lon));
  traccia = v.traccia ?? null;
  disegna();
  if (traccia) mostraRiepilogo("Percorso salvato. Per cambiarlo, «Cancella il percorso» e tocca i nuovi punti.");
}

// =====================================================================
//  C3: PERCORSO SULLA MAPPA DEI SENTIERI
//  Stato: i punti toccati (partenza, tappe, arrivo) e la traccia calcolata.
//  Ogni volta che i punti cambiano: chiedo il percorso al server (che chiede a BRouter),
//  compilo km, dislivello e coordinate, e ridisegno la mappa.
// =====================================================================
let mappa = null;         // creata la prima volta che si apre la finestra (Leaflet vuole un contenitore visibile)
let livello = null;       // gruppo con punti e linee: si svuota e si ridisegna
let punti = [];           // [[lat, lon], ...] nell'ordine in cui li hai toccati
let traccia = null;       // il percorso lungo i sentieri arrivato dal server, oppure null
let ultimaRichiesta = 0;  // numero dell'ultima richiesta: le risposte "vecchie" vengono ignorate
const riepilogoPercorso = document.querySelector("#riepilogo-percorso");

function preparaMappa() {
  if (!mappa) {
    mappa = creaMappa("mappa-scelta");
    livello = L.layerGroup().addTo(mappa);
    mappa.on("click", (e) => {
      if (punti.length >= 10) return mostraRiepilogo("Al massimo 10 punti.");
      punti.push([e.latlng.lat, e.latlng.lng]);
      cambiatiIPunti();
    });
  }
  mappa.invalidateSize(); // il contenitore era nascosto (finestra chiusa): Leaflet ricalcola le misure
}

async function cambiatiIPunti() {
  traccia = null;
  compilaCoordinate();
  disegna();
  if (punti.length < 2) return mostraRiepilogo(punti.length === 1 ? "Ora tocca l'arrivo (o una tappa)." : "");

  const questa = ++ultimaRichiesta;
  mostraRiepilogo("Cerco il percorso sui sentieri…");
  try {
    const q = punti.map(([lat, lon]) => `${lat.toFixed(5)},${lon.toFixed(5)}`).join(";");
    const percorso = await api(`/api/percorso?punti=${q}`);
    if (questa !== ultimaRichiesta) return; // nel frattempo hai toccato un altro punto: questa risposta è vecchia
    traccia = percorso.traccia;
    campi.distanza_km.value = percorso.distanza_km;
    campi.dislivello_m.value = percorso.dislivello_m;
    mostraRiepilogo(`${percorso.distanza_km.toLocaleString("it-IT")} km sui sentieri, ${percorso.dislivello_m.toLocaleString("it-IT")} m di salita.`);
    disegna();
  } catch (err) {
    if (questa !== ultimaRichiesta) return;
    mostraRiepilogo(err.message); // es. "Nessun sentiero trovato vicino a uno dei punti…"
  }
}

// Partenza = primo punto, arrivo = ultimo: finiscono nei campi del form (che vengono salvati)
function compilaCoordinate() {
  const metti = (tipo, p) => {
    campi[`lat_${tipo}`].value = p ? p[0].toFixed(5) : "";
    campi[`lon_${tipo}`].value = p ? p[1].toFixed(5) : "";
  };
  metti("partenza", punti[0]);
  metti("arrivo", punti.length >= 2 ? punti.at(-1) : null);
}

function disegna() {
  if (!mappa) return;
  livello.clearLayers();
  if (traccia) tracciato(traccia).addTo(livello);                     // il percorso vero
  else if (punti.length >= 2) lineaDritta(punti).addTo(livello);      // in attesa (o se il servizio non c'è)
  punti.forEach((p, i) => {
    const tipo = i === 0 ? "partenza" : i === punti.length - 1 ? "arrivo" : "tappa";
    punto(...p, tipo).addTo(livello);
  });
  if (traccia) mappa.fitBounds(traccia, { padding: [20, 20] });       // inquadra tutto il percorso
}

function mostraRiepilogo(testo) {
  riepilogoPercorso.textContent = testo;
}

document.querySelector("#togli-punto").addEventListener("click", () => {
  punti.pop();
  cambiatiIPunti();
});
document.querySelector("#ricomincia-mappa").addEventListener("click", () => {
  punti = [];
  campi.distanza_km.value = "";
  campi.dislivello_m.value = "";
  cambiatiIPunti();
});

// Se scrivi le coordinate a mano: i punti diventano partenza e arrivo dei campi
for (const nome of ["lat_partenza", "lon_partenza", "lat_arrivo", "lon_arrivo"]) {
  campi[nome].addEventListener("change", () => {
    const partenza = [numeroDa(campi.lat_partenza), numeroDa(campi.lon_partenza)];
    const arrivo = [numeroDa(campi.lat_arrivo), numeroDa(campi.lon_arrivo)];
    punti = [partenza, arrivo].filter((p) => p[0] !== null && p[1] !== null);
    cambiatiIPunti();
  });
}

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
    traccia: traccia ?? undefined, // C3: il percorso lungo i sentieri (se c'è)
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
    let id = inModifica;
    if (inModifica) {
      // Modifica: PUT con il viaggio intero (lo zaino non cambia)
      await api(`/api/viaggi/${inModifica}`, { method: "PUT", body: dati });
    } else {
      const url = campi.genera.checked ? "/api/viaggi?genera=true" : "/api/viaggi";
      id = (await api(url, { method: "POST", body: dati })).id;
    }
    location.href = `/scheda-viaggio.html?id=${id}`; // si va (o si torna) alla scheda del viaggio
  } catch (err) {
    mostraErrore(err.message); // US3 CA2: gli errori del server mostrati nel form
    bottoneSalva.disabled = false;
  }
});

function mostraErrore(testo) {
  erroreForm.textContent = testo;
  erroreForm.hidden = false;
}

await carica();
if (daModificare) {
  const v = viaggi.find((x) => x.id === daModificare);
  if (v) apriModifica(v);
  else location.href = "/viaggi.html"; // id sbagliato o viaggio non mio: torno alla lista
}