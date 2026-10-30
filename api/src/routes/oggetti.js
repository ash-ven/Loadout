import { Router } from "express";
import * as svc from "../services/oggetti.js";
import { validate } from "../middleware/validate.js";

export const router = Router();

const CATEGORIE = ["abbigliamento", "attrezzatura", "cucina", "sicurezza", "igiene", "elettronica", "cibo", "altro"];
const ATTIVITA = ["escursione", "alpinismo", "ciaspolata", "ferrata"]; // escursione = anche trekking (unite venerdì)

const schemaOggetto = {
  nome:              { type: "string", required: true, maxLength: 120 },
  categoria:         { type: "string", required: true, enum: CATEGORIE },
  peso_g:            { type: "number", required: true, min: 1, integer: true },
  is_indispensabile: { type: "boolean" },
  is_preferito:      { type: "boolean" },
  codice_etichetta:  { type: "string", maxLength: 64 },
  note:              { type: "string", maxLength: 1000 },
  marchio:           { type: "string", maxLength: 80 },                         // B1
  caratteristiche:   { type: "string", maxLength: 500 },                        // B1
  quantita_posseduta:{ type: "number", integer: true, min: 1, max: 99 },        // B2
  attivita_adatte:   { type: "array", items: { enum: ATTIVITA } },               // C2: [] = tutte
};

// === GET /api/oggetti?q=&categoria=&limit=&offset= (lista) ===
router.get("/", async (req, res, next) => {
  try {
    const limit = Math.min(Number(req.query.limit ?? 50), 200);
    const offset = Number(req.query.offset ?? 0);
    const categoria = req.query.categoria ?? null;
    if (!Number.isInteger(limit) || limit < 1) {
      return res.status(400).json({ error: "BAD_QUERY", message: "limit deve essere un intero ≥ 1" });
    }
    if (!Number.isInteger(offset) || offset < 0) {
      return res.status(400).json({ error: "BAD_QUERY", message: "offset deve essere un intero ≥ 0" });
    }
    if (categoria !== null && !CATEGORIE.includes(categoria)) {
      return res.status(400).json({ error: "BAD_QUERY", message: `categoria deve essere uno tra: ${CATEGORIE.join(", ")}` });
    }
    res.json(await svc.list(req.user.sub, { q: req.query.q ?? "", categoria, limit, offset }));
  } catch (err) { next(err); }
});

// === GET /api/oggetti/:id (dettaglio) ===
router.get("/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: "BAD_ID", message: "id deve essere un intero positivo" });
    }
    const row = await svc.getById(req.user.sub, id);
    if (!row) return res.status(404).json({ error: "NOT_FOUND", message: `Oggetto ${id} non trovato` });
    res.json(row);
  } catch (err) { next(err); }
});

// === POST /api/oggetti (crea) ===
router.post("/", validate(schemaOggetto), async (req, res, next) => {
  try {
    const nuovo = await svc.create(req.user.sub, req.validated);
    res.status(201).json(nuovo);
  } catch (err) { next(err); }
});

// === PUT /api/oggetti/:id (modifica) ===
router.put("/:id", validate(schemaOggetto), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: "BAD_ID", message: "id deve essere un intero positivo" });
    }
    const row = await svc.update(req.user.sub, id, req.validated);
    if (!row) return res.status(404).json({ error: "NOT_FOUND", message: `Oggetto ${id} non trovato` });
    res.json(row);
  } catch (err) { next(err); }
});

// === DELETE /api/oggetti/:id (elimina) ===
router.delete("/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: "BAD_ID", message: "id deve essere un intero positivo" });
    }
    const ok = await svc.remove(req.user.sub, id);
    if (!ok) return res.status(404).json({ error: "NOT_FOUND", message: `Oggetto ${id} non trovato` });
    res.status(204).end();
  } catch (err) { next(err); }
});