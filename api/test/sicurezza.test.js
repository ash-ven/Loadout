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

test("CSP delle mappe: tessere solo da MapTiler, script, stili e caratteri solo dal nostro sito, fetch solo verso la nostra API", async () => {
  const csp = (await request(app).get("/index.html")).headers["content-security-policy"];
  assert.match(csp, /img-src 'self' data: https:\/\/api\.maptiler\.com/);
  // 4/11 (privacy): Leaflet, lettore di codici a barre e caratteri sono in public/: niente unpkg né Google
  assert.match(csp, /script-src 'self'(;|$)/);
  assert.match(csp, /style-src 'self'(;|$)/);
  assert.match(csp, /font-src 'self'(;|$)/);
  assert.doesNotMatch(csp, /unpkg|googleapis|gstatic/);
  assert.match(csp, /connect-src 'self'(;|$)/); // BRouter lo chiama il server: il browser non esce dal nostro sito
});

// Mappa senza rete: SOLO il service worker può scaricare le tessere; le pagine restano chiuse
test("CSP del service worker: connect-src aperto a MapTiler solo per sw.js", async () => {
  const risposta = await request(app).get("/sw.js");
  assert.equal(risposta.status, 200);
  assert.match(risposta.headers["content-security-policy"], /connect-src 'self' https:\/\/api\.maptiler\.com$/);
  assert.match(risposta.headers["cache-control"], /no-cache/);
});

test("percorso e chiave delle mappe senza login: 401", async () => {
  assert.equal((await request(app).get("/api/percorso?punti=44.2,10.7;44.21,10.71")).status, 401);
  assert.equal((await request(app).get("/api/mappe/config")).status, 401);
  assert.equal((await request(app).put("/api/viaggi/1/percorso").send({ distanza_km: 5 })).status, 401);
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
