import { query, pool } from "../db.js";
import * as kit from "./kit.js";

// B5: "Genera zaino" intelligente, tutto in UNA transazione (o tutto, o niente):
// indispensabili e preferiti (fn_genera_zaino) + l'attrezzatura del kit trovata nell'armadio.
export async function genera(utenteId, viaggio) {
  const uscita = await kit.condizioni(viaggio); // prima della transazione: chiede il meteo (rete), non tiene occupato il database
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const risultato = await kit.generaIntelligente(client, utenteId, viaggio, uscita);
    await client.query("COMMIT");
    return risultato; // { aggiunti, base, dal_kit, esclusi }
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
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
            peso_addosso_g, ROUND(peso_addosso_g / 1000.0, 2) AS peso_addosso_kg,
            (SELECT COUNT(*) FROM viaggio_oggetto vo WHERE vo.viaggio_id = $1 AND vo.inserito) AS n_inseriti
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
export async function modifica(viaggioId, oggettoId, { inserito, quantita, indossato, non_usato }) {
  const { rows } = await query(
    `UPDATE viaggio_oggetto
     SET inserito  = COALESCE($3, inserito),
         quantita  = COALESCE($4, quantita),
         indossato = COALESCE($5, indossato),
         non_usato = COALESCE($6, non_usato)
     WHERE viaggio_id = $1 AND oggetto_id = $2
     RETURNING *`,
    [viaggioId, oggettoId, inserito ?? null, quantita ?? null, indossato ?? null, non_usato ?? null]
  );
  return rows[0] ?? null;
}

// Categoria e pezzi posseduti di un oggetto che sta nello zaino del viaggio (null se non c'è).
// Servono per due controlli: si può indossare? (B3) e ne hai abbastanza? (B2)
export async function infoNelloZaino(viaggioId, oggettoId) {
  const { rows } = await query(
    `SELECT o.categoria, o.quantita_posseduta
     FROM viaggio_oggetto vo
     JOIN oggetto o ON o.id = vo.oggetto_id
     WHERE vo.viaggio_id = $1 AND vo.oggetto_id = $2`,
    [viaggioId, oggettoId]
  );
  return rows[0] ?? null;
}

// Pezzi posseduti di un oggetto dell'utente (null se l'oggetto non è suo o non esiste): B2
export async function posseduti(utenteId, oggettoId) {
  const { rows } = await query(
    "SELECT quantita_posseduta FROM oggetto WHERE id = $1 AND utente_id = $2",
    [oggettoId, utenteId]
  );
  return rows[0]?.quantita_posseduta ?? null;
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
// =====================================================================
//  Punto 5 (3/11): «cosa non hai usato»
// =====================================================================

// Un viaggio è «fatto» se la data di partenza è prima di oggi (la stessa regola della Home, index.js).
// Oggi = la data in Italia, non quella del server (che può essere in UTC): "sv-SE" scrive le date come "2026-11-03".
export function eFatto(dataPartenza, adesso = new Date()) {
  const oggi = adesso.toLocaleDateString("sv-SE", { timeZone: "Europe/Rome" });
  return dataPartenza != null && dataPartenza < oggi; // le date "AAAA-MM-GG" si confrontano anche come testo
}

// Funzione pura (la provano i test): dalla storia degli oggetti nei viaggi passati, quelli NON usati
// le ultime 2 volte di fila (scelta di Asiha). storia = righe { oggetto_id, non_usato, viaggio, data_partenza },
// dalla più recente alla più vecchia. → Map oggetto_id → { viaggio, data } (l'ultimo viaggio in cui non l'hai usato)
export function nonUsatiDiFila(storia, volte = 2) {
  const perOggetto = new Map();
  for (const riga of storia) {
    const righe = perOggetto.get(riga.oggetto_id) ?? [];
    if (righe.length < volte) righe.push(riga);   // ci servono solo le ultime "volte" volte
    perOggetto.set(riga.oggetto_id, righe);
  }
  const risultato = new Map();
  for (const [id, righe] of perOggetto) {
    if (righe.length === volte && righe.every((r) => r.non_usato)) {
      risultato.set(id, { viaggio: righe[0].viaggio, data: righe[0].data_partenza });
    }
  }
  return risultato;
}

// Per lo zaino di questo viaggio: gli oggetti non usati le ultime 2 volte nei viaggi FATTI della stessa attività,
// prima di questo. L'attrezzatura di sicurezza è esclusa (kit.diSicurezza): non usarla non è un motivo per lasciarla.
export async function nonUsatiPrima(utenteId, viaggio) {
  const { rows } = await query(
    `SELECT vo.oggetto_id, vo.non_usato, v.nome AS viaggio, v.data_partenza,
            o.nome, o.categoria, o.marchio, o.caratteristiche
     FROM viaggio_oggetto vo
     JOIN viaggio v ON v.id = vo.viaggio_id
     JOIN oggetto o ON o.id = vo.oggetto_id
     WHERE v.utente_id = $1 AND v.attivita = $2 AND v.id <> $3
       AND v.data_partenza IS NOT NULL
       AND v.data_partenza < LEAST(COALESCE($4::date, 'infinity'::date), CURRENT_DATE)  -- fatti, e prima di questo viaggio
     ORDER BY v.data_partenza DESC, v.id DESC`,
    [utenteId, viaggio.attivita, viaggio.id, viaggio.data_partenza ?? null]
  );
  return nonUsatiDiFila(rows.filter((r) => !kit.diSicurezza(r)));
}
