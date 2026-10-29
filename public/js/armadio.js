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
const finestra = document.querySelector("#finestra");          // il <dialog> con il form
const bottoneNuovo = document.querySelector("#apri-nuovo");    // il pulsante + nella testata
const bottoneChiudi = document.querySelector("#chiudi");       // la X in alto nella finestra

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
  // "1 oggetto" / "3 oggetti" e kg in formato italiano con la virgola (0,40 e non 0.40)
  const kg = (pesoTotale / 1000).toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  riepilogo.textContent = `${oggetti.length} ${oggetti.length === 1 ? "oggetto" : "oggetti"}, ${kg} kg in tutto`;

  if (oggetti.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="muto">Nessun oggetto qui. Premi + per aggiungere il primo.</td></tr>`;
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
  nascondiErrore();
  render();       // per colorare la riga selezionata
  apriFinestra();
}

function svuotaForm() {
  inModifica = null;
  form.reset();
  titoloForm.textContent = "Nuovo oggetto";
  nascondiErrore();
  render();
}

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

// Comunque venga chiusa (X, Annulla, Esc, sfondo, dopo il salvataggio) la finestra
// lancia l'evento "close": è il posto giusto per rimettere il form in modalità "nuovo".
finestra.addEventListener("close", svuotaForm);

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
    finestra.close(); // la chiusura svuota anche il form (evento "close")
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