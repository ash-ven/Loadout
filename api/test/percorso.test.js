// Test del controllo sulla traccia della mappa (routes/viaggi.js): il server accetta solo tracce "sane".
import { test } from "node:test";
import assert from "node:assert/strict";
import { tracciaValida } from "../src/routes/viaggi.js";

const buona = { tappe: [[44.1, 11.2], [44.2, 11.3]], linea: [[44.1, 11.2, 900], [44.15, 11.25, 1200], [44.2, 11.3, 1000]] };

test("traccia: una traccia normale è valida (la quota è facoltativa)", () => {
  assert.equal(tracciaValida(buona), true);
  assert.equal(tracciaValida({ tappe: buona.tappe, linea: [[44.1, 11.2], [44.2, 11.3]] }), true);
});

test("traccia: scartate se mancano pezzi, se i punti sono fuori dal mondo o non sono numeri", () => {
  assert.equal(tracciaValida({ linea: buona.linea }), false);                         // niente tappe
  assert.equal(tracciaValida({ ...buona, tappe: [[44.1, 11.2]] }), false);             // una tappa sola
  assert.equal(tracciaValida({ ...buona, linea: [[95, 11, 0], [44, 11, 0]] }), false); // latitudine 95
  assert.equal(tracciaValida({ ...buona, linea: [["44", 11], [44, 11]] }), false);     // testo al posto del numero
});
