// api/test/luoghi.test.js – le quote dei luoghi trovati (5/11: la ricerca per nome ora la fa il browser con MapTiler)
import { test } from "node:test";
import assert from "node:assert/strict";
import { leggiPunti, quoteDaRisposta } from "../src/services/luoghi.js";

test("leggiPunti: coppie lat,lon separate da ; (anche negative)", () => {
  assert.deepEqual(leggiPunti("44.19,10.70;46.41,11.62"), [[44.19, 10.7], [46.41, 11.62]]);
  assert.deepEqual(leggiPunti("-33.9,-70.1"), [[-33.9, -70.1]]);
});

test("leggiPunti: niente punti, troppi punti, fuori dal mondo o testo = null", () => {
  assert.equal(leggiPunti(""), null);
  assert.equal(leggiPunti(undefined), null);
  assert.equal(leggiPunti(Array(11).fill("44,10").join(";")), null);
  assert.equal(leggiPunti("95,10"), null);
  assert.equal(leggiPunti("44,abc"), null);
  assert.equal(leggiPunti("44,10,5"), null);
});

test("quoteDaRisposta: quote arrotondate nell'ordine dei luoghi; senza risposta la quota è null", () => {
  assert.deepEqual(quoteDaRisposta(2, { elevation: [1402.3, 2243.6] }), [1402, 2244]);
  assert.deepEqual(quoteDaRisposta(2, { elevation: [1402.3] }), [1402, null]);
  assert.deepEqual(quoteDaRisposta(2, null), [null, null]);
});
