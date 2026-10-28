// === 1. IMPORT ===
import express from "express";
import cookieParser from "cookie-parser";
import { query } from "./db.js";
import { logger } from "./middleware/logger.js";
import { notFound, errorHandler } from "./middleware/errors.js";
import { requireAuth } from "./middleware/auth.js";
import { router as authRouter } from "./routes/auth.js";
import { router as oggettiRouter } from "./routes/oggetti.js";

const app = express();

// === 2. MIDDLEWARE GLOBALI (preparano la richiesta, prima di tutte le rotte) ===
app.use(express.json());   // body JSON → req.body
app.use(cookieParser());   // header Cookie → req.cookies
app.use(logger);           // stampa ogni richiesta nel terminale

// === 3. ROTTE ===
app.get("/api/health", async (req, res) => {
  const { rows } = await query("SELECT 1 AS ok");
  res.json({ status: "ok", time: new Date().toISOString(), db: rows[0].ok === 1 });
});
app.use("/api/auth", authRouter);                        // libera (login, register…)
app.use("/api/oggetti", requireAuth, oggettiRouter);     // protetta

// === 4. CHIUSURA (dopo tutte le rotte) ===
app.use(notFound);       // nessuna rotta ha risposto → 404
app.use(errorHandler);   // qualcuno ha chiamato next(err) → risposta d'errore

export default app;