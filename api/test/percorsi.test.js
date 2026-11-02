// Test della lettura della risposta di BRouter (services/percorsi.js), con una risposta FINTA:
// non serve internet e il risultato è sempre lo stesso.
import { test } from "node:test";
import assert from "node:assert/strict";
import { daBRouter, semplifica, discesa, NessunPercorso } from "../src/services/percorsi.js";

// Una risposta come quella di BRouter: coordinate [lon, lat, quota], lunghezza e salita come TESTO
const finta = {
  features: [{
    properties: { "track-length": "6234", "filtered ascend": "412", "plain-ascend": "99" },
    geometry: { coordinates: [
      [10.70000, 44.20000, 1501.4],
      [10.70010, 44.20005, 1503],   // a pochi metri dal primo: la semplificazione lo toglie
      [10.70500, 44.20500, 1763.2], // il punto più alto
      [10.71000, 44.21000, 1600],
    ] },
  }],
};

test("BRouter: km con un decimale, dislivello positivo, quote minima e massima arrotondate", () => {
  const p = daBRouter(finta);
  assert.equal(p.distanza_km, 6.2);
  assert.equal(p.dislivello_m, 412);
  assert.equal(p.quota_min_m, 1501);
  assert.equal(p.quota_max_m, 1763);
});

test("BRouter: coordinate girate in [lat, lon, quota] e punto più alto per il meteo in vetta", () => {
  const p = daBRouter(finta);
  assert.deepEqual(p.punto_piu_alto, [44.205, 10.705]);
  assert.deepEqual(p.traccia[0], [44.2, 10.7, 1501]);
  assert.equal(p.traccia.length, 3); // il secondo punto (a ~9 m dal primo) è stato tolto
});

// D−: salita totale meno (quota d'arrivo − quota di partenza). Qui 412 − 99 = 313 m di discesa
test("BRouter: dislivello negativo ricavato da salita totale e differenza di quota", () => {
  assert.equal(daBRouter(finta).discesa_m, 313);
  assert.equal(discesa({ "filtered ascend": "650", "plain-ascend": "-200" }), 850); // arrivi più in basso: scendi di più
  assert.equal(discesa({ "filtered ascend": "500", "plain-ascend": "0" }), 500);    // anello: D− = D+
  assert.equal(discesa({ "filtered ascend": "500" }), null);                         // manca il dato: non inventiamo
});

test("semplifica: tiene sempre primo, ultimo e il punto da tenere, anche se vicinissimi", () => {
  const vicini = [[44, 10, 1], [44.00001, 10, 2], [44.00002, 10, 9], [44.00003, 10, 3]];
  assert.deepEqual(semplifica(vicini, 20, 2), [[44, 10, 1], [44.00002, 10, 9], [44.00003, 10, 3]]);
});

test("BRouter: una risposta senza percorso diventa NessunPercorso (la rotta risponde 404)", () => {
  assert.throws(() => daBRouter({ features: [] }), NessunPercorso);
});
