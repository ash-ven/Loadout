import { api } from "./api.js";
import "./menu.js";

const saluto = document.querySelector("#saluto");
const contaOggetti = document.querySelector("#conta-oggetti");
const contaViaggi = document.querySelector("#conta-viaggi");

// Chi sono? Se non sono loggata, api() mi porta da sola alla pagina di login
const utente = await api("/api/auth/me");
saluto.textContent = `Ciao, ${utente.nome}!`;

// Le due richieste partono INSIEME (Promise.all) invece che una dopo l'altra:
// la pagina aspetta solo la più lenta, non la somma delle due.
const [oggetti, viaggi] = await Promise.all([
  api("/api/oggetti?limit=200"),
  api("/api/viaggi"),
]);

contaOggetti.textContent = `${oggetti.length} ${oggetti.length === 1 ? "oggetto" : "oggetti"}`;

// Viaggi "in arrivo": con una data di partenza da oggi in poi.
// Le date ISO ("2026-11-08") si possono confrontare come testo: l'ordine alfabetico è anche quello cronologico.
const oggi = new Date().toISOString().slice(0, 10);
const inArrivo = viaggi.filter((v) => v.data_partenza && v.data_partenza.slice(0, 10) >= oggi).length;
if (inArrivo > 0) {
  contaViaggi.textContent = `${inArrivo} in arrivo`;
  contaViaggi.classList.add("in-evidenza"); // pillola ocra, come nel design
} else {
  contaViaggi.textContent = `${viaggi.length} ${viaggi.length === 1 ? "viaggio" : "viaggi"}`;
}
