import { api, esc, formattaData } from "./api.js";
import "./menu.js";
import { CATEGORIE, ATTIVITA } from "./categorie.js";

// --- Quale viaggio? L'id arriva dall'URL: scheda-viaggio.html?id=7 ---
const id = Number(new URLSearchParams(location.search).get("id"));

// --- Elementi della pagina: intestazione e consigli ---
const titolo = document.querySelector("#titolo");
const dettagli = document.querySelector("#dettagli");
const elAcqua = document.querySelector("#acqua");
const elAcquaPersona = document.querySelector("#acqua-persona");
const formOre = document.querySelector("#form-ore");
const elSole = document.querySelector("#sole");
const elOraLimite = document.querySelector("#ora-limite"); // B2
const elMeteo = document.querySelector("#meteo");
const elPercorso = document.querySelector("#percorso");
const elEmergenza = document.querySelector("#emergenza");

// --- Elementi della pagina: zaino ---
const bottoneGenera = document.querySelector("#genera");
const bottoneSvuota = document.querySelector("#svuota");
const elPesoInserito = document.querySelector("#peso-inserito");
const elPesoTotale = document.querySelector("#peso-totale");
const elPesoAddosso = document.querySelector("#peso-addosso"); // B3: quello che indossi, a parte
const barraRiempimento = document.querySelector("#barra-riempimento");
const elAvvisoPeso = document.querySelector("#avviso-peso");
const elPesoAcqua = document.querySelector("#peso-acqua"); // B4
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
const num = (n) => Number(n).toLocaleString("it-IT", { useGrouping: "always" });
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
    ATTIVITA[v.attivita] ?? v.attivita,
    ...(v.luogo_partenza ? [`da ${v.luogo_partenza}`] : []),
    ...(v.quota_max_m != null ? [`fino a ${v.quota_max_m.toLocaleString("it-IT", { useGrouping: "always" })} m`] : []),
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
  // B2: l'ora limite di partenza, in evidenza (è il consiglio più utile d'inverno)
  const limite = c.ora_limite_partenza;
  elOraLimite.hidden = !limite;
  if (limite) {
    // tutto dentro uno <span>: .avviso è un flex, e ogni pezzo di testo diventerebbe una "colonna"
    elOraLimite.innerHTML = limite.prima_dell_alba
      ? `<span><strong>Attenzione:</strong> con ${num(c.ore_cammino_giorno)} ore di cammino non c'è abbastanza luce
         (alba ${esc(c.sole.alba)}, tramonto ${esc(c.sole.tramonto)}). Valuta di accorciare il percorso o di dividerlo in più giorni.</span>`
      : `<span>Parti <strong>entro le ${esc(limite.ora)}</strong> per arrivare almeno un'ora prima del tramonto
         (${num(c.ore_cammino_giorno)} ore di cammino, soste comprese nel margine).</span>`;
  }

  // Meteo e vestiario
  let htmlMeteo;
  if (c.meteo.disponibile) {
    const m = c.meteo;
    const quota = (metri) => (metri != null ? ` (${metri.toLocaleString("it-IT", { useGrouping: "always" })} m)` : "");
    const righe = [
      `<strong>In partenza</strong>${m.quota_partenza_m != null ? ` (circa ${m.quota_partenza_m.toLocaleString("it-IT", { useGrouping: "always" })} m)` : ""}:
       massima ${esc(num(m.temp_max))} °C · minima ${esc(num(m.temp_min))} °C · pioggia ${esc(m.prob_pioggia)}%`,
    ];
    // B3: la stima in cima, se conosciamo la quota massima
    if (m.cima) righe.push(`<strong>In cima</strong>${quota(m.cima.quota_m)}, stima: massima ${esc(num(m.cima.temp_max))} °C · minima ${esc(num(m.cima.temp_min))} °C`);
    if (m.vento_kmh != null) righe.push(`<strong>Vento</strong> fino a ${esc(num(m.vento_kmh))} km/h${m.raffiche_kmh != null ? `, raffiche ${esc(num(m.raffiche_kmh))} km/h` : ""}`);
    htmlMeteo = `${righe.map((r) => `<p>${r}</p>`).join("")}
      <ul>${m.vestiario.map((consiglio) => `<li>${esc(consiglio)}</li>`).join("")}</ul>`;
  } else {
    htmlMeteo = `<p>Non disponibile: ${esc(c.meteo.motivo)}.</p>`;
  }
  // B3: neve e ghiaccio, bollettino valanghe (valgono anche senza previsioni meteo)
  if (c.neve_ghiaccio) {
    htmlMeteo += `<p class="avviso"><span><strong>Neve e ghiaccio:</strong> sopra i 2000 m potresti trovarne.
      Valuta ramponcini o ramponi e informati sulle condizioni (rifugi, guide alpine).</span></p>`;
  }
  if (c.bollettino_valanghe) {
    htmlMeteo += `<p>Prima di partire controlla il <a href="https://www.aineva.it/bollettino/" target="_blank" rel="noopener">bollettino valanghe (AINEVA)</a>.</p>`;
  }
  elMeteo.innerHTML = htmlMeteo;

  // Percorso
  const parti = [];
  if (viaggio.luogo_arrivo) parti.push(`arrivo a ${viaggio.luogo_arrivo}`);
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
  caricaKit(); // B5: anche il riquadro "Per questa uscita" dipende da cosa c'è nello zaino
}

// =====================================================================
//  B5: "PER QUESTA USCITA" – l'attrezzatura che serve, e dove si trova
// =====================================================================
const kitCard = document.querySelector("#kit-card");
const elKit = document.querySelector("#kit");
const elKitRiepilogo = document.querySelector("#kit-riepilogo");

async function caricaKit() {
  try {
    const voci = await api(`/api/viaggi/${id}/kit`);
    const mancano = voci.filter((v) => v.stato === "manca").length;
    const daAggiungere = voci.filter((v) => v.stato === "nell_armadio").length;
    elKitRiepilogo.textContent = mancano + daAggiungere === 0
      ? "Hai tutto quello che serve per questa uscita."
      : [daAggiungere ? `${daAggiungere} da mettere nello zaino` : "", mancano ? `${mancano} che non hai nell'armadio` : ""]
          .filter(Boolean).join(" · ");
    elKit.innerHTML = voci.map(rigaKit).join("");
    kitCard.hidden = false;
  } catch {
    kitCard.hidden = true; // il riquadro è un aiuto in più: se non arriva, la scheda funziona lo stesso
  }
}

function rigaKit(v) {
  const perche = `<span class="kit-perche">${esc(v.perche)}</span>`;
  if (v.stato === "nello_zaino") {
    return `<li class="kit-ok"><span class="kit-segno" aria-hidden="true">✓</span>
      <span class="kit-testo"><strong>${esc(v.voce)}</strong> · nello zaino: ${esc(v.oggetto.nome)}${perche}</span></li>`;
  }
  if (v.stato === "nell_armadio") {
    return `<li><span class="kit-segno" aria-hidden="true">○</span>
      <span class="kit-testo"><strong>${esc(v.voce)}</strong> · nell'armadio: ${esc(v.oggetto.nome)}${perche}</span>
      <button type="button" class="btn-piccolo" data-aggiungi="${v.oggetto.id}">Aggiungi</button></li>`;
  }
  const link = `/armadio.html?nuovo=${encodeURIComponent(v.voce)}&categoria=${encodeURIComponent(v.categoria)}`;
  return `<li class="kit-manca"><span class="kit-segno" aria-hidden="true">!</span>
    <span class="kit-testo"><strong>${esc(v.voce)}</strong> · ti manca${perche}</span>
    <a class="btn-piccolo btn secondario" href="${link}">Aggiungi all'armadio</a></li>`;
}

// "Aggiungi": l'oggetto dell'armadio entra nello zaino (stessa API di "Aggiungi dall'armadio")
elKit.addEventListener("click", async (e) => {
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
    const uscita = viaggio.pernotto === "nessuno" ? "per un'uscita in giornata" : "con il pernotto";
    elTestoAvvisoPeso.textContent = `Lo zaino, senza acqua e cibo, pesa ${num2(p.peso_totale_kg)} kg: più del ${avviso.soglia_percento}% ` +
      `del tuo peso corporeo, il limite consigliato ${uscita} (${num2(avviso.soglia_kg)} kg). Valuta cosa togliere.`;
  }
  // B4: solo un promemoria, fuori dai calcoli: l'acqua pesa 1 kg al litro
  const litri = viaggio?.consigli.acqua_persona_giorno;
  elPesoAcqua.hidden = litri == null;
  if (litri != null) elPesoAcqua.textContent = `Più circa ${num(litri)} kg d'acqua a persona al giorno (1 litro = 1 kg), meno se lungo il percorso trovi fontane o rifugi.`;

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
    ? `<option value="">Scegli un oggetto…</option>` +
      disponibili.map((o) => `<option value="${o.id}">${esc(o.nome)} (${esc(o.peso_g)} g)</option>`).join("")
    : `<option value="">Tutto l'armadio è già nello zaino</option>`;
}

// --- Genera zaino (US4) ---
bottoneGenera.addEventListener("click", async () => {
  nascondiErrore();
  bottoneGenera.disabled = true;
  try {
    const { aggiunti, base, dal_kit: dalKit, esclusi } = await api(`/api/viaggi/${id}/genera`, { method: "POST" });
    await caricaZaino();
    // C2: entrano solo gli oggetti adatti all'attività del viaggio (o adatti a tutte)
    // B5: cosa ha fatto "Genera", in parole
    const parti = [];
    if (base > 0) parti.push(`${base} tra indispensabili e preferiti`);
    if (dalKit > 0) parti.push(`${dalKit} dall'attrezzatura per questa uscita`);
    let messaggio = aggiunti > 0
      ? `Aggiunti ${aggiunti} ${aggiunti === 1 ? "oggetto" : "oggetti"}: ${parti.join(" e ")}.`
      : "Nessun oggetto nuovo: lo zaino ha già tutto quello che posso aggiungere dal tuo armadio.";
    if (esclusi > 0) messaggio += ` In giornata ho lasciato fuori ${esclusi === 1 ? "un oggetto" : `${esclusi} oggetti`} che servono solo per dormire fuori.`;
    mostraInfo(messaggio);
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
    mostraInfo(`Spunte tolte: ${svuotati} ${svuotati === 1 ? "oggetto" : "oggetti"} da rimettere nello zaino. Gli oggetti restano nella lista.`);
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
// Arrivo dalla modifica del viaggio con attività, pernotto, cucina o giorni cambiati (?aggiorna=1):
// propongo di aggiornare lo zaino. "Genera" aggiunge solo quello che manca, non toglie niente.
function proponiAggiornamento() {
  const parametri = new URLSearchParams(location.search);
  if (!parametri.has("aggiorna")) return;
  history.replaceState(null, "", `?id=${id}`); // tolgo "aggiorna" dall'indirizzo: ricaricando non riappare
  elMessaggioZaino.textContent = "Hai cambiato l'uscita: vuoi aggiornare lo zaino? Aggiungo solo quello che manca. ";
  const bottone = document.createElement("button");
  bottone.type = "button";
  bottone.className = "btn-piccolo";
  bottone.textContent = "Aggiorna lo zaino";
  bottone.addEventListener("click", () => bottoneGenera.click()); // stesso effetto di "Genera zaino"
  elMessaggioZaino.append(bottone);
  elMessaggioZaino.hidden = false;
}

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

// --- Emergenza (C1): sempre il 112, più il contatto del profilo se c'è (tel: = un tocco per chiamare) ---
function mostraEmergenza(utente) {
  const { emergenza_nome: nome, emergenza_telefono: telefono, note_mediche: note, tessera_soccorso: tessera } = utente;
  let html = 'In caso di emergenza chiama il <a href="tel:112"><strong>112</strong></a>.'; // un tocco per chiamare
  if (nome || telefono) {
    const chi = esc(nome || "il tuo contatto");
    const numero = telefono ? ` <a href="tel:${esc(telefono.replace(/\s/g, ""))}">${esc(telefono)}</a>` : "";
    html += ` Avvisa anche ${chi}${numero}.`;
  }
  // Le informazioni da dire (o far leggere) a chi ti soccorre
  if (note) html += `<br><strong>Note mediche:</strong> ${esc(note)}`;
  if (tessera) html += `<br><strong>Tessera / assicurazione:</strong> ${esc(tessera)}`;
  if (!nome && !telefono && !note && !tessera) {
    html += ' <a href="/profilo.html">Aggiungi nel profilo</a> un contatto di emergenza, le note mediche e la tessera CAI.';
  }
  // B6: "Lascia detto": un messaggio già scritto per il contatto di emergenza (lo mandi tu, l'app non invia niente)
  if (telefono) {
    const testo = encodeURIComponent(messaggioLasciaDetto(nome));
    const cifre = numeroInternazionale(telefono);
    html += `<span class="lascia-detto"><strong>Lascia detto</strong> dove vai prima di partire:
      <a class="btn btn-piccolo" href="https://wa.me/${cifre}?text=${testo}" target="_blank" rel="noopener">WhatsApp</a>
      <a class="btn btn-piccolo secondario" href="sms:+${cifre}?body=${testo}">SMS</a></span>`;
  } else {
    html += '<span class="lascia-detto"><strong>Lascia detto</strong> dove vai: <a href="/profilo.html">aggiungi il telefono del contatto</a> e ti preparo il messaggio.</span>';
  }
  elEmergenza.innerHTML = html;
}

// "+39 333 123 4567" → "393331234567" (wa.me vuole solo cifre, con il prefisso del paese).
// Un numero italiano scritto senza prefisso (es. "333 1234567") riceve il 39 davanti.
function numeroInternazionale(telefono) {
  const cifre = telefono.replace(/\D/g, "");
  if (telefono.trim().startsWith("+")) return cifre;
  if (cifre.startsWith("00")) return cifre.slice(2);
  return `39${cifre}`;
}

// Il testo del messaggio, con quello che l'app sa già dell'uscita
function messaggioLasciaDetto(nomeContatto) {
  const v = viaggio;
  const giorno = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" });
  const quando = v.data_partenza ? giorno(v.data_partenza) : "nei prossimi giorni";
  const tipo = v.pernotto === "nessuno"
    ? "in giornata"
    : `${v.n_giorni} ${v.n_giorni === 1 ? "giorno" : "giorni"}, pernotto in ${v.pernotto}`;
  // "Escursione / trekking" nel messaggio diventa la parola giusta: trekking se dura più giorni
  const attivita = v.attivita === "escursione" ? (v.n_giorni > 1 ? "trekking" : "escursione") : (ATTIVITA[v.attivita] ?? v.attivita).toLowerCase();
  const frasi = [`Ciao${nomeContatto ? ` ${nomeContatto}` : ""}, ${quando} vado a «${v.nome}» (${attivita}, ${tipo}).`];
  const limite = v.consigli?.ora_limite_partenza;
  if (v.luogo_partenza) frasi.push(`Parto da ${v.luogo_partenza}${limite?.ora && !limite.prima_dell_alba ? ` entro le ${limite.ora}` : ""}.`);
  if (v.luogo_arrivo) frasi.push(`Arrivo a ${v.luogo_arrivo}.`);
  // Il rientro: in giornata prima del tramonto; su più giorni, l'ultimo giorno
  if (v.pernotto === "nessuno" && v.consigli?.sole?.disponibile) frasi.push(`Rientro previsto prima delle ${v.consigli.sole.tramonto}.`);
  if (v.pernotto !== "nessuno" && v.data_partenza && v.n_giorni > 1) {
    const ultimo = new Date(`${v.data_partenza}T12:00:00`);
    ultimo.setDate(ultimo.getDate() + v.n_giorni - 1);
    frasi.push(`Rientro previsto ${ultimo.toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" })}.`);
  }
  frasi.push(v.n_persone === 1 ? "Non viene nessuno con me." : `Siamo in ${v.n_persone}.`);
  frasi.push("Se non ti scrivo entro sera, chiama il 112.");
  return frasi.join(" ");
}

// --- Modifica viaggio: usa la finestra della pagina Viaggi, già compilata ---
document.querySelector("#modifica-viaggio").addEventListener("click", () => {
  location.href = `/viaggi.html?modifica=${id}`;
});

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
    mostraEmergenza(await api("/api/auth/me")); // C1: il contatto di emergenza dal profilo
    document.querySelector("#corpo-scheda").hidden = false; // tutto ok: mostro zaino e consigli
    proponiAggiornamento();
  } catch (err) {
    // 404 = l'uscita non esiste (o è di un altro utente): un messaggio comprensibile, senza numeri
    titolo.textContent = err.status === 404 ? "Questa uscita non esiste più o è stata eliminata" : err.message;
    document.querySelector("#elimina-viaggio").hidden = true; // niente da eliminare
    document.querySelector("#modifica-viaggio").hidden = true; // né da modificare
  } finally {
    // finally gira SEMPRE, sia dopo il try riuscito sia dopo il catch
    clearTimeout(timerCaricamento);     // se i dati sono arrivati prima dei 250 ms, l'animazione non parte proprio
    elCaricamento.hidden = true;
    document.querySelector("#intestazione").hidden = false; // titolo o messaggio d'errore
  }
}
