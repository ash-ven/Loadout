import jwt from "jsonwebtoken";
import { query } from "../db.js";

// Il cookie con il token di login (JWT) dice chi sei. 4/11: in più controlliamo nel database che la sessione
// sia ancora buona: se la password è cambiata DOPO la creazione del token (reset da email, o cambio dal profilo
// su un altro dispositivo), il token vecchio non vale più. iat = "issued at", il momento della firma, in secondi.
export async function requireAuth(req, res, next) {
  const token = req.cookies?.token;
  if (!token) return res.status(401).json({ error: "UNAUTHENTICATED", message: "Effettua il login" });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ error: "INVALID_TOKEN", message: "Sessione non valida o scaduta, effettua di nuovo il login" });
  }
  try {
    const { rows } = await query("SELECT password_cambiata_il FROM utente WHERE id = $1", [req.user.sub]);
    const cambiata = rows[0]?.password_cambiata_il;
    // Math.floor: confrontiamo secondi con secondi (un token creato nello stesso secondo del cambio resta valido)
    if (!rows[0] || (cambiata && Math.floor(cambiata.getTime() / 1000) > req.user.iat)) {
      return res.status(401).json({ error: "SESSIONE_SCADUTA", message: "La password è cambiata: accedi di nuovo" });
    }
    next();
  } catch (err) { next(err); }
}
