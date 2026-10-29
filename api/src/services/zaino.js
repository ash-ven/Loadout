import { query } from "../db.js";

// Riempie lo zaino con indispensabili e preferiti (logica nel database)
export async function genera(viaggioId) {
  const { rows } = await query("SELECT fn_genera_zaino($1) AS aggiunti", [viaggioId]);
  return rows[0].aggiunti;
}

// La checklist: una riga per oggetto, con categoria, peso, quantità, inserito
export async function dettaglio(viaggioId) {
  const { rows } = await query(
    "SELECT * FROM v_zaino_dettaglio WHERE viaggio_id = $1 ORDER BY categoria, nome",
    [viaggioId]
  );
  return rows;
}

// Il peso: totale e già inserito, in grammi e in kg con 2 decimali.
// Gli oggetti indossati NON contano nel peso dello zaino: stanno a parte in peso_addosso (B3).
export async function peso(viaggioId) {
  const { rows } = await query(
    `SELECT n_oggetti, peso_totale_g, peso_inserito_g, peso_totale_kg,
            ROUND(peso_inserito_g / 1000.0, 2) AS peso_inserito_kg,
            peso_addosso_g, ROUND(peso_addosso_g / 1000.0, 2) AS peso_addosso_kg
     FROM v_zaino_peso
     WHERE viaggio_id = $1`,
    [viaggioId]
  );
  return rows[0];
}

// Aggiunge un oggetto allo zaino, SOLO se l'oggetto è dell'utente
export async function aggiungi(utenteId, viaggioId, oggettoId, quantita) {
  const { rows } = await query(
    `INSERT INTO viaggio_oggetto (viaggio_id, oggetto_id, quantita)
     SELECT $1::int, id, $3::int FROM oggetto WHERE id = $2 AND utente_id = $4
     RETURNING *`,
    [viaggioId, oggettoId, quantita, utenteId]
  );
  return rows[0] ?? null;
}

// Cambia "inserito", la quantità e/o "indossato" (solo i campi inviati:
// COALESCE($n, colonna) = "se non me l'hai mandato, lascia il valore che c'è")
export async function modifica(viaggioId, oggettoId, { inserito, quantita, indossato }) {
  const { rows } = await query(
    `UPDATE viaggio_oggetto
     SET inserito  = COALESCE($3, inserito),
         quantita  = COALESCE($4, quantita),
         indossato = COALESCE($5, indossato)
     WHERE viaggio_id = $1 AND oggetto_id = $2
     RETURNING *`,
    [viaggioId, oggettoId, inserito ?? null, quantita ?? null, indossato ?? null]
  );
  return rows[0] ?? null;
}

// La categoria di un oggetto che sta nello zaino del viaggio (null se non c'è):
// serve per controllare che si possa indossare (B3: solo l'abbigliamento)
export async function categoria(viaggioId, oggettoId) {
  const { rows } = await query(
    `SELECT o.categoria
     FROM viaggio_oggetto vo
     JOIN oggetto o ON o.id = vo.oggetto_id
     WHERE vo.viaggio_id = $1 AND vo.oggetto_id = $2`,
    [viaggioId, oggettoId]
  );
  return rows[0]?.categoria ?? null;
}

// Toglie un oggetto dallo zaino (l'oggetto resta nell'armadio)
export async function rimuovi(viaggioId, oggettoId) {
  const { rowCount } = await query(
    "DELETE FROM viaggio_oggetto WHERE viaggio_id = $1 AND oggetto_id = $2",
    [viaggioId, oggettoId]
  );
  return rowCount > 0;
}

// Svuota la checklist: tutti gli oggetti tornano "non inseriti" (US5 CA4)
export async function svuota(viaggioId) {
  const { rowCount } = await query(
    "UPDATE viaggio_oggetto SET inserito = FALSE WHERE viaggio_id = $1 AND inserito = TRUE",
    [viaggioId]
  );
  return rowCount;
}