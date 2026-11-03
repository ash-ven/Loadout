// =====================================================================
//  SERVICE WORKER – Loadout anche senza rete (tappa 3 della navigazione)
//  Un service worker è un piccolo programma che il browser tiene accanto al sito: si mette in mezzo
//  tra la pagina e la rete e può rispondere con copie salvate (la "cache") quando la rete non c'è.
//
//  Cosa salva:
//   1. le pagine e i file dell'app che apri (la mappa del viaggio è salvata subito, al primo avvio);
//   2. i dati del viaggio aperto (GET /api/viaggi/:id) e la configurazione delle mappe;
//   3. le tessere della mappa CHE HAI GIÀ GUARDATO. Mai scaricate in blocco: le condizioni di MapTiler
//      permettono solo la "temporary personal cache" del dispositivo (punto 5.7), non il download in blocco (6.3).
//  Con la rete si usa sempre la versione nuova (prima la rete, poi la copia): così le modifiche si vedono subito.
//  All'uscita dall'account i dati dei viaggi salvati qui si cancellano (menu.js).
// =====================================================================
const VERSIONE = "v2"; // v2: + avvisi-percorso.js
const CACHE_APP = `loadout-app-${VERSIONE}`;
const CACHE_DATI = "loadout-dati";
const CACHE_TESSERE = "loadout-tessere";
const MAX_TESSERE = 3000; // circa 60–100 MB al massimo: poi si buttano le più vecchie

const LEAFLET = "https://unpkg.com/leaflet@1.9.4/dist/leaflet";
const DA_SALVARE_SUBITO = [
  "/mappa.html", "/css/style.css", "/img/favicon.svg", "/img/logo-topbar.svg", "/img/icone/mappe.svg",
  "/js/api.js", "/js/menu.js", "/js/mappa.js", "/js/mappa-disegno.js", "/js/mappa-base.js", "/js/post-it.js",
  "/js/controlli.js", "/js/errori-campi.js", "/js/gpx.js", "/js/navigazione.js", "/js/navigazione-calcoli.js", "/js/profilo-altimetrico.js", "/js/gpx-lettura.js", "/js/avvisi-percorso.js",
  `${LEAFLET}.css`, `${LEAFLET}.js`,
];

// Installazione: salva subito la pagina della mappa e i suoi file
self.addEventListener("install", (evento) => {
  // Un file per volta, e se uno non arriva (es. unpkg irraggiungibile) gli altri si salvano lo stesso:
  // con addAll() basterebbe un errore per non installare niente
  evento.waitUntil(caches.open(CACHE_APP)
    .then((cache) => Promise.allSettled(DA_SALVARE_SUBITO.map((url) =>
      cache.add(new Request(url, { mode: url.startsWith("http") ? "cors" : "same-origin" })))))
    .then(() => self.skipWaiting()));
});

// Attivazione: butta le copie delle versioni vecchie dell'app e prende subito il controllo delle pagine aperte
self.addEventListener("activate", (evento) => {
  evento.waitUntil(caches.keys()
    .then((nomi) => Promise.all(nomi.filter((n) => n.startsWith("loadout-app-") && n !== CACHE_APP).map((n) => caches.delete(n))))
    .then(() => self.clients.claim()));
});

self.addEventListener("fetch", (evento) => {
  const richiesta = evento.request;
  if (richiesta.method !== "GET") return; // salvare, modificare, cancellare: sempre e solo in rete
  const url = new URL(richiesta.url);

  if (url.hostname === "api.maptiler.com") return evento.respondWith(prima_la_copia(richiesta, CACHE_TESSERE));

  if (url.origin === self.location.origin && url.pathname.startsWith("/api/")) {
    // dell'API teniamo solo quello che serve alla mappa senza rete
    if (/^\/api\/viaggi\/\d+$/.test(url.pathname) || url.pathname === "/api/mappe/config") {
      evento.respondWith(prima_la_rete(richiesta, CACHE_DATI));
    }
    return;
  }
  if (url.origin === self.location.origin || url.href.startsWith(LEAFLET)) {
    evento.respondWith(prima_la_rete(richiesta, CACHE_APP));
  }
});

// Prima la rete (dati e pagine): se risponde, aggiorna la copia; se non c'è rete, la copia salvata
async function prima_la_rete(richiesta, nomeCache) {
  const cache = await caches.open(nomeCache);
  try {
    const risposta = await fetch(richiesta);
    if (risposta.ok) cache.put(richiesta, risposta.clone());
    return risposta;
  } catch (errore) {
    // per le pagine ignoriamo "?id=…": mappa.html?id=7 usa la stessa copia di mappa.html (l'id lo legge il JavaScript)
    const copia = await cache.match(richiesta, { ignoreSearch: richiesta.mode === "navigate" });
    if (copia) return copia;
    throw errore;
  }
}

// Prima la copia (tessere della mappa: non cambiano): se non c'è, dalla rete, e la teniamo
let aggiunte = 0;
async function prima_la_copia(richiesta, nomeCache) {
  const cache = await caches.open(nomeCache);
  const copia = await cache.match(richiesta);
  if (copia) return copia;
  const risposta = await fetch(richiesta);
  if (risposta.ok) {
    await cache.put(richiesta, risposta.clone());
    if (++aggiunte % 100 === 0) await sfoltisci(cache); // ogni 100 tessere nuove controlliamo quante sono
  }
  return risposta;
}

// Troppe tessere: via le più vecchie (keys() le dà nell'ordine in cui sono state salvate)
async function sfoltisci(cache) {
  const chiavi = await cache.keys();
  await Promise.all(chiavi.slice(0, Math.max(0, chiavi.length - MAX_TESSERE)).map((k) => cache.delete(k)));
}
