import { Router } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { rateLimit } from "express-rate-limit";
import { query } from "../db.js";
import { validate } from "../middleware/validate.js";
import { HttpError } from "../middleware/errors.js";
import { requireAuth } from "../middleware/auth.js";
import * as codici from "../services/token-email.js";
import { componiEmail, inviaEmail } from "../services/email.js";

export const router = Router();

const COOKIE = { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 8 * 3600 * 1000 };

// === LIMITE DI TENTATIVI (contro chi prova tante password di fila: "forza bruta") ===
// Il server conta le richieste di ogni indirizzo IP in una "finestra" di 15 minuti.
// Superato il limite risponde 429 "Too Many Requests" fino alla fine della finestra.
const RISPOSTA_TROPPI = (minuti) => ({ error: "TOO_MANY_REQUESTS", message: `Troppi tentativi: riprova tra ${minuti} minuti` });

// Login: contano solo i tentativi SBAGLIATI (chi entra al primo colpo non consuma niente)
const limiteLogin = rateLimit({
  windowMs: 15 * 60 * 1000,      // finestra di 15 minuti
  limit: 10,                     // al massimo 10 tentativi sbagliati
  skipSuccessfulRequests: true,  // i login riusciti non contano
  standardHeaders: "draft-8",    // dice al client quanti tentativi restano (intestazione RateLimit)
  legacyHeaders: false,
  message: RISPOSTA_TROPPI(15),
});

// Registrazione: contano tutte (evita che qualcuno crei centinaia di account in automatico)
const limiteRegistrazione = rateLimit({
  windowMs: 60 * 60 * 1000,      // finestra di un'ora
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: RISPOSTA_TROPPI(60),
});

// 4/11: le richieste che mandano un'email (rimanda conferma, password dimenticata): poche per ora e per indirizzo IP,
// così nessuno può usare Loadout per riempire di email la casella di qualcun altro (né consumare le 300 al giorno di Brevo)
const limiteEmail = rateLimit({
  windowMs: 60 * 60 * 1000,      // un'ora
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: RISPOSTA_TROPPI(60),
});

// L'indirizzo dell'app per i link nelle email. Online viene da APP_URL (es. https://loadout-t4ju.onrender.com):
// NON dall'intestazione Host della richiesta, che chi chiama può falsificare per far puntare il link a un sito suo.
// Solo in sviluppo, senza APP_URL, usiamo l'indirizzo da cui è arrivata la richiesta (https://localhost).
function indirizzoApp(req) {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  if (process.env.NODE_ENV === "production") throw new Error("Manca APP_URL: serve per i link nelle email");
  return `${req.protocol}://${req.get("host")}`;
}

// L'email con il link di conferma. Un errore di Brevo non deve far fallire la registrazione:
// lo scriviamo nel log, e l'utente può farsi rimandare il link dalla pagina di accesso
async function mandaConferma(req, utente) {
  try {
    const codice = await codici.crea(utente.id, "conferma");
    const link = `${indirizzoApp(req)}/conferma-email.html?codice=${codice}`;
    const { testo, html } = componiEmail({ nome: utente.nome, titolo: "Conferma la tua email", link,
      frase: "Grazie per l'iscrizione a Loadout. Per attivare l'account conferma che questo indirizzo è tuo.",
      pulsante: "Conferma l'email", nota: "Il link vale 24 ore. Se l'iscrizione non l'hai fatta tu, ignora questa email." });
    await inviaEmail({ a: utente.email, oggetto: "Conferma la tua email per Loadout", testo, html });
  } catch (err) {
    console.error("Email di conferma non inviata:", err.message);
  }
}

// 5/11 (sicurezza): ci si registra con un'email che ha già un account confermato. Al sito rispondiamo come sempre
// (così nessuno scopre chi usa Loadout), e a quell'indirizzo arriva un'email che lo dice
async function mandaGiaRegistrato(req, utente) {
  try {
    const { testo, html } = componiEmail({ nome: utente.nome, titolo: "Hai già un account", link: `${indirizzoApp(req)}/login.html`,
      frase: "Qualcuno, forse tu, ha provato a registrarsi a Loadout con questo indirizzo, ma un account c'è già.",
      pulsante: "Accedi", nota: "Se non ricordi la password usa «Password dimenticata?» nella pagina di accesso. Se non l'hai fatto tu, ignora questa email." });
    await inviaEmail({ a: utente.email, oggetto: "Hai già un account su Loadout", testo, html });
  } catch (err) {
    console.error("Email «hai già un account» non inviata:", err.message);
  }
}

// === POST /api/auth/register ===
// 4/11: l'account nasce NON confermato e non si può usare finché non clicchi il link nell'email (scelta di Asiha)
const schemaRegister = {
  email:    { etichetta: "l'email", type: "string", required: true, maxLength: 255 },
  password: { etichetta: "la password", type: "string", required: true },
  nome:     { etichetta: "lo username", type: "string", required: true, maxLength: 100 },
};

router.post("/register", limiteRegistrazione, validate(schemaRegister), async (req, res, next) => {
  try {
    const { email, password, nome } = req.validated;
    if (password.length < 8) throw new HttpError(400, "WEAK_PASSWORD", "Password di almeno 8 caratteri");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, "BAD_EMAIL", "Indirizzo email non valido");
    const hash = await bcrypt.hash(password, 12); // sempre, anche se l'email esiste: stessi tempi di risposta
    // 5/11 (sicurezza): la risposta è IDENTICA che l'email sia nuova o già registrata (prima: 409 «già presente»,
    // e chiunque poteva scoprire se una persona usa Loadout). Cosa succede davvero lo sa solo chi legge quella casella:
    //  - email nuova → account nuovo + email di conferma
    //  - account non ancora confermato → valgono username e password di QUESTA registrazione + nuova email di conferma
    //    (solo chi legge la casella può confermare: chi si era registrato con l'email di un altro non entra)
    //  - account confermato → nessuna modifica, email «hai già un account»
    const { rows } = await query(
      `INSERT INTO utente (email, password_hash, nome) VALUES ($1, $2, $3)
       ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, nome = EXCLUDED.nome
         WHERE utente.email_confermata_il IS NULL
       RETURNING id, email, nome`,
      [email.toLowerCase(), hash, nome]
    );
    if (rows[0]) {
      await mandaConferma(req, rows[0]);
    } else {
      const { rows: gia } = await query("SELECT id, email, nome FROM utente WHERE email = $1", [email.toLowerCase()]);
      if (gia[0]) await mandaGiaRegistrato(req, gia[0]);
    }
    res.status(201).json({ email: email.toLowerCase(), conferma_necessaria: true });
  } catch (err) { next(err); }
});

// === POST /api/auth/login ===
const schemaLogin = {
  email:    { etichetta: "l'email", type: "string", required: true },
  password: { etichetta: "la password", type: "string", required: true },
};

router.post("/login", limiteLogin, validate(schemaLogin), async (req, res, next) => {
  try {
    const { email, password } = req.validated;
    const { rows } = await query("SELECT * FROM utente WHERE email = $1", [email.toLowerCase()]);
    const user = rows[0];

    // stesso messaggio per email inesistente e password sbagliata: non riveliamo quale dei due
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      throw new HttpError(401, "BAD_CREDENTIALS", "Email o password errati");
    }
    // 4/11: password giusta ma email non ancora confermata: niente accesso. Lo diciamo solo DOPO aver controllato
    // la password, così non si scopre quali email sono iscritte
    if (!user.email_confermata_il) {
      throw new HttpError(403, "EMAIL_NON_CONFERMATA", "Conferma la tua email: apri il link che ti abbiamo mandato");
    }

    // 5/11 (privacy): solo la data dell'ultimo accesso, che si sovrascrive (niente IP, niente storico).
    // Serve a cancellare gli account inattivi da 2 anni (services/pulizia.js); azzera anche un eventuale avviso già mandato
    await query("UPDATE utente SET ultimo_accesso_il = now(), avviso_inattivita_il = NULL WHERE id = $1", [user.id]);
    const token = jwt.sign({ sub: user.id, nome: user.nome }, process.env.JWT_SECRET, { expiresIn: "8h" });
    res.cookie("token", token, COOKIE).json({ id: user.id, nome: user.nome });
  } catch (err) { next(err); }
});

// === POST /api/auth/logout ===
router.post("/logout", (req, res) => {
  // Per cancellare un cookie il browser vuole le STESSE opzioni con cui è stato creato (Secure, SameSite, HttpOnly):
  // togliamo solo maxAge, che clearCookie sostituisce con una scadenza nel passato
  const { maxAge, ...opzioni } = COOKIE;
  res.clearCookie("token", opzioni).status(204).end();
});

// =====================================================================
//  4/11: CONFERMA DELL'EMAIL E «PASSWORD DIMENTICATA»
//  I link nelle email aprono una PAGINA (conferma-email.html, nuova-password.html) e la pagina chiama queste rotte
//  con POST. Perché non direttamente un GET? Alcuni programmi di posta e antivirus "aprono" i link delle email
//  per controllarli: con un GET userebbero il codice al posto tuo, prima ancora che tu lo clicchi.
// =====================================================================
const RISPOSTA_GENERICA = { message: "Se l'indirizzo è registrato, ti abbiamo mandato un'email. Controlla anche lo spam." };
const schemaSoloEmail = { email: { etichetta: "l'email", type: "string", required: true, maxLength: 255 } };

// === POST /api/auth/conferma { codice } → email confermata e accesso fatto ===
router.post("/conferma", limiteLogin, validate({ codice: { etichetta: "il codice", type: "string", required: true, maxLength: 100 } }),
  async (req, res, next) => {
    try {
      const utenteId = await codici.usa(req.validated.codice, "conferma");
      if (!utenteId) throw new HttpError(400, "LINK_NON_VALIDO", "Il link non è valido o è scaduto: accedi e chiedine uno nuovo");
      const { rows } = await query(
        "UPDATE utente SET email_confermata_il = COALESCE(email_confermata_il, now()), ultimo_accesso_il = now() WHERE id = $1 RETURNING id, nome",
        [utenteId]
      );
      // confermata: entri subito, senza riscrivere la password
      const token = jwt.sign({ sub: rows[0].id, nome: rows[0].nome }, process.env.JWT_SECRET, { expiresIn: "8h" });
      res.cookie("token", token, COOKIE).json({ id: rows[0].id, nome: rows[0].nome });
    } catch (err) { next(err); }
  });

// === POST /api/auth/rimanda-conferma { email } → un nuovo link (risposta sempre uguale) ===
router.post("/rimanda-conferma", limiteEmail, validate(schemaSoloEmail), async (req, res, next) => {
  try {
    const { rows } = await query("SELECT id, email, nome, email_confermata_il FROM utente WHERE email = $1", [req.validated.email.toLowerCase()]);
    if (rows[0] && !rows[0].email_confermata_il) await mandaConferma(req, rows[0]);
    res.json(RISPOSTA_GENERICA); // uguale anche se l'email non esiste: non riveliamo chi è iscritto
  } catch (err) { next(err); }
});

// === POST /api/auth/password-dimenticata { email } → email con il link per sceglierne una nuova ===
router.post("/password-dimenticata", limiteEmail, validate(schemaSoloEmail), async (req, res, next) => {
  try {
    const { rows } = await query("SELECT id, email, nome FROM utente WHERE email = $1", [req.validated.email.toLowerCase()]);
    if (rows[0]) {
      try {
        const codice = await codici.crea(rows[0].id, "reset");
        const link = `${indirizzoApp(req)}/nuova-password.html?codice=${codice}`;
        const { testo, html } = componiEmail({ nome: rows[0].nome, titolo: "Scegli una nuova password", link,
          frase: "Hai chiesto di cambiare la password di Loadout. Scegline una nuova dal pulsante qui sotto.",
          pulsante: "Scegli la nuova password", nota: "Il link vale 1 ora e si usa una volta sola. Se non l'hai chiesto tu, ignora questa email: la password resta quella di prima." });
        await inviaEmail({ a: rows[0].email, oggetto: "La tua nuova password per Loadout", testo, html });
      } catch (err) {
        console.error("Email per la nuova password non inviata:", err.message);
      }
    }
    res.json(RISPOSTA_GENERICA);
  } catch (err) { next(err); }
});

// === POST /api/auth/nuova-password { codice, password } ===
// La password cambia, le sessioni aperte con quella vecchia non valgono più (password_cambiata_il), e l'email
// risulta confermata (il link è arrivato in quella casella). Poi si accede con la password nuova.
router.post("/nuova-password", limiteLogin,
  validate({ codice: { etichetta: "il codice", type: "string", required: true, maxLength: 100 },
             password: { etichetta: "la password", type: "string", required: true, maxLength: 200 } }),
  async (req, res, next) => {
    try {
      const { codice, password } = req.validated;
      if (password.length < 8) throw new HttpError(400, "WEAK_PASSWORD", "Password di almeno 8 caratteri");
      const utenteId = await codici.usa(codice, "reset");
      if (!utenteId) throw new HttpError(400, "LINK_NON_VALIDO", "Il link non è valido o è scaduto: chiedine uno nuovo");
      await query(
        `UPDATE utente SET password_hash = $1, password_cambiata_il = now(), email_confermata_il = COALESCE(email_confermata_il, now())
         WHERE id = $2`,
        [await bcrypt.hash(password, 12), utenteId]
      );
      res.status(204).end();
    } catch (err) { next(err); }
  });

// Le colonne del profilo che restituiamo (mai il password_hash; la foto ha un indirizzo suo)
const CAMPI_PROFILO = `id, email, nome, peso_corporeo_kg,
                       emergenza_nome, emergenza_telefono, tessera_soccorso,
                       sensibilita_freddo, (foto IS NOT NULL) AS ha_foto`;

// === GET /api/auth/me (dati aggiornati dal database) ===
router.get("/me", requireAuth, async (req, res, next) => {
  try {
    const { rows } = await query(`SELECT ${CAMPI_PROFILO} FROM utente WHERE id = $1`, [req.user.sub]);
    if (!rows[0]) throw new HttpError(401, "UNAUTHENTICATED", "Effettua il login"); // utente cancellato nel frattempo
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// === PATCH /api/auth/me (modifica parziale del profilo: solo i campi inviati) ===
// "" o null su un campo nullable = svuotalo (es. togliere la foto o il contatto di emergenza)
const schemaProfilo = {
  nome:               { etichetta: "lo username", type: "string", maxLength: 100 },                            // 4/11: modificabile dal Profilo
  peso_corporeo_kg:   { etichetta: "il peso corporeo", type: "number", min: 20, max: 300, nullable: true },     // stretch 5
  emergenza_nome:     { etichetta: "il nome del contatto di emergenza", type: "string", maxLength: 100, nullable: true },
  emergenza_telefono: { etichetta: "il telefono del contatto di emergenza", type: "string", maxLength: 30, nullable: true },
  tessera_soccorso:   { etichetta: "la tessera", type: "string", maxLength: 80, nullable: true },
  sensibilita_freddo: { etichetta: "la sensibilità al freddo", type: "string", enum: ["alta", "normale", "bassa"], nullable: true },
  foto:               { etichetta: "la foto", type: "string", maxLength: 200000, nullable: true },
};

// 5/11 (scelta di Asiha): tolte le note mediche e il loro consenso. Erano gli unici dati sulla salute (GDPR, art. 9):
// senza, Loadout non tratta categorie particolari di dati (migrazione loadout_stretch_senza_note_mediche.sql)

router.patch("/me", requireAuth, validate(schemaProfilo), async (req, res, next) => {
  try {
    const dati = req.validated;
    const nomi = Object.keys(dati); // solo nomi presi dallo schema qui sopra: è sicuro metterli nella query
    if (nomi.length === 0) throw new HttpError(400, "VALIDATION_ERROR", "Nessun campo da modificare");
    if (dati.emergenza_telefono && !/^\+?[0-9 ]{6,20}$/.test(dati.emergenza_telefono)) {
      throw new HttpError(400, "BAD_TELEFONO", "Numero di telefono non valido (solo cifre, spazi e un + iniziale)");
    }
    if (dati.foto && !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(dati.foto)) {
      throw new HttpError(400, "BAD_FOTO", "La foto deve essere un'immagine JPEG, PNG o WebP");
    }
    // SET peso_corporeo_kg = $1, tessera_soccorso = $2, ...  (i VALORI restano parametri $n, mai dentro la stringa)
    const set = nomi.map((nome, i) => `${nome} = $${i + 1}`).join(", ");
    const { rows } = await query(
      `UPDATE utente SET ${set} WHERE id = $${nomi.length + 1} RETURNING ${CAMPI_PROFILO}`,
      [...nomi.map((nome) => dati[nome]), req.user.sub]
    );
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// === GET /api/auth/me/foto (la foto come immagine vera: si usa direttamente in <img src>) ===
router.get("/me/foto", requireAuth, async (req, res, next) => {
  try {
    const { rows } = await query("SELECT foto FROM utente WHERE id = $1", [req.user.sub]);
    const foto = rows[0]?.foto;
    if (!foto) return res.status(404).json({ error: "NOT_FOUND", message: "Nessuna foto" });
    // "data:image/jpeg;base64,AAAA" → tipo "image/jpeg" + i byte decodificati dal base64
    const [, tipo, base64] = foto.match(/^data:(image\/[a-z]+);base64,(.*)$/);
    res.set("Cache-Control", "private, no-cache").type(tipo).send(Buffer.from(base64, "base64"));
  } catch (err) { next(err); }
});

// =====================================================================
//  B7: ACCOUNT E PRIVACY (GDPR): cambio password, scarica i miei dati, elimina account
// =====================================================================

// === PUT /api/auth/me/password — cambia la password (serve quella attuale) ===
// Stesso limite di tentativi del login: chi ha rubato il cookie non può provare mille password "attuali"
const schemaPassword = {
  attuale: { etichetta: "la password attuale", type: "string", required: true },
  nuova:   { etichetta: "la nuova password", type: "string", required: true },
};
router.put("/me/password", requireAuth, limiteLogin, validate(schemaPassword), async (req, res, next) => {
  try {
    const { attuale, nuova } = req.validated;
    if (nuova.length < 8) throw new HttpError(400, "WEAK_PASSWORD", "La nuova password deve avere almeno 8 caratteri");
    if (nuova === attuale) throw new HttpError(400, "SAME_PASSWORD", "La nuova password deve essere diversa da quella attuale");
    const { rows } = await query("SELECT password_hash FROM utente WHERE id = $1", [req.user.sub]);
    if (!rows[0] || !(await bcrypt.compare(attuale, rows[0].password_hash))) {
      throw new HttpError(403, "WRONG_PASSWORD", "La password attuale non è corretta"); // 403, non 401: sei loggata, ma la conferma è sbagliata
    }
    // 4/11: password_cambiata_il = adesso → le sessioni aperte altrove (altri dispositivi) non valgono più.
    // Questa sessione invece continua: le diamo un cookie nuovo
    await query("UPDATE utente SET password_hash = $1, password_cambiata_il = now() WHERE id = $2", [await bcrypt.hash(nuova, 12), req.user.sub]);
    const token = jwt.sign({ sub: req.user.sub, nome: req.user.nome }, process.env.JWT_SECRET, { expiresIn: "8h" });
    res.cookie("token", token, COOKIE).status(204).end();
  } catch (err) { next(err); }
});

// === GET /api/auth/me/dati — tutti i miei dati in un file JSON (diritto di accesso e portabilità) ===
router.get("/me/dati", requireAuth, async (req, res, next) => {
  try {
    const id = req.user.sub;
    const profilo = (await query(
      `SELECT email, nome, peso_corporeo_kg, emergenza_nome, emergenza_telefono,
              tessera_soccorso, sensibilita_freddo, foto FROM utente WHERE id = $1`, [id])).rows[0];
    const oggetti = (await query("SELECT * FROM oggetto WHERE utente_id = $1 ORDER BY categoria, nome", [id])).rows;
    const viaggi = (await query("SELECT * FROM viaggio WHERE utente_id = $1 ORDER BY data_partenza NULLS LAST, id", [id])).rows;
    const zaini = (await query(
      `SELECT vo.viaggio_id, o.nome, vo.quantita, vo.inserito, vo.indossato
       FROM viaggio_oggetto vo JOIN viaggio v ON v.id = vo.viaggio_id JOIN oggetto o ON o.id = vo.oggetto_id
       WHERE v.utente_id = $1 ORDER BY o.nome`, [id])).rows;
    const dati = {
      esportato_il: new Date().toISOString(),
      profilo,
      oggetti,
      viaggi: viaggi.map((v) => ({ ...v, zaino: zaini.filter((z) => z.viaggio_id === v.id) })),
    };
    // "attachment": il browser lo scarica come file invece di mostrarlo
    res.set("Content-Disposition", 'attachment; filename="loadout-i-miei-dati.json"').json(dati);
  } catch (err) { next(err); }
});

// === DELETE /api/auth/me — elimina l'account e TUTTI i suoi dati (serve la password) ===
// Oggetti, viaggi e zaini spariscono da soli: nel database sono collegati con ON DELETE CASCADE
const schemaElimina = { password: { etichetta: "la password", type: "string", required: true } };
router.delete("/me", requireAuth, limiteLogin, validate(schemaElimina), async (req, res, next) => {
  try {
    const { rows } = await query("SELECT password_hash FROM utente WHERE id = $1", [req.user.sub]);
    if (!rows[0] || !(await bcrypt.compare(req.validated.password, rows[0].password_hash))) {
      throw new HttpError(403, "WRONG_PASSWORD", "Password non corretta");
    }
    await query("DELETE FROM utente WHERE id = $1", [req.user.sub]);
    res.clearCookie("token").status(204).end(); // e il cookie di login non serve più
  } catch (err) { next(err); }
});

