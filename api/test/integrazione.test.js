// =====================================================================
//  TEST "DAL LOGIN AI DATI": usano il database vero (quello in Docker).
//  Leggono soltanto, non modificano niente.
//  Servono: il database acceso (docker compose up -d db) e DATABASE_URL nel file api/.env.
//  Senza DATABASE_URL vengono saltati (skip), non falliscono.
// =====================================================================
import { test, after } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import app from "../src/app.js";
import { pool } from "../src/db.js";

const salta = process.env.DATABASE_URL ? false : "serve DATABASE_URL (file api/.env) e il database acceso";

// Alla fine chiudiamo le connessioni al database, altrimenti il test resterebbe "appeso"
after(() => pool.end());

test("login con l'utente di prova, poi lettura dell'armadio", { skip: salta }, async () => {
  const agente = request.agent(app); // un "agente" ricorda i cookie tra una richiesta e l'altra, come un browser

  const login = await agente.post("/api/auth/login").send({ email: "asiha@example.com", password: "Password123!" });
  assert.equal(login.status, 200);
  assert.match(login.headers["set-cookie"][0], /^token=.*HttpOnly/); // il cookie di login, non leggibile da JavaScript

  const armadio = await agente.get("/api/oggetti"); // il cookie parte da solo
  assert.equal(armadio.status, 200);
  assert.ok(Array.isArray(armadio.body));
  assert.ok(armadio.body.length > 0, "l'armadio di prova non dovrebbe essere vuoto");
});

test("password sbagliata: 401 con un messaggio che non rivela se l'email esiste", { skip: salta }, async () => {
  const risposta = await request(app).post("/api/auth/login").send({ email: "asiha@example.com", password: "sbagliata" });
  assert.equal(risposta.status, 401);
  assert.equal(risposta.body.message, "Email o password errati");
});
