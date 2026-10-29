import { api } from "./api.js";

// Collega il link "Esci" della barra in alto (presente in tutte le pagine)
const linkEsci = document.querySelector("#esci");

linkEsci?.addEventListener("click", async (e) => {
  e.preventDefault(); // è un link: senza questa riga il browser seguirebbe href="#"
  await api("/api/auth/logout", { method: "POST" });
  location.href = "/login.html";
});
