import { api } from "./api.js";

// Logout: chiede al server di cancellare il cookie, poi torna al login.
// È esportata (export) così la può usare anche il pulsante "Esci" della pagina profilo.
export async function esci() {
  await api("/api/auth/logout", { method: "POST" });
  location.href = "/login.html";
}

// Collega il link "Esci" della barra in alto (presente in tutte le pagine)
const linkEsci = document.querySelector("#esci");

linkEsci?.addEventListener("click", async (e) => {
  e.preventDefault(); // è un link: senza questa riga il browser seguirebbe href="#"
  await esci();
});
