import { Router } from "express";
import * as svc from "../services/viaggi.js";
import * as zaino from "../services/zaino.js";
import { validate } from "../middleware/validate.js";

export const router = Router();

const ATTIVITA = ["escursione", "trekking", "alpinismo", "ciaspolata", "ferrata"];
const PERNOTTO = ["nessuno", "rifugio", "tenda", "bivacco"];

const schemaViaggio = {
  nome:          { type: "string", required: true, maxLength: 150 },
  attivita:      { type: "string", required: true, enum: ATTIVITA },
  n_persone:     { type: "number", integer: true, min: 1, max: 50 },
  n_giorni:      { type: "number", integer: true, min: 1, max: 60 },
  pernotto:      { type: "string", enum: PERNOTTO },
  serve_cucina:  { type: "boolean" },
  data_partenza: { type: "date" },
  lat_partenza:  { type: "number", min: -90,  max: 90 },
  lon_partenza:  { type: "number", min: -180, max: 180 },
  lat_arrivo:    { type: "number", min: -90,  max: 90 },
  lon_arrivo:    { type: "number", min: -180, max: 180 },
  dislivello_m:  { type: "number", integer: true, min: 0, max: 9000 },
  note:          { type: "string", maxLength: 1000 },
  pianificato:   { type: "boolean" },
};

// === Middleware "guardiano": il viaggio :id esiste ed è mio? ===
async function caricaViaggio(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: "BAD_ID", message: "id deve essere un intero positivo" });
    }
    const viaggio = await svc.getById(req.user.sub, id);
    if (!viaggio) return res.status(404).json({ error: "NOT_FOUND", message: `Viaggio ${id} non trovato` });
    req.viaggio = viaggio;
    next();
  } catch (err) { next(err); }
}

// === GET /api/viaggi (lista) ===
router.get("/", async (req, res, next) => {
  try {
    res.json(await svc.list(req.user.sub));
  } catch (err) { next(err); }
});

// === GET /api/viaggi/:id (dettaglio) ===
router.get("/:id", caricaViaggio, (req, res) => {
  res.json(req.viaggio);
});

// === POST /api/viaggi (crea) ===
router.post("/", validate(schemaViaggio), async (req, res, next) => {
  try {
    res.status(201).json(await svc.create(req.user.sub, req.validated));
  } catch (err) { next(err); }
});

// === PUT /api/viaggi/:id (modifica) ===
router.put("/:id", validate(schemaViaggio), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: "BAD_ID", message: "id deve essere un intero positivo" });
    }
    const viaggio = await svc.update(req.user.sub, id, req.validated);
    if (!viaggio) return res.status(404).json({ error: "NOT_FOUND", message: `Viaggio ${id} non trovato` });
    res.json(viaggio);
  } catch (err) { next(err); }
});

// === DELETE /api/viaggi/:id (elimina) ===
router.delete("/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: "BAD_ID", message: "id deve essere un intero positivo" });
    }
    const ok = await svc.remove(req.user.sub, id);
    if (!ok) return res.status(404).json({ error: "NOT_FOUND", message: `Viaggio ${id} non trovato` });
    res.status(204).end();
  } catch (err) { next(err); }
});

// ===================== ZAINO =====================

// === POST /api/viaggi/:id/genera (US4) ===
router.post("/:id/genera", caricaViaggio, async (req, res, next) => {
  try {
    const aggiunti = await zaino.genera(req.viaggio.id);
    res.json({ aggiunti });
  } catch (err) { next(err); }
});

// === GET /api/viaggi/:id/zaino (US5: checklist + peso) ===
router.get("/:id/zaino", caricaViaggio, async (req, res, next) => {
  try {
    const peso = await zaino.peso(req.viaggio.id);
    const oggetti = await zaino.dettaglio(req.viaggio.id);
    res.json({ peso, oggetti });
  } catch (err) { next(err); }
});