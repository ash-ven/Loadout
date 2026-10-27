// api/src/app.js
import express from "express";
import { query } from "./db.js";
import { router as oggettiRouter } from "./routes/oggetti.js";   // ① NUOVA

const app = express();
app.use(express.json()); // middleware: trasforma il body JSON in req.body

app.get("/api/health", async (req, res) => {
  const { rows } = await query("SELECT 1 AS ok");
  res.json({
    status: "ok",
    time: new Date().toISOString(),
    db: rows[0].ok === 1,
  });
});

app.use("/api/oggetti", oggettiRouter);                           // ② NUOVA

export default app;