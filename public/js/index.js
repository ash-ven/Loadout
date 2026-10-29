import { api, oggiISO, giorniTra } from "./api.js";
import "./menu.js";

const saluto = document.querySelector("#saluto");
const frase = document.querySelector("#frase");
const contaOggetti = document.querySelector("#conta-oggetti");
const contaViaggi = document.querySelector("#conta-viaggi");

// Le frasi fisse: [prima parte, chiusura in corsivo]
const FRASI = [
  ["La montagna non ha fretta: tu prepara lo zaino,", "lei ti aspetta."],
  ["Ogni grammo conta,", "soprattutto in salita."],
  ["Lo zaino giusto è quello che", "non senti sulle spalle."],
  ["Meno peso nello zaino,", "più passi sul sentiero."],
  ["Un buon viaggio comincia a casa,", "davanti all'armadio."],
  ["Frontale, acqua, guscio:", "poi solo sentiero."],
  ["La cima è facoltativa,", "il ritorno no."],
  ["Sveglia presto, zaino pronto,", "testa leggera."],
];

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

// Viaggi "in programma": con una data di partenza da oggi in poi, dal più vicino.
// Le date ISO ("2026-11-08") si confrontano come testo: l'ordine alfabetico è anche quello cronologico.
const oggi = oggiISO();
const inProgramma = viaggi
  .filter((v) => v.data_partenza && v.data_partenza >= oggi)
  .sort((a, b) => a.data_partenza.localeCompare(b.data_partenza));

if (inProgramma.length > 0) {
  contaViaggi.textContent = `${inProgramma.length} in arrivo`;
  contaViaggi.classList.add("in-evidenza"); // pillola ocra, come nel design
} else {
  contaViaggi.textContent = `${viaggi.length} ${viaggi.length === 1 ? "viaggio" : "viaggi"}`;
}

// --- La frase sotto il saluto ---
// Le 8 fisse più, SOLO se c'è un viaggio in programma, le 2 "vive" sul viaggio più vicino.
// Tutte nello stesso mucchio: ognuna ha la stessa probabilità di uscire.
const candidate = inProgramma.length > 0 ? [...FRASI, ...frasiVive(inProgramma[0])] : FRASI;
const [inizio, chiusura] = candidate[Math.floor(Math.random() * candidate.length)];

// Costruisco la frase con il DOM (il nome del viaggio lo ha scritto l'utente: niente innerHTML)
const corsivo = document.createElement("em");
corsivo.textContent = chiusura;
frase.replaceChildren(`${inizio} `, corsivo);

// Le due frasi vive, costruite con i dati del viaggio
function frasiVive(v) {
  // 1. Il conto alla rovescia (versione giocosa)
  const mancano = giorniTra(oggi, v.data_partenza);
  const contoAllaRovescia =
    mancano === 0 ? [`Oggi ${v.nome}:`, "buon cammino!"]
    : mancano === 1 ? [`${v.nome} è domani:`, "scarponi pronti?"]
    : [`${v.nome} tra ${mancano} giorni:`, "inizia a scaldare gli scarponi."];

  // 2. Che tipo di viaggio è: "5 giorni di trekking, notti in rifugio"
  const durata = v.n_giorni === 1 ? "una giornata" : `${v.n_giorni} giorni`;
  const attivita = {
    escursione: "di escursione",
    trekking: "di trekking",
    alpinismo: "di alpinismo",
    ciaspolata: "con le ciaspole",
    ferrata: "in ferrata",
  }[v.attivita] ?? `di ${v.attivita}`;
  const notti = v.pernotto === "nessuno" ? "" : `, ${v.n_giorni > 2 ? "notti" : "notte"} in ${v.pernotto}`;
  const tipoDiViaggio = [`${v.nome} ti aspetta:`, `${durata} ${attivita}${notti}.`];

  return [contoAllaRovescia, tipoDiViaggio];
}
