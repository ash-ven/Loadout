// =====================================================================
//  ZAINO INTELLIGENTE (B5)
//  Per ogni uscita l'app sa quale attrezzatura serve (le VOCI qui sotto) e la cerca
//  nell'armadio dell'utente per PAROLE CHIAVE, nel nome, nel marchio e nelle caratteristiche.
//  Per cambiare le liste basta modificare questo file.
// =====================================================================
import { query } from "../db.js";
import * as consigli from "./consigli.js";

// Ogni voce: id, nome da mostrare, categoria (per "Aggiungi all'armadio"), parole chiave (con i SINONIMI:
// italiano, varianti, nomi inglesi che si trovano sulle etichette), quando serve (una funzione dell'uscita)
// e il perché da mostrare.
// u = { attivita, pernotto, serve_cucina, freddo, neve, quota_alta, caldo }
const VOCI = [
  // --- sempre ---
  { id: "frontale", nome: "Frontale", categoria: "elettronica",
    parole: ["frontale", "lampada frontale", "lampada da testa", "pila frontale", "torcia", "torcia frontale", "headlamp", "tikka", "tikkina"],
    quando: () => true, perche: "sempre: se fai tardi" },
  { id: "pronto-soccorso", nome: "Kit di pronto soccorso", categoria: "sicurezza",
    parole: ["pronto soccorso", "primo soccorso", "kit di soccorso", "kit soccorso", "kit medico", "medikit", "first aid", "cerotti"],
    quando: () => true, perche: "sempre" },
  { id: "guscio", nome: "Giacca impermeabile (guscio)", categoria: "abbigliamento",
    parole: ["guscio", "giacca impermeabile", "impermeabile", "antipioggia", "giacca da pioggia", "mantella", "poncho",
             "k-way", "kway", "gore-tex", "goretex", "hardshell", "rain jacket"],
    quando: () => true, perche: "sempre: in montagna il tempo cambia in fretta" },
  { id: "borraccia", nome: "Borraccia", categoria: "attrezzatura",
    parole: ["borraccia", "borracce", "thermos", "termos", "sacca idrica", "camelbak", "bottiglia", "water bottle"],
    quando: () => true, perche: "sempre" },
  { id: "telo-termico", nome: "Telo termico", categoria: "sicurezza",
    parole: ["telo termico", "coperta termica", "coperta isotermica", "telo isotermico", "telo di sopravvivenza",
             "coperta di sopravvivenza", "metallina", "emergency blanket"],
    quando: () => true, perche: "sempre: pesa pochi grammi e in emergenza ti tiene caldo" },
  // --- ferrata e alpinismo ---
  { id: "casco", nome: "Casco", categoria: "sicurezza", parole: ["casco", "caschetto", "elmetto", "helmet"],
    quando: (u) => u.attivita === "ferrata" || u.attivita === "alpinismo" || u.attrezzato || u.alpinistico,
    perche: "per la ferrata, l'alpinismo e i tratti attrezzati o alpinistici" },
  { id: "imbrago", nome: "Imbrago", categoria: "sicurezza",
    parole: ["imbrago", "imbraco", "imbracatura", "imbragatura", "harness"],
    quando: (u) => u.attivita === "ferrata" || u.attivita === "alpinismo", perche: "per la ferrata e l'alpinismo" },
  { id: "set-ferrata", nome: "Set da ferrata (longe con dissipatore)", categoria: "sicurezza",
    parole: ["set da ferrata", "set ferrata", "kit da ferrata", "kit ferrata", "longe", "longes", "dissipatore", "via ferrata set"],
    quando: (u) => u.attivita === "ferrata" || u.attrezzato, perche: "per la ferrata e i tratti attrezzati (catene, cavi)" },
  { id: "ramponi", nome: "Ramponi", categoria: "attrezzatura", parole: ["ramponi", "rampone", "crampons"],
    quando: (u) => u.attivita === "alpinismo", perche: "per l'alpinismo" },
  { id: "piccozza", nome: "Piccozza", categoria: "attrezzatura", parole: ["piccozza", "picozza", "piolet", "ice axe"],
    quando: (u) => u.attivita === "alpinismo", perche: "per l'alpinismo" },
  // --- ciaspolata ---
  { id: "ciaspole", nome: "Ciaspole", categoria: "attrezzatura",
    parole: ["ciaspole", "ciaspola", "ciaspe", "racchette da neve", "snowshoes"],
    quando: (u) => u.attivita === "ciaspolata", perche: "per la ciaspolata" },
  { id: "artva", nome: "ARTVA", categoria: "sicurezza",
    parole: ["artva", "arva", "pieps", "beacon", "trasmettitore valanghe", "apparecchio di ricerca"],
    quando: (u) => u.attivita === "ciaspolata", perche: "per la ciaspolata (autosoccorso in valanga)" },
  { id: "pala", nome: "Pala da neve", categoria: "sicurezza", parole: ["pala", "pala da neve", "pala da valanga"],
    quando: (u) => u.attivita === "ciaspolata", perche: "per la ciaspolata (autosoccorso in valanga)" },
  { id: "sonda", nome: "Sonda", categoria: "sicurezza", parole: ["sonda", "sonda da valanga"],
    quando: (u) => u.attivita === "ciaspolata", perche: "per la ciaspolata (autosoccorso in valanga)" },
  { id: "bastoncini", nome: "Bastoncini", categoria: "attrezzatura",
    parole: ["bastoncini", "bastoncino", "bastoni da trekking", "bastoncini da trekking", "trekking poles", "poles"],
    quando: (u) => u.attivita === "ciaspolata" || u.impegnativo, perche: "per la ciaspolata e i tratti impegnativi (T3 e oltre)" },
  // --- pernotto (in giornata NON servono: vedi SOLO_PERNOTTO) ---
  { id: "sacco-lenzuolo", nome: "Sacco lenzuolo", categoria: "attrezzatura",
    parole: ["sacco lenzuolo", "sacco lenzuola", "sacco letto", "sacco da rifugio", "lenzuolo da rifugio", "sacco a pelo leggero", "liner"],
    quando: (u) => u.pernotto === "rifugio", perche: "per il rifugio (obbligatorio nei rifugi CAI)" },
  { id: "sacco-a-pelo", nome: "Sacco a pelo", categoria: "attrezzatura", parole: ["sacco a pelo", "saccoapelo", "sleeping bag"],
    quando: (u) => u.pernotto === "tenda" || u.pernotto === "bivacco", perche: "per dormire in tenda o in bivacco" },
  // B5 (revisione UX 2, scelta di Asiha): in rifugio il sacco a pelo serve solo se la notte è fredda (sotto 10 °C)
  { id: "sacco-a-pelo-rifugio", nome: "Sacco a pelo", categoria: "attrezzatura", parole: ["sacco a pelo", "saccoapelo", "sleeping bag"],
    quando: (u) => u.pernotto === "rifugio" && u.notte_fredda, perche: "per il rifugio: minima prevista sotto 10 °C" },
  { id: "materassino", nome: "Materassino", categoria: "attrezzatura",
    parole: ["materassino", "materasso", "stuoino", "tappetino", "sleeping pad"],
    quando: (u) => u.pernotto === "tenda" || u.pernotto === "bivacco", perche: "per dormire in tenda o in bivacco" },
  { id: "tenda", nome: "Tenda", categoria: "attrezzatura", parole: ["tenda", "tendina"],
    quando: (u) => u.pernotto === "tenda", perche: "per dormire in tenda" },
  // --- cucina ---
  { id: "fornello", nome: "Fornello", categoria: "cucina", parole: ["fornello", "fornellino", "jetboil", "bruciatore", "stove"],
    quando: (u) => u.serve_cucina, perche: "serve la cucina" },
  { id: "pentolino", nome: "Pentolino", categoria: "cucina",
    parole: ["pentolino", "pentola", "gavetta", "set pentole", "kit cucina"],
    quando: (u) => u.serve_cucina, perche: "serve la cucina" },
  { id: "gas", nome: "Cartuccia del gas", categoria: "cucina", parole: ["cartuccia", "bombola", "bomboletta", "gas", "combustibile"],
    quando: (u) => u.serve_cucina, perche: "serve la cucina" },
  // --- freddo e neve ---
  { id: "berretto", nome: "Berretto", categoria: "abbigliamento",
    parole: ["berretto", "cappello di lana", "cuffia", "beanie", "papalina"],
    quando: (u) => u.freddo, perche: "farà freddo" },
  { id: "guanti", nome: "Guanti", categoria: "abbigliamento", parole: ["guanti", "guanto", "muffole", "manopole", "gloves"],
    quando: (u) => u.freddo, perche: "farà freddo" },
  { id: "strato-caldo", nome: "Strato caldo (pile o piumino)", categoria: "abbigliamento",
    parole: ["pile", "piumino", "piumino leggero", "giacca termica", "maglia termica", "giacca imbottita", "primaloft", "fleece"],
    quando: (u) => u.freddo, perche: "farà freddo" },
  { id: "scaldacollo", nome: "Scaldacollo", categoria: "abbigliamento", parole: ["scaldacollo", "buff", "sciarpa", "passamontagna"],
    quando: (u) => u.freddo, perche: "farà freddo (e c'è vento in quota)" },
  // Per neve e ghiaccio sui sentieri vanno bene i ramponcini, ma anche i ramponi (più pesanti):
  // se ci sono tutti e due, migliorOggetto sceglie il più leggero
  { id: "ramponcini", nome: "Ramponcini (o ramponi)", categoria: "attrezzatura",
    parole: ["ramponcini", "catenelle", "microspikes", "ramponi", "rampone", "crampons"],
    quando: (u) => u.neve && u.attivita !== "alpinismo", perche: "potresti trovare neve o ghiaccio" },
  // --- sole: in quota, sulla neve o con il caldo ---
  { id: "occhiali-sole", nome: "Occhiali da sole", categoria: "abbigliamento", parole: ["occhiali da sole", "occhiali", "occhiale", "sunglasses"],
    quando: (u) => u.neve || u.quota_alta || u.caldo, perche: "in quota e sulla neve il sole riflette e abbaglia" },
  { id: "crema-solare", nome: "Crema solare", categoria: "igiene", parole: ["crema solare", "protezione solare", "latte solare", "spf", "sunscreen"],
    quando: (u) => u.neve || u.quota_alta || u.caldo, perche: "in quota il sole scotta di più" },
  { id: "cappello-sole", nome: "Cappello da sole", categoria: "abbigliamento", parole: ["cappello", "cappellino", "visiera"],
    quando: (u) => u.caldo, perche: "farà caldo" },
];

// Le voci che servono SOLO per dormire fuori: in un'uscita in giornata non entrano mai,
// neanche se sono tra i preferiti (es. il sacco a pelo preferito in una gita di un giorno)
const SOLO_PERNOTTO = VOCI.filter((v) => ["sacco-lenzuolo", "sacco-a-pelo", "materassino", "tenda"].includes(v.id));

// --- Funzioni "pure" (niente database né rete): le provano i test in test/kit.test.js ---

// "Imbracatura Petzl Corax" → "imbracatura petzl corax" (minuscole, senza accenti)
function normalizza(testo) {
  return String(testo ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

// L'oggetto corrisponde alla voce? Una parola chiave deve comparire all'INIZIO di una parola
// (così "pala" trova "Pala da neve" ma non "Spalaneve", e "ramponi" non trova "Ramponcini")
export function corrisponde(oggetto, voce) {
  const testo = normalizza(`${oggetto.nome} ${oggetto.marchio ?? ""} ${oggetto.caratteristiche ?? ""}`);
  return voce.parole.some((parola) => new RegExp(`(^|[^a-z0-9])${normalizza(parola)}`).test(testo));
}

// Le voci che servono per questa uscita
export function vociPerUscita(uscita) {
  return VOCI.filter((v) => v.quando(uscita));
}

// --- Lo ZAINO giusto per il viaggio (in base ai litri) ---
// Quanti litri servono, a seconda del viaggio (scelta di Asiha):
//   tenda o bivacco, oppure più di 3 giorni         → 50–70 L
//   in rifugio                                      → 30–45 L
//   in giornata con ciaspole, alpinismo o ferrata   → 30–40 L (pala, sonda, corda, imbrago…)
//   in giornata                                     → 20–30 L
export function litriConsigliati(u) {
  if (u.pernotto === "tenda" || u.pernotto === "bivacco" || u.n_giorni > 3) return { min: 50, max: 70 };
  if (u.pernotto === "rifugio") return { min: 30, max: 45 };
  if (["ciaspolata", "alpinismo", "ferrata"].includes(u.attivita)) return { min: 30, max: 40 };
  return { min: 20, max: 30 };
}

// Tra gli zaini dell'armadio sceglie quello giusto: il PIÙ PICCOLO che basta (di solito anche il più leggero).
// Se nessuno basta, il più grande che hai, e troppo_piccolo = true (l'app ti avvisa).
// Gli zaini senza litri si usano solo se non ce n'è nessuno con i litri (prima indispensabili e preferiti, poi il più leggero).
// → { zaino, troppo_piccolo, consigliati } oppure { zaino: null, … } se nell'armadio non hai zaini
export function scegliZaino(zaini, u) {
  const consigliati = litriConsigliati(u);
  const conLitri = zaini.filter((z) => z.litri != null);
  if (conLitri.length === 0) {
    const zaino = [...zaini].sort((a, b) => (b.is_indispensabile || b.is_preferito) - (a.is_indispensabile || a.is_preferito)
      || a.peso_g - b.peso_g)[0] ?? null;
    return { zaino, troppo_piccolo: false, consigliati };
  }
  const bastano = conLitri.filter((z) => z.litri >= consigliati.min).sort((a, b) => a.litri - b.litri || a.peso_g - b.peso_g);
  if (bastano.length) return { zaino: bastano[0], troppo_piccolo: false, consigliati };
  const piuGrande = [...conLitri].sort((a, b) => b.litri - a.litri || a.peso_g - b.peso_g)[0];
  return { zaino: piuGrande, troppo_piccolo: true, consigliati };
}

// Lo zaino già nel viaggio è più piccolo del minimo consigliato: cosa dire (e cosa proporre)
export function avvisoZainoNelViaggio(dentro, sostituto, { min, max }) {
  const base = `Hai messo «${dentro.nome}» (${dentro.litri} L): per questo viaggio ne servono ${min}–${max}`;
  if (!sostituto) return `${base}, e nell'armadio non hai uno zaino più grande`;
  return `${base}. Il più grande che hai è «${sostituto.nome}» (${sostituto.litri} L)` +
    (sostituto.litri < min ? ", stretto anche lui ma meglio" : "");
}

// Il testo dell'avviso se lo zaino scelto è troppo piccolo (lo mostrano "Genera zaino" e il riquadro "Per questo viaggio")
export function avvisoZainoPiccolo(scelta) {
  if (!scelta.troppo_piccolo) return null;
  return `Il tuo zaino più grande è da ${scelta.zaino.litri} L: per questo viaggio ne servono ${scelta.consigliati.min}–${scelta.consigliati.max}, potrebbe stare stretto`;
}

// Tra gli oggetti che corrispondono alla voce, il migliore: prima indispensabili e preferiti, poi il più leggero
export function migliorOggetto(voce, oggetti) {
  return oggetti
    .filter((o) => corrisponde(o, voce))
    .sort((a, b) => (b.is_indispensabile || b.is_preferito) - (a.is_indispensabile || a.is_preferito) || a.peso_g - b.peso_g)[0] ?? null;
}

// --- Con il database ---

// Le condizioni dell'uscita: attività, pernotto, cucina, freddo, neve.
// Freddo: minima (in vetta, se c'è la quota) sotto i 5 °C; senza previsioni, da novembre a marzo.
// Quota alta: dai 2000 m in su. Caldo: massima in partenza sopra i 25 °C.
export async function condizioni(viaggio) {
  const meteo = await consigli.meteo(viaggio, null, consigli.oreStimate(viaggio));
  const minima = meteo.disponibile ? (meteo.vetta?.temp_min ?? meteo.temp_min) : null;
  const mese = viaggio.data_partenza ? Number(viaggio.data_partenza.slice(5, 7)) : null;
  const neve = consigli.rischioNeve(viaggio.quota_max_m, viaggio.data_partenza, minima);
  const freddo = neve || (minima != null ? minima < 5 : mese != null && (mese >= 11 || mese <= 3));
  // B5 (soglia scelta da Asiha): notte fredda in rifugio = minima prevista (in vetta, se c'è la quota) sotto 10 °C;
  // senza previsioni, da ottobre a maggio
  const notteFredda = minima != null ? minima < 10 : mese != null && (mese >= 10 || mese <= 5);
  const quotaAlta = viaggio.quota_max_m != null && viaggio.quota_max_m >= 2000; // C1: occhiali e crema solare in quota
  const caldo = meteo.disponibile && meteo.temp_max > 25;                        // C1: cappello e crema con il caldo
  // Avvisi sul percorso (dai dati dei sentieri, salvati con la mappa): T3+ = impegnativo, T4+ = alpinistico, catene/cavi = attrezzato
  const tipi = new Set((viaggio.traccia?.avvisi_percorso?.avvisi ?? []).map((a) => a.tipo));
  const impegnativo = tipi.has("t3") || tipi.has("t4") || tipi.has("t56");
  const alpinistico = tipi.has("t4") || tipi.has("t56");
  const attrezzato = tipi.has("attrezzato");
  return { attivita: viaggio.attivita, pernotto: viaggio.pernotto, serve_cucina: viaggio.serve_cucina, n_giorni: viaggio.n_giorni,
           impegnativo, alpinistico, attrezzato,
           freddo, notte_fredda: notteFredda, neve, quota_alta: quotaAlta, caldo };
}

async function armadio(db, utenteId) {
  const { rows } = await db.query(
    "SELECT id, nome, categoria, litri, marchio, caratteristiche, peso_g, is_indispensabile, is_preferito FROM oggetto WHERE utente_id = $1",
    [utenteId]
  );
  return rows;
}

async function idNelloZaino(db, viaggioId) {
  const { rows } = await db.query("SELECT oggetto_id FROM viaggio_oggetto WHERE viaggio_id = $1", [viaggioId]);
  return new Set(rows.map((r) => r.oggetto_id));
}

// B5 (revisione UX 2): "Genera" non aggiunge due oggetti dello stesso tipo (es. due frontali).
// Funzione "pura": tra gli oggetti APPENA aggiunti (nuovi), per ogni voce del kit ne tiene al massimo uno;
// se nello zaino ce n'era già uno di quel tipo (giaPresenti), non ne aggiunge altri. Gli oggetti messi a mano non si toccano.
// Restituisce gli id da togliere.
export function doppioni(nuovi, giaPresenti, voci = VOCI) {
  const daTogliere = new Set();
  for (const voce of voci) {
    const nuoviDelTipo = nuovi.filter((o) => !daTogliere.has(o.id) && corrisponde(o, voce));
    if (nuoviDelTipo.length === 0) continue;
    // si tiene prima l'indispensabile, poi il preferito, poi il più leggero
    const ordinati = [...nuoviDelTipo].sort((a, b) => (b.is_indispensabile - a.is_indispensabile)
      || (b.is_preferito - a.is_preferito) || (a.peso_g - b.peso_g));
    const tenuto = giaPresenti.some((o) => corrisponde(o, voce)) ? null : ordinati[0];
    nuoviDelTipo.filter((o) => o !== tenuto).forEach((o) => daTogliere.add(o.id));
  }
  return [...daTogliere];
}

// Il nuovo "Genera zaino". Va chiamato DENTRO una transazione (db = il client con BEGIN già fatto):
//   1. indispensabili e preferiti con fn_genera_zaino (la logica di base resta nel database);
//   2. in giornata toglie quello che serve solo per dormire fuori (tra gli oggetti appena aggiunti);
//   3. aggiunge dall'armadio l'attrezzatura del kit che manca nello zaino;
//   4. sceglie lo zaino giusto per i litri (fn_genera_zaino gli zaini non li aggiunge più).
export async function generaIntelligente(db, utenteId, viaggio, uscita) {
  const prima = await idNelloZaino(db, viaggio.id);
  const { rows } = await db.query("SELECT fn_genera_zaino($1) AS aggiunti", [viaggio.id]);
  const oggetti = await armadio(db, utenteId);
  const perId = new Map(oggetti.map((o) => [o.id, o]));

  let esclusi = 0;
  if (uscita.pernotto === "nessuno") {
    const nuovi = [...(await idNelloZaino(db, viaggio.id))].filter((id) => !prima.has(id));
    const daTogliere = nuovi.filter((id) => SOLO_PERNOTTO.some((voce) => corrisponde(perId.get(id), voce)));
    if (daTogliere.length) {
      await db.query("DELETE FROM viaggio_oggetto WHERE viaggio_id = $1 AND oggetto_id = ANY($2::int[])", [viaggio.id, daTogliere]);
      esclusi = daTogliere.length;
    }
  }

  // B5: in rifugio con la notte non fredda il sacco a pelo appena aggiunto esce (basta il sacco lenzuolo)
  let esclusiRifugio = 0;
  if (uscita.pernotto === "rifugio" && !uscita.notte_fredda) {
    const sacco = VOCI.find((v) => v.id === "sacco-a-pelo");
    const lenzuolo = VOCI.find((v) => v.id === "sacco-lenzuolo");
    const nuovi = [...(await idNelloZaino(db, viaggio.id))].filter((id) => !prima.has(id));
    const daTogliere = nuovi.filter((id) => corrisponde(perId.get(id), sacco) && !corrisponde(perId.get(id), lenzuolo));
    if (daTogliere.length) {
      await db.query("DELETE FROM viaggio_oggetto WHERE viaggio_id = $1 AND oggetto_id = ANY($2::int[])", [viaggio.id, daTogliere]);
      esclusiRifugio = daTogliere.length;
    }
  }

  // B5: un solo oggetto per tipo tra quelli appena aggiunti (es. due frontali → resta l'indispensabile, o il più leggero)
  const doppi = doppioni(
    [...(await idNelloZaino(db, viaggio.id))].filter((id) => !prima.has(id)).map((id) => perId.get(id)),
    [...prima].map((id) => perId.get(id)).filter(Boolean)
  );
  if (doppi.length) await db.query("DELETE FROM viaggio_oggetto WHERE viaggio_id = $1 AND oggetto_id = ANY($2::int[])", [viaggio.id, doppi]);

  let dalKit = 0;
  const nelloZaino = await idNelloZaino(db, viaggio.id);
  for (const voce of vociPerUscita(uscita)) {
    const giaDentro = [...nelloZaino].some((id) => corrisponde(perId.get(id), voce));
    if (giaDentro) continue;
    const scelto = migliorOggetto(voce, oggetti);
    if (!scelto) continue; // non c'è nell'armadio: lo dirà il riquadro "Per questo viaggio"
    await db.query(
      "INSERT INTO viaggio_oggetto (viaggio_id, oggetto_id, quantita) VALUES ($1, $2, 1) ON CONFLICT DO NOTHING",
      [viaggio.id, scelto.id]
    );
    nelloZaino.add(scelto.id);
    dalKit++;
  }

  // Lo zaino: se nello zaino del viaggio non ce n'è già uno (messo a mano), l'app sceglie quello giusto per i litri
  let zaino = null;
  const zainiArmadio = oggetti.filter((o) => o.categoria === "zaini");
  const giaUnoZaino = zainiArmadio.find((z) => nelloZaino.has(z.id));
  // A1: lo zaino che c'era (messo a mano o da un "Genera" di prima) non si cambia da soli,
  // ma se è troppo piccolo per il viaggio di ADESSO lo diciamo anche nel messaggio di "Genera"
  if (giaUnoZaino?.litri != null) {
    const scelta = scegliZaino(zainiArmadio, uscita);
    if (giaUnoZaino.litri < scelta.consigliati.min) {
      const sostituto = scelta.zaino.id !== giaUnoZaino.id && scelta.zaino.litri > giaUnoZaino.litri ? scelta.zaino : null;
      zaino = { id: giaUnoZaino.id, nome: giaUnoZaino.nome, litri: giaUnoZaino.litri, aggiunto: false,
                avviso: avvisoZainoNelViaggio(giaUnoZaino, sostituto, scelta.consigliati) };
    }
  }
  if (!giaUnoZaino && zainiArmadio.length) {
    const scelta = scegliZaino(zainiArmadio, uscita);
    await db.query(
      "INSERT INTO viaggio_oggetto (viaggio_id, oggetto_id, quantita) VALUES ($1, $2, 1) ON CONFLICT DO NOTHING",
      [viaggio.id, scelta.zaino.id]
    );
    zaino = { id: scelta.zaino.id, nome: scelta.zaino.nome, litri: scelta.zaino.litri, aggiunto: true, avviso: avvisoZainoPiccolo(scelta) };
  }

  const base = rows[0].aggiunti - esclusi - esclusiRifugio - doppi.length;
  return { aggiunti: base + dalKit + (zaino?.aggiunto ? 1 : 0), base, dal_kit: dalKit, esclusi, esclusi_rifugio: esclusiRifugio,
           doppioni: doppi.length, zaino };
}

// Il riquadro "Per questo viaggio": per ogni voce, se è nello zaino, nell'armadio o se manca
export async function stato(utenteId, viaggio) {
  const uscita = await condizioni(viaggio);
  const oggetti = await armadio({ query }, utenteId);
  const nelloZaino = await idNelloZaino({ query }, viaggio.id);
  const nelloZainoOggetti = oggetti.filter((o) => nelloZaino.has(o.id));
  return [statoZaino(oggetti, nelloZaino, uscita), ...vociPerUscita(uscita).map((voce) => {
    const dentro = migliorOggetto(voce, nelloZainoOggetti);
    if (dentro) return { voce: voce.nome, perche: voce.perche, categoria: voce.categoria, stato: "nello_zaino", oggetto: { id: dentro.id, nome: dentro.nome } };
    const fuori = migliorOggetto(voce, oggetti);
    if (fuori) return { voce: voce.nome, perche: voce.perche, categoria: voce.categoria, stato: "nell_armadio", oggetto: { id: fuori.id, nome: fuori.nome } };
    return { voce: voce.nome, perche: voce.perche, categoria: voce.categoria, stato: "manca", oggetto: null };
  })];
}

// La prima riga del riquadro: lo zaino (quello nello zaino del viaggio, oppure quello che l'app sceglierebbe)
function statoZaino(oggetti, nelloZaino, uscita) {
  const zaini = oggetti.filter((o) => o.categoria === "zaini");
  const scelta = scegliZaino(zaini, uscita);
  const { min, max } = scelta.consigliati;
  const riga = { voce: "Zaino", perche: `per questo viaggio: ${min}–${max} litri`, categoria: "zaini" };
  const dentro = zaini.find((z) => nelloZaino.has(z.id));
  if (dentro) {
    const stretto = dentro.litri != null && dentro.litri < min;
    if (!stretto) return { ...riga, stato: "nello_zaino", oggetto: { id: dentro.id, nome: dentro.nome }, avviso: null };
    // Collaudo 3/11, A1: lo zaino nel viaggio è troppo piccolo (es. il viaggio è passato da 1 giorno a 3 in tenda).
    // Non resta tra le cose "a posto": diventa da cambiare, con il più grande che hai (se è più grande di questo)
    const sostituto = scelta.zaino && scelta.zaino.id !== dentro.id && scelta.zaino.litri > dentro.litri ? scelta.zaino : null;
    return { ...riga, stato: "da_cambiare", oggetto: { id: dentro.id, nome: dentro.nome },
             sostituto: sostituto ? { id: sostituto.id, nome: sostituto.nome, litri: sostituto.litri } : null,
             avviso: avvisoZainoNelViaggio(dentro, sostituto, scelta.consigliati) };
  }
  if (scelta.zaino) {
    return { ...riga, stato: "nell_armadio", oggetto: { id: scelta.zaino.id, nome: scelta.zaino.nome }, avviso: avvisoZainoPiccolo(scelta) };
  }
  return { ...riga, stato: "manca", oggetto: null, avviso: null };
}
