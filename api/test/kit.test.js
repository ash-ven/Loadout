// Test dello zaino intelligente: le liste del kit e il riconoscimento degli oggetti (niente database)
import { test } from "node:test";
import assert from "node:assert/strict";
import { corrisponde, vociPerUscita, migliorOggetto, doppioni } from "../src/services/kit.js";

const uscita = (altro) => ({ attivita: "escursione", pernotto: "nessuno", serve_cucina: false, freddo: false, neve: false, ...altro });
const ids = (voci) => voci.map((v) => v.id);
const voce = (id, u) => vociPerUscita(uscita(u)).find((v) => v.id === id);

test("kit: la ferrata chiede casco, imbrago e set da ferrata; l'escursione in giornata no", () => {
  assert.ok(["casco", "imbrago", "set-ferrata"].every((id) => ids(vociPerUscita(uscita({ attivita: "ferrata" }))).includes(id)));
  assert.ok(!ids(vociPerUscita(uscita())).includes("casco"));
  assert.ok(!ids(vociPerUscita(uscita())).includes("sacco-a-pelo"));
});

test("kit: rifugio → sacco lenzuolo; tenda con cucina e freddo → tenda, sacco a pelo, fornello, guanti, berretto", () => {
  assert.ok(ids(vociPerUscita(uscita({ pernotto: "rifugio" }))).includes("sacco-lenzuolo"));
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

test("sacco a pelo in rifugio solo se la notte è fredda (sotto 10 °C)", () => {
  const base = { attivita: "escursione", pernotto: "rifugio", serve_cucina: false, freddo: false, neve: false, quota_alta: false, caldo: false };
  const ids = (u) => vociPerUscita(u).map((v) => v.id);
  assert.ok(ids({ ...base, notte_fredda: true }).includes("sacco-a-pelo-rifugio"));
  assert.ok(!ids({ ...base, notte_fredda: false }).includes("sacco-a-pelo-rifugio"));
  assert.ok(ids({ ...base, notte_fredda: false }).includes("sacco-lenzuolo"));          // il lenzuolo serve sempre in rifugio
});
