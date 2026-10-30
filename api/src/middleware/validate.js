import { HttpError } from "./errors.js";

export function validate(schema) {
  return (req, res, next) => {
    const errors = [];
    const out = {};

    for (const [field, rule] of Object.entries(schema)) {
      let v = req.body?.[field];

      if (v === undefined || v === null || v === "") {
        if (rule.required) errors.push(`'${field}' è obbligatorio`);
        // nullable: mandare "" o null vuol dire "svuota questo campo" (non mandarlo vuol dire "lascialo com'è")
        else if (rule.nullable && v !== undefined) out[field] = null;
        continue;
      }

      if (rule.type === "number") {
        v = Number(v);
        if (Number.isNaN(v)) errors.push(`'${field}' deve essere numerico`);
        else if (rule.integer && !Number.isInteger(v)) errors.push(`'${field}' deve essere un numero intero`);
      }
      if (rule.type === "boolean") v = v === true || v === "true";
      if (rule.type === "date") {
        const d = new Date(`${v}T00:00:00Z`);
        if (typeof v !== "string" || Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== v) errors.push(`'${field}' deve essere una data valida (AAAA-MM-GG)`);
      }
      if (rule.type === "string" && typeof v !== "string") errors.push(`'${field}' deve essere testo`);
      if (rule.type === "object" && (typeof v !== "object" || Array.isArray(v))) errors.push(`'${field}' deve essere un oggetto`);
      if (rule.pattern && typeof v === "string" && !rule.pattern.test(v)) errors.push(`'${field}' non è nel formato giusto${rule.formato ? ` (${rule.formato})` : ""}`);
      if (rule.type === "array") {
        if (!Array.isArray(v)) errors.push(`'${field}' deve essere un elenco`);
        else {
          if (rule.items?.enum && v.some((x) => !rule.items.enum.includes(x))) {
            errors.push(`'${field}' può contenere solo: ${rule.items.enum.join(", ")}`);
          }
          v = [...new Set(v)]; // niente doppioni
        }
      }

      if (rule.maxLength && typeof v !== "object" && String(v).length > rule.maxLength) errors.push(`'${field}' troppo lungo (max ${rule.maxLength})`);
      if (rule.min !== undefined && v < rule.min) errors.push(`'${field}' deve essere ≥ ${rule.min}`);
      if (rule.max !== undefined && v > rule.max) errors.push(`'${field}' deve essere ≤ ${rule.max}`);
      if (rule.enum && rule.type !== "array" && !rule.enum.includes(v)) errors.push(`'${field}' deve essere uno tra: ${rule.enum.join(", ")}`);

      out[field] = typeof v === "string" ? v.trim() : v;
    }

    if (errors.length) return next(new HttpError(400, "VALIDATION_ERROR", errors.join("; ")));
    req.validated = out;
    next();
  };
}