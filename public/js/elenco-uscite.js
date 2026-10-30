import { oggiISO } from "./api.js";

// Divide le uscite in tre gruppi, come la pagina Viaggi: in arrivo, senza data, già fatti.
// Lo usano le pagine Zaino (zaini.js) e Mappe (mappe.js).
// Le date ISO ("2026-11-08") si confrontano come testo: l'ordine alfabetico è quello cronologico.
export function gruppiPerData(uscite) {
  const oggi = oggiISO();
  const data = (u) => u.data_partenza?.slice(0, 10);
  return [
    ["In arrivo", uscite.filter((u) => data(u) && data(u) >= oggi)],
    ["Senza data", uscite.filter((u) => !data(u))],
    ["Già fatti", uscite.filter((u) => data(u) && data(u) < oggi).reverse()], // il più recente in alto
  ];
}

// I gruppi in HTML: un titolo con il conteggio e le righe (rigaHtml = funzione che disegna una riga)
export function htmlGruppi(gruppi, rigaHtml) {
  return gruppi.map(([titolo, elenco]) => elenco.length === 0 ? "" : `
    <section class="gruppo">
      <div class="gruppo-testa"><h2>${titolo}</h2><span>${elenco.length}</span></div>
      <div class="gruppo-righe">${elenco.map(rigaHtml).join("")}</div>
    </section>`).join("");
}
