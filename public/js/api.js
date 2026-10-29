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
  if (!res.ok) throw new Error(data.message ?? `Errore ${res.status}`);
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