import { HttpError } from "./errors.js";

// A3 (revisione UX 2): ogni regola può avere
//   etichetta: il nome leggibile del campo, con l'articolo (es. "la latitudine di partenza"): finisce nei messaggi
//              al posto del nome della colonna ('lat_partenza'), che all'utente non dice niente;
//   aiuto:     un suggerimento aggiunto tra parentesi (es. "in Italia circa 36–47, es. 44,19").
const numero = (n) => Number(n).toLocaleString("it-IT", { useGrouping: "always" });
const maiuscola = (testo) => testo.charAt(0).toUpperCase() + testo.slice(1);

export function validate(schema) {
  return (req, res, next) => {
    const errors = [];
    const out = {};

    for (const [field, rule] of Object.entries(schema)) {
      let v = req.body?.[field];
      const nome = rule.etichetta ?? `'${field}'`;   // "la latitudine di partenza" (o il nome tecnico, se manca)
      const Nome = maiuscola(nome);
      const aiuto = rule.aiuto ? ` (${rule.aiuto})` : "";

      if (v === undefined || v === null || v === "") {
        if (rule.required) errors.push(`Manca ${nome}`);
        // nullable: mandare "" o null vuol dire "svuota questo campo" (non mandarlo vuol dire "lascialo com'è")
        else if (rule.nullable && v !== undefined) out[field] = null;
        continue;
      }

      if (rule.type === "number") {
        v = Number(v);
        if (Number.isNaN(v)) errors.push(`${Nome} deve essere un numero`);
        else if (rule.integer && !Number.isInteger(v)) errors.push(`${Nome} deve essere un numero intero`);
      }
      if (rule.type === "boolean") v = v === true || v === "true";
      if (rule.type === "date") {
        const d = new Date(`${v}T00:00:00Z`);
        if (typeof v !== "string" || Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== v) errors.push(`${Nome} non è una data valida (AAAA-MM-GG)`);
      }
      if (rule.type === "string" && typeof v !== "string") errors.push(`${Nome} deve essere un testo`);
      if (rule.type === "object" && (typeof v !== "object" || Array.isArray(v))) errors.push(`${Nome} non è nel formato giusto`);
      if (rule.pattern && typeof v === "string" && !rule.pattern.test(v)) errors.push(`${Nome} non è nel formato giusto${rule.formato ? ` (${rule.formato})` : ""}`);
      if (rule.type === "array") {
        if (!Array.isArray(v)) errors.push(`${Nome} deve essere un elenco`);
        else {
          if (rule.items?.enum && v.some((x) => !rule.items.enum.includes(x))) {
            errors.push(`${Nome} può contenere solo: ${rule.items.enum.join(", ")}`);
          }
          v = [...new Set(v)]; // niente doppioni
        }
      }

      if (rule.maxLength && typeof v !== "object" && String(v).length > rule.maxLength) errors.push(`${Nome} è troppo lungo: al massimo ${numero(rule.maxLength)} caratteri`);
      const fuoriMin = rule.min !== undefined && v < rule.min;
      const fuoriMax = rule.max !== undefined && v > rule.max;
      if ((fuoriMin || fuoriMax) && rule.min !== undefined && rule.max !== undefined) {
        errors.push(`${Nome} va da ${numero(rule.min)} a ${numero(rule.max)}${aiuto}`);
      } else if (fuoriMin) errors.push(`${Nome} deve essere almeno ${numero(rule.min)}${aiuto}`);
      else if (fuoriMax) errors.push(`${Nome} deve essere al massimo ${numero(rule.max)}${aiuto}`);
      if (rule.enum && rule.type !== "array" && !rule.enum.includes(v)) errors.push(`${Nome}: scegli tra ${rule.enum.join(", ")}`);

      out[field] = typeof v === "string" ? v.trim() : v;
    }

    if (errors.length) return next(new HttpError(400, "VALIDATION_ERROR", errors.join("; ")));
    req.validated = out;
    next();
  };
}
