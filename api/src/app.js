// api/src/app.js
import express from "express";
const app = express();
app.use(express.json());
// middleware: trasforma il body JSON in req.body
app.get("/api/health", (req, res) => {
res.json({ status: "ok", time: new Date().toISOString() });
});
export default app;
