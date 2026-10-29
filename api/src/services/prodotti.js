// =====================================================================
//  RICERCA DI UN PRODOTTO DAL CODICE A BARRE (stretch 2, parte 2)
//  Il codice EAN è solo un numero: nome, marchio e peso stanno in banche dati esterne.
//  Le interroga il SERVER (non il browser): così il browser parla solo con il nostro sito,
//  e se un giorno cambiamo servizio si modifica solo questo file.
// =====================================================================

// Le banche dati gratuite "Open Facts" (senza chiave). Le proviamo tutte insieme.
// "categoria" = la categoria del nostro armadio che suggeriamo se il prodotto è trovato lì.
const OPEN_FACTS = [
  { nome: "Open Products Facts", url: "https://world.openproductsfacts.org", categoria: null },
  { nome: "Open Food Facts",     url: "https://world.openfoodfacts.org",     categoria: "cibo" },
  { nome: "Open Beauty Facts",   url: "https://world.openbeautyfacts.org",   categoria: "igiene" },
];
const CAMPI_OPEN_FACTS = "product_name,product_name_it,brands,quantity,product_quantity,product_quantity_unit";
const UPCITEMDB = "https://api.upcitemdb.com/prod/trial/lookup"; // prova gratuita: circa 100 ricerche al giorno

// Open Facts chiede alle app di presentarsi con un nome nell'header User-Agent
const INTESTAZIONI = { "User-Agent": "Loadout/1.0 (progetto di stage ITS Futura)", Accept: "application/json" };
const ATTESA_MAX_MS = 5000; // oltre, lasciamo perdere quella banca dati

// Piccola memoria (cache): lo stesso codice cercato due volte non rifà le richieste.
// Vive finché il server è acceso; teniamo al massimo 500 codici.
const memoria = new Map();
const MEMORIA_MAX = 500;

// --- Funzioni "pure" (niente rete): trasformano le risposte nel nostro formato. Le prova test/prodotti.test.js ---

// "1.2 lb" → 544, "500 g" → 500, "0,35 kg" → 350. Unità sconosciute (ml, pezzi…) → null
export function pesoInGrammi(testo) {
  const m = String(testo ?? "").trim().replace(",", ".").match(/^(\d+(?:\.\d+)?)\s*(g|gr|grammi|kg|lb|lbs|oz)\b/i);
  if (!m) return null;
  const n = Number(m[1]);
  const perGrammo = { g: 1, gr: 1, grammi: 1, kg: 1000, lb: 453.592, lbs: 453.592, oz: 28.3495 }[m[2].toLowerCase()];
  const grammi = Math.round(n * perGrammo);
  return grammi > 0 ? grammi : null;
}

// Risposta di Open Facts → { nome, marchio, peso_g } oppure null se il prodotto non c'è
export function daOpenFacts(json) {
  if (json?.status !== 1 || !json.product) return null;
  const p = json.product;
  const nome = (p.product_name_it || p.product_name || "").trim();
  if (!nome) return null; // scheda vuota: per noi è come non trovato
  const peso = p.product_quantity_unit && p.product_quantity
    ? pesoInGrammi(`${p.product_quantity} ${p.product_quantity_unit}`)
    : pesoInGrammi(p.quantity);
  return { nome: nome.slice(0, 120), marchio: primoMarchio(p.brands), peso_g: peso };
}

// Risposta di UPCitemdb → { nome, marchio, peso_g } oppure null
export function daUpcItemDb(json) {
  const item = json?.items?.[0];
  if (!item?.title) return null;
  return { nome: item.title.trim().slice(0, 120), marchio: primoMarchio(item.brand), peso_g: pesoInGrammi(item.weight) };
}

// "Decathlon,Quechua" → "Decathlon" (il nostro campo marchio ne tiene uno)
function primoMarchio(testo) {
  const primo = String(testo ?? "").split(",")[0].trim();
  return primo ? primo.slice(0, 80) : null;
}

// --- Le richieste vere ---

async function chiediJson(url) {
  const res = await fetch(url, { headers: INTESTAZIONI, signal: AbortSignal.timeout(ATTESA_MAX_MS) });
  if (res.status === 404) return null;         // alcune banche dati rispondono 404 per "non c'è"
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// Ritorna { trovato: true, fonte, nome, marchio, peso_g, categoria }
//      o { trovato: false, irraggiungibile } (irraggiungibile = nessuna banca dati ha risposto)
export async function cerca(codice) {
  if (memoria.has(codice)) return memoria.get(codice);

  let risposte = 0; // quante banche dati hanno risposto (anche con "non c'è")

  // 1) Le tre Open Facts insieme (Promise.allSettled: aspetta tutte, anche se qualcuna fallisce)
  const esiti = await Promise.allSettled(
    OPEN_FACTS.map((fonte) => chiediJson(`${fonte.url}/api/v2/product/${codice}.json?fields=${CAMPI_OPEN_FACTS}`))
  );
  let risultato = null;
  esiti.forEach((esito, i) => {
    if (esito.status !== "fulfilled") return;
    risposte++;
    const prodotto = daOpenFacts(esito.value);
    if (prodotto && !risultato) { // vale il primo nell'ordine della lista
      risultato = { trovato: true, fonte: OPEN_FACTS[i].nome, ...prodotto, categoria: OPEN_FACTS[i].categoria };
    }
  });

  // 2) Solo se nessuna Open Facts lo conosce: UPCitemdb (ha un limite giornaliero, non la sprechiamo)
  if (!risultato) {
    try {
      const prodotto = daUpcItemDb(await chiediJson(`${UPCITEMDB}?upc=${codice}`));
      risposte++;
      if (prodotto) risultato = { trovato: true, fonte: "UPCitemdb", ...prodotto, categoria: null };
    } catch { /* limite superato o servizio giù: andiamo avanti */ }
  }

  if (!risultato) risultato = { trovato: false, irraggiungibile: risposte === 0 };

  // In memoria: i prodotti trovati, e i "non trovato" solo se TUTTE le banche dati hanno risposto
  // (se qualcuna era giù o UPCitemdb aveva finito le ricerche del giorno, la prossima volta riproviamo)
  if (risultato.trovato || risposte === OPEN_FACTS.length + 1) {
    if (memoria.size >= MEMORIA_MAX) memoria.delete(memoria.keys().next().value); // butta il più vecchio
    memoria.set(codice, risultato);
  }
  return risultato;
}
