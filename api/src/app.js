// api/src/app.js
import express from "express";
import { query } from "./db.js";
import { router as oggettiRouter } from "./routes/oggetti.js";
import { logger } from "./middleware/logger.js";                  // NUOVA
import { notFound, errorHandler } from "./middleware/errors.js";  // NUOVA

const app = express();
app.use(express.json()); // middleware: trasforma il body JSON in req.body
app.use(logger);                                                   // NUOVA: prima delle rotte

app.get("/api/health", async (req, res) => {
  const { rows } = await query("SELECT 1 AS ok");
  res.json({
    status: "ok",
    time: new Date().toISOString(),
    db: rows[0].ok === 1,
  });
});

app.use("/api/oggetti", oggettiRouter);

app.use(notFound);                                                 // NUOVA: dopo tutte le rotte
app.use(errorHandler);                                             // NUOVA: per ultimo

export default app;