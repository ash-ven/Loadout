export class HttpError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function notFound(req, res) {
  res.status(404).json({ error: "NOT_FOUND", message: `Rotta ${req.method} ${req.originalUrl} inesistente` });
}

export function errorHandler(err, req, res, next) { // 4 parametri: Express lo riconosce come error handler
  // body JSON malformato (lo segnala express.json prima ancora di arrivare alle rotte)
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ error: "BAD_JSON", message: "Il body della richiesta non è un JSON valido" });
  }

  // errori di Postgres: traduciamo i codici più comuni
  if (err.code === "23505") return res.status(409).json({ error: "DUPLICATE", message: "Valore già presente" });
  if (err.code === "23503") return res.status(422).json({ error: "FK_VIOLATION", message: "Riferimento a un record inesistente" });
  if (err.code === "23514") return res.status(422).json({ error: "CHECK_VIOLATION", message: err.message });
  if (err.code === "P0001") return res.status(422).json({ error: "DOMAIN_RULE", message: err.message }); // RAISE EXCEPTION
  // valore che Postgres non sa interpretare (22P02) o fuori dall'intervallo del tipo (22003, es. id oltre i 2,1 miliardi)
  if (err.code === "22P02" || err.code === "22003") {
    return res.status(400).json({ error: "BAD_INPUT", message: "Valore non valido o fuori intervallo" });
  }

  // errori "nostri", lanciati con throw new HttpError(...)
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.code, message: err.message });

  console.error(err); // log completo lato server
  res.status(500).json({ error: "INTERNAL", message: "Errore interno" }); // mai lo stack al client
}
