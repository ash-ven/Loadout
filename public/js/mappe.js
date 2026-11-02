import { api, esc, formattaData } from "./api.js";
import "./menu.js";
import { ATTIVITA } from "./categorie.js";
import { gruppiPerData, htmlGruppi } from "./elenco-uscite.js";

// Pagina Mappe: le uscite che hanno una mappa (ha_mappa arriva da GET /api/viaggi).
// La mappa si disegna nel form dell'uscita, in «Percorso e coordinate».
const lista = document.querySelector("#lista");
const riepilogo = document.querySelector("#riepilogo");

const num = (n) => Number(n).toLocaleString("it-IT", { useGrouping: "always" });

// Una riga: link alla mappa dell'uscita
function rigaMappa(v) {
  // B4 (revisione UX 2): qui contano i numeri del percorso; l'attività si vede aprendo l'uscita
  const parti = [];
  if (v.distanza_km != null) parti.push(`${num(v.distanza_km)} km`);
  if (v.dislivello_m != null) parti.push(`D+ ${num(v.dislivello_m)} m`);
  return `
    <a class="riga" href="/mappa.html?id=${v.id}">
      <span class="riquadro-icona"><img src="/img/icone/mappe.svg" alt="" width="22" height="22"></span>
      <span class="riga-testo">
        <span class="riga-nome">${esc(v.nome)}</span>
        <span class="riga-nota">${esc(parti.join(" · ") || (ATTIVITA[v.attivita] ?? v.attivita))}</span>
      </span>
      <span class="riga-valore">${v.data_partenza ? formattaData(v.data_partenza) : "—"}</span>
    </a>`;
}

try {
  const conMappa = (await api("/api/viaggi")).filter((v) => v.ha_mappa);
  riepilogo.innerHTML = `<strong>${conMappa.length} ${conMappa.length === 1 ? "mappa" : "mappe"}</strong>`;
  lista.innerHTML = conMappa.length
    ? htmlGruppi(gruppiPerData(conMappa), rigaMappa)
    : `<p class="vuoto">Nessuna mappa ancora. Apri un viaggio in <a href="/viaggi.html">Viaggi</a> e premi «Disegna la mappa».</p>`;
} catch (err) {
  lista.innerHTML = `<p class="errore">${esc(err.message)}</p>`;
}
