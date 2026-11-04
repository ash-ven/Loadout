// api/src/services/pulizia.js
// 4/11 (privacy, punto 6): non teniamo i dati più del necessario (GDPR, art. 5.1.e: "limitazione della conservazione").
// Una volta al giorno il server cancella:
//   1. i link mandati per email (token_email) scaduti o già usati da più di GIORNI giorni: non servono più a niente;
//   2. gli account MAI CONFERMATI creati da più di GIORNI giorni. Senza conferma non si può entrare, quindi non hanno
//      armadio né viaggi; per sicurezza lo controlliamo lo stesso (NOT EXISTS). Così un indirizzo scritto male, o di
//      qualcun altro, non resta nel database per sempre, e chi è il vero proprietario può registrarsi.
// L'informativa (public/privacy.html, «Per quanto tempo») dice gli stessi 7 giorni: se cambi il numero, cambia anche lei.
import { query } from "../db.js";

export const GIORNI = 7;
const UN_GIORNO_MS = 24 * 60 * 60 * 1000;

// Fa la pulizia una volta e dice quante righe ha cancellato (la usano anche i test)
export async function pulisci() {
  const token = await query(
    `DELETE FROM token_email
     WHERE COALESCE(usato_il, scade_il) < now() - make_interval(days => $1)`, [GIORNI]);
  // token_email degli account cancellati qui sotto se ne va da solo: è collegato con ON DELETE CASCADE
  const account = await query(
    `DELETE FROM utente u
     WHERE u.email_confermata_il IS NULL
       AND u.created_at < now() - make_interval(days => $1)
       AND NOT EXISTS (SELECT 1 FROM oggetto o WHERE o.utente_id = u.id)
       AND NOT EXISTS (SELECT 1 FROM viaggio v WHERE v.utente_id = u.id)`, [GIORNI]);
  return { token: token.rowCount, account: account.rowCount };
}

// Parte all'avvio del server e poi ogni 24 ore. Su Render free il server si addormenta quando nessuno lo usa:
// allora la pulizia si fa a ogni risveglio, cioè al massimo una volta al giorno di uso. Per noi basta.
// Un errore (es. database non raggiungibile) si scrive nel log ma non ferma il server: ci riprova il giorno dopo.
export function avviaPulizia() {
  const giro = async () => {
    try {
      const { token, account } = await pulisci();
      if (token || account) console.log(`Pulizia: cancellati ${token} link scaduti e ${account} account mai confermati`);
    } catch (err) {
      console.error(`Pulizia non riuscita: ${err.message}`);
    }
  };
  giro();
  setInterval(giro, UN_GIORNO_MS).unref(); // unref: il timer da solo non tiene acceso il processo
}
