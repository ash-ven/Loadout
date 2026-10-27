// api/src/middleware/errors.js

// Errore "con status": domani lo useremo per lanciare 400, 401, 404...
export class HttpError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

// Rotta inesistente → 404 in JSON (al posto della pagina HTML "Cannot GET")
export function notFound(req, res) {
  res.status(404).json({ error: "NOT_FOUND", message: `Rotta ${req.method} ${req.originalUrl} inesistente` });
}

// Gestore finale degli errori: 4 parametri, così Express lo riconosce come error handler
export function errorHandler(err, req, res, next) {
  // errori di Postgres: traduciamo i codici più comuni
  if (err.code === "23505") return res.status(409).json({ error: "DUPLICATE", message: "Valore già presente" });
  if (err.code === "23503") return res.status(422).json({ error: "FK_VIOLATION", message: "Riferimento a un record inesistente" });
  if (err.code === "23514") return res.status(422).json({ error: "CHECK_VIOLATION", message: err.message });
  if (err.code === "P0001") return res.status(422).json({ error: "DOMAIN_RULE", message: err.message }); // RAISE EXCEPTION
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.code, message: err.message });

  console.error(err); // log completo lato server
  res.status(500).json({ error: "INTERNAL", message: "Errore interno" }); // mai lo stack al client
}
