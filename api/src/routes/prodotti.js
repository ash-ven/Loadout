import { Router } from "express";
import * as svc from "../services/prodotti.js";

export const router = Router();

// === GET /api/prodotti/:codice — cerca nome, marchio e peso di un codice a barre nelle banche dati esterne ===
// Accettiamo solo codici di 8–14 cifre (EAN-8, UPC-A, EAN-13, GTIN-14): niente altro finisce negli indirizzi esterni.
router.get("/:codice", async (req, res, next) => {
  try {
    const codice = req.params.codice.trim();
    if (!/^\d{8,14}$/.test(codice)) {
      return res.status(400).json({ error: "BAD_CODICE", message: "Il codice deve avere da 8 a 14 cifre" });
    }
    res.json(await svc.cerca(codice));
  } catch (err) { next(err); }
});
