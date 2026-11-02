// Test della funzione che trasforma la risposta di Nominatim (non usa la rete)
import { test } from "node:test";
import assert from "node:assert/strict";
import { daNominatim, conQuote } from "../src/services/luoghi.js";

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

// A5 (revisione UX 2): la quota accanto a ogni luogo, per distinguere gli omonimi
test("conQuote: quote arrotondate nell'ordine dei luoghi; senza risposta la quota è null", () => {
  const luoghi = [{ etichetta: "Passo del Lupo (Fanano, MO)", lat: 44.15, lon: 10.8 }, { etichetta: "Passo del Lupo (Leonessa, RI)", lat: 42.5, lon: 13 }];
  assert.deepEqual(conQuote(luoghi, { elevation: [1402.4, 1049.6] }).map((l) => l.quota_m), [1402, 1050]);
  assert.deepEqual(conQuote(luoghi, null).map((l) => l.quota_m), [null, null]); // Open-Meteo non risponde: la ricerca funziona lo stesso
});
