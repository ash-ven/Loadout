// =====================================================================
//  I CODICI DEI LINK MANDATI PER EMAIL (4/11)
//  Il codice è casuale (32 byte = 256 bit: impossibile da indovinare) e va SOLO nell'email.
//  Nel database salviamo la sua impronta SHA-256: come per le password, chi leggesse la tabella
//  non potrebbe usare i link. (Qui basta SHA-256 e non bcrypt: il codice è già lungo e casuale, non una parola scelta da una persona.)
//  Ogni codice ha un tipo ("conferma" o "reset"), scade e si usa una volta sola.
// =====================================================================
import { randomBytes, createHash } from "node:crypto";
import { query } from "../db.js";

export const DURATA_MINUTI = { conferma: 24 * 60, reset: 60 }; // conferma: 24 ore; reset della password: 1 ora

export const impronta = (codice) => createHash("sha256").update(codice).digest("hex");
export const nuovoCodice = () => randomBytes(32).toString("base64url"); // base64url: si può mettere in un indirizzo web

// Un codice nuovo per l'utente: i vecchi dello stesso tipo non ancora usati smettono di valere (vale solo l'ultima email)
export async function crea(utenteId, tipo) {
  const codice = nuovoCodice();
  await query("UPDATE token_email SET usato_il = now() WHERE utente_id = $1 AND tipo = $2 AND usato_il IS NULL", [utenteId, tipo]);
  await query(
    `INSERT INTO token_email (utente_id, tipo, hash, scade_il) VALUES ($1, $2, $3, now() + make_interval(mins => $4::int))`,
    [utenteId, tipo, impronta(codice), DURATA_MINUTI[tipo]]
  );
  return codice;
}

// Usa il codice: se è giusto, del tipo giusto, non scaduto e non usato, lo segna come usato e restituisce l'id
// dell'utente; altrimenti null. UPDATE … RETURNING fa controllo e consumo in un colpo solo: due clic veloci
// sullo stesso link non possono usarlo due volte.
export async function usa(codice, tipo) {
  if (typeof codice !== "string" || codice.length < 20 || codice.length > 100) return null;
  const { rows } = await query(
    `UPDATE token_email SET usato_il = now()
     WHERE hash = $1 AND tipo = $2 AND usato_il IS NULL AND scade_il > now()
     RETURNING utente_id`,
    [impronta(codice), tipo]
  );
  return rows[0]?.utente_id ?? null;
}
