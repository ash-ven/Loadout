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

// A1 (revisione UX 2): la traccia ricorda quali valori ha compilato la mappa (o il luogo); gli altri sono dell'utente
test("traccia: le origini dei valori sono accettate solo con campi e valori conosciuti", () => {
  assert.equal(tracciaValida({ ...buona, origini: { distanza_km: "mappa", lat_partenza: "luogo" } }), true);
  assert.equal(tracciaValida({ ...buona, origini: {} }), true);                         // tutto scritto a mano
  assert.equal(tracciaValida({ ...buona, origini: { distanza_km: "a mano" } }), false); // valore sconosciuto
  assert.equal(tracciaValida({ ...buona, origini: { password: "mappa" } }), false);     // campo che non c'entra
  assert.equal(tracciaValida({ ...buona, origini: ["mappa"] }), false);                 // non è un oggetto
});

// Profilo del percorso e dislivello negativo stanno nella traccia (niente colonne nuove)
test("traccia: profilo sentieri/breve e discesa_m intera tra 0 e 9000", () => {
  assert.equal(tracciaValida({ ...buona, profilo: "breve", discesa_m: 450 }), true);
  assert.equal(tracciaValida({ ...buona, profilo: "sentieri", discesa_m: null }), true);
  assert.equal(tracciaValida({ ...buona, profilo: "auto" }), false);   // profilo sconosciuto
  assert.equal(tracciaValida({ ...buona, discesa_m: -5 }), false);      // negativa
  assert.equal(tracciaValida({ ...buona, discesa_m: 12.5 }), false);    // non intera
});

// Collaudo 3/11, B2: una traccia importata da un file GPX lo ricorda (origine: "gpx"), nient'altro
test("traccia: origine «gpx» accettata, altri valori no", () => {
  assert.equal(tracciaValida({ ...buona, origine: "gpx" }), true);
  assert.equal(tracciaValida({ ...buona, origine: "komoot" }), false);
});
