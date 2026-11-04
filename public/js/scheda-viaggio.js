import { api, esc, formattaData } from "./api.js";
import "./menu.js";
import { ATTIVITA } from "./categorie.js";
import { plurale, ore } from "./testi.js"; // B3: numeri e parole accordati
import { attivaFormUscita } from "./form-uscita.js"; // B12: la finestra di modifica si apre qui, senza cambiare pagina
import { discesaDellaTraccia } from "./navigazione-calcoli.js"; // D− anche per le mappe salvate prima che esistesse
import { mostraAvvisi } from "./avvisi-percorso.js";
import { mostraDiario } from "./diario.js";                       // punto 6: nota e voto, dopo il viaggio             // i tratti difficili del percorso (dalla mappa)

// C10 (revisione UX 2): un piccolo «?» accanto alle parole difficili, porta alla spiegazione nel glossario dei Consigli
const aiuto = (id, cosa) =>
  `<a class="aiuto" href="/consigli.html#g-${id}" aria-label="Cosa vuol dire ${cosa}?" title="Cosa vuol dire ${cosa}?">?</a>`;
// Quale voce del glossario spiega ogni avviso della vetta
const AIUTO_AVVISO = { vento: ["raffiche", "raffiche"], zero_termico: ["zero-termico", "zero termico"] };

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
const elEmergenza = document.querySelector("#emergenza");

// --- Collegamenti allo zaino e alla mappa dell'uscita (nella testata) ---
const linkZaino = document.querySelector("#link-zaino");
const linkMappa = document.querySelector("#link-mappa");
const elProponiZaino = document.querySelector("#proponi-zaino");

// --- Stato ---
let viaggio = null; // il viaggio con peso e consigli (GET /api/viaggi/:id)

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
  mostraDiario(viaggio);
}

function renderIntestazione() {
  const v = viaggio;
  document.title = `Loadout – ${v.nome}`;
  titolo.textContent = v.nome;
  // B10 (revisione UX 2): prima le tre etichette principali (data e ora, attività, quota), poi le altre.
  // Sul telefono le altre stanno dietro "+N dettagli" (il CSS le nasconde finché non lo tocchi); sul computer si vedono tutte.
  const principali = [
    v.data_partenza ? `partenza ${formattaData(v.data_partenza)}${v.ora_partenza ? ` · ore ${v.ora_partenza}` : ""}` : "data da decidere",
    ATTIVITA[v.attivita] ?? v.attivita,
    ...(v.quota_max_m != null ? [`fino a ${v.quota_max_m.toLocaleString("it-IT", { useGrouping: "always" })} m`] : []),
  ];
  const altre = [
    ...(v.luogo_partenza ? [`da ${v.luogo_partenza}`] : []),
    `${v.n_persone} ${v.n_persone === 1 ? "persona" : "persone"}`,
    `${v.n_giorni} ${v.n_giorni === 1 ? "giorno" : "giorni"}`,
    v.pernotto === "nessuno" ? "in giornata" : `pernotto in ${v.pernotto}`,
    v.serve_cucina ? "con cucina" : "senza cucina",
  ];
  // Ogni dato del viaggio diventa un'etichetta (createElement + textContent: niente innerHTML, niente XSS)
  const extra = altre.map((testo) => creaEtichetta(testo));
  if (v.pianificato) extra.push(creaEtichetta("da fare in futuro", "da-fare"));
  extra.forEach((el) => el.classList.add("etichetta-extra"));
  const piu = document.createElement("button");
  piu.type = "button";
  piu.className = "etichetta etichetta-piu";
  piu.textContent = `+${extra.length} dettagli`;
  piu.setAttribute("aria-expanded", "false");
  piu.addEventListener("click", () => {
    dettagli.classList.add("aperte"); // mostra le altre etichette e nasconde questo pulsante
    piu.setAttribute("aria-expanded", "true");
  });
  dettagli.classList.remove("aperte");
  dettagli.replaceChildren(...principali.map((testo) => creaEtichetta(testo)), ...extra, piu);
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

    const persone = `${v.n_persone} ${v.n_persone === 1 ? "persona" : "persone"}`;
    const giorni = `${v.n_giorni} ${v.n_giorni === 1 ? "giorno" : "giorni"}`;
    // 4/11 (Asiha): solo il totale, senza la spiegazione del calcolo (ore, dislivello, temperatura, cucina)
    elAcqua.textContent = `In tutto ${num(c.acqua_litri)} L per ${persone} per ${giorni}.`;
  }
  formOre.elements.ore.value = c.ore_cammino_giorno ?? "";

  // Alba e tramonto
  elSole.textContent = c.sole.disponibile
    ? `Alba alle ${c.sole.alba}, tramonto alle ${c.sole.tramonto}.`
    : `Non disponibile: ${c.sole.motivo}.`;
  // B2: l'ora limite di partenza, in evidenza (è il consiglio più utile d'inverno)
  const limite = c.ora_limite_partenza;
  // 4/11 (Asiha): tolto l'avviso «Parti troppo tardi» in cima alla scheda (era la B7 della revisione UX 2):
  // il ritardo resta detto solo qui sotto Alba e tramonto, nel riquadro dell'ora limite
  elOraLimite.hidden = !limite;
  if (limite) {
    // tutto dentro uno <span>: .avviso è un flex, e ogni pezzo di testo diventerebbe una "colonna"
    elOraLimite.innerHTML = limite.prima_dell_alba
      ? `<span><strong>Attenzione:</strong> con ${ore(c.ore_cammino_giorno)} di cammino non c'è abbastanza luce
         (alba ${esc(c.sole.alba)}, tramonto ${esc(c.sole.tramonto)}). Valuta di accorciare il percorso o di dividerlo in più giorni.</span>`
      : `<span>Parti <strong>entro le ${esc(limite.ora)}</strong> per arrivare almeno un'ora prima del tramonto
         (${ore(c.ore_cammino_giorno)} di cammino) ${aiuto("ora-limite", "ora limite")}.${limite.in_ritardo
           ? ` <strong>Hai segnato la partenza alle ${esc(limite.ora_partenza)}: è più tardi del limite.</strong>` : ""}</span>`;
  }

  // Meteo e vestiario
  let htmlMeteo;
  if (c.meteo.disponibile) {
    const m = c.meteo;
    // B8 (revisione UX 2): una tabellina Partenza / Vetta al posto di cinque righe di numeri.
    // Numeri interi (niente decimali inutili); "–" dove il dato non c'è. Tutti numeri o testi nostri: niente rischio XSS
    const n0 = (n) => (n == null ? "–" : Math.round(n).toLocaleString("it-IT", { useGrouping: "always" }));
    const metri = (q) => (q != null ? ` (${n0(q)} m)` : "");
    const vt = m.vetta;
    const stima = vt?.fonte === "stima"; // Open-Meteo non ha risposto per la vetta: resta la stima (−6 °C ogni 1000 m)
    // Collaudo 3/11, C3: stesso formato nelle due colonne ("min 0 · max 2 °C"); in vetta, prima, il valore all'ora di arrivo
    const minMax = (a, b) => (a == null && b == null ? '<span class="muto">non disponibile</span>' : `min ${n0(a)} · max ${n0(b)} °C`);
    const allArrivo = (n) => (n == null ? "" : `${n0(n)} °C all'arrivo<br>`);
    const colonnaVetta = vt ? {
      titolo: `Vetta${metri(vt.quota_m)}${!stima && vt.ora_arrivo_stimata ? ` · verso le ${esc(vt.ora_arrivo_stimata)}` : ""}${stima ? " · stima" : ""}`,
      temperatura: `${stima ? "" : allArrivo(vt.temp)}<span class="${stima ? "" : "muto"}">${minMax(vt.temp_min, vt.temp_max)}</span>`,
      percepita: stima || (vt.percepita == null && vt.percepita_min == null) ? '<span class="muto">non disponibile</span>'
        : `${allArrivo(vt.percepita)}${vt.percepita_min != null ? `<span class="muto">min ${n0(vt.percepita_min)} °C</span>` : ""}`,
      raffiche: !stima && vt.raffiche_kmh != null ? `${n0(vt.raffiche_kmh)} km/h` : "–",
      pioggia: "–",
    } : null;
    const colonnaPartenza = {
      // A4 (collaudo 3/11): se la vetta è a meno di 100 m sopra la partenza, una colonna sola "Sul percorso"
      titolo: `${m.una_quota ? "Sul percorso" : "Partenza"}${m.quota_partenza_m != null ? ` (circa ${n0(m.quota_partenza_m)} m)` : ""}`,
      temperatura: minMax(m.temp_min, m.temp_max),
      percepita: minMax(m.percepita_min, m.percepita_max),
      raffiche: m.raffiche_kmh != null ? `${n0(m.raffiche_kmh)} km/h` : "–",
      pioggia: `${n0(m.prob_pioggia)}%`,
    };
    const colonne = [colonnaPartenza, ...(colonnaVetta ? [colonnaVetta] : [])];
    const riga = (nome, chiave) => `<tr><th scope="row">${nome}</th>${colonne.map((col) => `<td>${col[chiave]}</td>`).join("")}</tr>`;
    htmlMeteo = `${vt ? `<p class="muto">Meteo calcolato sul punto più alto che raggiungerai${metri(vt.quota_m)}</p>` : ""}
      <table class="tabella-meteo">
        <thead><tr><td></td>${colonne.map((col) => `<th scope="col">${col.titolo}</th>`).join("")}</tr></thead>
        <tbody>${riga("Temperatura", "temperatura")}${riga(`Percepita ${aiuto("percepita", "temperatura percepita")}`, "percepita")}${riga(`Raffiche ${aiuto("raffiche", "raffiche")}`, "raffiche")}${riga("Pioggia", "pioggia")}</tbody>
      </table>
      <ul>${m.vestiario.map((consiglio) => `<li>${esc(consiglio)}</li>`).join("")}</ul>`;
    // gli avvisi della vetta (vento, zero termico, temporali) nel riquadro ocra, come gli altri avvisi
    for (const a of m.avvisi ?? []) {
      const voce = AIUTO_AVVISO[a.tipo];
      htmlMeteo += `<p class="avviso"><span>${esc(a.testo)}${voce ? ` ${aiuto(...voce)}` : ""}</span></p>`;
    }
  } else {
    htmlMeteo = `<p>Non disponibile: ${esc(c.meteo.motivo)}.</p>`;
  }
  // B3: neve e ghiaccio, bollettino valanghe (valgono anche senza previsioni meteo)
  if (c.neve_ghiaccio) {
    htmlMeteo += `<p class="avviso"><span><strong>Neve e ghiaccio:</strong> sopra i 2000 m potresti trovarne.
      Valuta ramponcini o ramponi e informati sulle condizioni (rifugi, guide alpine).</span></p>`;
  }
  if (c.bollettino_valanghe) {
    htmlMeteo += `<p>Prima di partire controlla il <a href="https://www.aineva.it/bollettino/" target="_blank" rel="noopener">bollettino valanghe (AINEVA)</a> ${aiuto("valanghe", "bollettino valanghe")}.</p>`;
  }
  elMeteo.innerHTML = htmlMeteo;

  // Percorso: 4/11 (Asiha) tolta la riga «12,4 km di sentiero · 950 m di dislivello positivo…» (gli stessi numeri
  // sono nella tessera della mappa). Restano gli avvisi sul percorso; senza avvisi il riquadro Percorso non si vede
  const elAvvisi = document.querySelector("#avvisi-percorso");
  elAvvisi.hidden = !mostraAvvisi(elAvvisi, viaggio.traccia);
  elAvvisi.closest(".consiglio").hidden = elAvvisi.hidden;
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

// --- Le tessere dello zaino e della mappa: se ci sono si aprono (con il riepilogo), altrimenti si creano ---
function renderCollegamenti() {
  const p = viaggio.peso;
  const testo = (selettore, valore) => { document.querySelector(selettore).textContent = valore; }; // textContent: niente XSS
  // B10: la barra sottile di avanzamento sulla tessera dello zaino (larghezza con style.width: la CSP lo permette)
  const barraTessera = document.querySelector("#barra-tessera");
  barraTessera.hidden = !(p.n_oggetti > 0 && p.n_inseriti != null);
  if (!barraTessera.hidden) barraTessera.firstElementChild.style.width = `${Math.round((p.n_inseriti / p.n_oggetti) * 100)}%`;
  if (p.n_oggetti > 0) {
    linkZaino.href = `/zaino.html?id=${id}`;
    testo("#titolo-zaino", "Lo zaino");
    const quanti = p.n_inseriti != null ? `${p.n_inseriti} su ${p.n_oggetti} nello zaino` : plurale(p.n_oggetti, "oggetto", "oggetti");
    testo("#riepilogo-zaino", `${quanti} · ${num2(p.peso_totale_kg)} kg`);
  } else {
    linkZaino.href = `/zaino.html?id=${id}&genera=1`; // la pagina dello zaino lo riempie appena si apre
    testo("#titolo-zaino", "Genera lo zaino");
    testo("#riepilogo-zaino", "Ancora vuoto: lo riempio con indispensabili, preferiti e l'attrezzatura per questo viaggio.");
  }
  linkMappa.href = `/mappa.html?id=${id}`; // la mappa si disegna e si guarda nella sua pagina, come lo zaino
  if (viaggio.traccia) {
    const parti = [];
    if (viaggio.distanza_km != null) parti.push(`${num(viaggio.distanza_km)} km`);
    if (viaggio.dislivello_m != null) parti.push(`D+ ${num(viaggio.dislivello_m)} m`);
    const discesaMappa = discesaDellaTraccia(viaggio.traccia, viaggio.dislivello_m);
    if (discesaMappa != null) parti.push(`D− ${num(discesaMappa)} m`);
    testo("#titolo-mappa", "La mappa");
    testo("#riepilogo-mappa", parti.join(" · ") || "Il percorso sui sentieri");
  } else {
    testo("#titolo-mappa", "Disegna la mappa");
    testo("#riepilogo-mappa", "Tocca partenza e tappe: il percorso segue i sentieri.");
  }
  document.querySelector("#tessere").hidden = false;
}

// Arrivo dalla modifica del viaggio con attività, pernotto, cucina o giorni cambiati (?aggiorna=1):
// propongo di aggiornare lo zaino. "Aggiorna" apre lo zaino e fa "Genera", che aggiunge solo quello che manca.
// B12 (revisione UX 2): un riquadro ocra con titolo e l'elenco di quello che "Genera" aggiungerebbe dall'armadio.
// subito = true dopo una modifica fatta in questa pagina; altrimenti vale il vecchio ?aggiorna=1 nell'indirizzo
async function proponiAggiornamento(subito = false) {
  const daIndirizzo = new URLSearchParams(location.search).has("aggiorna");
  if ((!subito && !daIndirizzo) || !(viaggio.peso.n_oggetti > 0)) return;
  if (daIndirizzo) history.replaceState(null, "", `?id=${id}`); // ricaricando la pagina non riappare
  // B8 (collaudo 3/11): un oggetto può servire per due voci (es. «Fornello a gas» per fornello e gas): una volta sola.
  // E separiamo quello che si prende dall'armadio da quello che non hai (e lo zaino da cambiare, A1)
  let dallArmadio = [], mancano = [], zainoPiccolo = null;
  try {
    const voci = await api(`/api/viaggi/${id}/kit`);
    const visti = new Set();
    for (const v of voci) {
      if (v.stato === "nell_armadio" && !visti.has(v.oggetto.id)) { visti.add(v.oggetto.id); dallArmadio.push(v.oggetto.nome); }
      if (v.stato === "manca") mancano.push(v.voce.toLowerCase());
      if (v.stato === "da_cambiare") zainoPiccolo = v.avviso;
    }
  } catch { /* l'elenco è un aiuto in più: senza, il riquadro resta utile */ }
  const titolo = document.createElement("strong");
  titolo.textContent = "Lo zaino è da aggiornare. ";
  const pezzi = [];
  if (dallArmadio.length) pezzi.push(`Dall'armadio servono anche: ${elenco(dallArmadio)}.`);
  if (mancano.length) pezzi.push(`Ti mancano: ${elenco(mancano)}.`);
  if (zainoPiccolo) pezzi.push(`${zainoPiccolo}.`);
  const testo = pezzi.length
    ? `${pezzi.join(" ")} `
    : "Con le modifiche potrebbero servire altre cose: «Aggiorna lo zaino» aggiunge solo quello che manca. ";
  const link = document.createElement("a");
  link.className = "btn btn-piccolo";
  link.href = `/zaino.html?id=${id}&genera=1`;
  link.textContent = "Aggiorna lo zaino";
  const corpo = document.createElement("span");
  corpo.append(titolo, testo, link);
  elProponiZaino.replaceChildren(corpo);
  elProponiZaino.hidden = false;
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

// Il testo del messaggio, con quello che l'app sa già dell'uscita.
// A4 (revisione UX 2): l'ora di PARTENZA scritta (non l'ora limite), il rientro previsto e un'ora precisa
// entro cui preoccuparsi, così chi riceve il messaggio sa quando chiamare il 112.
function messaggioLasciaDetto(nomeContatto) {
  const v = viaggio;
  const c = v.consigli ?? {};
  const giorno = (data) => data.toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" });
  const inizio = v.data_partenza ? new Date(`${v.data_partenza}T12:00:00`) : null;
  const tipo = v.pernotto === "nessuno"
    ? "in giornata"
    : `${v.n_giorni} ${v.n_giorni === 1 ? "giorno" : "giorni"}, pernotto in ${v.pernotto}`;
  // "Escursione / trekking" nel messaggio diventa la parola giusta: trekking se dura più giorni
  const attivita = v.attivita === "escursione" ? (v.n_giorni > 1 ? "trekking" : "escursione") : (ATTIVITA[v.attivita] ?? v.attivita).toLowerCase();
  const frasi = [`Ciao${nomeContatto ? ` ${nomeContatto}` : ""}, ${inizio ? giorno(inizio) : "nei prossimi giorni"} vado a «${v.nome}» (${attivita}, ${tipo}).`];

  // Partenza: l'ora che hai scritto nel form (08:00 se non l'hai scritta)
  const partenza = minutiDa(v.ora_partenza || "08:00");
  frasi.push(`Parto alle ${orarioBreve(partenza)}${v.luogo_partenza ? ` da ${v.luogo_partenza}` : ""}.`);
  if (v.luogo_arrivo) frasi.push(`Arrivo a ${v.luogo_arrivo}.`);

  // Rientro: ora di partenza + ore di cammino; con più giorni, l'ultimo giorno
  const piuGiorni = v.pernotto !== "nessuno" && v.n_giorni > 1;
  let ultimo = inizio;
  if (inizio && piuGiorni) {
    ultimo = new Date(inizio);
    ultimo.setDate(ultimo.getDate() + v.n_giorni - 1);
  }
  // Più giorni (controllo finale della revisione UX 2): l'ora in cui lasci il rifugio l'ultimo giorno non la sappiamo,
  // quindi niente ore inventate (un allarme troppo presto farebbe chiamare il 112 per niente):
  // solo il giorno del rientro, e "entro la tarda serata" di quel giorno (scelta di Asiha).
  if (piuGiorni && ultimo) {
    frasi.push(`Rientro previsto ${giorno(ultimo)}.`);
    frasi.push(v.n_persone === 1 ? "Non viene nessuno con me." : `Siamo in ${v.n_persone}.`);
    frasi.push(`Se entro la tarda serata di ${giorno(ultimo)} non ti ho scritto, chiama il 112 e leggigli questo messaggio.`);
    return frasi.join(" ");
  }

  // In giornata: rientro = ora di partenza + ore di cammino
  const rientro = c.ore_cammino_giorno != null ? partenza + Math.round(c.ore_cammino_giorno * 60) : null;
  if (rientro != null) frasi.push(`Rientro previsto verso le ${orarioBreve(rientro)}.`);
  frasi.push(v.n_persone === 1 ? "Non viene nessuno con me." : `Siamo in ${v.n_persone}.`);

  // Ora entro cui preoccuparsi: il rientro + 2 ore, ma mai dopo un'ora dal tramonto
  const tramontoPiuUno = c.sole?.disponibile ? minutiDa(c.sole.tramonto) + 60 : null;
  const candidati = [rientro != null ? rientro + 120 : null, tramontoPiuUno].filter((n) => n != null);
  if (candidati.length) {
    const allarme = Math.min(...candidati, 23 * 60 + 59);
    frasi.push(`Se alle ${orarioBreve(allarme)} non ti ho scritto, chiama il 112 e leggigli questo messaggio.`);
  } else {
    frasi.push("Se entro sera non ti ho scritto, chiama il 112 e leggigli questo messaggio.");
  }
  return frasi.join(" ");
}

// "08:30" → 510 minuti dalla mezzanotte; 510 → "8:30" (all'italiana, senza lo zero davanti all'ora)
function minutiDa(hhmm) { const [h, m] = hhmm.split(":").map(Number); return h * 60 + (m || 0); }
function orarioBreve(minuti) {
  const m = Math.min(Math.max(Math.round(minuti), 0), 23 * 60 + 59);
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`;
}

// --- Modifica viaggio ---
// B12 (revisione UX 2): la finestra di modifica si apre QUI (prima portava sopra la lista dei Viaggi).
// Dopo il salvataggio la scheda si aggiorna senza cambiare pagina, e se serve propone di aggiornare lo zaino.
let utente = null; // il profilo (per il riquadro Emergenza, che va riscritto se cambia l'uscita)
const formUscita = attivaFormUscita({
  suSalvato: async ({ zainoDaAggiornare }) => {
    await caricaViaggio();
    renderCollegamenti();
    if (utente) mostraEmergenza(utente); // "Lascia detto" usa i dati dell'uscita
    elProponiZaino.hidden = true;
    if (zainoDaAggiornare) await proponiAggiornamento(true);
  },
});
document.querySelector("#modifica-viaggio").addEventListener("click", () => formUscita.modifica(viaggio));

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
    renderCollegamenti();
    utente = await api("/api/auth/me");
    mostraEmergenza(utente); // C1: il contatto di emergenza dal profilo
    document.querySelector("#corpo-scheda").hidden = false; // tutto ok: mostro i consigli
    proponiAggiornamento();
  } catch (err) {
    // 404 = l'uscita non esiste (o è di un altro utente): un messaggio comprensibile, senza numeri
    titolo.textContent = err.status === 404 ? "Questo viaggio non esiste più o è stato eliminato" : err.message;
    document.querySelector("#elimina-viaggio").hidden = true; // niente da eliminare
    document.querySelector("#tessere").hidden = true; // niente zaino né mappa da aprire
    document.querySelector("#modifica-viaggio").hidden = true; // né da modificare
  } finally {
    // finally gira SEMPRE, sia dopo il try riuscito sia dopo il catch
    clearTimeout(timerCaricamento);     // se i dati sono arrivati prima dei 250 ms, l'animazione non parte proprio
    elCaricamento.hidden = true;
    document.querySelector("#intestazione").hidden = false; // titolo o messaggio d'errore
  }
}
