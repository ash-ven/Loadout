import { Router } from "express";

export const router = Router();

// === GET /api/mappe/config (mappe, fase 5) ===
// La chiave di MapTiler sta nel .env del server (MAPTILER_KEY), non nel repository.
// Arriva comunque al browser, perché le tessere della mappa le scarica lui da api.maptiler.com
// (le condizioni di MapTiler non permettono di farle passare dal nostro server): è una scelta consapevole.
// La rotta è protetta (requireAuth in app.js): la chiave la vede solo chi ha fatto il login.
router.get("/config", (req, res) => {
  const chiave = process.env.MAPTILER_KEY;
  if (!chiave) {
    return res.status(503).json({ error: "MAPPE_NON_CONFIGURATE", message: "Mappe non disponibili: manca MAPTILER_KEY nel file .env" });
  }
  res.json({ chiave });
});
