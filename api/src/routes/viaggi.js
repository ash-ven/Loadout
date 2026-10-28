import { Router } from "express";
import * as svc from "../services/viaggi.js";
import * as zaino from "../services/zaino.js";
import * as consigli from "../services/consigli.js";
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
  distanza_km:   { type: "number", min: 0.1, max: 999 },
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

// === GET /api/viaggi?pianificato=true|false (lista) ===
router.get("/", async (req, res, next) => {
  try {
    let pianificato = null;
    if (req.query.pianificato !== undefined) {
      if (req.query.pianificato !== "true" && req.query.pianificato !== "false") {
        return res.status(400).json({ error: "BAD_QUERY", message: "pianificato deve essere true oppure false" });
      }
      pianificato = req.query.pianificato === "true";
    }
    res.json(await svc.list(req.user.sub, { pianificato }));
  } catch (err) { next(err); }
});

// === GET /api/viaggi/:id?ore_cammino= (dettaglio + peso + consigli, US6 + stretch 1 e 5) ===
router.get("/:id", caricaViaggio, async (req, res, next) => {
  try {
    const v = req.viaggio;

    // Ore di cammino al giorno: quelle inserite dall'utente vincono sulla stima dal percorso
    let ore = consigli.oreStimate(v);
    let fonteOre = ore == null ? null : "percorso";
    if (req.query.ore_cammino !== undefined) {
      const o = Number(req.query.ore_cammino);
      if (Number.isNaN(o) || o < 0.5 || o > 16) {
        return res.status(400).json({ error: "BAD_QUERY", message: "ore_cammino deve essere un numero tra 0.5 e 16" });
      }
      ore = o;
      fonteOre = "utente";
    }

    const peso = await zaino.peso(v.id);
    const sole = await consigli.sole(v);
    const meteo = await consigli.meteo(v);
    const tempMax = meteo.disponibile ? meteo.temp_max : null;
    const acquaLitri = ore == null ? null : await consigli.acqua(v, ore, tempMax);

    res.json({
      ...v,
      peso,
      consigli: {
        distanza_linea_aria_km: consigli.distanzaLineaAria(v),
        ore_cammino_giorno: ore,
        fonte_ore: fonteOre,
        acqua_litri: acquaLitri,
        acqua_con_temperatura: tempMax != null,
        sole,
        meteo,
        avviso_peso: await consigli.avvisoPeso(req.user.sub, peso.peso_totale_kg),
      },
    });
  } catch (err) { next(err); }
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

//