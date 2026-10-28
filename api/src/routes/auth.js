import { Router } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { query } from "../db.js";
import { validate } from "../middleware/validate.js";
import { HttpError } from "../middleware/errors.js";
import { requireAuth } from "../middleware/auth.js";

export const router = Router();

const COOKIE = { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 8 * 3600 * 1000 };

const schemaRegister = {
  email:    { type: "string", required: true, maxLength: 255 },
  password: { type: "string", required: true },
  nome:     { type: "string", required: true, maxLength: 100 },
};

// === POST /api/auth/register ===
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
const schemaLogin = {
  email:    { type: "string", required: true },
  password: { type: "string", required: true },
};

// === POST /api/auth/login ===
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

// === GET /api/auth/me ===
router.get("/me", requireAuth, (req, res) => {
  res.json(req.user);
});

// === PATCH /api/auth/me (stretch 5: imposta il proprio peso corporeo) ===
const schemaProfilo = {
  peso_corporeo_kg: { type: "number", required: true, min: 20, max: 300 },
};

router.patch("/me", requireAuth, validate(schemaProfilo), async (req, res, next) => {
  try {
    const { rows } = await query(
      "UPDATE utente SET peso_corporeo_kg = $1 WHERE id = $2 RETURNING id, email, nome, peso_corporeo_kg",
      [req.validated.peso_corporeo_kg, req.user.sub]
    );
    res.json(rows[0]);
  } catch (err) { next(err); }
});