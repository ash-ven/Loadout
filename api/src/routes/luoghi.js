import { Router } from "express";
import * as svc from "../services/luoghi.js";

export const router = Router();

// === GET /api/luoghi/quote?punti=44.19,10.70;46.41,11.62 — le quote dei luoghi trovati (al massimo 10) ===
// 5/11: la ricerca per nome la fa il browser con MapTiler (public/js/cerca-luoghi.js); qui arrivano solo le coordinate
router.get("/quote", async (req, res, next) => {
  try {
    const punti = svc.leggiPunti(req.query.punti);
    if (!punti) return res.status(400).json({ error: "BAD_PUNTI", message: "Da 1 a 10 punti «lat,lon» separati da ;" });
    res.json({ quote: await svc.quote(punti) });
  } catch (err) { next(err); }
});
