import { api, esc, formattaData, oggiISO, giorniTra } from "./api.js";
import "./menu.js";
import { creaMappa } from "./mappa-base.js";

// =====================================================================
//  HOME
//  Testata: saluto e frase a caso (come prima).
//  C8 (revisione UX 2, scelta di Asiha: «La mia mappa»): sotto, una mappa con TUTTI i tuoi viaggi,
//  la "traccia" di quello che hai fatto e di quello che farai, e i totali da sempre.
// =====================================================================

const saluto = document.querySelector("#saluto");
const frase = document.querySelector("#frase");

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

// La lista dei viaggi contiene già tutto quello che serve alla mappa (anche la traccia): una sola richiesta
const viaggi = await api("/api/viaggi");
const oggi = oggiISO();
const data = (v) => v.data_partenza?.slice(0, 10) ?? null;
// Fatto = con una data già passata. Tutto il resto (data da oggi in poi, o senza data) è "in programma"
const eFatto = (v) => data(v) != null && data(v) < oggi;

// Viaggi "in programma" con una data: per le frasi vive, dal più vicino
const inProgramma = viaggi
  .filter((v) => data(v) && data(v) >= oggi)
  .sort((a, b) => data(a).localeCompare(data(b)));

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
  const mancano = giorniTra(oggi, data(v));
  const contoAllaRovescia =
    mancano === 0 ? [`Oggi ${v.nome}:`, "buon cammino!"]
    : mancano === 1 ? [`${v.nome} è domani:`, "scarponi pronti?"]
    : [`${v.nome} tra ${mancano} giorni:`, "inizia a scaldare gli scarponi."]; // B3: qui mancano è sempre ≥ 2

  // 2. Che tipo di viaggio è: "5 giorni di trekking, notti in rifugio"
  const durata = v.n_giorni === 1 ? "una giornata" : `${v.n_giorni} giorni`;
  const attivita = {
    escursione: v.n_giorni > 1 ? "di trekking" : "di escursione", // stessa attività: il nome dipende dai giorni
    alpinismo: "di alpinismo",
    ciaspolata: "con le ciaspole",
    ferrata: "in ferrata",
  }[v.attivita] ?? `di ${v.attivita}`;
  const notti = v.pernotto === "nessuno" ? "" : `, ${v.n_giorni > 2 ? "notti" : "notte"} in ${v.pernotto}`;
  const tipoDiViaggio = [`${v.nome} ti aspetta:`, `${durata} ${attivita}${notti}.`];

  return [contoAllaRovescia, tipoDiViaggio];
}

// =====================================================================
//  LA MAPPA DI TUTTI I VIAGGI (C8)
// =====================================================================
const COLORE = { fatto: "#31503f", futuro: "#c8962b" }; // verde muschio e senape, come nel resto dell'app
const ALONE = "#f6efdf";                                 // il bordo chiaro che stacca le linee da ogni sfondo
const ITALIA = [42.5, 12.5];

const num = (n, decimali = 0) => Number(n).toLocaleString("it-IT", { maximumFractionDigits: decimali, useGrouping: "always" });

// Il fumetto che si apre toccando un percorso o un pallino: nome, data, km e D+, link al viaggio.
// Il nome lo ha scritto l'utente: passa da esc() prima di finire nell'HTML
function fumetto(v) {
  const dettagli = [data(v) ? formattaData(data(v)) : "data da decidere"];
  if (v.distanza_km != null) dettagli.push(`${num(v.distanza_km, 1)} km`);
  if (v.dislivello_m != null) dettagli.push(`D+ ${num(v.dislivello_m)} m`);
  return `<strong>${esc(v.nome)}</strong><br><span class="muto">${dettagli.join(" · ")}</span><br>
    <a href="/scheda-viaggio.html?id=${v.id}">Apri il viaggio →</a>`;
}

const elMappa = document.querySelector("#mappa-home");
const elVuota = document.querySelector("#mappa-vuota");
const elTotali = document.querySelector("#totali");

// La traccia salvata è { tappe, linea, ... }: la linea è il sentiero vero (punti [lat, lon])
const conTraccia = viaggi.filter((v) => v.traccia?.linea?.length >= 2);
const soloPartenza = viaggi.filter((v) => !conTraccia.includes(v) && v.lat_partenza != null && v.lon_partenza != null);

try {
  const { chiave } = await api("/api/mappe/config"); // 503 se sul server manca la chiave MapTiler
  const mappa = creaMappa(elMappa, chiave, { centro: ITALIA, zoom: 5 });
  const livello = L.featureGroup().addTo(mappa);

  // Prima i fatti, poi quelli in programma: così i futuri restano sopra e si vedono meglio
  const ordinati = [...conTraccia].sort((a, b) => Number(!eFatto(a)) - Number(!eFatto(b)));
  for (const v of ordinati) {
    const colore = eFatto(v) ? COLORE.fatto : COLORE.futuro;
    const linea = v.traccia.linea.map(([lat, lon]) => [lat, lon]); // la linea può avere anche la quota: teniamo lat e lon
    L.polyline(linea, { color: ALONE, weight: 8, opacity: .9, lineCap: "round", lineJoin: "round", interactive: false }).addTo(livello);
    L.polyline(linea, { color: colore, weight: 4, lineCap: "round", lineJoin: "round", interactive: false }).addTo(livello);
    // Una terza linea invisibile e larga sopra le altre: è lei che si tocca (una linea di 4 px col dito non si prende)
    L.polyline(linea, { color: colore, weight: 22, opacity: 0 }).bindPopup(fumetto(v)).addTo(livello);
  }
  for (const v of soloPartenza) {
    L.circleMarker([v.lat_partenza, v.lon_partenza], {
      radius: 7, color: ALONE, weight: 2.5, fillColor: eFatto(v) ? COLORE.fatto : COLORE.futuro, fillOpacity: 1,
    }).bindPopup(fumetto(v)).addTo(livello);
  }

  // Inquadra tutti i viaggi (con un po' di margine). Un solo pallino: zoom fisso, se no Leaflet ingrandirebbe al massimo
  if (livello.getLayers().length > 0) {
    if (conTraccia.length === 0 && soloPartenza.length === 1) mappa.setView([soloPartenza[0].lat_partenza, soloPartenza[0].lon_partenza], 11);
    else mappa.fitBounds(livello.getBounds(), { padding: [30, 30], maxZoom: 13 });
  } else {
    elVuota.hidden = false; // ancora nessun viaggio con un posto sulla mappa
  }
} catch (err) {
  // Senza chiave o senza rete la Home resta usabile: lo diciamo sopra lo spazio della mappa
  document.querySelector("#testo-mappa-vuota").textContent =
    err.status === 503 ? "Le mappe non sono disponibili in questo momento." : `Mappa non disponibile: ${err.message}`;
  elVuota.hidden = false;
}

// --- I totali da sempre (scelta di Asiha), solo dei viaggi già fatti ---
const fatti = viaggi.filter(eFatto);
if (fatti.length > 0) {
  const km = fatti.reduce((somma, v) => somma + Number(v.distanza_km ?? 0), 0);
  const metri = fatti.reduce((somma, v) => somma + Number(v.dislivello_m ?? 0), 0);
  const parti = [`<strong>${fatti.length} ${fatti.length === 1 ? "viaggio fatto" : "viaggi fatti"}</strong>`];
  if (km > 0) parti.push(`${num(km)} km`);
  if (metri > 0) parti.push(`${num(metri)} m di dislivello`);
  elTotali.innerHTML = `In tutto: ${parti.join(" · ")}`;
  elTotali.hidden = false;
}
