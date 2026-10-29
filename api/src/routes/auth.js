import { Router } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { query } from "../db.js";
import { validate } from "../middleware/validate.js";
import { HttpError } from "../middleware/errors.js";
import { requireAuth } from "../middleware/auth.js";

export const router = Router();

const COOKIE = { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 8 * 3600 * 1000 };

// === POST /api/auth/register ===
const schemaRegister = {
  email:    { type: "string", required: true, maxLength: 255 },
  password: { type: "string", required: true },
  nome:     { type: "string", required: true, maxLength: 100 },
};

router.post("/register", validate(schemaRegister), async (req, res, next) => {
  try {
    const { email, password, nome } = req.validated;
    if (password.length < 8) throw new HttpError(400, "WEAK_PASSWORD", "Password di almeno 8 caratteri");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, "BAD_EMAIL", "Indirizzo email non valido");
    const hash = await bcrypt.hash(password, 12);
    const { rows } = await query(
      "INSERT INTO utente (email, password_hash, nome) VALUES ($1, $2, $3) RETURNING id, email, nome",
      [email.toLowerCase(), hash, nome]
    );
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

// === POST /api/auth/login ===
const schemaLogin = {
  email:    { type: "string", required: true },
  password: { type: "string", required: true },
};

router.post("/login", validate(schemaLogin), async (req, res, next) => {
  try {
    const { email, password } = req.validated;
    const { rows } = await query("SELECT * FROM utente WHERE email = $1", [email.toLowerCase()]);
    const user = rows[0];

    // stesso messaggio per email inesistente e password sbagliata: non riveliamo quale dei due
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      throw new HttpError(401, "BAD_CREDENTIALS", "Email o password errati");
    }

    const token = jwt.sign({ sub: user.id, nome: user.nome }, process.env.JWT_SECRET, { expiresIn: "8h" });
    res.cookie("token", token, COOKIE).json({ id: user.id, nome: user.nome });
  } catch (err) { next(err); }
});

// === POST /api/auth/logout ===
router.post("/logout", (req, res) => {
  res.clearCookie("token").status(204).end();
});

// Le colonne del profilo che restituiamo (mai il password_hash; la foto ha un indirizzo suo)
const CAMPI_PROFILO = `id, email, nome, peso_corporeo_kg, livello_esperienza, citta,
                       emergenza_nome, emergenza_telefono, (foto IS NOT NULL) AS ha_foto`;

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
  peso_corporeo_kg:   { type: "number", min: 20, max: 300, nullable: true },     // stretch 5
  livello_esperienza: { type: "string", enum: ["principiante", "intermedio", "esperto"], nullable: true }, // C1
  citta:              { type: "string", maxLength: 100, nullable: true },
  emergenza_nome:     { type: "string", maxLength: 100, nullable: true },
  emergenza_telefono: { type: "string", maxLength: 30, nullable: true },
  foto:               { type: "string", maxLength: 200000, nullable: true },
};

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
    // SET peso_corporeo_kg = $1, citta = $2, ...  (i VALORI restano parametri $n, mai dentro la stringa)
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