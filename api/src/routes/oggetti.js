import { Router } from "express";
import * as svc from "../services/oggetti.js";
import { validate } from "../middleware/validate.js";

export const router = Router();

const CATEGORIE = ["abbigliamento", "attrezzatura", "cucina", "sicurezza", "igiene", "elettronica", "cibo", "altro"];

const schemaOggetto = {
  nome:              { type: "string", required: true, maxLength: 120 },
  categoria:         { type: "string", required: true, enum: CATEGORIE },
  peso_g:            { type: "number", required: true, min: 1, integer: true },
  is_indispensabile: { type: "boolean" },
  is_preferito:      { type: "boolean" },
  codice_etichetta:  { type: "string", maxLength: 64 },
  note:              { type: "string", maxLength: 1000 },
};


router.get("/", async (req, res, next) => {
  try {
    const limit = Math.min(Number(req.query.limit ?? 50), 200);
    const offset = Number(req.query.offset ?? 0);
    if (!Number.isInteger(limit) || limit < 1) {
      return res.status(400).json({ error: "BAD_QUERY", message: "limit deve essere un intero ≥ 1" });
    }
    if (!Number.isInteger(offset) || offset < 0) {
      return res.status(400).json({ error: "BAD_QUERY", message: "offset deve essere un intero ≥ 0" });
    }
    res.json(await svc.list({ q: req.query.q ?? "", limit, offset }));
  } catch (err) { next(err); }
});

router.get("/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: "BAD_ID", message: "id deve essere un intero positivo" });
    }
    const row = await svc.getById(id);
    if (!row) return res.status(404).json({ error: "NOT_FOUND", message: `Oggetto ${id} non trovato` });
    res.json(row);
  } catch (err) { next(err); }
});                                  // ← qui finisce la rotta 2


router.post("/", validate(schemaOggetto), async (req, res, next) => {
  try {
    const nuovo = await svc.create(1, req.validated); // 1 = Asiha, finché non c'è il login
    res.status(201).json(nuovo);
  } catch (err) { next(err); }
});
