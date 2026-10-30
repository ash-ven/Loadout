import { api } from "./api.js";

const form = document.querySelector("#form-login");
const errore = document.querySelector("#errore");

// B7: arrivo dopo aver eliminato l'account
if (new URLSearchParams(location.search).has("eliminato")) {
  const avviso = document.querySelector("#avviso-login");
  avviso.textContent = "Il tuo account e tutti i tuoi dati sono stati eliminati.";
  avviso.hidden = false;
}

form.addEventListener("submit", async (e) => {
  e.preventDefault(); // altrimenti il browser ricarica la pagina
  errore.hidden = true;

  const dati = Object.fromEntries(new FormData(form)); // { email: "...", password: "..." }

  // validazione "di cortesia" lato client: quella che conta resta sul server
  if (!dati.email || !dati.password) {
    mostraErrore("Inserisci email e password");
    return;
  }

  const bottone = form.querySelector("button");
  bottone.disabled = true; // evita doppi click mentre aspettiamo il server
  try {
    await api("/api/auth/login", { method: "POST", body: dati });
    location.href = "/"; // login riuscito: alla home
  } catch (err) {
    mostraErrore(err.message); // es. "Email o password errati"
  } finally {
    bottone.disabled = false;
  }
});

function mostraErrore(testo) {
  errore.textContent = testo;
  errore.hidden = false;
}