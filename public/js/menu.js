import { api } from "./api.js";

// Logout: chiede al server di cancellare il cookie, poi torna al login.
// È esportata (export) così la può usare anche il pulsante "Esci" della pagina profilo.
export async function esci() {
  await api("/api/auth/logout", { method: "POST" });
  // i dati dei viaggi salvati per l'uso senza rete restano sul dispositivo: uscendo li cancelliamo (privacy)
  await globalThis.caches?.delete("loadout-dati").catch(() => {});
  location.href = "/login.html";
}

// Collega il link "Esci" della barra in alto (presente in tutte le pagine)
const linkEsci = document.querySelector("#esci");

linkEsci?.addEventListener("click", async (e) => {
  e.preventDefault(); // è un link: senza questa riga il browser seguirebbe href="#"
  await esci();
});

// Mappa senza rete: registra il service worker (public/sw.js). Funziona solo su https:// o localhost;
// se il browser non lo sa fare, l'app funziona lo stesso, semplicemente solo con la rete.
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js").catch((err) => console.warn("Service worker non registrato:", err.message));
}
