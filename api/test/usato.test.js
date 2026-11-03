// Punto 5 (3/11): «cosa non hai usato» – le funzioni pure (niente database)
import { test } from "node:test";
import assert from "node:assert/strict";
import { eFatto, nonUsatiDiFila } from "../src/services/zaino.js";
import { diSicurezza } from "../src/services/kit.js";

test("eFatto: solo i viaggi con la partenza prima di oggi (data italiana)", () => {
  const adesso = new Date("2026-11-03T10:00:00+01:00");
  assert.equal(eFatto("2026-11-02", adesso), true);
  assert.equal(eFatto("2026-11-03", adesso), false); // oggi: non ancora fatto
  assert.equal(eFatto("2026-12-01", adesso), false);
  assert.equal(eFatto(null, adesso), false);         // senza data non si sa
  // alle 00:30 in Italia è già il 4 novembre, anche se in UTC è ancora il 3
  assert.equal(eFatto("2026-11-03", new Date("2026-11-03T23:30:00Z")), true);
});

test("nonUsatiDiFila: la nota solo se non usato le ULTIME 2 volte", () => {
  const storia = [ // dalla più recente
    { oggetto_id: 1, non_usato: true,  viaggio: "Cimone", data_partenza: "2026-10-12" },
    { oggetto_id: 2, non_usato: true,  viaggio: "Cimone", data_partenza: "2026-10-12" },
    { oggetto_id: 3, non_usato: true,  viaggio: "Cimone", data_partenza: "2026-10-12" },
    { oggetto_id: 1, non_usato: true,  viaggio: "Pania",  data_partenza: "2026-09-20" },
    { oggetto_id: 2, non_usato: false, viaggio: "Pania",  data_partenza: "2026-09-20" },
    { oggetto_id: 2, non_usato: true,  viaggio: "Vecchio", data_partenza: "2026-08-01" },
  ];
  const r = nonUsatiDiFila(storia);
  assert.deepEqual(r.get(1), { viaggio: "Cimone", data: "2026-10-12" }); // 2 volte di fila
  assert.equal(r.has(2), false); // la penultima volta l'hai usato: conta solo l'ultima coppia
  assert.equal(r.has(3), false); // portato una volta sola
});

test("diSicurezza: categoria sicurezza e voci di sicurezza in altre categorie", () => {
  assert.equal(diSicurezza({ nome: "Casco Petzl", categoria: "sicurezza" }), true);
  assert.equal(diSicurezza({ nome: "Frontale Petzl Tikka", categoria: "elettronica" }), true);
  assert.equal(diSicurezza({ nome: "Kit pronto soccorso", categoria: "altro" }), true);
  assert.equal(diSicurezza({ nome: "Fornello Jetboil", categoria: "cucina" }), false);
  assert.equal(diSicurezza({ nome: "Secondo pile", categoria: "abbigliamento" }), false);
});
