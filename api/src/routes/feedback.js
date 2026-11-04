// =====================================================================
//  FEEDBACK (4/11): «Dicci cosa ne pensi», dalla scheda del Profilo.
//  Il messaggio arriva per email all'indirizzo di assistenza (scelta di Asiha: solo email, niente database).
//  Chi scrive può scegliere di restare anonimo: allora nell'email non mettiamo né nome né indirizzo
//  (e niente «Rispondi a»). Altrimenti «Rispondi a» è il suo indirizzo: rispondi dal Gmail e la risposta va a lui o lei.
// =====================================================================
import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { query } from "../db.js";
import { validate } from "../middleware/validate.js";
import { HttpError } from "../middleware/errors.js";
import { inviaEmail, indirizzoAssistenza } from "../services/email.js";

export const router = Router();

// Al massimo 5 messaggi all'ora: abbastanza per chi scrive davvero, troppo pochi per riempire la casella
const limiteFeedback = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "TOO_MANY_REQUESTS", message: "Hai già mandato diversi messaggi: riprova tra un'ora" },
});

const schemaFeedback = {
  messaggio: { etichetta: "il messaggio", type: "string", required: true, maxLength: 2000 },
  anonimo:   { etichetta: "«anonimo»", type: "boolean" },
};

// === POST /api/feedback { messaggio, anonimo } ===
router.post("/", limiteFeedback, validate(schemaFeedback), async (req, res, next) => {
  try {
    const { messaggio, anonimo = false } = req.validated;
    if (messaggio.length < 3) throw new HttpError(400, "MESSAGGIO_VUOTO", "Scrivi qualcosa prima di inviare");
    const a = indirizzoAssistenza();
    if (!a) throw new HttpError(503, "FEEDBACK_NON_DISPONIBILE", "I messaggi non sono attivi in questo momento");

    let chi = "Messaggio anonimo";
    let rispondiA;
    if (!anonimo) {
      const { rows } = await query("SELECT nome, email FROM utente WHERE id = $1", [req.user.sub]);
      chi = `Da: ${rows[0].nome} <${rows[0].email}>`;
      rispondiA = rows[0].email;
    }
    const testo = `${chi}\n\n${messaggio}\n\n— Inviato dal Profilo di Loadout`;
    try {
      await inviaEmail({ a, oggetto: `Feedback da Loadout${anonimo ? "" : ` · ${chi.slice(4, 60)}`}`, testo, rispondiA });
    } catch (err) {
      console.error("Feedback non inviato:", err.message);
      throw new HttpError(502, "INVIO_NON_RIUSCITO", "Non sono riuscito a mandare il messaggio: riprova più tardi");
    }
    res.status(204).end();
  } catch (err) { next(err); }
});
