// === 1. IMPORT ===
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import cors from "cors";
import { query } from "./db.js";
import { logger } from "./middleware/logger.js";
import { notFound, errorHandler } from "./middleware/errors.js";
import { requireAuth } from "./middleware/auth.js";
import { router as authRouter } from "./routes/auth.js";
import { router as oggettiRouter } from "./routes/oggetti.js";
import { router as viaggiRouter } from "./routes/viaggi.js";
import { router as prodottiRouter } from "./routes/prodotti.js";
import { router as luoghiRouter } from "./routes/luoghi.js";
import { router as percorsiRouter } from "./routes/percorsi.js";
import { router as mappeRouter } from "./routes/mappe.js";
import { router as feedbackRouter } from "./routes/feedback.js";

// Cartella di questo file (api/src) e cartella del frontend (loadout/public)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cartellaPublic = path.join(__dirname, "../../public");

const app = express();

// Siamo dietro UN proxy (Caddy): l'indirizzo vero di chi visita arriva nell'intestazione X-Forwarded-For.
// Senza questa riga tutte le richieste sembrerebbero arrivare da Caddy, e il limite di tentativi
// sul login bloccherebbe tutti insieme invece della sola persona che sbaglia.
app.set("trust proxy", 1);

// === 2. MIDDLEWARE GLOBALI (preparano la richiesta, prima di tutte le rotte) ===

// Intestazioni di sicurezza su OGNI risposta (helmet). La più importante è la CSP
// (Content-Security-Policy): la lista di DA DOVE il browser può caricare script, stili, font, immagini.
// Tutto il resto viene bloccato, anche uno script infilato nella pagina da un attaccante (XSS).
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      "default-src": ["'self'"],                                   // di base: solo dal nostro sito
      // 4/11 (privacy): librerie (Leaflet, lettore di codici a barre) e caratteri sono in public/vendor e public/fonts,
      // quindi script, stili e font vengono SOLO dal nostro sito: il browser non contatta più unpkg né Google
      "script-src": ["'self'"],
      "style-src": ["'self'"],
      "font-src": ["'self'"],
      "img-src": ["'self'", "data:", "https://api.maptiler.com"],  // + "data:" (la foto ridotta nel browser) + le tessere della mappa
      "connect-src": ["'self'"],                                   // fetch() solo verso la nostra API
      "object-src": ["'none'"],                                    // niente plugin (Flash e simili)
      "frame-ancestors": ["'none'"],                               // nessun sito può mettere Loadout dentro un suo riquadro
      "upgrade-insecure-requests": null,                           // tolta: in sviluppo usiamo http://localhost:3000
    },
  },
  // HSTS ("usa sempre https per questo sito") lo lasciamo al proxy: su "localhost" bloccherebbe
  // anche http://localhost:3000, che ci serve per sviluppare con npm run dev
  strictTransportSecurity: false,
}));

// CORS: quali ALTRI siti possono chiamare la nostra API dal browser di un utente.
// Il frontend di Loadout sta sullo STESSO sito dell'API, quindi a lui CORS non serve.
// Di base (CORS_ORIGINS vuota) non permettiamo nessun altro sito: il browser applica la sua regola
// "stessa origine" e blocca gli altri. Se un giorno servisse (es. un'app su un altro dominio),
// basta elencarlo in CORS_ORIGINS, separato da virgole. Mai "*" insieme ai cookie di login.
const originiPermesse = (process.env.CORS_ORIGINS ?? "").split(",").map((o) => o.trim()).filter(Boolean);
app.use("/api", cors({
  origin: originiPermesse.length > 0 ? originiPermesse : false, // false = nessun altro sito
  credentials: true,                                            // per i siti elencati: anche il cookie di login
}));

app.use(express.json({ limit: "300kb" })); // body JSON → req.body (300 kB: basta per la foto del profilo, già ridotta dal browser)
app.use(cookieParser());                  // header Cookie → req.cookies
app.use(logger);                          // stampa ogni richiesta nel terminale
// Il service worker (public/sw.js, la mappa senza rete) scarica e salva le tessere di MapTiler:
// i fetch() del service worker seguono la CSP del SUO file, quindi solo per lui allarghiamo connect-src a MapTiler.
// Le pagine restano con connect-src 'self'. "no-cache" = il browser controlla sempre se c'è una versione nuova.
app.get("/sw.js", (req, res, next) => {
  res.setHeader("Content-Security-Policy", "default-src 'self'; connect-src 'self' https://api.maptiler.com");
  res.setHeader("Cache-Control", "no-cache");
  next();
});
app.use(express.static(cartellaPublic));  // file del frontend (HTML, CSS, JS)

// === 3. ROTTE ===
app.get("/api/health", async (req, res) => {
  const { rows } = await query("SELECT 1 AS ok");
  res.json({ status: "ok", time: new Date().toISOString(), db: rows[0].ok === 1 });
});
// 4/11: i contatti pubblici dell'app (l'indirizzo di assistenza), per le pagine di accesso e del profilo. Libera
app.get("/api/contatti", (req, res) => {
  res.json({ assistenza: process.env.EMAIL_ASSISTENZA || process.env.EMAIL_MITTENTE || null });
});
app.use("/api/auth", authRouter);                        // libera (login, register…)
app.use("/api/oggetti", requireAuth, oggettiRouter);     // protetta
app.use("/api/viaggi", requireAuth, viaggiRouter);       // protetta
app.use("/api/luoghi", requireAuth, luoghiRouter);       // protetta (B1: cerca un luogo per nome)
app.use("/api/prodotti", requireAuth, prodottiRouter);   // protetta (stretch 2: cerca il prodotto dal codice a barre)
app.use("/api/percorso", requireAuth, percorsiRouter);   // protetta (mappe: percorso sui sentieri con BRouter)
app.use("/api/mappe", requireAuth, mappeRouter);         // protetta (mappe: la chiave di MapTiler per le tessere)
app.use("/api/feedback", requireAuth, feedbackRouter);   // protetta (4/11: «Dicci cosa ne pensi» dal Profilo)

// === 4. CHIUSURA (dopo tutte le rotte) ===
app.use(notFound);       // nessuna rotta ha risposto → 404
app.use(errorHandler);   // qualcuno ha chiamato next(err) → risposta d'errore

export default app;