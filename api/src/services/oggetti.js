import { query } from "../db.js";

export async function list(utenteId, { q = "", limit = 50, offset = 0 }) {
  const { rows } = await query(
    `SELECT * FROM oggetto
     WHERE utente_id = $1 AND nome ILIKE $2
     ORDER BY categoria, nome
     LIMIT $3 OFFSET $4`,
    [utenteId, `%${q}%`, limit, offset]
  );
  return rows;
}

export async function getById(utenteId, id) {
  const { rows } = await query("SELECT * FROM oggetto WHERE id = $1 AND utente_id = $2", [id, utenteId]);
  return rows[0] ?? null;
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

export async function update(utenteId, id, dati) {
  const { nome, categoria, peso_g, is_indispensabile = false, is_preferito = false, codice_etichetta = null, note = null } = dati;
  const { rows } = await query(
    `UPDATE oggetto
     SET nome = $3, categoria = $4, peso_g = $5, is_indispensabile = $6, is_preferito = $7, codice_etichetta = $8, note = $9
     WHERE id = $1 AND utente_id = $2
     RETURNING *`,
    [id, utenteId, nome, categoria, peso_g, is_indispensabile, is_preferito, codice_etichetta, note]
  );
  return rows[0] ?? null;
}

export async function remove(utenteId, id) {
  const { rowCount } = await query("DELETE FROM oggetto WHERE id = $1 AND utente_id = $2", [id, utenteId]);
  return rowCount > 0;
}