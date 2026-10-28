import jwt from "jsonwebtoken";

export function requireAuth(req, res, next) {
  const token = req.cookies?.token;
  if (!token) return res.status(401).json({ error: "UNAUTHENTICATED", message: "Effettua il login" });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: "INVALID_TOKEN", message: "Sessione non valida o scaduta, effettua di nuovo il login" });
  }
}