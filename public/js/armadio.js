import { api, esc } from "./api.js";
import "./menu.js";

// --- Elementi della pagina ---
const tbody = document.querySelector("#tabella tbody");
const q = document.querySelector("#q");
const filtroCategoria = document.querySelector("#filtro-categoria");
const riepilogo = document.querySelector("#riepilogo");
const form = document.querySelector("#form-oggetto");
const campi = form.elements; // i campi del form, per nome: campi.nome, campi.peso_g, ...
const titoloForm = document.querySelector("#titolo-form");
const erroreForm = document.querySelector("#form-errore");
const bottoneSalva = document.querySelector("#salva");
const bottoneAnnulla = document.querySelector("#annulla");

// --- Stato ---
let oggetti = [];        // gli oggetti mostrati in tabella
let inModifica = null;   // id dell'oggetto in modifica, oppure null se stiamo creando

// --- Caricamento dall'API: aggiorna lo stato e ridisegna ---
async function carica() {
  const parametri = new URLSearchParams({ q: q.value, limit: 200 });
  if (filtroCategoria.value) parametri.set("categoria", filtroCategoria.value);
  oggetti = await api(`/api/oggetti?${parametri}`);
  render();
}

// --- Render: dallo stato all'HTML della tabella ---
function render() {
  const pesoTotale = oggetti.reduce((somma, o) => somma + o.peso_g, 0);
  riepilogo.textContent = `${oggetti.length} oggetti · ${(pesoTotale / 1000).toFixed(2)} kg in totale`;

  if (oggetti.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="muto">Nessun oggetto trovato.</td></tr>`;
    return;
  }

  tbody.innerHTML = oggetti.map((o) => `
    <tr data-id="${o.id}" class="${o.id === inModifica ? "selezionata" : ""}">
      <td>${esc(o.nome)}</td>
      <td>${esc(o.categoria)}</td>
      <td>${esc(o.peso_g)}&nbsp;g</td>
      <td>
        ${o.is_indispensabile ? '<span class="badge indispensabile">indispensabile</span>' : ""}
        ${o.is_preferito ? '<span class="badge preferito">preferito</span>' : ""}
      </td>
      <td><button type="button" class="pericolo elimina" data-id="${o.id}">Elimina</button></td>
    </tr>`).join("");
}

// --- Click nella tabella (event delegation: UN solo listener per tutte le righe) ---
tbody.addEventListener("click", async (e) => {
  const bottoneElimina = e.target.closest(".elimina");
  if (bottoneElimina) {
    await elimina(Number(bottoneElimina.dataset.id));
    return;
  }
  const riga = e.target.closest("tr[data-id]");
  if (riga) {
    const oggetto = oggetti.find((o) => o.id === Number(riga.dataset.id));
    riempiForm(oggetto);
  }
});

async function elimina(id) {
  const oggetto = oggetti.find((o) => o.id === id);
  if (!confirm(`Eliminare "${oggetto.nome}"?\nSparirà anche dagli zaini in cui si trova.`)) return;
  try {
    await api(`/api/oggetti/${id}`, { method: "DELETE" });
    if (id === inModifica) svuotaForm(); // stavamo modificando proprio quello
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
  campi.is_indispensabile.checked = o.is_indispensabile;
  campi.is_preferito.checked = o.is_preferito;
  campi.codice_etichetta.value = o.codice_etichetta ?? "";
  campi.note.value = o.note ?? "";
  titoloForm.textContent = `Modifica: ${o.nome}`;
  bottoneAnnulla.hidden = false;
  nascondiErrore();
  render();           // per colorare la riga selezionata
  campi.nome.focus(); // il cursore va nel primo campo
}

function svuotaForm() {
  inModifica = null;
  form.reset();
  titoloForm.textContent = "Nuovo oggetto";
  bottoneAnnulla.hidden = true;
  nascondiErrore();
  render();
}

bottoneAnnulla.addEventListener("click", svuotaForm);

// --- Lettura e validazione dei dati del form ---
function leggiForm() {
  return {
    nome: campi.nome.value.trim(),
    categoria: campi.categoria.value,
    peso_g: Number(campi.peso_g.value),
    is_indispensabile: campi.is_indispensabile.checked,
    is_preferito: campi.is_preferito.checked,
    codice_etichetta: campi.codice_etichetta.value.trim(),
    note: campi.note.value.trim(),
  };
}

function validaLatoClient(dati) {
  const errori = [];
  if (!dati.nome) errori.push("Il nome è obbligatorio");
  if (!Number.isInteger(dati.peso_g) || dati.peso_g < 1) errori.push("Il peso deve essere un numero intero di almeno 1 grammo");
  return errori;
}

// --- Salvataggio: POST se nuovo, PUT se in modifica ---
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  nascondiErrore();

  const dati = leggiForm();
  const errori = validaLatoClient(dati);
  if (errori.length) return mostraErrore(errori.join("; "));

  bottoneSalva.disabled = true;
  try {
    if (inModifica) {
      await api(`/api/oggetti/${inModifica}`, { method: "PUT", body: dati });
    } else {
      await api("/api/oggetti", { method: "POST", body: dati });
    }
    svuotaForm();
    await carica();
  } catch (err) {
    mostraErrore(err.message); // es. "Hai già un oggetto con questo nome nell'armadio" (409)
  } finally {
    bottoneSalva.disabled = false;
  }
});

function mostraErrore(testo) {
  erroreForm.textContent = testo;
  erroreForm.hidden = false;
}

function nascondiErrore() {
  erroreForm.hidden = true;
}

// --- Eventi: ogni volta che cambia la ricerca o il filtro, si ricarica ---
q.addEventListener("input", carica);
filtroCategoria.addEventListener("change", carica);

carica(); // primo caricamento all'apertura della pagina