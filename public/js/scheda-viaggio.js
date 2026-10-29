import { api, esc, formattaData } from "./api.js";
import "./menu.js";

// --- Quale viaggio? L'id arriva dall'URL: scheda-viaggio.html?id=7 ---
const id = Number(new URLSearchParams(location.search).get("id"));

// --- Elementi della pagina: intestazione e consigli ---
const titolo = document.querySelector("#titolo");
const dettagli = document.querySelector("#dettagli");
const elAcqua = document.querySelector("#acqua");
const formOre = document.querySelector("#form-ore");
const elSole = document.querySelector("#sole");
const elMeteo = document.querySelector("#meteo");
const elPercorso = document.querySelector("#percorso");

// --- Elementi della pagina: zaino ---
const bottoneGenera = document.querySelector("#genera");
const bottoneSvuota = document.querySelector("#svuota");
const elPesoInserito = document.querySelector("#peso-inserito");
const elPesoTotale = document.querySelector("#peso-totale");
const barraRiempimento = document.querySelector("#barra-riempimento");
const elAvvisoPeso = document.querySelector("#avviso-peso");
const elTestoAvvisoPeso = document.querySelector("#testo-avviso-peso"); // il testo: l'icona accanto resta fissa
const elMessaggioZaino = document.querySelector("#messaggio-zaino");
const tbodyChecklist = document.querySelector("#checklist tbody");
const formAggiungi = document.querySelector("#form-aggiungi");
const erroreZaino = document.querySelector("#errore-zaino");

// --- Stato ---
let viaggio = null;                       // il viaggio con peso e consigli (GET /api/viaggi/:id)
let zaino = { peso: null, oggetti: [] };  // la checklist (GET /api/viaggi/:id/zaino)
let armadio = [];                         // tutti i miei oggetti, per il selettore "aggiungi"

// Numeri in formato italiano: 3.5 → "3,5"; e con 2 decimali: 5.6 → "5,60"
const num = (n) => Number(n).toLocaleString("it-IT");
const num2 = (n) => Number(n).toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// =====================================================================
//  VIAGGIO: intestazione e consigli
// =====================================================================

async function caricaViaggio(ore) {
  const url = ore ? `/api/viaggi/${id}?ore_cammino=${ore}` : `/api/viaggi/${id}`;
  viaggio = await api(url);
  renderIntestazione();
  renderConsigli();
}

function renderIntestazione() {
  const v = viaggio;
  document.title = `Loadout – ${v.nome}`;
  titolo.textContent = v.nome;
  const parti = [
    v.attivita,
    v.data_partenza ? `partenza ${formattaData(v.data_partenza)}` : "data da decidere",
    `${v.n_persone} ${v.n_persone === 1 ? "persona" : "persone"}`,
    `${v.n_giorni} ${v.n_giorni === 1 ? "giorno" : "giorni"}`,
    v.pernotto === "nessuno" ? "in giornata" : `pernotto in ${v.pernotto}`,
    v.serve_cucina ? "con cucina" : "senza cucina",
  ];
  dettagli.textContent = parti.join(" · ");
  // Viaggio da fare in futuro: aggiungo il badge con l'icona costruendo gli elementi a mano
  // (createElement + textContent: nessun rischio XSS, non uso innerHTML)
  if (v.pianificato) {
    const badge = document.createElement("span");
    badge.className = "badge preferito";
    const icona = document.createElement("img");
    icona.className = "icona";
    icona.src = "/img/icone/da-fare.svg";
    icona.alt = "";
    badge.append(icona, "da fare in futuro");
    dettagli.append(" ", badge);
  }
}

function renderConsigli() {
  const c = viaggio.consigli;

  // Acqua
  if (c.acqua_litri == null) {
    elAcqua.textContent = "Inserisci le ore di cammino (o i km del percorso) per calcolarla.";
  } else {
    const fonte = c.fonte_ore === "utente" ? "inserite da te" : "stimate dal percorso";
    const caldo = c.acqua_con_temperatura ? " Calcolata anche in base alla temperatura prevista." : "";
    elAcqua.textContent = `${num(c.acqua_litri)} litri in tutto, con ${num(c.ore_cammino_giorno)} ore di cammino al giorno (${fonte}).${caldo}`;
  }
  formOre.elements.ore.value = c.ore_cammino_giorno ?? "";

  // Alba e tramonto
  elSole.textContent = c.sole.disponibile
    ? `Alba alle ${c.sole.alba}, tramonto alle ${c.sole.tramonto}.`
    : `Non disponibile: ${c.sole.motivo}.`;

  // Meteo e vestiario
  if (c.meteo.disponibile) {
    const m = c.meteo;
    elMeteo.innerHTML = `
      <p>Massima ${esc(num(m.temp_max))} °C · minima ${esc(num(m.temp_min))} °C · pioggia ${esc(m.prob_pioggia)}%</p>
      <ul>${m.vestiario.map((consiglio) => `<li>${esc(consiglio)}</li>`).join("")}</ul>`;
  } else {
    elMeteo.innerHTML = `<p>Non disponibile: ${esc(c.meteo.motivo)}.</p>`;
  }

  // Percorso
  const parti = [];
  if (viaggio.distanza_km != null) parti.push(`${num(viaggio.distanza_km)} km di sentiero`);
  if (viaggio.dislivello_m != null) parti.push(`${num(viaggio.dislivello_m)} m di dislivello`);
  if (c.distanza_linea_aria_km != null) parti.push(`${num(c.distanza_linea_aria_km)} km in linea d'aria tra partenza e arrivo`);
  elPercorso.textContent = parti.length
    ? parti.join(" · ")
    : "Aggiungi km, dislivello e coordinate per avere più consigli.";
}

// Ricalcolo dell'acqua con le ore inserite dall'utente (US6 CA1)
formOre.addEventListener("submit", async (e) => {
  e.preventDefault();
  const ore = formOre.elements.ore.value;
  try {
    await caricaViaggio(ore);
  } catch (err) {
    elAcqua.textContent = err.message; // es. "ore_cammino deve essere un numero tra 0.5 e 16"
  }
});

// =====================================================================
//  ZAINO: checklist, peso, genera, aggiungi, modifica, togli, svuota
// =====================================================================

async function caricaZaino() {
  zaino = await api(`/api/viaggi/${id}/zaino`);
  renderZaino();
}

function renderZaino() {
  const p = zaino.peso;

  // Peso e barra (US5 CA2: kg con 2 decimali, aggiornati senza ricaricare)
  elPesoInserito.textContent = num2(p.peso_inserito_kg);
  elPesoTotale.textContent = num2(p.peso_totale_kg);
  const percentuale = p.peso_totale_g > 0 ? Math.round((p.peso_inserito_g / p.peso_totale_g) * 100) : 0;
  barraRiempimento.style.width = `${percentuale}%`;

  // Avviso peso (stretch 5): la soglia arriva dal dettaglio del viaggio, il peso è quello aggiornato
  const avviso = viaggio?.consigli.avviso_peso;
  const troppoPesante = avviso?.disponibile && p.peso_totale_kg > avviso.soglia_kg;
  elAvvisoPeso.hidden = !troppoPesante;
  barraRiempimento.classList.toggle("oltre-soglia", Boolean(troppoPesante));
  if (troppoPesante) {
    elTestoAvvisoPeso.textContent = `Lo zaino pesa ${num2(p.peso_totale_kg)} kg: più del 20% del tuo peso corporeo (limite consigliato ${num2(avviso.soglia_kg)} kg). Valuta cosa togliere.`;
  }

  // Checklist
  if (zaino.oggetti.length === 0) {
    tbodyChecklist.innerHTML = "";
    mostraInfo("Lo zaino è vuoto: premi «Genera zaino» per riempirlo con indispensabili e preferiti, oppure aggiungi un oggetto dall'armadio.");
  } else {
    elMessaggioZaino.hidden = true;
    tbodyChecklist.innerHTML = zaino.oggetti.map((o) => `
      <tr data-id="${o.oggetto_id}" class="${o.inserito ? "inserito" : ""}">
        <td><input type="checkbox" class="spunta" ${o.inserito ? "checked" : ""} aria-label="Inserito nello zaino: ${esc(o.nome)}"></td>
        <td class="nome-oggetto">${esc(o.nome)}</td>
        <td>${esc(o.categoria)}</td>
        <td><input type="number" class="quantita" min="1" max="99" step="1" value="${o.quantita}" aria-label="Quantità di ${esc(o.nome)}"></td>
        <td>${num(o.peso_riga_g)}&nbsp;g</td>
        <td><button type="button" class="secondario togli">Togli</button></td>
      </tr>`).join("");
  }

  renderSelettore();
}

// Il selettore "aggiungi dall'armadio" mostra solo gli oggetti che NON sono già nello zaino
function renderSelettore() {
  const presenti = new Set(zaino.oggetti.map((o) => o.oggetto_id));
  const disponibili = armadio.filter((o) => !presenti.has(o.id));
  formAggiungi.elements.oggetto_id.innerHTML = disponibili.length
    ? `<option value="">Aggiungi dall'armadio…</option>` +
      disponibili.map((o) => `<option value="${o.id}">${esc(o.nome)} (${esc(o.peso_g)} g)</option>`).join("")
    : `<option value="">Tutto l'armadio è già nello zaino</option>`;
}

// --- Genera zaino (US4) ---
bottoneGenera.addEventListener("click", async () => {
  nascondiErrore();
  bottoneGenera.disabled = true;
  try {
    const { aggiunti } = await api(`/api/viaggi/${id}/genera`, { method: "POST" });
    await caricaZaino();
    mostraInfo(aggiunti > 0
      ? `Aggiunti ${aggiunti} oggetti tra indispensabili e preferiti.`
      : "Nessun oggetto nuovo: lo zaino contiene già tutti i tuoi indispensabili e preferiti.");
  } catch (err) {
    mostraErrore(err.message);
  } finally {
    bottoneGenera.disabled = false;
  }
});

// --- Svuota checklist (US5 CA4) ---
bottoneSvuota.addEventListener("click", async () => {
  if (!confirm("Togliere la spunta a tutti gli oggetti dello zaino?")) return;
  nascondiErrore();
  try {
    const { svuotati } = await api(`/api/viaggi/${id}/zaino/svuota`, { method: "POST" });
    await caricaZaino();
    mostraInfo(`Checklist svuotata (${svuotati} ${svuotati === 1 ? "oggetto" : "oggetti"}).`);
  } catch (err) {
    mostraErrore(err.message);
  }
});

// --- Checkbox "inserito" e quantità: event delegation sull'evento "change" ---
tbodyChecklist.addEventListener("change", async (e) => {
  const riga = e.target.closest("tr[data-id]");
  if (!riga) return;
  const oggettoId = riga.dataset.id;
  nascondiErrore();

  let modifica;
  if (e.target.matches(".spunta")) {
    modifica = { inserito: e.target.checked };
  } else if (e.target.matches(".quantita")) {
    const quantita = Number(e.target.value);
    if (!Number.isInteger(quantita) || quantita < 1 || quantita > 99) {
      mostraErrore("La quantità deve essere un numero intero tra 1 e 99");
      renderZaino(); // rimette il valore giusto
      return;
    }
    modifica = { quantita };
  } else {
    return;
  }

  try {
    await api(`/api/viaggi/${id}/zaino/${oggettoId}`, { method: "PATCH", body: modifica });
    await caricaZaino();
  } catch (err) {
    mostraErrore(err.message);
    await caricaZaino();
  }
});

// --- Togli dallo zaino: event delegation sull'evento "click" ---
tbodyChecklist.addEventListener("click", async (e) => {
  const bottone = e.target.closest(".togli");
  if (!bottone) return;
  const oggettoId = bottone.closest("tr[data-id]").dataset.id;
  nascondiErrore();
  try {
    await api(`/api/viaggi/${id}/zaino/${oggettoId}`, { method: "DELETE" });
    await caricaZaino();
  } catch (err) {
    mostraErrore(err.message);
  }
});

// --- Aggiungi un oggetto dall'armadio (US5 CA3) ---
formAggiungi.addEventListener("submit", async (e) => {
  e.preventDefault();
  nascondiErrore();
  const oggettoId = Number(formAggiungi.elements.oggetto_id.value);
  const quantita = Number(formAggiungi.elements.quantita.value);
  if (!oggettoId) return mostraErrore("Scegli un oggetto dall'armadio");
  if (!Number.isInteger(quantita) || quantita < 1 || quantita > 99) return mostraErrore("La quantità deve essere tra 1 e 99");
  try {
    await api(`/api/viaggi/${id}/zaino`, { method: "POST", body: { oggetto_id: oggettoId, quantita } });
    formAggiungi.elements.quantita.value = 1;
    await caricaZaino();
  } catch (err) {
    mostraErrore(err.message); // es. "Questo oggetto è già nello zaino" (409)
  }
});

// --- Messaggi ---
function mostraInfo(testo) {
  elMessaggioZaino.textContent = testo;
  elMessaggioZaino.hidden = false;
}

function mostraErrore(testo) {
  erroreZaino.textContent = testo;
  erroreZaino.hidden = false;
}

function nascondiErrore() {
  erroreZaino.hidden = true;
}

// =====================================================================
//  AVVIO
// =====================================================================
if (!Number.isInteger(id) || id <= 0) {
  location.href = "/viaggi.html"; // URL senza un id valido: torniamo alla lista
} else {
  const elCaricamento = document.querySelector("#caricamento");
  // Lo zaino animato compare solo se i dati tardano più di 250 ms:
  // in locale arrivano subito, e un lampo di animazione sarebbe solo fastidioso.
  const timerCaricamento = setTimeout(() => { elCaricamento.hidden = false; }, 250);
  try {
    await caricaViaggio();
    armadio = await api("/api/oggetti?limit=200");
    await caricaZaino();
    document.querySelector("#corpo-scheda").hidden = false; // tutto ok: mostro zaino e consigli
  } catch (err) {
    titolo.textContent = err.message; // es. "Viaggio 99 non trovato" (anche se è di un altro utente)
  } finally {
    // finally gira SEMPRE, sia dopo il try riuscito sia dopo il catch
    clearTimeout(timerCaricamento);     // se i dati sono arrivati prima dei 250 ms, l'animazione non parte proprio
    elCaricamento.hidden = true;
    document.querySelector("#intestazione").hidden = false; // titolo o messaggio d'errore
  }
}
