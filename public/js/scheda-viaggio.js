import { api, esc, formattaData } from "./api.js";
import "./menu.js";
import { CATEGORIE } from "./categorie.js";

// --- Quale viaggio? L'id arriva dall'URL: scheda-viaggio.html?id=7 ---
const id = Number(new URLSearchParams(location.search).get("id"));

// --- Elementi della pagina: intestazione e consigli ---
const titolo = document.querySelector("#titolo");
const dettagli = document.querySelector("#dettagli");
const elAcqua = document.querySelector("#acqua");
const elAcquaPersona = document.querySelector("#acqua-persona");
const formOre = document.querySelector("#form-ore");
const elSole = document.querySelector("#sole");
const elMeteo = document.querySelector("#meteo");
const elPercorso = document.querySelector("#percorso");

// --- Elementi della pagina: zaino ---
const bottoneGenera = document.querySelector("#genera");
const bottoneSvuota = document.querySelector("#svuota");
const elPesoInserito = document.querySelector("#peso-inserito");
const elPesoTotale = document.querySelector("#peso-totale");
const elPesoAddosso = document.querySelector("#peso-addosso"); // B3: quello che indossi, a parte
const barraRiempimento = document.querySelector("#barra-riempimento");
const elAvvisoPeso = document.querySelector("#avviso-peso");
const elTestoAvvisoPeso = document.querySelector("#testo-avviso-peso"); // il testo: l'icona accanto resta fissa
const elMessaggioZaino = document.querySelector("#messaggio-zaino");
const elChecklist = document.querySelector("#checklist");
const formAggiungi = document.querySelector("#form-aggiungi");
const erroreZaino = document.querySelector("#errore-zaino");

// --- Stato ---
let viaggio = null;                       // il viaggio con peso e consigli (GET /api/viaggi/:id)
let zaino = { peso: null, oggetti: [] };  // la checklist (GET /api/viaggi/:id/zaino)
let armadio = [];                         // tutti i miei oggetti, per il selettore "aggiungi"

// Unisce un elenco all'italiana: ["a", "b", "c"] → "a, b e c"
const elenco = (parti) => parti.length < 2 ? parti.join("") : `${parti.slice(0, -1).join(", ")} e ${parti.at(-1)}`;

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
  // Ogni dato del viaggio diventa un'etichetta (createElement + textContent: niente innerHTML, niente XSS)
  dettagli.replaceChildren(...parti.map((testo) => creaEtichetta(testo)));
  if (v.pianificato) dettagli.append(creaEtichetta("da fare in futuro", "da-fare"));
}

// Un'etichetta della testata; con un'icona diventa quella "in evidenza" (sfondo senape)
function creaEtichetta(testo, icona) {
  const el = document.createElement("span");
  el.className = icona ? "etichetta in-evidenza" : "etichetta";
  if (icona) {
    const img = document.createElement("img");
    img.className = "icona";
    img.src = `/img/icone/${icona}.svg`;
    img.alt = "";
    el.append(img);
  }
  el.append(testo);
  return el;
}

function renderConsigli() {
  const c = viaggio.consigli;

  // Acqua: il dato principale è quanta acqua porta OGNI persona OGNI giorno (A5).
  // Lo calcola il database (fn_acqua_persona_giorno, B4); il totale del viaggio resta sotto, più piccolo.
  if (c.acqua_persona_giorno == null) {
    elAcquaPersona.hidden = true;
    elAcqua.textContent = "Inserisci le ore di cammino (o i km del percorso) per calcolarla.";
  } else {
    const v = viaggio;
    elAcquaPersona.innerHTML = `${num(c.acqua_persona_giorno)}&nbsp;L <span>a persona, al giorno</span>`; // solo numeri: niente rischio XSS
    elAcquaPersona.hidden = false;

    // Da cosa dipende il calcolo: un pezzo di frase per ogni fattore usato
    const fattori = [`${num(c.ore_cammino_giorno)} ore di cammino al giorno (${c.fonte_ore === "utente" ? "inserite da te" : "stimate dal percorso"})`];
    if (c.acqua_con_dislivello) fattori.push(`${num(Math.round(v.dislivello_m / v.n_giorni))} m di salita al giorno`);
    if (c.acqua_con_temperatura) fattori.push(`la temperatura prevista (${num(c.meteo.temp_max)} °C)`);
    if (c.acqua_con_cucina) fattori.push("l'acqua per cucinare");

    const persone = `${v.n_persone} ${v.n_persone === 1 ? "persona" : "persone"}`;
    const giorni = `${v.n_giorni} ${v.n_giorni === 1 ? "giorno" : "giorni"}`;
    elAcqua.textContent = `In tutto ${num(c.acqua_litri)} litri per ${persone} e ${giorni}. Calcolata su ${elenco(fattori)}.` +
      (v.n_giorni > 1 ? " Sui percorsi di più giorni informati su fontane e rifugi per rifornirti." : "");
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
  // B3: quello che indossi non pesa nello zaino, ma lo mostriamo a parte
  elPesoAddosso.hidden = !(p.peso_addosso_g > 0);
  elPesoAddosso.textContent = ` · più ${num2(p.peso_addosso_kg)} kg addosso`;

  // Avviso peso (stretch 5): la soglia arriva dal dettaglio del viaggio, il peso è quello aggiornato
  const avviso = viaggio?.consigli.avviso_peso;
  const troppoPesante = avviso?.disponibile && p.peso_totale_kg > avviso.soglia_kg;
  elAvvisoPeso.hidden = !troppoPesante;
  barraRiempimento.classList.toggle("oltre-soglia", Boolean(troppoPesante));
  if (troppoPesante) {
    elTestoAvvisoPeso.textContent = `Lo zaino pesa ${num2(p.peso_totale_kg)} kg: più del 20% del tuo peso corporeo (limite consigliato ${num2(avviso.soglia_kg)} kg). Valuta cosa togliere.`;
  }

  // Checklist: un gruppo per categoria, con il peso del gruppo (come nell'armadio)
  if (zaino.oggetti.length === 0) {
    elChecklist.innerHTML = "";
    mostraInfo("Lo zaino è vuoto: premi «Genera zaino» per riempirlo con indispensabili e preferiti, oppure aggiungi un oggetto dall'armadio.");
  } else {
    elMessaggioZaino.hidden = true;
    elChecklist.innerHTML = Object.keys(CATEGORIE).map((categoria) => {
      const delGruppo = zaino.oggetti.filter((o) => o.categoria === categoria);
      if (delGruppo.length === 0) return "";
      // peso del gruppo DENTRO lo zaino: gli oggetti indossati non contano (B3)
      const pesoGruppo = delGruppo.filter((o) => !o.indossato).reduce((somma, o) => somma + o.peso_riga_g, 0);
      const presi = delGruppo.filter((o) => o.inserito).length;
      return `
        <section class="gruppo">
          <div class="gruppo-testa"><h2>${CATEGORIE[categoria]} · ${presi}/${delGruppo.length}</h2><span>${num(pesoGruppo)}&nbsp;g</span></div>
          <div class="gruppo-righe">${delGruppo.map(rigaZaino).join("")}</div>
        </section>`;
    }).join("");
  }

  renderSelettore();
}

// Una riga della checklist. Qui la riga NON è un pulsante: dentro ci sono già dei controlli
// (spunta, quantità, togli), e un controllo non può stare dentro un altro.
function rigaZaino(o) {
  return `
    <div class="riga riga-zaino ${o.inserito ? "inserito" : ""} ${o.indossato ? "addosso" : ""}" data-id="${o.oggetto_id}">
      <input type="checkbox" class="spunta" ${o.inserito ? "checked" : ""} aria-label="Inserito nello zaino: ${esc(o.nome)}">
      <span class="riquadro-icona"><img src="/img/icone/categorie/${o.categoria}.svg" alt="" width="22" height="22"></span>
      <span class="riga-testo">
        <span class="riga-nome">${esc(o.nome)}</span>
        <span class="riga-nota">${o.marchio ? `${esc(o.marchio)} · ` : ""}${num(o.peso_riga_g)}&nbsp;g${o.quantita > 1 ? ` (${num(o.peso_g)}&nbsp;g l'uno)` : ""}${o.indossato ? " · addosso" : ""}</span>
      </span>
      ${o.categoria === "abbigliamento" ? pulsanteIndosso(o) : '<span class="indosso-vuoto"></span>'}
      <!-- max = pezzi che possiedi (B2): le frecce del campo non vanno oltre -->
      <input type="number" class="quantita" min="1" max="${o.quantita_posseduta}" step="1" value="${o.quantita}" aria-label="Quantità di ${esc(o.nome)}">
      <button type="button" class="togli" aria-label="Togli ${esc(o.nome)} dallo zaino" title="Togli dallo zaino">
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>
      </button>
    </div>`;
}

// B3: il pulsante "lo indosso" (solo per l'abbigliamento).
// aria-pressed dice se è attivo ("true"/"false"), come i segmenti dell'armadio
function pulsanteIndosso(o) {
  return `
      <button type="button" class="indosso" aria-pressed="${o.indossato}" aria-label="Lo indosso: ${esc(o.nome)}" title="Lo indosso (non pesa nello zaino)">
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 3.5 4 6l1.8 3.6L8 8.6V20.5h8V8.6l2.2 1L20 6l-4.5-2.5c-.6 1.4-1.9 2.2-3.5 2.2s-2.9-.8-3.5-2.2Z"/></svg>
      </button>`;
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
elChecklist.addEventListener("change", async (e) => {
  const riga = e.target.closest(".riga-zaino[data-id]");
  if (!riga) return;
  const oggettoId = riga.dataset.id;
  nascondiErrore();

  let modifica;
  if (e.target.matches(".spunta")) {
    modifica = { inserito: e.target.checked };
  } else if (e.target.matches(".quantita")) {
    const quantita = Number(e.target.value);
    const posseduti = Number(e.target.max); // B2: quanti ne hai nell'armadio
    if (!Number.isInteger(quantita) || quantita < 1) {
      mostraErrore("La quantità deve essere un numero intero, almeno 1");
      renderZaino(); // rimette il valore giusto
      return;
    }
    if (quantita > posseduti) {
      mostraErrore(posseduti === 1 ? "Nell'armadio ne hai solo uno" : `Nell'armadio ne hai solo ${posseduti}`);
      renderZaino();
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

// --- Clic sui pulsanti della riga (event delegation sull'evento "click"):
//     "lo indosso" (B3) cambia indossato con PATCH, la X toglie dallo zaino con DELETE ---
elChecklist.addEventListener("click", async (e) => {
  const bottoneIndosso = e.target.closest(".indosso");
  const bottoneTogli = e.target.closest(".togli");
  if (!bottoneIndosso && !bottoneTogli) return;
  const oggettoId = e.target.closest(".riga-zaino[data-id]").dataset.id;
  nascondiErrore();
  try {
    if (bottoneIndosso) {
      // aria-pressed è testo ("true"/"false"): mando il contrario di com'è adesso
      const indossato = bottoneIndosso.getAttribute("aria-pressed") !== "true";
      await api(`/api/viaggi/${id}/zaino/${oggettoId}`, { method: "PATCH", body: { indossato } });
    } else {
      await api(`/api/viaggi/${id}/zaino/${oggettoId}`, { method: "DELETE" });
    }
    await caricaZaino();
  } catch (err) {
    mostraErrore(err.message);
  }
});

// B2: scegliendo un oggetto, il campo quantità non può superare i pezzi che ne possiedi
formAggiungi.elements.oggetto_id.addEventListener("change", () => {
  const scelto = armadio.find((o) => o.id === Number(formAggiungi.elements.oggetto_id.value));
  formAggiungi.elements.quantita.max = scelto ? scelto.quantita_posseduta : 99;
  formAggiungi.elements.quantita.value = 1;
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

// --- Elimina viaggio (prima era un pulsante nella lista dei viaggi) ---
document.querySelector("#elimina-viaggio").addEventListener("click", async () => {
  if (!confirm(`Eliminare il viaggio "${viaggio.nome}"?\nVerrà eliminato anche il suo zaino.`)) return;
  try {
    await api(`/api/viaggi/${id}`, { method: "DELETE" });
    location.href = "/viaggi.html"; // il viaggio non esiste più: torniamo alla lista
  } catch (err) {
    alert(err.message);
  }
});

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
    document.querySelector("#elimina-viaggio").hidden = true; // niente da eliminare
  } finally {
    // finally gira SEMPRE, sia dopo il try riuscito sia dopo il catch
    clearTimeout(timerCaricamento);     // se i dati sono arrivati prima dei 250 ms, l'animazione non parte proprio
    elCaricamento.hidden = true;
    document.querySelector("#intestazione").hidden = false; // titolo o messaggio d'errore
  }
}
