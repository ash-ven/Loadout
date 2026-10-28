import { query } from "../db.js";

// I 14 campi del viaggio, sempre nello stesso ordine, con i valori di riserva
function campi(d) {
  return [
    d.nome,
    d.attivita,
    d.n_persone ?? 1,
    d.n_giorni ?? 1,
    d.pernotto ?? "nessuno",
    d.serve_cucina ?? false,
    d.data_partenza ?? null,
    d.lat_partenza ?? null,
    d.lon_partenza ?? null,
    d.lat_arrivo ?? null,
    d.lon_arrivo ?? null,
    d.dislivello_m ?? null,
    d.note ?? null,
    d.pianificato ?? false,
  ];
}

export async function list(utenteId) {
  const { rows } = await query(
    "SELECT * FROM viaggio WHERE utente_id = $1 ORDER BY data_partenza NULLS LAST, id",
    [utenteId]
  );
  return rows;
}

export async function getById(utenteId, id) {
  const { rows } = await query("SELECT * FROM viaggio WHERE id = $1 AND utente_id = $2", [id, utenteId]);
  return rows[0] ?? null;
}

export async function create(utenteId, dati) {
  const { rows } = await query(
    `INSERT INTO viaggio (utente_id, nome, attivita, n_persone, n_giorni, pernotto, serve_cucina, data_partenza,
                          lat_partenza, lon_partenza, lat_arrivo, lon_arrivo, dislivello_m, note, pianificato)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
     RETURNING *`,
    [utenteId, ...campi(dati)]
  );
  return rows[0];
}

export async function update(utenteId, id, dati) {
  const { rows } = await query(
    `UPDATE viaggio
     SET nome = $3, attivita = $4, n_persone = $5, n_giorni = $6, pernotto = $7, serve_cucina = $8, data_partenza = $9,
         lat_partenza = $10, lon_partenza = $11, lat_arrivo = $12, lon_arrivo = $13, dislivello_m = $14, note = $15, pianificato = $16
     WHERE id = $1 AND utente_id = $2
     RETURNING *`,
    [id, utenteId, ...campi(dati)]
  );
  return rows[0] ?? null;
}

export async function remove(utenteId, id) {
  const { rowCount } = await query("DELETE FROM viaggio WHERE id = $1 AND utente_id = $2", [id, utenteId]);
  return rowCount > 0;
}