import { api } from "./api.js";

// Logout: chiede al server di cancellare il cookie, poi torna al login.
// È esportata (export) così la può usare anche il pulsante "Esci" della pagina profilo.
export async function esci() {
  try {
    await api("/api/auth/logout", { method: "POST" });
  } catch (err) {
    // se la richiesta non va (rete assente, risposta strana di un proxy) lo scriviamo, ma usciamo lo stesso dalla pagina
    console.warn("Logout non confermato dal server:", err.message);
  }
  // i dati dei viaggi salvati per l'uso senza rete restano sul dispositivo: uscendo li cancelliamo (privacy)
  await globalThis.caches?.delete("loadout-dati").catch(() => {});
  location.href = "/login.html?uscita=1"; // ?uscita=1: il login non ti rimanda alla home anche se il cookie fosse rimasto
}

// Collega il link "Esci" della barra in alto (presente in tutte le pagine)
const linkEsci = document.querySelector("#esci");

linkEsci?.addEventListener("click", async (e) => {
  e.preventDefault(); // è un link: senza questa riga il browser seguirebbe href="#"
  await esci();
});

// Il service worker (mappa senza rete, app installata) ora lo registra pwa.js: lo importano anche le pagine senza menu
import "./pwa.js";

// Collaudo 3/11, A2: quando lo schermo è medio il menu mostra solo le icone; il nome compare al passaggio del mouse
for (const voce of document.querySelectorAll(".menu a")) {
  if (!voce.title) voce.title = voce.textContent.trim();
}
