// Test della funzione che trasforma la risposta di Nominatim (non usa la rete)
import { test } from "node:test";
import assert from "node:assert/strict";
import { daNominatim } from "../src/services/luoghi.js";

test("daNominatim: nome, comune e sigla della provincia, tipo tradotto, coordinate numeriche", () => {
  const risposta = [{
    name: "Rifugio Vajolet", type: "alpine_hut", lat: "46.4561234567", lon: "11.6201234567",
    address: { village: "Pozza di Fassa", "ISO3166-2-lvl6": "IT-TN", state: "Trentino-Alto Adige", country_code: "it", country: "Italia" },
  }];
  assert.deepEqual(daNominatim(risposta), [
    { etichetta: "Rifugio Vajolet (Pozza di Fassa, TN)", tipo: "rifugio", lat: 46.456123, lon: 11.620123 },
  ]);
});

test("daNominatim: fuori dall'Italia aggiunge lo stato; risposta strana = nessun risultato", () => {
  const risposta = [{ name: "Zermatt", type: "village", lat: "46.02", lon: "7.75",
    address: { village: "Zermatt", state: "Vallese", country_code: "ch", country: "Svizzera" } }];
  assert.equal(daNominatim(risposta)[0].etichetta, "Zermatt (Vallese, Svizzera)");
  assert.deepEqual(daNominatim({ errore: true }), []);
});
