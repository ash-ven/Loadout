import { api, esc, formattaData, oggiISO, giorniTra } from "./api.js";
import "./menu.js";
import { gruppiPerData, htmlGruppi } from "./elenco-uscite.js";

// =====================================================================
//  PAGINA ZAINO (tutti gli zaini)
//  C7 (revisione UX 2): non più una copia di Viaggi. Ha un compito suo:
//   1. "Da preparare": i viaggi dei prossimi 7 giorni, con una barra grande (quanto hai già messo nello zaino)
//      e "Genera zaino" per quelli che lo zaino non ce l'hanno ancora;
//   2. "Senza zaino": gli altri viaggi futuri (o senza data) ancora da generare;
//   3. sotto, tutti gli altri zaini, divisi in gruppi come prima.
//  I dati arrivano da GET /api/viaggi, che per ogni viaggio dà anche n_oggetti, n_inseriti e peso_totale_kg.
// =====================================================================
const daPreparare = document.querySelector("#da-preparare");
const lista = document.querySelector("#lista");

const num2 = (n) => Number(n).toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const GIORNI_AVANTI = 7;

// "oggi", "domani", "tra 3 giorni"
function quando(giorni) {
  if (giorni === 0) return "oggi";
  if (giorni === 1) return "domani";
  return `tra ${giorni} giorni`;
}

// Una voce di "Da preparare": nome, quando, barra grande (o "Genera zaino" se lo zaino è vuoto)
function vocePreparare(v, giorni) {
  const testa = `
    <div class="preparare-testa">
      <a class="preparare-nome" href="/zaino.html?id=${v.id}">${esc(v.nome)}</a>
      <span class="muto">${quando(giorni)} · ${formattaData(v.data_partenza.slice(0, 10))}</span>
    </div>`;
  if (v.n_oggetti === 0) {
    return `<div class="preparare-voce">${testa}
      <p class="preparare-stato"><a class="btn btn-piccolo" href="/zaino.html?id=${v.id}&genera=1">Genera zaino</a></p>
    </div>`;
  }
  const percento = Math.round((v.n_inseriti / v.n_oggetti) * 100);
  const pronto = v.n_inseriti === v.n_oggetti;
  // La larghezza della barra la mette il JavaScript dopo (data-percento): la CSP non permette style="" scritti nell'HTML
  return `<div class="preparare-voce">${testa}
    <div class="barra barra-grande" role="progressbar" aria-label="Oggetti già nello zaino"
         aria-valuemin="0" aria-valuemax="${v.n_oggetti}" aria-valuenow="${v.n_inseriti}"><div data-percento="${percento}"></div></div>
    <p class="preparare-stato muto">${pronto ? "<strong>Zaino pronto</strong>" : `${v.n_inseriti} su ${v.n_oggetti} nello zaino`} · ${num2(v.peso_totale_kg)} kg</p>
  </div>`;
}

// Riga degli altri zaini (come prima)
function rigaZaino(v) {
  const nota = `${v.n_inseriti} su ${v.n_oggetti} nello zaino · ${v.data_partenza ? formattaData(v.data_partenza) : "data da decidere"}`;
  return `
    <a class="riga" href="/zaino.html?id=${v.id}">
      <span class="riquadro-icona"><img src="/img/icone/zaino.svg" alt="" width="22" height="22"></span>
      <span class="riga-testo">
        <span class="riga-nome">${esc(v.nome)}</span>
        <span class="riga-nota">${esc(nota)}</span>
      </span>
      <span class="riga-valore">${num2(v.peso_totale_kg)}&nbsp;kg</span>
    </a>`;
}

// Riga di un viaggio senza zaino: tutta la riga porta allo zaino e lo genera subito (&genera=1)
function rigaSenzaZaino(v) {
  return `
    <a class="riga" href="/zaino.html?id=${v.id}&genera=1">
      <span class="riquadro-icona"><img src="/img/icone/zaino.svg" alt="" width="22" height="22"></span>
      <span class="riga-testo">
        <span class="riga-nome">${esc(v.nome)}</span>
        <span class="riga-nota">${v.data_partenza ? formattaData(v.data_partenza) : "data da decidere"}</span>
      </span>
      <span class="riga-valore riga-genera">Genera</span>
    </a>`;
}

try {
  const viaggi = await api("/api/viaggi");
  const oggi = oggiISO();
  const giorni = (v) => (v.data_partenza ? giorniTra(oggi, v.data_partenza.slice(0, 10)) : null);

  // 1. Da preparare: partenza tra oggi e 7 giorni, il più vicino per primo (la lista arriva già ordinata per data)
  const vicini = viaggi.filter((v) => giorni(v) != null && giorni(v) >= 0 && giorni(v) <= GIORNI_AVANTI);
  daPreparare.innerHTML = `
    <h2>Da preparare <span class="muto">· prossimi ${GIORNI_AVANTI} giorni</span></h2>
    ${vicini.length
      ? vicini.map((v) => vocePreparare(v, giorni(v))).join("")
      : `<p class="muto">Nessuna partenza nei prossimi ${GIORNI_AVANTI} giorni.</p>`}`;
  for (const barra of daPreparare.querySelectorAll("[data-percento]")) {
    barra.style.width = `${barra.dataset.percento}%`; // dal JavaScript (CSSOM) la CSP lo permette
  }

  // 2. Senza zaino: viaggi non ancora fatti (futuri o senza data), fuori da "Da preparare"
  const senzaZaino = viaggi.filter((v) => v.n_oggetti === 0 && !vicini.includes(v) && (giorni(v) == null || giorni(v) >= 0));
  // 3. Gli altri zaini (quelli dei prossimi 7 giorni sono già sopra)
  const zaini = viaggi.filter((v) => v.n_oggetti > 0 && !vicini.includes(v));

  // 4/11 (Asiha): tolto il riepilogo «8 zaini · 2 da preparare questa settimana» sotto il titolo

  const htmlSenza = senzaZaino.length ? htmlGruppi([["Senza zaino", senzaZaino]], rigaSenzaZaino) : "";
  const htmlZaini = htmlGruppi(gruppiPerData(zaini), rigaZaino);
  lista.innerHTML = htmlSenza + htmlZaini ||
    `<p class="vuoto">Nessun altro zaino.</p>`;
} catch (err) {
  lista.innerHTML = `<p class="errore">${esc(err.message)}</p>`;
}
