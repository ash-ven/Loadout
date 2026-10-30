// Piccolo client HTTP riutilizzabile da tutte le pagine
export async function api(percorso, { method = "GET", body } = {}) {
  const res = await fetch(percorso, {
    method,
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
    credentials: "same-origin", // manda il cookie con il token
  });

  // 401 = non sei loggata → alla pagina di login.
  // Eccezione: al login stesso il 401 vuol dire "credenziali sbagliate" e va mostrato all'utente.
  if (res.status === 401 && percorso !== "/api/auth/login") {
    location.href = "/login.html";
    throw new Error("Effettua il login");
  }

  if (res.status === 204) return null; // nessun corpo (DELETE, logout)

  const data = await res.json();
  if (!res.ok) {
    const errore = new Error(data.message ?? `Errore ${res.status}`);
    errore.status = res.status; // chi chiama può decidere in base allo status (es. 404 = non esiste)
    throw errore;
  }
  return data;
}

// Rende "innocuo" un testo prima di metterlo nell'HTML (difesa contro XSS, esercizio L6.7.5)
export function esc(valore) {
  return String(valore ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

// "2026-11-08" → "08/11/2026": l'API usa il formato ISO, l'utente vede quello italiano
export function formattaData(iso) {
  const [anno, mese, giorno] = iso.split("-");
  return `${giorno}/${mese}/${anno}`;
}
// Oggi come testo "2026-10-29", nel fuso orario di chi usa l'app.
// (new Date().toISOString() userebbe l'ora di Greenwich: in Italia, tra mezzanotte e l'una, darebbe ancora "ieri")
export function oggiISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Quanti giorni da una data all'altra, entrambe "AAAA-MM-GG".
// Date.parse le legge tutte e due come mezzanotte UTC: niente sorprese con l'ora legale.
export function giorniTra(da, a) {
  return Math.round((Date.parse(a) - Date.parse(da)) / 86_400_000); // 86.400.000 ms = un giorno
}
