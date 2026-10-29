// === 1. IMPORT ===
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import cookieParser from "cookie-parser";
import { query } from "./db.js";
import { logger } from "./middleware/logger.js";
import { notFound, errorHandler } from "./middleware/errors.js";
import { requireAuth } from "./middleware/auth.js";
import { router as authRouter } from "./routes/auth.js";
import { router as oggettiRouter } from "./routes/oggetti.js";
import { router as viaggiRouter } from "./routes/viaggi.js";

// Cartella di questo file (api/src) e cartella del frontend (loadout/public)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cartellaPublic = path.join(__dirname, "../../public");

const app = express();

// === 2. MIDDLEWARE GLOBALI (preparano la richiesta, prima di tutte le rotte) ===
app.use(express.json({ limit: "300kb" })); // body JSON → req.body (300 kB: basta per la foto del profilo, già ridotta dal browser)
app.use(cookieParser());                  // header Cookie → req.cookies
app.use(logger);                          // stampa ogni richiesta nel terminale
app.use(express.static(cartellaPublic));  // file del frontend (HTML, CSS, JS)

// === 3. ROTTE ===
app.get("/api/health", async (req, res) => {
  const { rows } = await query("SELECT 1 AS ok");
  res.json({ status: "ok", time: new Date().toISOString(), db: rows[0].ok === 1 });
});
app.use("/api/auth", authRouter);                        // libera (login, register…)
app.use("/api/oggetti", requireAuth, oggettiRouter);     // protetta
app.use("/api/viaggi", requireAuth, viaggiRouter);       // protetta

// === 4. CHIUSURA (dopo tutte le rotte) ===
app.use(notFound);       // nessuna rotta ha risposto → 404
app.use(errorHandler);   // qualcuno ha chiamato next(err) → risposta d'errore

export default app;