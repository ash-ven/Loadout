// =====================================================================
//  TEST DELL'API con supertest: richieste HTTP vere alla nostra app Express,
//  senza accendere il server (supertest chiama "app" direttamente).
//  Questi NON usano il database: provano le regole che scattano prima.
//  Si lanciano con: npm test   (dalla cartella api)
// =====================================================================
import { test } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import jwt from "jsonwebtoken";
import app from "../src/app.js";
import { after } from "node:test";
import { pool } from "../src/db.js";

// La chiave per firmare i token: quella del file .env, oppure una solo per i test
process.env.JWT_SECRET ??= "chiave-solo-per-i-test";

// 4/11: con un token VALIDO il guardiano (requireAuth) chiede al database se la password è cambiata dopo il login.
// Quei test quindi servono il database acceso, come i test di integrazione: senza, vengono saltati
const senzaDb = process.env.DATABASE_URL ? false : "serve DATABASE_URL (file api/.env) e il database acceso";
after(() => pool.end());

test("senza login, l'armadio risponde 401", async () => {
  const risposta = await request(app).get("/api/oggetti");
  assert.equal(risposta.status, 401);
  assert.equal(risposta.body.error, "UNAUTHENTICATED");
});

test("una rotta che non esiste risponde 404, in JSON", async () => {
  const risposta = await request(app).get("/api/non-esiste");
  assert.equal(risposta.status, 404);
  assert.equal(risposta.body.error, "NOT_FOUND");
});

test("un body JSON rotto risponde 400 BAD_JSON (e non 500)", async () => {
  const risposta = await request(app)
    .post("/api/auth/login")
    .set("Content-Type", "application/json")
    .send('{"email": "asiha@example.com", '); // JSON tagliato a metà
  assert.equal(risposta.status, 400);
  assert.equal(risposta.body.error, "BAD_JSON");
});

test("registrazione con un'email non valida: 400 BAD_EMAIL", async () => {
  const risposta = await request(app)
    .post("/api/auth/register")
    .send({ email: "non-è-una-email", password: "Password123!", nome: "Prova" });
  assert.equal(risposta.status, 400);
  assert.equal(risposta.body.error, "BAD_EMAIL");
});

test("un token firmato con un'altra chiave viene rifiutato: 401", async () => {
  const tokenFalso = jwt.sign({ sub: 1, nome: "Asiha" }, "chiave-di-un-attaccante");
  const risposta = await request(app).get("/api/oggetti").set("Cookie", `token=${tokenFalso}`);
  assert.equal(risposta.status, 401);
  assert.equal(risposta.body.error, "INVALID_TOKEN");
});

test("con un login valido, un codice a barre fatto di lettere: 400 BAD_CODICE", { skip: senzaDb }, async () => {
  const token = jwt.sign({ sub: 1, nome: "Asiha" }, process.env.JWT_SECRET);
  const risposta = await request(app).get("/api/prodotti/ABC123").set("Cookie", `token=${token}`);
  assert.equal(risposta.status, 400);
  assert.equal(risposta.body.error, "BAD_CODICE");
});

// --- B7: account ---
test("cambio password senza login: 401", async () => {
  const risposta = await request(app).put("/api/auth/me/password").send({ attuale: "Password123!", nuova: "NuovaPassword1" });
  assert.equal(risposta.status, 401);
});

test("cambio password: la nuova troppo corta viene rifiutata (400)", { skip: senzaDb }, async () => {
  const token = jwt.sign({ sub: 1, nome: "Asiha" }, process.env.JWT_SECRET);
  const risposta = await request(app).put("/api/auth/me/password").set("Cookie", `token=${token}`)
    .send({ attuale: "Password123!", nuova: "corta" });
  assert.equal(risposta.status, 400);
  assert.equal(risposta.body.error, "WEAK_PASSWORD");
});

test("eliminare l'account senza scrivere la password: 400", { skip: senzaDb }, async () => {
  const token = jwt.sign({ sub: 1, nome: "Asiha" }, process.env.JWT_SECRET);
  const risposta = await request(app).delete("/api/auth/me").set("Cookie", `token=${token}`).send({});
  assert.equal(risposta.status, 400);
});

// --- 4/11: conferma dell'email e «password dimenticata» (le regole che scattano prima del database) ---
test("conferma con un codice troppo corto: 400 LINK_NON_VALIDO", async () => {
  const risposta = await request(app).post("/api/auth/conferma").send({ codice: "abc" });
  assert.equal(risposta.status, 400);
  assert.equal(risposta.body.error, "LINK_NON_VALIDO");
});

test("nuova password troppo corta: 400 WEAK_PASSWORD, prima ancora di guardare il codice", async () => {
  const risposta = await request(app).post("/api/auth/nuova-password").send({ codice: "x".repeat(43), password: "corta" });
  assert.equal(risposta.status, 400);
  assert.equal(risposta.body.error, "WEAK_PASSWORD");
});

test("password dimenticata senza email: 400", async () => {
  const risposta = await request(app).post("/api/auth/password-dimenticata").send({});
  assert.equal(risposta.status, 400);
});
