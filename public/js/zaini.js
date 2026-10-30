import { api, esc, formattaData } from "./api.js";
import "./menu.js";
import { gruppiPerData, htmlGruppi } from "./elenco-uscite.js";

// Pagina Zaino: tutti gli zaini, uno per ogni uscita che ne ha uno (almeno un oggetto).
// I dati arrivano da GET /api/viaggi, che per ogni uscita dà anche n_oggetti, n_inseriti e peso_totale_kg.
const lista = document.querySelector("#lista");
const riepilogo = document.querySelector("#riepilogo");

const num2 = (n) => Number(n).toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Una riga: link allo zaino dell'uscita
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

try {
  const zaini = (await api("/api/viaggi")).filter((v) => v.n_oggetti > 0);
  riepilogo.innerHTML = `<strong>${zaini.length} ${zaini.length === 1 ? "zaino" : "zaini"}</strong>`;
  lista.innerHTML = zaini.length
    ? htmlGruppi(gruppiPerData(zaini), rigaZaino)
    : `<p class="vuoto">Nessuno zaino ancora. Apri un'uscita in <a href="/viaggi.html">Viaggi</a> e premi «Genera lo zaino».</p>`;
} catch (err) {
  lista.innerHTML = `<p class="errore">${esc(err.message)}</p>`;
}
