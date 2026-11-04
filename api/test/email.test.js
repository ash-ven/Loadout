// 4/11: i codici dei link e il testo delle email (niente database, niente invio)
import { test } from "node:test";
import assert from "node:assert/strict";
import { impronta, nuovoCodice } from "../src/services/token-email.js";
import { componiEmail } from "../src/services/email.js";

test("codice: lungo, casuale, adatto a un indirizzo web; l'impronta è SHA-256 in esadecimale", () => {
  const a = nuovoCodice(), b = nuovoCodice();
  assert.notEqual(a, b);
  assert.equal(a.length, 43);                 // 32 byte in base64url
  assert.match(a, /^[A-Za-z0-9_-]+$/);        // niente + / = : si mette nel link così com'è
  assert.match(impronta(a), /^[0-9a-f]{64}$/);
  assert.equal(impronta(a), impronta(a));     // stessa impronta per lo stesso codice
  assert.notEqual(impronta(a), a);            // nel database non c'è il codice
});

test("email: il nome scelto dall'utente non può infilare HTML nella email", () => {
  const { html, testo } = componiEmail({ nome: "<script>x</script>", titolo: "T", frase: "F", pulsante: "P",
    link: "https://loadout.example/conferma-email.html?codice=abc", nota: "N" });
  assert.ok(!html.includes("<script>"));
  assert.ok(html.includes("&lt;script&gt;"));
  assert.ok(testo.includes("https://loadout.example/conferma-email.html?codice=abc"));
});
