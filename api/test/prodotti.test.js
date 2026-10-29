// Test delle funzioni che trasformano le risposte delle banche dati (non usano la rete).
// Si lanciano con: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { pesoInGrammi, daOpenFacts, daUpcItemDb } from "../src/services/prodotti.js";

test("pesoInGrammi converte le unità più comuni", () => {
  assert.equal(pesoInGrammi("500 g"), 500);
  assert.equal(pesoInGrammi("0,35 kg"), 350);
  assert.equal(pesoInGrammi("1.2 lb"), 544);
  assert.equal(pesoInGrammi("3 oz"), 85);
});

test("pesoInGrammi rifiuta unità che non sono pesi", () => {
  assert.equal(pesoInGrammi("750 ml"), null);
  assert.equal(pesoInGrammi("2 pezzi"), null);
  assert.equal(pesoInGrammi(""), null);
  assert.equal(pesoInGrammi(undefined), null);
});

test("daOpenFacts legge nome (meglio quello italiano), primo marchio e peso", () => {
  const json = { status: 1, product: { product_name: "Trail bar", product_name_it: "Barretta", brands: "Decathlon,Aptonia", product_quantity: "45", product_quantity_unit: "g" } };
  assert.deepEqual(daOpenFacts(json), { nome: "Barretta", marchio: "Decathlon", peso_g: 45 });
});

test("daOpenFacts: prodotto assente o senza nome = non trovato", () => {
  assert.equal(daOpenFacts({ status: 0, status_verbose: "product not found" }), null);
  assert.equal(daOpenFacts({ status: 1, product: { product_name: "  " } }), null);
});

test("daUpcItemDb legge il primo risultato", () => {
  const json = { code: "OK", total: 1, items: [{ title: "Trekking pole", brand: "Forclaz", weight: "0.6 lb" }] };
  assert.deepEqual(daUpcItemDb(json), { nome: "Trekking pole", marchio: "Forclaz", peso_g: 272 });
  assert.equal(daUpcItemDb({ code: "OK", total: 0, items: [] }), null);
});
