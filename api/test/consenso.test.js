// Test delle regole del consenso per le note mediche (GDPR art. 9), senza database
import { test } from "node:test";
import assert from "node:assert/strict";
import { regoleConsenso } from "../src/routes/auth.js";

test("consenso: con la spunta si registra la data, solo la prima volta (COALESCE)", () => {
  const r = regoleConsenso({ note_mediche: "asma" }, true, false);
  assert.equal(r.errore, null);
  assert.equal(r.campi.note_mediche, "asma");
  assert.match(r.setConsenso, /COALESCE\(consenso_salute_il, now\(\)\)/);
});

test("consenso ritirato: note mediche cancellate e data tolta", () => {
  const r = regoleConsenso({ note_mediche: "asma", emergenza_nome: "Marco" }, false, true);
  assert.equal(r.campi.note_mediche, null);
  assert.equal(r.campi.emergenza_nome, "Marco"); // gli altri dati restano
  assert.equal(r.setConsenso, "consenso_salute_il = NULL");
});

test("note mediche senza consenso: errore; con il consenso già dato: si salvano", () => {
  assert.match(regoleConsenso({ note_mediche: "asma" }, undefined, false).errore, /serve il tuo consenso/);
  assert.equal(regoleConsenso({ note_mediche: "asma" }, undefined, true).errore, null);
  assert.equal(regoleConsenso({ peso_corporeo_kg: 60 }, undefined, false).errore, null); // altri campi: nessun problema
});
