import { Router } from "express";
import * as percorsi from "../services/percorsi.js";

export const router = Router();

// === GET /api/percorso?punti=44.21,10.64;44.22,10.62 (C3: percorso lungo i sentieri) ===
// Da 2 a 10 punti "lat,lon" separati da ";": partenza, eventuali tappe, arrivo.
router.get("/", async (req, res, next) => {
  try {
    const punti = String(req.query.punti ?? "")
      .split(";")
      .filter(Boolean)
      .map((coppia) => coppia.split(",").map(Number));
    const validi = punti.every(([lat, lon, ...resto]) =>
      resto.length === 0 && Number.isFinite(lat) && Number.isFinite(lon) &&
      lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180);
    if (punti.length < 2 || punti.length > 10 || !validi) {
      return res.status(400).json({ error: "BAD_QUERY", message: "punti: da 2 a 10 coppie lat,lon separate da ;" });
    }
    res.json(await percorsi.calcola(punti));
  } catch (err) {
    if (err instanceof percorsi.NessunPercorso) {
      return res.status(404).json({ error: "NESSUN_PERCORSO", message: "Nessun sentiero trovato vicino a uno dei punti: prova a toccare più vicino a un sentiero" });
    }
    if (err.name === "TimeoutError" || err.name === "TypeError" || /BRouter/.test(err.message)) {
      console.error("BRouter non disponibile:", err.message);
      return res.status(502).json({ error: "SERVIZIO_PERCORSI", message: "Servizio dei percorsi non disponibile, riprova tra poco" });
    }
    next(err);
  }
});
