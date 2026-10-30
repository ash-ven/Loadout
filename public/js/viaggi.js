import { api, esc, formattaData, oggiISO } from "./api.js";
import "./menu.js";
import { segno } from "./segni.js";
import { ATTIVITA } from "./categorie.js";
import { attivaCampoLuogo } from "./campo-luogo.js";
import { attivaMappaForm } from "./mappa-form.js";
import { staccaPostItScrivendo } from "./post-it.js";

// --- Elementi della pagina ---
const lista = document.querySelector("#lista");
const segmenti = document.querySelector("#filtri-viaggi"); // con un id: nella pagina ci sono due gruppi di segmenti
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
let prima = null;      // il viaggio com'era prima della modifica (per capire se lo zaino va aggiornato)

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
    ATTIVITA[v.attivita] ?? v.attivita,
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
          ${v.pianificato ? segno("da-fare") : ""}
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
  if (dettagliPercorso.open) mappaForm.apri(); // «Percorso» era già aperto: la mappa va rimisurata
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

// Mappe, fase 5: la mappa facoltativa dentro «Percorso». Scrive nei campi veri del form con il post-it.
const dettagliPercorso = document.querySelector("#dettagli-percorso");
const mappaForm = attivaMappaForm({
  contenitore: document.querySelector("#mappa-form"),
  conteggio: document.querySelector("#conteggio-punti"),
  stato: document.querySelector("#stato-mappa"),
  interruttoreAnello: document.querySelector("#anello"),
  bottoneTogli: document.querySelector("#togli-punto"),
  bottoneRicomincia: document.querySelector("#ricomincia"),
  campi: { km: campi.distanza_km, dislivello: campi.dislivello_m, quotaMax: campi.quota_max_m, quotaMin: campi.quota_min_m },
  coordinate: { latPartenza: campi.lat_partenza, lonPartenza: campi.lon_partenza, latArrivo: campi.lat_arrivo, lonArrivo: campi.lon_arrivo },
});
// La mappa nasce (o si rimisura) quando apri «Percorso»: dentro un <details> chiuso Leaflet misurerebbe zero
dettagliPercorso.addEventListener("toggle", () => { if (dettagliPercorso.open) mappaForm.apri(); });

// I campi che possono avere il post-it (compilati dalla mappa o dal luogo): scrivendo a mano diventano tuoi
const CAMPI_POST_IT = ["lat_partenza", "lon_partenza", "lat_arrivo", "lon_arrivo", "distanza_km", "dislivello_m", "quota_max_m", "quota_min_m"];
staccaPostItScrivendo(CAMPI_POST_IT.map((nome) => campi[nome]));

// B1: i due campi luogo con i suggerimenti (il nome e, scegliendo, le coordinate).
// Scegliendo la partenza la mappa si centra lì (le puntine non si spostano, il nome non lo tocca nessuno)
const luogoPartenza = attivaCampoLuogo({
  campoTesto: campi.luogo_partenza, lista: document.querySelector("#suggerimenti-partenza"),
  campoLat: campi.lat_partenza, campoLon: campi.lon_partenza,
  suScelta: (lat, lon) => mappaForm.centra(lat, lon),
});
const luogoArrivo = attivaCampoLuogo({
  campoTesto: campi.luogo_arrivo, lista: document.querySelector("#suggerimenti-arrivo"),
  campoLat: campi.lat_arrivo, campoLon: campi.lon_arrivo,
});

// Quando la finestra si chiude, il form torna pulito per la prossima volta
function svuotaForm() {
  form.reset(); // rimette i valori iniziali scritti nell'HTML (1 persona, 1 giorno, "genera" spuntato)
  CAMPI_POST_IT.forEach((nome) => delete campi[nome].dataset.auto); // reset() non toglie i post-it
  mappaForm.svuota();
  erroreForm.hidden = true;
  inModifica = null;
  titoloForm.textContent = "Prepara il tuo cammino";
  bottoneSalva.textContent = "Crea il viaggio";
  rigaGenera.hidden = false;
  luogoPartenza.aggiorna();
  luogoArrivo.aggiorna();
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
  prima = v;
  titoloForm.textContent = `Modifica: ${v.nome}`;
  bottoneSalva.textContent = "Salva le modifiche";
  rigaGenera.hidden = true; // lo zaino c'è già: "genera" lo trovi nella scheda
  for (const nome of ["nome", "attivita", "n_persone", "n_giorni", "pernotto", "data_partenza", "distanza_km",
                      "dislivello_m", "lat_partenza", "lon_partenza", "lat_arrivo", "lon_arrivo", "note",
                      "luogo_partenza", "luogo_arrivo", "quota_max_m", "quota_min_m"]) {
    campi[nome].value = v[nome] ?? "";
  }
  campi.ora_partenza.value = v.ora_partenza ?? "08:00"; // senza ora salvata, vale quella di default
  // I post-it in modifica (non sappiamo chi aveva scritto i valori, quindi indoviniamo nel modo più utile):
  // - coordinate: dalla mappa se c'è una traccia, altrimenti dal luogo → scegliendo un altro luogo si aggiornano;
  // - i quattro valori del percorso: dalla mappa solo se c'è una traccia, altrimenti sono tuoi.
  const origine = v.traccia ? "mappa" : "luogo";
  for (const nome of ["lat_partenza", "lon_partenza", "lat_arrivo", "lon_arrivo"]) {
    if (campi[nome].value !== "") campi[nome].dataset.auto = origine;
  }
  if (v.traccia) {
    for (const nome of ["distanza_km", "dislivello_m", "quota_max_m", "quota_min_m"]) {
      if (campi[nome].value !== "") campi[nome].dataset.auto = "mappa";
    }
  }
  mappaForm.carica(v); // le puntine e la traccia salvate (compaiono quando apri «Percorso»)
  campi.serve_cucina.checked = v.serve_cucina;
  campi.pianificato.checked = v.pianificato;
  apriFinestra();
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
    luogo_partenza: campi.luogo_partenza.value.trim(),
    luogo_arrivo: campi.luogo_arrivo.value.trim(),
    quota_max_m: numero("quota_max_m"),
    quota_min_m: numero("quota_min_m"),
    ora_partenza: campi.ora_partenza.value || undefined,
    // la traccia della mappa ({ tappe, linea }); senza percorso non si manda, e il server salva null
    traccia: mappaForm.traccia() ?? undefined,
  };
}

function validaLatoClient(d) {
  const errori = [];
  if (!d.nome) errori.push("Il nome dell'uscita è obbligatorio");
  if (!d.luogo_partenza) errori.push("Scrivi da dove parti");
  if (d.quota_max_m !== undefined && (!Number.isInteger(d.quota_max_m) || d.quota_max_m < 0 || d.quota_max_m > 9000)) {
    errori.push("La quota massima deve essere un numero intero di metri, tra 0 e 9000");
  }
  if (d.quota_min_m !== undefined && (!Number.isInteger(d.quota_min_m) || d.quota_min_m < -500 || d.quota_min_m > 9000)) {
    errori.push("La quota minima deve essere un numero intero di metri, tra -500 e 9000");
  }
  if (d.quota_min_m !== undefined && d.quota_max_m !== undefined && d.quota_min_m > d.quota_max_m) {
    errori.push("La quota minima non può superare la quota massima");
  }
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
    let zainoDaAggiornare = false;
    if (inModifica) {
      // Modifica: PUT con il viaggio intero. Lo zaino non cambia da solo, ma se sono cambiati
      // i dati che decidono cosa ci va dentro, nella scheda proponiamo di aggiornarlo.
      await api(`/api/viaggi/${inModifica}`, { method: "PUT", body: dati });
      zainoDaAggiornare = ["attivita", "pernotto", "serve_cucina", "n_giorni"]
        .some((campo) => String(dati[campo]) !== String(prima[campo]));
    } else {
      const url = campi.genera.checked ? "/api/viaggi?genera=true" : "/api/viaggi";
      id = (await api(url, { method: "POST", body: dati })).id;
    }
    // si va (o si torna) alla scheda del viaggio; "&aggiorna=1" = mostra la proposta di aggiornare lo zaino
    location.href = `/scheda-viaggio.html?id=${id}${zainoDaAggiornare ? "&aggiorna=1" : ""}`;
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
  if (v) {
    apriModifica(v);
    // "Disegna la mappa" della scheda (?mappa=1): apro subito «Percorso e coordinate», dove si disegna la mappa
    if (new URLSearchParams(location.search).has("mappa")) {
      const percorso = form.querySelector("details");
      percorso.open = true;
      percorso.scrollIntoView({ block: "start" });
    }
  } else location.href = "/viaggi.html"; // id sbagliato o viaggio non mio: torno alla lista
}