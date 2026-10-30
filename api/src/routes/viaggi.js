import { Router } from "express";
import * as svc from "../services/viaggi.js";
import * as zaino from "../services/zaino.js";
import * as consigli from "../services/consigli.js";
import * as kit from "../services/kit.js";
import { validate } from "../middleware/validate.js";

export const router = Router();

const ATTIVITA = ["escursione", "alpinismo", "ciaspolata", "ferrata"]; // escursione = anche trekking (unite venerdì)
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
  luogo_partenza:{ type: "string", maxLength: 200 },   // B1: obbligatorio nel form; qui facoltativo (viaggi vecchi, richieste di prova)
  luogo_arrivo:  { type: "string", maxLength: 200 },
  quota_max_m:   { type: "number", integer: true, min: 0, max: 9000 }, // B3
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

// ===================== VIAGGI =====================

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
    const meteo = await consigli.meteo(v, await consigli.sensibilitaFreddo(req.user.sub));
    const tempMax = meteo.disponibile ? meteo.temp_max : null;
    const neve = consigli.rischioNeve(v.quota_max_m, v.data_partenza,
      meteo.disponibile ? (meteo.cima?.temp_min ?? meteo.temp_min) : null);
    const acqua = ore == null ? null : await consigli.acqua(v, ore, tempMax); // { persona_giorno, totale }

    res.json({
      ...v,
      peso,
      consigli: {
        distanza_linea_aria_km: consigli.distanzaLineaAria(v),
        ore_cammino_giorno: ore,
        fonte_ore: fonteOre,
        acqua_litri: acqua?.totale ?? null,                    // tutto il viaggio, tutto il gruppo
        acqua_persona_giorno: acqua?.persona_giorno ?? null,   // B4: il dato principale
        acqua_con_temperatura: tempMax != null,
        acqua_con_dislivello: v.dislivello_m != null,
        acqua_con_cucina: v.serve_cucina,
        sole,
        // B2: "parti entro le 9:25" (tramonto − ore di cammino − 1 ora di margine)
        ora_limite_partenza: sole.disponibile && ore != null ? consigli.oraLimitePartenza(sole.alba, sole.tramonto, ore) : null,
        meteo,
        // B3: neve e ghiaccio possibili sopra i 2000 m; bollettino valanghe per ciaspole, alpinismo o neve
        neve_ghiaccio: neve,
        bollettino_valanghe: neve || ["ciaspolata", "alpinismo"].includes(v.attivita),
        avviso_peso: await consigli.avvisoPeso(req.user.sub, peso.peso_totale_kg, v.pernotto),
      },
    });
  } catch (err) { next(err); }
});

// === POST /api/viaggi?genera=true (crea; con genera=true riempie anche lo zaino, in una transazione) ===
router.post("/", validate(schemaViaggio), async (req, res, next) => {
  try {
    const genera = req.query.genera;
    if (genera !== undefined && genera !== "true" && genera !== "false") {
      return res.status(400).json({ error: "BAD_QUERY", message: "genera deve essere true oppure false" });
    }
    const viaggio = genera === "true"
      ? await svc.createConZaino(req.user.sub, req.validated)
      : await svc.create(req.user.sub, req.validated);
    res.status(201).json(viaggio);
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
    res.json(await zaino.genera(req.user.sub, req.viaggio)); // B5: { aggiunti, base, dal_kit, esclusi }
  } catch (err) { next(err); }
});

// === GET /api/viaggi/:id/kit (B5: "Per questa uscita": per ogni voce, nello zaino / nell'armadio / manca) ===
router.get("/:id/kit", caricaViaggio, async (req, res, next) => {
  try {
    res.json(await kit.stato(req.user.sub, req.viaggio));
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

// --- Aggiungi / modifica / rimuovi ---
const schemaAggiungi = {
  oggetto_id: { type: "number", required: true, integer: true, min: 1 },
  quantita:   { type: "number", integer: true, min: 1, max: 99 },
};

const schemaModifica = {
  inserito:  { type: "boolean" },
  quantita:  { type: "number", integer: true, min: 1, max: 99 },
  indossato: { type: "boolean" }, // B3: lo porto addosso, non pesa nello zaino
};

// B2: la risposta quando chiedi più pezzi di quanti ne possiedi
function troppi(posseduti) {
  return {
    error: "QUANTITA_OLTRE_POSSEDUTI",
    message: posseduti === 1 ? "Nell'armadio ne hai solo uno" : `Nell'armadio ne hai solo ${posseduti}`,
  };
}

// legge :oggettoId dall'URL; null se non è un intero positivo
function leggiOggettoId(req) {
  const id = Number(req.params.oggettoId);
  return Number.isInteger(id) && id > 0 ? id : null;
}

// === POST /api/viaggi/:id/zaino (US5 CA3: aggiungi dall'armadio) ===
router.post("/:id/zaino", caricaViaggio, validate(schemaAggiungi), async (req, res, next) => {
  try {
    const { oggetto_id, quantita = 1 } = req.validated;
    // B2: non puoi metterne più di quanti ne possiedi
    const posseduti = await zaino.posseduti(req.user.sub, oggetto_id);
    if (posseduti == null) return res.status(404).json({ error: "NOT_FOUND", message: `Oggetto ${oggetto_id} non trovato` });
    if (quantita > posseduti) return res.status(400).json(troppi(posseduti));
    const riga = await zaino.aggiungi(req.user.sub, req.viaggio.id, oggetto_id, quantita);
    if (!riga) return res.status(404).json({ error: "NOT_FOUND", message: `Oggetto ${oggetto_id} non trovato` });
    res.status(201).json(riga);
  } catch (err) { next(err); }
});

// === PATCH /api/viaggi/:id/zaino/:oggettoId (checkbox "inserito", quantità e/o "indossato") ===
router.patch("/:id/zaino/:oggettoId", caricaViaggio, validate(schemaModifica), async (req, res, next) => {
  try {
    const oggettoId = leggiOggettoId(req);
    if (!oggettoId) return res.status(400).json({ error: "BAD_ID", message: "oggettoId deve essere un intero positivo" });
    if (Object.keys(req.validated).length === 0) {
      return res.status(400).json({ error: "VALIDATION_ERROR", message: "Indica almeno 'inserito', 'quantita' o 'indossato'" });
    }
    // Controlli sull'oggetto (il frontend aiuta, ma decide il server):
    // B3 si può indossare solo l'abbigliamento; B2 non più pezzi di quanti ne possiedi
    if (req.validated.indossato === true || req.validated.quantita !== undefined) {
      const info = await zaino.infoNelloZaino(req.viaggio.id, oggettoId);
      if (!info) return res.status(404).json({ error: "NOT_FOUND", message: `Oggetto ${oggettoId} non presente nello zaino` });
      if (req.validated.indossato === true && info.categoria !== "abbigliamento") {
        return res.status(400).json({ error: "NON_INDOSSABILE", message: "Si può indossare solo l'abbigliamento" });
      }
      if (req.validated.quantita > info.quantita_posseduta) return res.status(400).json(troppi(info.quantita_posseduta));
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