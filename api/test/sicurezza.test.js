// =====================================================================
//  TEST DELLE PROTEZIONI: helmet, CORS e limite di tentativi sul login.
//  (File separato: node --test esegue ogni file in un processo suo, quindi
//   il contatore dei tentativi qui non disturba gli altri test.)
// =====================================================================
import { test } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import app from "../src/app.js";

test("ogni risposta ha le intestazioni di sicurezza di helmet", async () => {
  const risposta = await request(app).get("/index.html");
  assert.equal(risposta.status, 200);
  assert.match(risposta.headers["content-security-policy"], /default-src 'self'/);
  assert.equal(risposta.headers["x-content-type-options"], "nosniff");
  assert.equal(risposta.headers["x-frame-options"], "SAMEORIGIN");
});

test("CORS: un altro sito non riceve il permesso di chiamare l'API", async () => {
  const risposta = await request(app)
    .options("/api/oggetti")
    .set("Origin", "https://sito-cattivo.example")
    .set("Access-Control-Request-Method", "GET");
  assert.equal(risposta.headers["access-control-allow-origin"], undefined); // niente permesso → il browser blocca
});

test("dopo 10 login sbagliati, l'11° risponde 429 Troppi tentativi", async () => {
  // Login senza password: il server risponde 400, e per il limite è un tentativo sbagliato
  for (let i = 1; i <= 10; i++) {
    const risposta = await request(app).post("/api/auth/login").send({ email: "chi@prova.it" });
    assert.equal(risposta.status, 400, `il tentativo ${i} doveva essere un 400`);
  }
  const undicesimo = await request(app).post("/api/auth/login").send({ email: "chi@prova.it" });
  assert.equal(undicesimo.status, 429);
  assert.equal(undicesimo.body.error, "TOO_MANY_REQUESTS");
});
