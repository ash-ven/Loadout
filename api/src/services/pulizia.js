// api/src/services/pulizia.js
// 4/11 (privacy, punto 6): non teniamo i dati più del necessario (GDPR, art. 5.1.e: "limitazione della conservazione").
// Una volta al giorno il server cancella:
//   1. i link mandati per email (token_email) scaduti o già usati da più di GIORNI giorni: non servono più a niente;
//   2. gli account MAI CONFERMATI creati da più di GIORNI giorni. Senza conferma non si può entrare, quindi non hanno
//      armadio né viaggi; per sicurezza lo controlliamo lo stesso (NOT EXISTS). Così un indirizzo scritto male, o di
//      qualcun altro, non resta nel database per sempre, e chi è il vero proprietario può registrarsi.
// L'informativa (public/privacy.html, «Per quanto tempo») dice gli stessi 7 giorni: se cambi il numero, cambia anche lei.
import { query } from "../db.js";
import { componiEmail, inviaEmail } from "./email.js";

export const GIORNI = 7;
// 5/11 (scelta di Asiha): account in cui non si entra da 24 mesi → cancellati, con un'email di avviso a 23 mesi.
// Si cancella solo se l'avviso è partito da almeno 30 giorni (chi rientra azzera tutto: routes/auth.js, login).
// L'informativa (privacy.html, «Per quanto tempo») dice gli stessi 2 anni.
export const MESI_AVVISO = 23;
export const MESI_CANCELLAZIONE = 24;
const MAX_AVVISI = 100; // al massimo 100 email per giro: il piano gratuito di Brevo ne permette 300 al giorno
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
  const inattivi = await pulisciInattivi();
  return { token: token.rowCount, account: account.rowCount, ...inattivi };
}

// Gli account inattivi: prima l'avviso per email, poi (almeno 30 giorni dopo) la cancellazione
export async function pulisciInattivi() {
  const cancellati = await query(
    `DELETE FROM utente
     WHERE ultimo_accesso_il < now() - make_interval(months => $1)
       AND avviso_inattivita_il < now() - interval '30 days'`, [MESI_CANCELLAZIONE]);
  const { rows: daAvvisare } = await query(
    `SELECT id, email, nome FROM utente
     WHERE email_confermata_il IS NOT NULL
       AND ultimo_accesso_il < now() - make_interval(months => $1)
       AND avviso_inattivita_il IS NULL
     ORDER BY ultimo_accesso_il LIMIT $2`, [MESI_AVVISO, MAX_AVVISI]);
  const app = process.env.APP_URL || `http://localhost:${process.env.PORT ?? 3000}`;
  let avvisati = 0;
  for (const u of daAvvisare) {
    try {
      const { testo, html } = componiEmail({ nome: u.nome, titolo: "Il tuo account sta per essere cancellato", link: `${app}/login.html`,
        frase: "Non entri in Loadout da quasi due anni. Per non tenere i tuoi dati più del necessario, tra un mese cancelleremo l'account con armadio e viaggi.",
        pulsante: "Entra per tenerlo", nota: "Basta entrare una volta per tenere l'account. Se vuoi una copia dei tuoi dati, entra e usa «Scarica i miei dati» nel Profilo." });
      await inviaEmail({ a: u.email, oggetto: "Loadout: il tuo account sta per essere cancellato", testo, html });
      await query("UPDATE utente SET avviso_inattivita_il = now() WHERE id = $1", [u.id]);
      avvisati++;
    } catch (err) {
      console.error(`Avviso di inattività non inviato: ${err.message}`); // si riprova al giro dopo
    }
  }
  return { avvisati, inattivi: cancellati.rowCount };
}

// Parte all'avvio del server e poi ogni 24 ore. Su Render free il server si addormenta quando nessuno lo usa:
// allora la pulizia si fa a ogni risveglio, cioè al massimo una volta al giorno di uso. Per noi basta.
// Un errore (es. database non raggiungibile) si scrive nel log ma non ferma il server: ci riprova il giorno dopo.
export function avviaPulizia() {
  const giro = async () => {
    try {
      const { token, account, avvisati, inattivi } = await pulisci();
      if (token || account) console.log(`Pulizia: cancellati ${token} link scaduti e ${account} account mai confermati`);
      if (avvisati || inattivi) console.log(`Pulizia: ${avvisati} avvisi di inattività mandati, ${inattivi} account inattivi cancellati`);
    } catch (err) {
      console.error(`Pulizia non riuscita: ${err.message}`);
    }
  };
  giro();
  setInterval(giro, UN_GIORNO_MS).unref(); // unref: il timer da solo non tiene acceso il processo
}
