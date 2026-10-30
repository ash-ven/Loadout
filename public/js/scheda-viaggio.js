import { api, esc, formattaData } from "./api.js";
import "./menu.js";
import { ATTIVITA } from "./categorie.js";

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
    if (c.acqua_con_dislivello) fattori.push(`${num(Math.round(v.dislivello_m / v.n_giorni))} m di dislivello positivo al giorno`);
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
         (${num(c.ore_cammino_giorno)} ore di cammino, soste comprese nel margine).${limite.in_ritardo
           ? ` <strong>Hai segnato la partenza alle ${esc(limite.ora_partenza)}: è più tardi del limite.</strong>` : ""}</span>`;
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
    // Mappe, fase 1: il meteo in vetta (sulla quota massima), all'ora in cui stimiamo che arriverai
    const vt = m.vetta;
    if (vt) {
      righe.unshift(`<span class="muto">Meteo calcolato sul punto più alto che raggiungerai${quota(vt.quota_m)}</span>`);
      if (vt.fonte === "stima") {
        // Open-Meteo non ha risposto per la vetta: resta la stima di prima (−6 °C ogni 1000 m)
        righe.push(`<strong>In vetta</strong>, stima: massima ${esc(num(vt.temp_max))} °C · minima ${esc(num(vt.temp_min))} °C`);
      } else {
        const allArrivo = [];
        if (vt.temp != null) allArrivo.push(`${esc(num(vt.temp))} °C`);
        if (vt.percepita != null) allArrivo.push(`percepiti ${esc(num(vt.percepita))} °C`);
        if (vt.raffiche_kmh != null) allArrivo.push(`raffiche ${esc(num(vt.raffiche_kmh))} km/h`);
        righe.push(`<strong>In vetta verso le ${esc(vt.ora_arrivo_stimata)}</strong>${allArrivo.length ? `: ${allArrivo.join(" · ")}` : ""}`);
        righe.push(`Nella giornata, in vetta: massima ${esc(num(vt.temp_max))} °C · minima ${esc(num(vt.temp_min))} °C`);
      }
    }
    if (m.vento_kmh != null) righe.push(`<strong>Vento</strong> fino a ${esc(num(m.vento_kmh))} km/h${m.raffiche_kmh != null ? `, raffiche ${esc(num(m.raffiche_kmh))} km/h` : ""}`);
    htmlMeteo = `${righe.map((r) => `<p>${r}</p>`).join("")}
      <ul>${m.vestiario.map((consiglio) => `<li>${esc(consiglio)}</li>`).join("")}</ul>`;
    // gli avvisi della vetta (vento, zero termico, temporali) nel riquadro ocra, come gli altri avvisi
    for (const a of m.avvisi ?? []) htmlMeteo += `<p class="avviso"><span>${esc(a.testo)}</span></p>`;
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
  if (viaggio.dislivello_m != null) parti.push(`${num(viaggio.dislivello_m)} m di dislivello positivo`);
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

// --- Le tessere dello zaino e della mappa: se ci sono si aprono (con il riepilogo), altrimenti si creano ---
function renderCollegamenti() {
  const p = viaggio.peso;
  const testo = (selettore, valore) => { document.querySelector(selettore).textContent = valore; }; // textContent: niente XSS
  if (p.n_oggetti > 0) {
    linkZaino.href = `/zaino.html?id=${id}`;
    testo("#titolo-zaino", "Lo zaino");
    const quanti = p.n_inseriti != null ? `${p.n_inseriti} su ${p.n_oggetti} nello zaino` : `${p.n_oggetti} oggetti`;
    testo("#riepilogo-zaino", `${quanti} · ${num2(p.peso_totale_kg)} kg`);
  } else {
    linkZaino.href = `/zaino.html?id=${id}&genera=1`; // la pagina dello zaino lo riempie appena si apre
    testo("#titolo-zaino", "Genera lo zaino");
    testo("#riepilogo-zaino", "Ancora vuoto: lo riempio con indispensabili, preferiti e l'attrezzatura per questa uscita.");
  }
  linkMappa.href = `/mappa.html?id=${id}`; // la mappa si disegna e si guarda nella sua pagina, come lo zaino
  if (viaggio.traccia) {
    const parti = [];
    if (viaggio.distanza_km != null) parti.push(`${num(viaggio.distanza_km)} km`);
    if (viaggio.dislivello_m != null) parti.push(`D+ ${num(viaggio.dislivello_m)} m`);
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
function proponiAggiornamento() {
  if (!new URLSearchParams(location.search).has("aggiorna") || !(viaggio.peso.n_oggetti > 0)) return;
  history.replaceState(null, "", `?id=${id}`); // tolgo "aggiorna" dall'indirizzo: ricaricando non riappare
  elProponiZaino.textContent = "Hai cambiato l'uscita: vuoi aggiornare lo zaino? Aggiungo solo quello che manca. ";
  const link = document.createElement("a");
  link.className = "btn btn-piccolo";
  link.href = `/zaino.html?id=${id}&genera=1`;
  link.textContent = "Aggiorna lo zaino";
  elProponiZaino.append(link);
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
    renderCollegamenti();
    mostraEmergenza(await api("/api/auth/me")); // C1: il contatto di emergenza dal profilo
    document.querySelector("#corpo-scheda").hidden = false; // tutto ok: mostro i consigli
    proponiAggiornamento();
  } catch (err) {
    // 404 = l'uscita non esiste (o è di un altro utente): un messaggio comprensibile, senza numeri
    titolo.textContent = err.status === 404 ? "Questa uscita non esiste più o è stata eliminata" : err.message;
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
