import { Router } from "express";
import * as svc from "../services/luoghi.js";
import { HttpError } from "../middleware/errors.js";

export const router = Router();

// === GET /api/luoghi?q=malga prato — suggerimenti di luoghi con le coordinate ===
router.get("/", async (req, res, next) => {
  try {
    const q = String(req.query.q ?? "").trim();
    if (q.length < 3 || q.length > 100) {
      return res.status(400).json({ error: "BAD_QUERY", message: "Scrivi da 3 a 100 caratteri" });
    }
    try {
      res.json(await svc.cerca(q));
    } catch (err) {
      console.error("Nominatim non disponibile:", err.message);
      throw new HttpError(502, "LUOGHI_NON_DISPONIBILI", "La ricerca dei luoghi non risponde: inserisci le coordinate a mano o riprova tra poco");
    }
  } catch (err) { next(err); }
});
