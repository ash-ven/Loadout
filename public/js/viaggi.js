import { api, esc, formattaData } from "./api.js";
import "./menu.js";

// --- Elementi della pagina ---
const tbody = document.querySelector("#tabella tbody");
const filtro = document.querySelector("#filtro-pianificati");
const riepilogo = document.querySelector("#riepilogo");
const form = document.querySelector("#form-viaggio");
const campi = form.elements;
const erroreForm = document.querySelector("#form-errore");
const bottoneSalva = document.querySelector("#salva");

// --- Stato ---
let viaggi = [];

// --- Caricamento ---
async function carica() {
  const url = filtro.value ? `/api/viaggi?pianificato=${filtro.value}` : "/api/viaggi";
  viaggi = await api(url);
  render();
}

// --- Render ---
function render() {
  riepilogo.textContent = viaggi.length === 1 ? "1 viaggio" : `${viaggi.length} viaggi`;

  if (viaggi.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="muto">Nessun viaggio qui. Preparane uno con il form!</td></tr>`;
    return;
  }

  tbody.innerHTML = viaggi.map((v) => `
    <tr data-id="${v.id}">
      <td>
        <a href="/scheda-viaggio.html?id=${v.id}">${esc(v.nome)}</a>
        ${v.pianificato ? '<span class="badge preferito"><img class="icona" src="/img/icone/da-fare.svg" alt="">da fare</span>' : ""}
      </td>
      <td>${esc(v.attivita)}</td>
      <td>${v.data_partenza ? formattaData(v.data_partenza) : '<span class="muto">—</span>'}</td>
      <td>${esc(v.n_persone)} pers. · ${esc(v.n_giorni)} gg</td>
      <td><button type="button" class="pericolo elimina" data-id="${v.id}">Elimina</button></td>
    </tr>`).join("");
}

// --- Click nella tabella: elimina, oppure apri la scheda del viaggio ---
tbody.addEventListener("click", async (e) => {
  const bottoneElimina = e.target.closest(".elimina");
  if (bottoneElimina) {
    await elimina(Number(bottoneElimina.dataset.id));
    return;
  }
  const riga = e.target.closest("tr[data-id]");
  if (riga) location.href = `/scheda-viaggio.html?id=${riga.dataset.id}`;
});

async function elimina(id) {
  const viaggio = viaggi.find((v) => v.id === id);
  if (!confirm(`Eliminare il viaggio "${viaggio.nome}"?\nVerrà eliminato anche il suo zaino.`)) return;
  try {
    await api(`/api/viaggi/${id}`, { method: "DELETE" });
    await carica();
  } catch (err) {
    alert(err.message);
  }
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

// --- Eventi ---
filtro.addEventListener("change", carica);

carica();