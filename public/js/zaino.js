import { api, esc, formattaData } from "./api.js";
import "./menu.js";
import { CATEGORIE } from "./categorie.js";
import { plurale } from "./testi.js"; // B3: numeri e parole accordati

// Pagina dello zaino di un'uscita: zaino.html?id=7 (prima stava dentro la scheda del viaggio).
// Con &genera=1 (pulsante "Genera lo zaino" della scheda) lo zaino si riempie appena la pagina si apre.
const id = Number(new URLSearchParams(location.search).get("id"));

// --- Elementi della pagina ---
const titolo = document.querySelector("#titolo");
const linkTorna = document.querySelector("#torna");
const bottoneGenera = document.querySelector("#genera");
const bottoneSvuota = document.querySelector("#svuota");
const elPesoInserito = document.querySelector("#peso-inserito");
const elPesoTotale = document.querySelector("#peso-totale");
const elPesoAddosso = document.querySelector("#peso-addosso"); // B3: quello che indossi, a parte
const barraRiempimento = document.querySelector("#barra-riempimento");
const elAvvisoPeso = document.querySelector("#avviso-peso");
const elPesoAcqua = document.querySelector("#peso-acqua"); // B4
const elPesoCorporeo = document.querySelector("#peso-corporeo"); // punto 1: lo zaino rispetto al tuo peso
const elTestoAvvisoPeso = document.querySelector("#testo-avviso-peso"); // il testo: l'icona accanto resta fissa
const elMessaggioZaino = document.querySelector("#messaggio-zaino");
const elChecklist = document.querySelector("#checklist");
// Punto 5: il riquadro «Com'è andata?». QUI in cima e non vicino al suo codice in fondo al file: il primo caricamento
// (await caricaZaino() più giù) disegna la pagina PRIMA che il modulo arrivi in fondo, e una const non ancora
// raggiunta non si può usare ("Cannot access 'elRientro' before initialization", errore del 4/11)
const elRientro = document.querySelector("#rientro");
const elRientroElenco = document.querySelector("#rientro-elenco");
const formAggiungi = document.querySelector("#form-aggiungi");
const erroreZaino = document.querySelector("#errore-zaino");

// --- Stato ---
let viaggio = null;                       // il viaggio (serve per la soglia del peso, l'acqua e il pernotto)
let zaino = { peso: null, oggetti: [] };  // la checklist (GET /api/viaggi/:id/zaino)
let armadio = [];                         // tutti i miei oggetti, per il selettore "aggiungi"

// Numeri in formato italiano: 3.5 → "3,5"; e con 2 decimali: 5.6 → "5,60"
const num = (n) => Number(n).toLocaleString("it-IT", { useGrouping: "always" });
const num2 = (n) => Number(n).toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// =====================================================================
//  ZAINO: checklist, peso, genera, aggiungi, modifica, togli, svuota
// =====================================================================

async function caricaZaino() {
  zaino = await api(`/api/viaggi/${id}/zaino`);
  renderZaino();
  caricaKit(); // B5: anche il riquadro "Per questo viaggio" dipende da cosa c'è nello zaino
}

// =====================================================================
//  B5: "PER QUESTA USCITA" – l'attrezzatura che serve, e dove si trova
// =====================================================================
const kitCard = document.querySelector("#kit-card");
const elKit = document.querySelector("#kit");
const elKitRiepilogo = document.querySelector("#kit-riepilogo");
const elKitGia = document.querySelector("#kit-gia");            // A6: "Mostra anche le … già nello zaino"
const elKitGiaTitolo = document.querySelector("#kit-gia-titolo");
const elKitOk = document.querySelector("#kit-ok");
const elAvvisoKit = document.querySelector("#avviso-kit");      // A6: la riga ocra in alto
const elTestoAvvisoKit = document.querySelector("#testo-avviso-kit");

async function caricaKit() {
  try {
    const voci = await api(`/api/viaggi/${id}/kit`);
    // A6 (revisione UX 2): prima quello che manca nello zaino (da procurare o da prendere nell'armadio), poi il resto
    // A1 (collaudo 3/11): uno zaino troppo piccolo è "da sistemare", insieme a quello che manca
    const mancano = voci.filter((v) => v.stato === "manca" || v.stato === "da_cambiare");
    const nellArmadio = voci.filter((v) => v.stato === "nell_armadio");
    const gia = voci.filter((v) => v.stato === "nello_zaino");
    const daFare = mancano.length + nellArmadio.length;
    elKitRiepilogo.textContent = daFare === 0
      ? "Hai tutto quello che serve"
      : [mancano.length ? `${mancano.length} da procurare` : "", nellArmadio.length ? `${nellArmadio.length} nell'armadio` : "",
         gia.length ? `${gia.length} già nello zaino` : ""].filter(Boolean).join(" · ");
    elKit.innerHTML = [...mancano, ...nellArmadio].map(rigaKit).join("");
    elKit.hidden = daFare === 0;
    // Quelle già nello zaino: dietro "Mostra anche…" (un <details> dentro il riquadro)
    elKitGia.hidden = gia.length === 0;
    elKitGiaTitolo.textContent = `Mostra anche ${gia.length === 1 ? "quella già nello zaino" : `le ${gia.length} già nello zaino`}`;
    elKitOk.innerHTML = gia.map(rigaKit).join("");
    // In alto, sotto il peso: la riga ocra se manca qualcosa
    elAvvisoKit.hidden = daFare === 0;
    elTestoAvvisoKit.textContent = daFare === 1 ? "Manca 1 cosa" : `Mancano ${daFare} cose`; // 4/11: più corto
    kitCard.hidden = false;
  } catch {
    kitCard.hidden = true;  // il riquadro è un aiuto in più: se non arriva, la pagina funziona lo stesso
    elAvvisoKit.hidden = true;
  }
}

// "Vedi": apre il riquadro in fondo e ci porta lì
document.querySelector("#vedi-kit").addEventListener("click", () => {
  kitCard.open = true;
  kitCard.scrollIntoView({ behavior: "smooth", block: "start" });
});

function rigaKit(v) {
  // 4/11 (Asiha): niente più il perché sotto ogni voce. Resta solo l'avviso dello zaino troppo piccolo
  const perche = v.avviso ? `<span class="kit-perche"><strong>${esc(v.avviso)}</strong></span>` : "";
  if (v.stato === "nello_zaino") {
    return `<li class="kit-ok"><span class="kit-segno" aria-hidden="true">✓</span>
      <span class="kit-testo"><strong>${esc(v.voce)}</strong> · nello zaino: ${esc(v.oggetto.nome)}${perche}</span></li>`;
  }
  if (v.stato === "da_cambiare") {
    // A1: lo zaino del viaggio è troppo piccolo. "Usa …" lo scambia con il più grande che hai
    const azione = v.sostituto
      ? `<button type="button" class="btn-piccolo" data-cambia-zaino="${v.oggetto.id}" data-con="${v.sostituto.id}">Usa «${esc(v.sostituto.nome)}»</button>`
      : `<a class="btn-piccolo btn secondario" href="/armadio.html?nuovo=${encodeURIComponent("Zaino")}&categoria=zaini&uscita=${id}">Aggiungi all'armadio</a>`;
    return `<li class="kit-manca"><span class="kit-segno" aria-hidden="true">!</span>
      <span class="kit-testo"><strong>${esc(v.voce)}</strong> · da cambiare${perche}</span>${azione}</li>`;
  }
  if (v.stato === "nell_armadio") {
    return `<li><span class="kit-segno" aria-hidden="true">○</span>
      <span class="kit-testo"><strong>${esc(v.voce)}</strong> · nell'armadio: ${esc(v.oggetto.nome)}${perche}</span>
      <button type="button" class="btn-piccolo" data-aggiungi="${v.oggetto.id}">Aggiungi</button></li>`;
  }
  // B6 (revisione UX 2): &uscita= → dopo il salvataggio l'armadio riporta qui, con l'oggetto già nello zaino
  const link = `/armadio.html?nuovo=${encodeURIComponent(v.voce)}&categoria=${encodeURIComponent(v.categoria)}&uscita=${id}`;
  return `<li class="kit-manca"><span class="kit-segno" aria-hidden="true">!</span>
    <span class="kit-testo"><strong>${esc(v.voce)}</strong> · ti manca${perche}</span>
    <a class="btn-piccolo btn secondario" href="${link}">Aggiungi all'armadio</a></li>`;
}

// "Aggiungi": l'oggetto dell'armadio entra nello zaino (stessa API di "Aggiungi dall'armadio")
elKit.addEventListener("click", async (e) => {
  // A1: cambio dello zaino: tolgo quello piccolo e metto quello grande (due richieste, una dopo l'altra)
  const cambia = e.target.closest("[data-cambia-zaino]");
  if (cambia) {
    cambia.disabled = true;
    nascondiErrore();
    try {
      await api(`/api/viaggi/${id}/zaino/${cambia.dataset.cambiaZaino}`, { method: "DELETE" });
      await api(`/api/viaggi/${id}/zaino`, { method: "POST", body: { oggetto_id: Number(cambia.dataset.con), quantita: 1 } });
      await caricaZaino();
    } catch (err) {
      mostraErrore(err.message);
      cambia.disabled = false;
    }
    return;
  }
  const bottone = e.target.closest("[data-aggiungi]");
  if (!bottone) return;
  bottone.disabled = true;
  nascondiErrore();
  try {
    await api(`/api/viaggi/${id}/zaino`, { method: "POST", body: { oggetto_id: Number(bottone.dataset.aggiungi), quantita: 1 } });
    await caricaZaino();
  } catch (err) {
    mostraErrore(err.message);
    bottone.disabled = false;
  }
});

function renderZaino() {
  bottoneSvuota.hidden = !zaino.oggetti.some((o) => o.inserito); // C6: senza spunte non serve
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
    // 4/11 (Asiha): frase corta e senza l'elenco dei più pesanti
    elTestoAvvisoPeso.textContent = `Lo zaino è troppo pesante: ${num2(p.peso_totale_kg)} kg. Il limite è ${num2(avviso.soglia_kg)} kg, valuta cosa togliere.`;
  }
  mostraPesoCorporeo(avviso, p.peso_totale_kg);
  // B4: solo un promemoria, fuori dai calcoli: l'acqua pesa 1 kg al litro
  const litri = viaggio?.consigli.acqua_persona_giorno;
  elPesoAcqua.hidden = litri == null;
  // 4/11 (Asiha): «Più 2 L d'acqua», con i litri a persona al giorno della scheda del viaggio
  if (litri != null) elPesoAcqua.textContent = `Più ${num(litri)} L d'acqua`;

  // Checklist: un gruppo per categoria, con il peso del gruppo (come nell'armadio)
  if (zaino.oggetti.length === 0) {
    elChecklist.innerHTML = "";
    mostraInfo("Zaino vuoto: premi «Genera zaino»."); // 4/11: più corto
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
  renderRientro();
}

// Una riga della checklist. Qui la riga NON è un pulsante: dentro ci sono già dei controlli
// (spunta, quantità, togli), e un controllo non può stare dentro un altro.
// A7 (revisione UX 2): casella, icona, nome e peso stanno dentro un <label>: toccando il nome si spunta
// (il label "gira" il tocco alla sua casella), e la zona da toccare diventa tutta la parte sinistra della riga.
function rigaZaino(o) {
  return `
    <div class="riga riga-zaino ${o.inserito ? "inserito" : ""} ${o.indossato ? "addosso" : ""}" data-id="${o.oggetto_id}">
      <label class="riga-spunta">
        <input type="checkbox" class="spunta" ${o.inserito ? "checked" : ""}>
        <span class="riquadro-icona"><img src="/img/icone/categorie/${o.categoria}.svg" alt="" width="22" height="22"></span>
        <span class="riga-testo">
          <span class="riga-nome">${esc(o.nome)}</span>
          <span class="riga-nota">${o.marchio ? `${esc(o.marchio)} · ` : ""}${num(o.peso_riga_g)}&nbsp;g${o.quantita > 1 ? ` (${num(o.peso_g)}&nbsp;g l'uno)` : ""}${o.indossato ? " · addosso" : ""}</span>
          ${notaNonUsato(o)}
        </span>
      </label>
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
    ? `<option value="">Scegli un oggetto…</option>` +
      disponibili.map((o) => `<option value="${o.id}">${esc(o.nome)} (${esc(o.peso_g)} g)</option>`).join("")
    : `<option value="">Tutto l'armadio è già nello zaino</option>`;
}

// --- Genera zaino (US4) ---
bottoneGenera.addEventListener("click", async () => {
  nascondiErrore();
  bottoneGenera.disabled = true;
  try {
    const { aggiunti, zaino: zainoScelto } = await api(`/api/viaggi/${id}/genera`, { method: "POST" });
    await caricaZaino();
    // 4/11 (Asiha): solo un segno che ha funzionato (sul telefono la lista è sotto, fuori dallo schermo).
    // Niente più spiegazioni (indispensabili, esclusi per la giornata, doppioni…): resta l'avviso dello zaino troppo piccolo
    let messaggio = aggiunti > 0 ? `${aggiunti === 1 ? "Aggiunto" : "Aggiunti"} ${plurale(aggiunti, "oggetto", "oggetti")}.` : "Niente da aggiungere.";
    if (zainoScelto?.avviso) messaggio += ` ${zainoScelto.avviso}.`; // A1: zaino troppo piccolo per questo viaggio
    mostraInfo(messaggio);
  } catch (err) {
    mostraErrore(err.message);
  } finally {
    bottoneGenera.disabled = false;
  }
});

// --- Svuota checklist (US5 CA4) ---
// C6 (revisione UX 2): niente finestra di conferma; ci ricordiamo cosa era spuntato e per qualche secondo si può annullare
bottoneSvuota.addEventListener("click", async () => {
  const spuntati = zaino.oggetti.filter((o) => o.inserito).map((o) => o.oggetto_id);
  nascondiErrore();
  try {
    const { svuotati } = await api(`/api/viaggi/${id}/zaino/svuota`, { method: "POST" });
    await caricaZaino();
    mostraAnnulla(`Spunte tolte: ${svuotati} ${svuotati === 1 ? "oggetto" : "oggetti"}`, async () => {
      // rimettiamo la spunta a quelli che l'avevano (una richiesta per oggetto, tutte insieme)
      await Promise.all(spuntati.map((oggettoId) =>
        api(`/api/viaggi/${id}/zaino/${oggettoId}`, { method: "PATCH", body: { inserito: true } })));
    });
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
    // B1 (revisione UX 2): il messaggio sotto la riga dell'oggetto, non in cima alla pagina (fuori vista)
    if (!Number.isInteger(quantita) || quantita < 1) {
      renderZaino(); // rimette il valore giusto
      erroreSottoRiga(oggettoId, "La quantità deve essere un numero intero, almeno 1");
      return;
    }
    if (quantita > posseduti) {
      renderZaino();
      erroreSottoRiga(oggettoId, `Nell'armadio ne hai ${posseduti}`, true);
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
      const o = zaino.oggetti.find((x) => String(x.oggetto_id) === String(oggettoId)); // com'era, per "Annulla"
      await api(`/api/viaggi/${id}/zaino/${oggettoId}`, { method: "DELETE" });
      if (o) mostraAnnulla(`Hai tolto «${o.nome}» dallo zaino`, async () => {
        // Lo rimettiamo com'era: stessa quantità, e se serve la spunta e "lo indosso"
        await api(`/api/viaggi/${id}/zaino`, { method: "POST", body: { oggetto_id: o.oggetto_id, quantita: o.quantita } });
        if (o.inserito || o.indossato) {
          await api(`/api/viaggi/${id}/zaino/${o.oggetto_id}`, { method: "PATCH", body: { inserito: o.inserito, ...(o.indossato ? { indossato: true } : {}) } });
        }
      });
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

// --- A7 (revisione UX 2): "Togli" resta un tocco solo, ma per qualche secondo si può annullare.
//     C6: lo stesso riquadro serve anche per "Togli tutte le spunte". Chi lo chiama passa il testo
//     e la funzione che rimette le cose com'erano (azione). ---
const boxAnnulla = document.querySelector("#annulla");
const testoAnnulla = document.querySelector("#testo-annulla");
const bottoneAnnulla = document.querySelector("#bottone-annulla");
let azioneAnnulla = null; // la funzione che disfa l'ultima operazione
let timerAnnulla = null;

function mostraAnnulla(testo, azione) {
  azioneAnnulla = azione;
  testoAnnulla.textContent = testo;
  boxAnnulla.hidden = false;
  clearTimeout(timerAnnulla);
  timerAnnulla = setTimeout(() => { boxAnnulla.hidden = true; azioneAnnulla = null; }, 7000); // 7 secondi per ripensarci
}

bottoneAnnulla.addEventListener("click", async () => {
  const azione = azioneAnnulla;
  if (!azione) return;
  clearTimeout(timerAnnulla);
  boxAnnulla.hidden = true;
  azioneAnnulla = null;
  nascondiErrore();
  try {
    await azione();
    await caricaZaino();
  } catch (err) {
    mostraErrore(err.message);
  }
});

// B1: un messaggio subito sotto la riga di un oggetto (sparisce alla prossima modifica dello zaino, che ridisegna la lista).
// conLink = aggiunge "Aggiorna i pezzi", che apre l'armadio sulla scheda di quell'oggetto
function erroreSottoRiga(oggettoId, testo, conLink = false) {
  const riga = elChecklist.querySelector(`.riga-zaino[data-id="${oggettoId}"]`);
  if (!riga) return mostraErrore(testo);
  const messaggio = document.createElement("p");
  messaggio.className = "errore-riga";
  messaggio.id = `errore-riga-${oggettoId}`;
  messaggio.setAttribute("role", "alert"); // il lettore di schermo lo annuncia subito
  messaggio.textContent = testo;
  if (conLink) {
    const link = document.createElement("a");
    link.href = `/armadio.html?apri=${oggettoId}`;
    link.textContent = "Aggiorna i pezzi";
    messaggio.append(" · ", link);
  }
  riga.after(messaggio);
  const campo = riga.querySelector(".quantita");
  campo.setAttribute("aria-invalid", "true");
  campo.setAttribute("aria-describedby", messaggio.id);
}

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
  location.href = "/zaini.html"; // URL senza un id valido: torniamo all'elenco degli zaini
} else {
  const elCaricamento = document.querySelector("#caricamento");
  const timerCaricamento = setTimeout(() => { elCaricamento.hidden = false; }, 250); // come nella scheda
  linkTorna.href = `/scheda-viaggio.html?id=${id}`;
  try {
    viaggio = await api(`/api/viaggi/${id}`);
    document.title = `Loadout – Zaino: ${viaggio.nome}`;
    titolo.textContent = `Zaino: ${viaggio.nome}`;
    armadio = await api("/api/oggetti?limit=200");
    await caricaZaino();
    document.querySelector("#corpo-zaino").hidden = false;
    // B6: arrivo dall'armadio dopo "Aggiungi all'armadio" (?aggiunto=Telo termico): lo diciamo
    const aggiunto = new URLSearchParams(location.search).get("aggiunto");
    if (aggiunto) {
      history.replaceState(null, "", `?id=${id}`);
      mostraInfo(`«${aggiunto}» aggiunto all'armadio e allo zaino.`);
    }
    // Arrivo da "Genera lo zaino" (o "Aggiorna lo zaino") della scheda: lo riempio subito
    if (new URLSearchParams(location.search).has("genera")) {
      history.replaceState(null, "", `?id=${id}`); // ricaricando la pagina non rigenera
      bottoneGenera.click();
    }
  } catch (err) {
    titolo.textContent = err.status === 404 ? "Questo viaggio non esiste più o è stato eliminato" : err.message;
  } finally {
    clearTimeout(timerCaricamento);
    elCaricamento.hidden = true;
    document.querySelector("#intestazione").hidden = false;
  }
}

// =====================================================================
//  Punto 1 (3/11): lo zaino rispetto al tuo peso corporeo
// =====================================================================
// La riga sotto il peso, sempre: «Il 10% del tuo peso · limite con pernotto 20% (12,4 kg)».
// I dati arrivano già dal server nel dettaglio del viaggio (consigli.avviso_peso: peso corporeo, percentuale e soglia).
// Senza il peso nel profilo, l'invito ad aggiungerlo (con il link). Costruita con textContent: niente innerHTML.
function mostraPesoCorporeo(avviso, pesoZainoKg) {
  if (!avviso) { elPesoCorporeo.hidden = true; return; }
  elPesoCorporeo.hidden = false;
  if (!avviso.disponibile) {
    const link = document.createElement("a");
    link.href = "/profilo.html";
    link.textContent = "Aggiungi il tuo peso nel profilo";
    elPesoCorporeo.replaceChildren(link, " per sapere quanto pesa lo zaino rispetto a te.");
    return;
  }
  const percento = Math.round((pesoZainoKg / avviso.peso_corporeo_kg) * 100);
  const uscita = viaggio.pernotto === "nessuno" ? "in giornata" : "con pernotto";
  elPesoCorporeo.textContent = `Il ${percento}% del tuo peso · limite ${uscita} ${avviso.soglia_percento}% (${num2(avviso.soglia_kg)} kg)`;
}


// =====================================================================
//  Punto 5 (3/11): «cosa non hai usato»
// =====================================================================
// La nota sotto il nome, se non l'hai usato le ultime 2 volte (stessa attività). La calcola il server
// (non_usato_prima = { viaggio, data } o null) e non la mette mai all'attrezzatura di sicurezza.
// Solo la nota: decidi tu se togliere l'oggetto, con la ✕ di sempre (scelta di Asiha).
function notaNonUsato(o) {
  if (!o.non_usato_prima) return "";
  const { viaggio, data } = o.non_usato_prima;
  const quando = data ? `, ${formattaData(data).slice(0, 5)}` : ""; // "12/10/2026" → "12/10"
  return `<span class="riga-nota nota-non-usato">Non usato le ultime 2 volte (${esc(viaggio)}${quando})</span>`;
}

// «Com'è andata?»: solo per i viaggi già fatti (fatto arriva dal server). Una casella per oggetto, spuntata = NON usato.
function renderRientro() {
  elRientro.hidden = !zaino.fatto || zaino.oggetti.length === 0;
  if (elRientro.hidden) return;
  elRientroElenco.innerHTML = zaino.oggetti.map((o) => `
    <label class="check"><input type="checkbox" data-id="${o.oggetto_id}" ${o.non_usato ? "checked" : ""}> ${esc(o.nome)}</label>`).join("");
}

// Ogni spunta si salva subito (PATCH), come la checklist. Se il server dice di no, la casella torna com'era
elRientroElenco.addEventListener("change", async (e) => {
  const casella = e.target.closest("input[data-id]");
  if (!casella) return;
  const oggetto = zaino.oggetti.find((o) => String(o.oggetto_id) === casella.dataset.id);
  try {
    await api(`/api/viaggi/${id}/zaino/${casella.dataset.id}`, { method: "PATCH", body: { non_usato: casella.checked } });
    if (oggetto) oggetto.non_usato = casella.checked;
  } catch (err) {
    casella.checked = !casella.checked;
    mostraErrore(err.message);
  }
});
