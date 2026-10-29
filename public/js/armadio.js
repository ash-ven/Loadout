import { api, esc } from "./api.js";
import "./menu.js";
import { CATEGORIE } from "./categorie.js";

// --- Elementi della pagina ---
const lista = document.querySelector("#lista");
const q = document.querySelector("#q");
const segmenti = document.querySelector(".segmenti");
const riepilogo = document.querySelector("#riepilogo");
const form = document.querySelector("#form-oggetto");
const campi = form.elements; // i campi del form, per nome: campi.nome, campi.peso_g, ...
const titoloForm = document.querySelector("#titolo-form");
const erroreForm = document.querySelector("#form-errore");
const bottoneSalva = document.querySelector("#salva");
const bottoneAnnulla = document.querySelector("#annulla");
const bottoneElimina = document.querySelector("#elimina-oggetto"); // dentro la finestra, solo in modifica
const finestra = document.querySelector("#finestra");              // il <dialog> con il form
const bottoneNuovo = document.querySelector("#apri-nuovo");        // "Aggiungi" nella testata
const bottoneScansiona = document.querySelector("#scansiona");     // "Scansiona etichetta" nella testata
const bottoneChiudi = document.querySelector("#chiudi");           // la X in alto nella finestra
// La scheda di dettaglio (B1): un secondo <dialog>, in sola lettura
const dettaglio = document.querySelector("#dettaglio");
const dettaglioIcona = document.querySelector("#dettaglio-icona");
const dettaglioNome = document.querySelector("#dettaglio-nome");
const dettaglioMarchio = document.querySelector("#dettaglio-marchio");
const dettaglioBadge = document.querySelector("#dettaglio-badge");
const dettaglioDati = document.querySelector("#dettaglio-dati");

// --- Stato ---
let oggetti = [];        // gli oggetti arrivati dall'API (già filtrati dalla ricerca)
let filtro = "tutti";    // "tutti" | "indispensabili" | "preferiti"
let inModifica = null;   // id dell'oggetto in modifica, oppure null se stiamo creando
let aperto = null;       // l'oggetto mostrato nella scheda di dettaglio

// --- Caricamento dall'API: aggiorna lo stato e ridisegna ---
async function carica() {
  const parametri = new URLSearchParams({ q: q.value, limit: 200 });
  oggetti = await api(`/api/oggetti?${parametri}`);
  render();
}

// 1860 → "1.860 g". useGrouping: "always" serve perché in italiano, di base, i numeri di 4 cifre
// non hanno il punto delle migliaia. &nbsp; = niente a capo tra il numero e "g".
const grammi = (g) => `${g.toLocaleString("it-IT", { useGrouping: "always" })}&nbsp;g`;

// C2: le attività, con il nome da mostrare
const ATTIVITA = { escursione: "Escursione", trekking: "Trekking", alpinismo: "Alpinismo", ciaspolata: "Ciaspolata", ferrata: "Ferrata" };

// Le checkbox "Adatto a" hanno tutte lo stesso name: querySelectorAll le prende tutte
const spunteAttivita = () => [...form.querySelectorAll('input[name="attivita_adatte"]')];

// Peso di un oggetto contando tutti i pezzi che possiedi (B2): 3 paia di calze da 60 g = 180 g
const pesoTuttiIPezzi = (o) => o.peso_g * (o.quantita_posseduta ?? 1);

// --- Render: dallo stato all'HTML ---
function render() {
  // Riepilogo nella testata: "4 oggetti, 0,96 kg in tutto"
  const pesoTotale = oggetti.reduce((somma, o) => somma + pesoTuttiIPezzi(o), 0);
  const kg = (pesoTotale / 1000).toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  riepilogo.innerHTML = `<strong>${oggetti.length} ${oggetti.length === 1 ? "oggetto" : "oggetti"}</strong>, ${kg} kg in tutto`;
  segmenti.querySelector('[data-filtro="tutti"]').textContent = `Tutti · ${oggetti.length}`;

  // Filtro dei segmenti: si applica qui, senza richiamare l'API (i dati li abbiamo già)
  const visibili = oggetti.filter((o) =>
    filtro === "tutti" ? true : filtro === "indispensabili" ? o.is_indispensabile : o.is_preferito
  );

  if (visibili.length === 0) {
    lista.innerHTML = `<p class="vuoto">${
      oggetti.length === 0 ? "Nessun oggetto qui. Premi «Aggiungi» per inserire il primo." : "Nessun oggetto con questo filtro."
    }</p>`;
    return;
  }

  // Un gruppo per ogni categoria che ha almeno un oggetto, con il peso totale del gruppo
  lista.innerHTML = Object.keys(CATEGORIE).map((categoria) => {
    const delGruppo = visibili.filter((o) => o.categoria === categoria);
    if (delGruppo.length === 0) return "";
    const pesoGruppo = delGruppo.reduce((somma, o) => somma + pesoTuttiIPezzi(o), 0);
    return `
      <section class="gruppo">
        <div class="gruppo-testa"><h2>${CATEGORIE[categoria]}</h2><span>${grammi(pesoGruppo)}</span></div>
        <div class="gruppo-righe">${delGruppo.map(rigaOggetto).join("")}</div>
      </section>`;
  }).join("");
}

// Una riga della lista: è un <button>, così si può aprire anche da tastiera (Tab + Invio)
function rigaOggetto(o) {
  return `
    <button type="button" class="riga" data-id="${o.id}">
      <span class="riquadro-icona"><img src="/img/icone/categorie/${o.categoria}.svg" alt="" width="22" height="22"></span>
      <span class="riga-testo">
        <span class="riga-nome">${esc(o.nome)}</span>
        <span class="riga-dettagli">
          ${sottotitolo(o) ? `<span class="riga-nota">${esc(sottotitolo(o))}</span>` : ""}
          ${o.is_indispensabile ? '<span class="badge indispensabile">Indispensabile</span>' : ""}
          ${o.is_preferito ? '<span class="badge preferito">Preferito</span>' : ""}
        </span>
      </span>
      <span class="riga-valore">${grammi(o.peso_g)}</span>
    </button>`;
}

// Sotto il nome: marchio e pezzi posseduti (B1, B2); se non ci sono, la nota
function sottotitolo(o) {
  const parti = [o.marchio, o.quantita_posseduta > 1 ? `${o.quantita_posseduta} pezzi` : null].filter(Boolean);
  return parti.length ? parti.join(" · ") : o.note;
}

// --- Clic su un oggetto della lista (event delegation: UN solo listener per tutte le righe) ---
lista.addEventListener("click", (e) => {
  const riga = e.target.closest(".riga[data-id]");
  if (!riga) return;
  apriDettaglio(oggetti.find((o) => o.id === Number(riga.dataset.id)));
});

// --- Scheda di dettaglio (B1): tutto quello che sappiamo dell'oggetto, in sola lettura ---
function apriDettaglio(o) {
  aperto = o;
  dettaglioIcona.innerHTML = `<img src="/img/icone/categorie/${o.categoria}.svg" alt="" width="22" height="22">`;
  dettaglioNome.textContent = o.nome;
  dettaglioMarchio.textContent = o.marchio ?? "";
  dettaglioMarchio.hidden = !o.marchio;
  dettaglioBadge.innerHTML =
    (o.is_indispensabile ? '<span class="badge indispensabile">Indispensabile</span>' : "") +
    (o.is_preferito ? '<span class="badge preferito">Preferito</span>' : "");

  // Solo le voci che hanno un valore: [etichetta, valore]
  const voci = [
    ["Categoria", CATEGORIE[o.categoria]],
    ["Peso", `${o.peso_g.toLocaleString("it-IT", { useGrouping: "always" })} g`],
    ["Pezzi", o.quantita_posseduta],
    ["Adatto a", o.attivita_adatte?.length ? o.attivita_adatte.map((a) => ATTIVITA[a]).join(", ") : "Tutte le attività"],
    ["Caratteristiche", o.caratteristiche],
    ["Codice etichetta", o.codice_etichetta],
    ["Note", o.note],
  ].filter(([, valore]) => valore !== null && valore !== undefined && valore !== "");
  dettaglioDati.innerHTML = voci.map(([etichetta, valore]) => `<dt>${etichetta}</dt><dd>${esc(valore)}</dd>`).join("");

  dettaglio.showModal();
}

document.querySelector("#dettaglio-modifica").addEventListener("click", () => {
  dettaglio.close();
  riempiForm(aperto); // dalla scheda alla finestra con il form, già compilato
});
document.querySelector("#dettaglio-elimina").addEventListener("click", () => elimina(aperto.id));
document.querySelector("#chiudi-dettaglio").addEventListener("click", () => dettaglio.close());
dettaglio.addEventListener("click", (e) => {
  if (e.target === dettaglio) dettaglio.close(); // clic sullo sfondo scuro
});

// --- Segmenti Tutti / Indispensabili / Preferiti ---
segmenti.addEventListener("click", (e) => {
  const bottone = e.target.closest("button[data-filtro]");
  if (!bottone) return;
  filtro = bottone.dataset.filtro;
  // aria-pressed dice (anche ai lettori di schermo) quale segmento è attivo; il CSS lo usa per colorarlo
  segmenti.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b === bottone)));
  render();
});

async function elimina(id) {
  const oggetto = oggetti.find((o) => o.id === id);
  if (!confirm(`Eliminare "${oggetto.nome}"?\nSparirà anche dagli zaini in cui si trova.`)) return;
  try {
    await api(`/api/oggetti/${id}`, { method: "DELETE" });
    finestra.close();  // la chiusura svuota anche il form (evento "close")
    dettaglio.close(); // se l'hai eliminato dalla scheda di dettaglio (chiudere un dialog già chiuso non fa nulla)
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
  campi.marchio.value = o.marchio ?? "";
  campi.quantita_posseduta.value = o.quantita_posseduta ?? 1;
  campi.caratteristiche.value = o.caratteristiche ?? "";
  spunteAttivita().forEach((c) => { c.checked = (o.attivita_adatte ?? []).includes(c.value); });
  campi.is_indispensabile.checked = o.is_indispensabile;
  campi.is_preferito.checked = o.is_preferito;
  campi.codice_etichetta.value = o.codice_etichetta ?? "";
  campi.note.value = o.note ?? "";
  titoloForm.textContent = `Modifica: ${o.nome}`;
  bottoneElimina.hidden = false;
  nascondiErrore();
  apriFinestra();
}

function svuotaForm() {
  inModifica = null;
  form.reset();
  titoloForm.textContent = "Nuovo oggetto";
  bottoneElimina.hidden = true;
  nascondiErrore();
}

// --- La finestra (dialog) con il form ---
// showModal() la apre sopra la pagina (il resto non è cliccabile); close() la chiude.
// Il browser la chiude da solo anche con il tasto Esc.
function apriFinestra(campoIniziale = campi.nome) {
  finestra.showModal();
  campoIniziale.focus(); // il cursore va nel campo indicato (di solito il nome)
}

bottoneNuovo.addEventListener("click", () => {
  svuotaForm();
  apriFinestra();
});
// "Scansiona etichetta": per ora apre il form con il cursore sul codice (la fotocamera arriverà con lo stretch 2)
bottoneScansiona.addEventListener("click", () => {
  svuotaForm();
  apriFinestra(campi.codice_etichetta);
});
bottoneChiudi.addEventListener("click", () => finestra.close());
bottoneAnnulla.addEventListener("click", () => finestra.close());
bottoneElimina.addEventListener("click", () => elimina(inModifica));

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
    marchio: campi.marchio.value.trim(),
    quantita_posseduta: Number(campi.quantita_posseduta.value || 1),
    caratteristiche: campi.caratteristiche.value.trim(),
    attivita_adatte: spunteAttivita().filter((c) => c.checked).map((c) => c.value), // [] = tutte
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
  if (!Number.isInteger(dati.quantita_posseduta) || dati.quantita_posseduta < 1 || dati.quantita_posseduta > 99) {
    errori.push("I pezzi posseduti devono essere tra 1 e 99");
  }
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

// --- Ricerca: ogni volta che cambia il testo, si ricarica dall'API ---
q.addEventListener("input", carica);

carica(); // primo caricamento all'apertura della pagina
