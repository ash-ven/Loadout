// api/src/routes/oggetti.js
import { Router } from "express";
import * as svc from "../services/oggetti.js";

export const router = Router();

// GET /api/oggetti?q=&limit=&offset=  → lista
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

// GET /api/oggetti/:id  → dettaglio
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
});