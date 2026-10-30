import { query, pool } from "../db.js";
import * as kit from "./kit.js";

// I 21 campi del viaggio, sempre nello stesso ordine, con i valori di riserva
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
    d.distanza_km ?? null,
    d.luogo_partenza || null, // B1: il nome del luogo ("" → null)
    d.luogo_arrivo || null,
    d.quota_max_m ?? null,    // B3
    d.quota_min_m ?? null,    // mappe: il punto più basso
    d.traccia ? JSON.stringify(d.traccia) : null, // mappe: tappe + linea (JSONB)
    d.ora_partenza || null,   // meteo in vetta all'ora giusta
  ];
}

// La INSERT del viaggio, usata sia da create sia da createConZaino
const SQL_INSERT = `
  INSERT INTO viaggio (utente_id, nome, attivita, n_persone, n_giorni, pernotto, serve_cucina, data_partenza,
                       lat_partenza, lon_partenza, lat_arrivo, lon_arrivo, dislivello_m, note, pianificato, distanza_km,
                       luogo_partenza, luogo_arrivo, quota_max_m, quota_min_m, traccia, ora_partenza)
  VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
  RETURNING *`;

// Ogni viaggio arriva con il riepilogo del suo zaino (per la pagina Zaino) e ha_mappa (per la pagina Mappe):
// così il browser non deve fare una richiesta in più per ogni uscita.
//   n_oggetti, peso_totale_kg → dalla vista v_zaino_peso (gli oggetti indossati non pesano)
//   n_inseriti                → quanti oggetti hanno già la spunta
export async function list(utenteId, { pianificato = null } = {}) {
  const { rows } = await query(
    `SELECT v.*, z.n_oggetti, z.peso_totale_kg,
            (SELECT COUNT(*) FROM viaggio_oggetto vo WHERE vo.viaggio_id = v.id AND vo.inserito) AS n_inseriti,
            v.traccia IS NOT NULL AS ha_mappa
     FROM viaggio v
     JOIN v_zaino_peso z ON z.viaggio_id = v.id
     WHERE v.utente_id = $1
       AND ($2::boolean IS NULL OR v.pianificato = $2)
     ORDER BY v.data_partenza NULLS LAST, v.id`,
    [utenteId, pianificato]
  );
  return rows;
}

export async function getById(utenteId, id) {
  const { rows } = await query("SELECT * FROM viaggio WHERE id = $1 AND utente_id = $2", [id, utenteId]);
  return rows[0] ?? null;
}

export async function create(utenteId, dati) {
  const { rows } = await query(SQL_INSERT, [utenteId, ...campi(dati)]);
  return rows[0];
}

// Crea il viaggio E genera lo zaino in UNA transazione: o tutto, o niente (lezione 5.8)
export async function createConZaino(utenteId, dati) {
  // B5: le condizioni dell'uscita (meteo compreso) prima della transazione: la rete non deve tenere occupato il database
  const uscita = await kit.condizioni({ pernotto: "nessuno", serve_cucina: false, ...dati });
  const client = await pool.connect(); // un client dedicato: BEGIN e COMMIT devono stare sulla stessa connessione
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(SQL_INSERT, [utenteId, ...campi(dati)]);
    const viaggio = rows[0];
    const gen = await kit.generaIntelligente(client, utenteId, viaggio, uscita); // fn_genera_zaino + kit
    await client.query("COMMIT");
    return { ...viaggio, aggiunti: gen.aggiunti };
  } catch (err) {
    await client.query("ROLLBACK"); // annulla anche la INSERT del viaggio
    throw err;                      // e passa l'errore alla rotta, che lo manda all'errorHandler
  } finally {
    client.release(); // SEMPRE: altrimenti il pool resta senza connessioni
  }
}

// Solo il percorso (pagina della mappa): traccia, km, dislivello positivo, quote e coordinate.
// I campi non mandati diventano null: il percorso si sostituisce per intero.
export async function aggiornaPercorso(utenteId, id, d) {
  const { rows } = await query(
    `UPDATE viaggio
     SET traccia = $3, distanza_km = $4, dislivello_m = $5, quota_min_m = $6, quota_max_m = $7,
         lat_partenza = $8, lon_partenza = $9, lat_arrivo = $10, lon_arrivo = $11
     WHERE id = $1 AND utente_id = $2
     RETURNING *`,
    [id, utenteId, d.traccia ? JSON.stringify(d.traccia) : null, d.distanza_km ?? null, d.dislivello_m ?? null,
     d.quota_min_m ?? null, d.quota_max_m ?? null, d.lat_partenza ?? null, d.lon_partenza ?? null,
     d.lat_arrivo ?? null, d.lon_arrivo ?? null]
  );
  return rows[0] ?? null;
}

export async function update(utenteId, id, dati) {
  const { rows } = await query(
    `UPDATE viaggio
     SET nome = $3, attivita = $4, n_persone = $5, n_giorni = $6, pernotto = $7, serve_cucina = $8, data_partenza = $9,
         lat_partenza = $10, lon_partenza = $11, lat_arrivo = $12, lon_arrivo = $13, dislivello_m = $14, note = $15,
         pianificato = $16, distanza_km = $17, luogo_partenza = $18, luogo_arrivo = $19, quota_max_m = $20,
         quota_min_m = $21, traccia = $22, ora_partenza = $23
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