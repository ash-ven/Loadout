// A3 (revisione UX 2): i messaggi del validatore usano il nome leggibile del campo, non quello della colonna.
import { test } from "node:test";
import assert from "node:assert/strict";
import { validate } from "../src/middleware/validate.js";

// Esegue il middleware come farebbe Express e restituisce il messaggio d'errore (o null se è tutto valido)
function messaggio(schema, body) {
  let errore = null;
  validate(schema)({ body }, {}, (err) => { errore = err ?? null; });
  return errore?.message ?? null;
}

const schema = {
  lat_partenza: { etichetta: "la latitudine di partenza", aiuto: "in Italia circa 36–47, es. 44,19", type: "number", min: -90, max: 90 },
  nome:         { etichetta: "il nome del viaggio", type: "string", required: true },
};

test("A3: latitudine 123 → messaggio leggibile con il suggerimento, senza 'lat_partenza'", () => {
  const testo = messaggio(schema, { nome: "Cimone", lat_partenza: 123 });
  assert.equal(testo, "La latitudine di partenza va da -90 a 90 (in Italia circa 36–47, es. 44,19)");
  assert.doesNotMatch(testo, /lat_partenza/);
});

test("A3: campo obbligatorio mancante → «Manca …»; dati giusti → nessun errore", () => {
  assert.equal(messaggio(schema, { lat_partenza: 44.19 }), "Manca il nome del viaggio");
  assert.equal(messaggio(schema, { nome: "Cimone", lat_partenza: 44.19 }), null);
});
