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
const schemaAggiungi = {
  oggetto_id: { type: "number", required: true, integer: true, min: 1 },
  quantita:   { type: "number", integer: true, min: 1, max: 99 },
};

const schemaModifica = {
  inserito: { type: "boolean" },
  quantita: { type: "number", integer: true, min: 1, max: 99 },
};

// legge :oggettoId dall'URL; null se non è un intero positivo
function leggiOggettoId(req) {
  const id = Number(req.params.oggettoId);
  return Number.isInteger(id) && id > 0 ? id : null;
}

// === POST /api/viaggi/:id/zaino (US5 CA3: aggiungi dall'armadio) ===
router.post("/:id/zaino", caricaViaggio, validate(schemaAggiungi), async (req, res, next) => {
  try {
    const { oggetto_id, quantita = 1 } = req.validated;
    const riga = await zaino.aggiungi(req.user.sub, req.viaggio.id, oggetto_id, quantita);
    if (!riga) return res.status(404).json({ error: "NOT_FOUND", message: `Oggetto ${oggetto_id} non trovato` });
    res.status(201).json(riga);
  } catch (err) { next(err); }
});

// === PATCH /api/viaggi/:id/zaino/:oggettoId (checkbox "inserito" e/o quantità) ===
router.patch("/:id/zaino/:oggettoId", caricaViaggio, validate(schemaModifica), async (req, res, next) => {
  try {
    const oggettoId = leggiOggettoId(req);
    if (!oggettoId) return res.status(400).json({ error: "BAD_ID", message: "oggettoId deve essere un intero positivo" });
    if (Object.keys(req.validated).length === 0) {
      return res.status(400).json({ error: "VALIDATION_ERROR", message: "Indica almeno 'inserito' o 'quantita'" });
    }
    const riga = await zaino.modifica(req.viaggio.id, oggettoId, req.validated);
    if (!riga) return res.status(404).json({ error: "NOT_FOUND", message: `Oggetto ${oggettoId} non presente nello zaino` });
    res.json(riga);
  } catch (err) { next(err); }
});

// === DELETE /api/viaggi/:id/zaino/:oggettoId (togli dallo zaino) ===
router.delete("/:id/zaino/:oggettoId", caricaViaggio, async (req, res, next) => {
  try {
    const oggettoId = leggiOggettoId(req);
    if (!oggettoId) return res.status(400).json({ error: "BAD_ID", message: "oggettoId deve essere un intero positivo" });
    const ok = await zaino.rimuovi(req.viaggio.id, oggettoId);
    if (!ok) return res.status(404).json({ error: "NOT_FOUND", message: `Oggetto ${oggettoId} non presente nello zaino` });
    res.status(204).end();
  } catch (err) { next(err); }
});

// === POST /api/viaggi/:id/zaino/svuota (US5 CA4: svuota la checklist) ===
router.post("/:id/zaino/svuota", caricaViaggio, async (req, res, next) => {
  try {
    const svuotati = await zaino.svuota(req.viaggio.id);
    res.json({ svuotati });
  } catch (err) { next(err); }
});