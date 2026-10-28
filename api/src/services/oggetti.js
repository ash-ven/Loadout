// api/src/services/oggetti.js
import { query } from "../db.js";

export async function list({ q = "", limit = 50, offset = 0 }) {
  const { rows } = await query(
    `SELECT * FROM oggetto
     WHERE nome ILIKE $1
     ORDER BY categoria, nome
     LIMIT $2 OFFSET $3`,
    [`%${q}%`, limit, offset]
  );
  return rows;
}

export async function getById(id) {
  const { rows } = await query("SELECT * FROM oggetto WHERE id = $1", [id]);
  return rows[0] ?? null; // undefined → null: chi chiama controlla "se null → 404"
}

export async function create(utenteId, dati) {
  const { nome, categoria, peso_g, is_indispensabile = false, is_preferito = false, codice_etichetta = null, note = null } = dati;
  const { rows } = await query(
    `INSERT INTO oggetto (utente_id, nome, categoria, peso_g, is_indispensabile, is_preferito, codice_etichetta, note)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [utenteId, nome, categoria, peso_g, is_indispensabile, is_preferito, codice_etichetta, note]
  );
  return rows[0];
}