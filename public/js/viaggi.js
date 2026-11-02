import { api, esc, formattaData, oggiISO } from "./api.js";
import "./menu.js";
import { segno } from "./segni.js";
import { ATTIVITA } from "./categorie.js";
import { attivaFormUscita } from "./form-uscita.js";

// --- Elementi della pagina ---
const lista = document.querySelector("#lista");
const segmenti = document.querySelector("#filtri-viaggi"); // con un id: nella pagina ci sono due gruppi di segmenti
const riepilogo = document.querySelector("#riepilogo");
const bottoneNuovo = document.querySelector("#apri-nuovo");    // "Nuovo viaggio" nella testata

// --- Stato ---
let viaggi = [];
let filtro = "tutti"; // "tutti" | "da-fare" | "organizzati"

// B12 (revisione UX 2): la finestra "Prepara il tuo cammino" sta in un modulo condiviso con la scheda dell'uscita.
// Qui serve per CREARE: dopo il salvataggio si va alla scheda della nuova uscita.
const formUscita = attivaFormUscita({
  suSalvato: ({ id, zainoDaAggiornare }) => {
    location.href = `/scheda-viaggio.html?id=${id}${zainoDaAggiornare ? "&aggiorna=1" : ""}`;
  },
});
bottoneNuovo.addEventListener("click", () => formUscita.nuova());

// Vecchi collegamenti a viaggi.html?modifica=7 (ora la modifica si apre nella scheda): funzionano ancora,
// e chiudendo la finestra si torna alla scheda
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

await carica();
if (daModificare) {
  const v = viaggi.find((x) => x.id === daModificare);
  if (v) formUscita.modifica(v, { alChiudere: () => { location.href = `/scheda-viaggio.html?id=${daModificare}`; } });
  else location.href = "/viaggi.html"; // id sbagliato o viaggio non mio: torno alla lista
}
