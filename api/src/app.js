// api/src/app.js
import express from "express";
import { query } from "./db.js"; 
const app = express();
app.use(express.json());
app.get("/api/health", async (req, res) => {             // ② aggiunto async
  const { rows } = await query("SELECT 1 AS ok");        // ③ NUOVA: chiedo 1 al database
  res.json({
    status: "ok",
    time: new Date().toISOString(),
    db: rows[0].ok === 1,                                // ③ NUOVA voce: il DB ha risposto?
  });
});

export default app;
