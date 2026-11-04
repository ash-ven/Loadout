// Test dello zaino intelligente: le liste del kit e il riconoscimento degli oggetti (niente database)
import { test } from "node:test";
import assert from "node:assert/strict";
import { corrisponde, vociPerUscita, migliorOggetto, doppioni, litriConsigliati, scegliZaino, avvisoZainoPiccolo, avvisoZainoNelViaggio } from "../src/services/kit.js";

const uscita = (altro) => ({ attivita: "escursione", pernotto: "nessuno", serve_cucina: false, freddo: false, neve: false, ...altro });
const ids = (voci) => voci.map((v) => v.id);
const voce = (id, u) => vociPerUscita(uscita(u)).find((v) => v.id === id);

test("kit: la ferrata chiede casco, imbrago e set da ferrata; l'escursione in giornata no", () => {
  assert.ok(["casco", "imbrago", "set-ferrata"].every((id) => ids(vociPerUscita(uscita({ attivita: "ferrata" }))).includes(id)));
  assert.ok(!ids(vociPerUscita(uscita())).includes("casco"));
  assert.ok(!ids(vociPerUscita(uscita())).includes("sacco-a-pelo"));
});

test("kit: rifugio senza sacchi (4/11); tenda con cucina e freddo → tenda, sacco a pelo, fornello, guanti, berretto", () => {
  assert.ok(!ids(vociPerUscita(uscita({ pernotto: "rifugio" }))).includes("sacco-lenzuolo"));
  const tenda = ids(vociPerUscita(uscita({ pernotto: "tenda", serve_cucina: true, freddo: true })));
  assert.ok(["tenda", "sacco-a-pelo", "fornello", "guanti", "berretto"].every((id) => tenda.includes(id)));
});

test("riconoscimento: senza badare a maiuscole e accenti, solo a inizio parola", () => {
  assert.ok(corrisponde({ nome: "IMBRACATURA Petzl" }, voce("imbrago", { attivita: "ferrata" })));
  assert.ok(corrisponde({ nome: "Pala da neve" }, voce("pala", { attivita: "ciaspolata" })));
  assert.ok(!corrisponde({ nome: "Spalaneve" }, voce("pala", { attivita: "ciaspolata" })));
  assert.ok(!corrisponde({ nome: "Ramponcini Grivel" }, voce("ramponi", { attivita: "alpinismo" })));
});

test("miglior oggetto: prima i preferiti, poi il più leggero", () => {
  const frontale = voce("frontale");
  const oggetti = [
    { id: 1, nome: "Frontale pesante", peso_g: 200, is_preferito: false, is_indispensabile: false },
    { id: 2, nome: "Frontale leggera", peso_g: 60, is_preferito: false, is_indispensabile: false },
    { id: 3, nome: "Frontale preferita", peso_g: 120, is_preferito: true, is_indispensabile: false },
  ];
  assert.equal(migliorOggetto(frontale, oggetti).id, 3);
  assert.equal(migliorOggetto(frontale, oggetti.slice(0, 2)).id, 2);
  assert.equal(migliorOggetto(frontale, [{ id: 9, nome: "Calze", peso_g: 50 }]), null);
});

test("sinonimi: imbragatura, elmetto, lampada da testa, ciaspe, picozza, sleeping bag", () => {
  const ferrata = { attivita: "ferrata" };
  assert.ok(corrisponde({ nome: "Imbragatura da ferrata" }, voce("imbrago", ferrata)));
  assert.ok(corrisponde({ nome: "Elmetto Kong" }, voce("casco", ferrata)));
  assert.ok(corrisponde({ nome: "Lampada da testa" }, voce("frontale")));
  assert.ok(corrisponde({ nome: "Ciaspe MSR" }, voce("ciaspole", { attivita: "ciaspolata" })));
  assert.ok(corrisponde({ nome: "Picozza Grivel" }, voce("piccozza", { attivita: "alpinismo" })));
  assert.ok(corrisponde({ nome: "Sleeping bag 0 °C" }, voce("sacco-a-pelo", { pernotto: "tenda" })));
});

test("famiglie nuove: occhiali e crema in quota, cappello col caldo, scaldacollo col freddo", () => {
  assert.ok(ids(vociPerUscita(uscita({ quota_alta: true }))).includes("occhiali-sole"));
  assert.ok(ids(vociPerUscita(uscita({ quota_alta: true }))).includes("crema-solare"));
  assert.ok(!ids(vociPerUscita(uscita())).includes("occhiali-sole"));
  assert.ok(ids(vociPerUscita(uscita({ caldo: true }))).includes("cappello-sole"));
  assert.ok(ids(vociPerUscita(uscita({ freddo: true }))).includes("scaldacollo"));
});

test("niente falsi amici: il caricatore solare non è crema, il powerbank non è un pentolino", () => {
  assert.ok(!corrisponde({ nome: "Caricatore solare" }, voce("crema-solare", { quota_alta: true })));
  assert.ok(!corrisponde({ nome: "Powerbank potente" }, voce("pentolino", { serve_cucina: true })));
});

test("neve: vanno bene ramponcini o ramponi; se ci sono tutti e due, i più leggeri", () => {
  const neve = voce("ramponcini", { neve: true });
  assert.ok(corrisponde({ nome: "Ramponi Grivel G10" }, neve));
  const scelto = migliorOggetto(neve, [
    { id: 1, nome: "Ramponi Grivel G10", peso_g: 900 },
    { id: 2, nome: "Ramponcini Kahtoola", peso_g: 340 },
  ]);
  assert.equal(scelto.id, 2);
});

// B5 (revisione UX 2)
test("doppioni: di due frontali appena aggiunte resta l'indispensabile; se ce n'era già una, nessuna nuova", () => {
  const lampada = { id: 1, nome: "Lampada frontale", peso_g: 120, is_indispensabile: true, is_preferito: false };
  const piccola = { id: 2, nome: "Frontale Tikkina", peso_g: 80, is_indispensabile: false, is_preferito: true };
  const borraccia = { id: 3, nome: "Borraccia 1 L", peso_g: 150, is_indispensabile: true, is_preferito: false };
  assert.deepEqual(doppioni([lampada, piccola, borraccia], []), [2]);      // resta la Lampada (indispensabile), la borraccia non c'entra
  assert.deepEqual(doppioni([piccola], [lampada]).sort(), [2]);            // la frontale c'era già (messa a mano): la nuova esce
});

test("4/11: in rifugio né sacco a pelo né sacco lenzuolo, neanche con la notte fredda", () => {
  const base = { attivita: "escursione", pernotto: "rifugio", serve_cucina: false, freddo: false, neve: false, quota_alta: false, caldo: false };
  const ids = (u) => vociPerUscita(u).map((v) => v.id);
  assert.ok(!ids({ ...base, notte_fredda: true }).some((id) => id.startsWith("sacco")));
  assert.ok(!ids({ ...base, notte_fredda: false }).some((id) => id.startsWith("sacco")));
});

// --- Zaini con i litri: quale zaino per quale viaggio ---
const giornata = { attivita: "escursione", pernotto: "nessuno", n_giorni: 1 };
const ciaspole = { attivita: "ciaspolata", pernotto: "nessuno", n_giorni: 1 };
const rifugio = { attivita: "escursione", pernotto: "rifugio", n_giorni: 2 };
const tenda = { attivita: "escursione", pernotto: "tenda", n_giorni: 2 };
const lungo = { attivita: "escursione", pernotto: "rifugio", n_giorni: 5 }; // più di 3 giorni: come la tenda

test("zaini: litri consigliati per tipo di viaggio", () => {
  assert.deepEqual(litriConsigliati(giornata), { min: 20, max: 30 });
  assert.deepEqual(litriConsigliati(ciaspole), { min: 30, max: 40 });
  assert.deepEqual(litriConsigliati(rifugio), { min: 30, max: 45 });
  assert.deepEqual(litriConsigliati(tenda), { min: 50, max: 70 });
  assert.deepEqual(litriConsigliati(lungo), { min: 50, max: 70 });
});

const z = (id, litri, peso_g, extra = {}) => ({ id, nome: `Zaino ${litri ?? "?"}`, litri, peso_g, is_indispensabile: false, is_preferito: false, ...extra });

test("zaini: sceglie il più piccolo che basta (in giornata il 25 L, non il 45 L)", () => {
  const scelta = scegliZaino([z(1, 45, 1500), z(2, 25, 900), z(3, 18, 600)], giornata);
  assert.equal(scelta.zaino.id, 2);
  assert.equal(scelta.troppo_piccolo, false);
  assert.equal(avvisoZainoPiccolo(scelta), null);
});

test("zaini: se nessuno basta prende il più grande e avvisa", () => {
  const scelta = scegliZaino([z(1, 35, 1200), z(2, 25, 900)], tenda);
  assert.equal(scelta.zaino.id, 1);
  assert.equal(scelta.troppo_piccolo, true);
  assert.match(avvisoZainoPiccolo(scelta), /più grande è da 35 L.*50–70/);
});

test("zaini: a parità di litri il più leggero; senza litri conta prima il preferito", () => {
  assert.equal(scegliZaino([z(1, 30, 1100), z(2, 30, 800)], rifugio).zaino.id, 2);
  assert.equal(scegliZaino([z(1, null, 700), z(2, null, 1200, { is_preferito: true })], giornata).zaino.id, 2);
  assert.equal(scegliZaino([], giornata).zaino, null); // nessuno zaino nell'armadio
});

// Collaudo 3/11, A1: lo zaino già nel viaggio è troppo piccolo per il viaggio di adesso
test("zaini: zaino nel viaggio troppo piccolo, con e senza uno più grande nell'armadio", () => {
  const piccolo = { nome: "UX 25", litri: 25 };
  const tenda = { min: 50, max: 70 };
  assert.match(avvisoZainoNelViaggio(piccolo, { nome: "Zaino 35L", litri: 35 }, tenda),
    /Hai messo «UX 25» \(25 L\): per questo viaggio ne servono 50–70\. Il più grande che hai è «Zaino 35L» \(35 L\), stretto anche lui/);
  assert.match(avvisoZainoNelViaggio(piccolo, { nome: "Grande", litri: 60 }, tenda), /«Grande» \(60 L\)$/);
  assert.match(avvisoZainoNelViaggio(piccolo, null, tenda), /non hai uno zaino più grande/);
});

// Avvisi sul percorso → zaino: T3+ bastoncini, T4+ casco, tratti attrezzati casco e set da ferrata
test("kit: i tratti difficili del percorso aggiungono bastoncini, casco e set da ferrata", () => {
  const voci = (u) => ids(vociPerUscita(uscita(u)));
  assert.ok(voci({ impegnativo: true }).includes("bastoncini"));
  assert.ok(!voci({ impegnativo: true }).includes("casco"));
  assert.ok(voci({ impegnativo: true, alpinistico: true }).includes("casco"));
  assert.ok(voci({ attrezzato: true }).includes("set-ferrata"));
  assert.ok(!voci({}).includes("bastoncini")); // escursione normale: niente
});

// 4/11 (UX con un amico di Asiha): «Telino termico» nello zaino, ma il kit diceva «Telo termico · ti manca»
test("sinonimi allargati: diminutivi, plurali e scritture con trattini e apostrofi", () => {
  assert.ok(corrisponde({ nome: "Telino termico" }, voce("telo-termico")));
  assert.ok(corrisponde({ nome: "Telo d'emergenza oro/argento" }, voce("telo-termico")));
  assert.ok(corrisponde({ nome: "Coperta d’emergenza" }, voce("telo-termico")));      // apostrofo "curvo"
  assert.ok(corrisponde({ nome: "Borraccina 0,5 L" }, voce("borraccia")));
  assert.ok(corrisponde({ nome: "Frontalino Petzl" }, voce("frontale")));
  assert.ok(corrisponde({ nome: "K-Way" }, voce("guscio")));
  assert.ok(corrisponde({ nome: "Sacco-a-pelo Ferrino" }, voce("sacco-a-pelo", { pernotto: "tenda" })));
  assert.ok(corrisponde({ nome: "Guantini touch" }, voce("guanti", { freddo: true })));
  // e quello che NON deve corrispondere
  assert.ok(!corrisponde({ nome: "Nastro isolante" }, voce("materassino", { pernotto: "tenda" })));
  assert.ok(!corrisponde({ nome: "Maglietta tecnica" }, voce("telo-termico")));
});
