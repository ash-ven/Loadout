// api/test/pulizia.test.js – 4/11 (privacy, punto 6): la pulizia di link scaduti e account mai confermati.
// Serve il database (come i test di integrazione): senza DATABASE_URL i test vengono saltati.
// Ogni test crea i suoi utenti con un'email unica e li cancella alla fine, così il database resta come prima.
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { pool, query } from "../src/db.js";
import { pulisci, GIORNI } from "../src/services/pulizia.js";

const senzaDb = process.env.DATABASE_URL ? false : "serve DATABASE_URL (file api/.env) e il database acceso";
const fatti = [];
// Un utente di prova, creato "giorni" giorni fa, confermato o no
async function utente(giorni, confermato) {
  const email = `pulizia-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
  const { rows } = await query(
    `INSERT INTO utente (email, password_hash, nome, created_at, email_confermata_il)
     VALUES ($1, 'x', 'Prova', now() - make_interval(days => $2), CASE WHEN $3 THEN now() END) RETURNING id`,
    [email, giorni, confermato]);
  fatti.push(rows[0].id);
  return rows[0].id;
}
const esiste = async (id) => (await query("SELECT 1 FROM utente WHERE id = $1", [id])).rowCount === 1;
// alla fine: via gli utenti di prova (oggetti e link se ne vanno con loro), poi si chiude la connessione
after(async () => {
  if (!senzaDb) await query("DELETE FROM utente WHERE id = ANY($1)", [fatti]);
  await pool.end();
});

test("account mai confermati: via quelli più vecchi di 7 giorni, restano i recenti e i confermati", { skip: senzaDb }, async () => {
  const vecchio = await utente(GIORNI + 1, false);
  const recente = await utente(GIORNI - 1, false);
  const confermato = await utente(GIORNI + 30, true);
  await pulisci();
  assert.equal(await esiste(vecchio), false);
  assert.equal(await esiste(recente), true);
  assert.equal(await esiste(confermato), true);
});

test("un account non confermato che ha qualcosa nell'armadio non viene cancellato (per sicurezza)", { skip: senzaDb }, async () => {
  const id = await utente(GIORNI + 1, false);
  await query("INSERT INTO oggetto (utente_id, nome, peso_g) VALUES ($1, 'Frontale', 80)", [id]);
  await pulisci();
  assert.equal(await esiste(id), true);
});

test("link via email: via quelli scaduti o usati da più di 7 giorni, resta quello ancora valido", { skip: senzaDb }, async () => {
  const id = await utente(1, true);
  const link = async (sql) => (await query(
    `INSERT INTO token_email (utente_id, tipo, hash, scade_il, usato_il) VALUES ($1, 'reset', md5(random()::text) || md5(random()::text), ${sql}) RETURNING id`,
    [id])).rows[0].id;
  const scaduto = await link(`now() - interval '10 days', NULL`);
  const usato = await link(`now() + interval '1 day', now() - interval '8 days'`);
  const valido = await link(`now() + interval '1 hour', NULL`);
  await pulisci();
  const rimasti = (await query("SELECT id FROM token_email WHERE id = ANY($1)", [[scaduto, usato, valido]])).rows.map((r) => r.id);
  assert.deepEqual(rimasti, [valido]);
});
