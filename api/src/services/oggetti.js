import { query } from "../db.js";

// La ricerca "q" cerca nel nome, nel marchio, nelle caratteristiche e nelle note
// (ILIKE = senza distinguere maiuscole e minuscole; COALESCE perché i campi facoltativi possono essere NULL)
export async function list(utenteId, { q = "", categoria = null, limit = 50, offset = 0 }) {
  const { rows } = await query(
    `SELECT * FROM oggetto
     WHERE utente_id = $1
       AND (nome ILIKE $2 OR COALESCE(marchio, '') ILIKE $2
            OR COALESCE(caratteristiche, '') ILIKE $2 OR COALESCE(note, '') ILIKE $2)
       AND ($3::categoria_oggetto IS NULL OR categoria = $3)
     ORDER BY categoria, nome
     LIMIT $4 OFFSET $5`,
    [utenteId, `%${q}%`, categoria, limit, offset]
  );
  return rows;
}

export async function getById(utenteId, id) {
  const { rows } = await query("SELECT * FROM oggetto WHERE id = $1 AND utente_id = $2", [id, utenteId]);
  return rows[0] ?? null;
}

// I campi facoltativi hanno un valore di default: chi non li manda ottiene null (o 1 pezzo)
function campi(dati) {
  const {
    nome, categoria, peso_g, is_indispensabile = false, is_preferito = false,
    codice_etichetta = null, note = null, marchio = null, caratteristiche = null, quantita_posseduta = 1,
  } = dati;
  return [nome, categoria, peso_g, is_indispensabile, is_preferito, codice_etichetta, note, marchio, caratteristiche,
          quantita_posseduta];
}

export async function create(utenteId, dati) {
  const { rows } = await query(
    `INSERT INTO oggetto (utente_id, nome, categoria, peso_g, is_indispensabile, is_preferito,
                          codice_etichetta, note, marchio, caratteristiche, quantita_posseduta)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING *`,
    [utenteId, ...campi(dati)]
  );
  return rows[0];
}

// Modifica. Se abbassi i pezzi posseduti (es. da 3 a 1), negli zaini dove ne avevi messi di più
// la quantità scende a quella nuova: lo fa la stessa query, con due UPDATE in una "WITH" (atomica).
export async function update(utenteId, id, dati) {
  const { rows } = await query(
    `WITH aggiornato AS (
       UPDATE oggetto
       SET nome = $3, categoria = $4, peso_g = $5, is_indispensabile = $6, is_preferito = $7,
           codice_etichetta = $8, note = $9, marchio = $10, caratteristiche = $11, quantita_posseduta = $12
       WHERE id = $1 AND utente_id = $2
       RETURNING *
     ), negli_zaini AS (
       UPDATE viaggio_oggetto vo
       SET quantita = a.quantita_posseduta
       FROM aggiornato a
       WHERE vo.oggetto_id = a.id AND vo.quantita > a.quantita_posseduta
     )
     SELECT * FROM aggiornato`,
    [id, utenteId, ...campi(dati)]
  );
  return rows[0] ?? null;
}

export async function remove(utenteId, id) {
  const { rowCount } = await query("DELETE FROM oggetto WHERE id = $1 AND utente_id = $2", [id, utenteId]);
  return rowCount > 0;
}
