import { Router } from "express";
import * as percorsi from "../services/percorsi.js";

export const router = Router();

// === GET /api/percorso?punti=44.21,10.64;44.22,10.62 (mappe, fase 4: percorso lungo i sentieri) ===
// Da 2 a 30 punti "lat,lon" separati da ";": partenza, tappe, arrivo (per l'anello la partenza ripetuta in fondo).
// &profilo=sentieri (predefinito) oppure &profilo=breve (il percorso più corto).
// &attivita=ferrata|alpinismo (facoltativo): accetta anche i passaggi difficili (fino a T6), per non aggirare la ferrata.
router.get("/", async (req, res, next) => {
  try {
    const punti = String(req.query.punti ?? "")
      .split(";")
      .filter(Boolean)
      .map((coppia) => coppia.split(",").map(Number));
    const validi = punti.every(([lat, lon, ...resto]) =>
      resto.length === 0 && Number.isFinite(lat) && Number.isFinite(lon) &&
      lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180);
    if (punti.length < 2 || punti.length > 30 || !validi) {
      return res.status(400).json({ error: "BAD_QUERY", message: "punti: da 2 a 30 coppie lat,lon separate da ;" });
    }
    const profilo = req.query.profilo ?? "sentieri";
    if (!Object.hasOwn(percorsi.PROFILI, profilo)) {
      return res.status(400).json({ error: "BAD_QUERY", message: "profilo deve essere sentieri oppure breve" });
    }
    const attivita = req.query.attivita ?? null; // un valore sconosciuto non fa danni: vale come escursione
    res.json(await percorsi.calcola(punti, profilo, attivita));
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
