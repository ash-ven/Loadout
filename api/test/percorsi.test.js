// Test della lettura della risposta di BRouter (services/percorsi.js), con una risposta FINTA:
// non serve internet e il risultato è sempre lo stesso.
import { test } from "node:test";
import assert from "node:assert/strict";
import { daBRouter, semplifica, discesa, parametriDifficolta, avvisiDalPercorso, NessunPercorso } from "../src/services/percorsi.js";

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

// Ferrate e alpinismo: sul profilo dei sentieri si PERMETTONO i passaggi fino a T6 (senza preferirli)
// e la ferrata costa come un sentiero (gli altri casi non cambiano). Vedi la prova del 3/11 in percorsi.js.
test("BRouter: per ferrata e alpinismo i passaggi difficili sono permessi e la ferrata non costa il doppio", () => {
  assert.equal(parametriDifficolta("sentieri", "ferrata"), "&profile:SAC_scale_limit=6&profile:cost_of_unknown=1");
  assert.equal(parametriDifficolta("sentieri", "alpinismo"), "&profile:SAC_scale_limit=6&profile:cost_of_unknown=1");
  assert.doesNotMatch(parametriDifficolta("sentieri", "ferrata"), /SAC_scale_preferred/); // "preferire T4" faceva aggirare la ferrata
  assert.equal(parametriDifficolta("sentieri", "escursione"), "");
  assert.equal(parametriDifficolta("breve", "ferrata"), ""); // il più breve non guarda la scala SAC
  assert.equal(parametriDifficolta("sentieri", null), "");
});

// Avvisi sul percorso: la tabella "messages" di BRouter (riga 0 = intestazione, come nella risposta vera del 3/11)
const testa = ["Longitude", "Latitude", "Elevation", "Distance", "CostPerKm", "ElevCost", "TurnCost", "NodeCost", "InitialCost", "WayTags", "NodeTags", "Time", "Energy"];
const riga = (metri, tag) => [0, 0, 0, String(metri), 0, 0, 0, 0, 0, tag, "", 0, 0];

test("avvisi: metri e tratti per tipo, copertura della scala SAC, tratti attaccati uniti", () => {
  const a = avvisiDalPercorso([testa,
    riga(500, "highway=track"),                                                  // 0–500: niente sac_scale
    riga(300, "highway=path sac_scale=demanding_mountain_hiking surface=rock"),  // 500–800: T3 e roccia
    riga(200, "highway=path sac_scale=demanding_mountain_hiking"),               // 800–1000: T3 (attaccato al precedente)
    riga(1000, "highway=path sac_scale=mountain_hiking")]);                      // 1000–2000: T2, nessun avviso
  assert.equal(a.copertura, 75);                                // 1500 m su 2000 con sac_scale
  assert.deepEqual(a.avvisi.map((v) => v.tipo), ["t3", "roccia"]); // nell'ordine: prima i più seri
  assert.equal(a.avvisi[0].metri, 500);
  assert.deepEqual(a.avvisi[0].tratti, [[0.25, 0.5]]);         // un tratto solo, da 500 a 1000 m
  assert.deepEqual(a.avvisi[1].tratti, [[0.25, 0.4]]);
});

test("avvisi: T4, T5–T6, ferrata e traccia poco visibile; senza tabella null", () => {
  const a = avvisiDalPercorso([testa,
    riga(100, "highway=via_ferrata sac_scale=difficult_alpine_hiking"),
    riga(100, "highway=path sac_scale=alpine_hiking trail_visibility=bad"),
    riga(100, "highway=path")]);                                // un sentiero qualsiasi: nessun avviso
  assert.deepEqual(a.avvisi.map((v) => v.tipo), ["t56", "t4", "attrezzato", "traccia"]);
  assert.equal(avvisiDalPercorso(undefined), null);
  assert.equal(avvisiDalPercorso([testa]), null);
});

// Righe copiate dalle risposte vere di BRouter del 3/11 (Pietra di Bismantova)
test("avvisi: le ferrate vere di Bismantova, con e senza scala SAC, contano come difficoltà segnata", () => {
  const ultimoSole = avvisiDalPercorso([testa, riga(177, "highway=via_ferrata sac_scale=demanding_mountain_hiking")]);
  assert.deepEqual(ultimoSole.avvisi.map((v) => v.tipo), ["attrezzato", "t3"]);
  assert.equal(ultimoSole.copertura, 100);
  const alpini = avvisiDalPercorso([testa, riga(89, "highway=via_ferrata"), riga(89, "highway=path")]); // senza sac_scale
  assert.deepEqual(alpini.avvisi.map((v) => v.tipo), ["attrezzato"]);
  assert.equal(alpini.avvisi[0].metri, 89);
  assert.equal(alpini.copertura, 50); // la ferrata sì, il sentiero senza SAC no
});

test("avvisi: roccia solo con surface=rock (bare_rock e scree BRouter non li passa)", () => {
  const a = avvisiDalPercorso([testa, riga(100, "highway=path surface=rock sac_scale=mountain_hiking"), riga(100, "highway=path surface=gravel")]);
  assert.deepEqual(a.avvisi.map((v) => v.tipo), ["roccia"]);
  assert.equal(a.avvisi[0].metri, 100);
});
