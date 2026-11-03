import { api } from "./api.js";
import { collegaRigaInstalla } from "./pwa.js"; // PWA: service worker + la riga «Installa Loadout sul telefono»

const form = document.querySelector("#form-register");
const errore = document.querySelector("#errore");

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  errore.hidden = true;

  const dati = Object.fromEntries(new FormData(form)); // { nome, email, password }

  // validazione di cortesia: stessi limiti del server
  if (!dati.nome || !dati.email || !dati.password) return mostraErrore("Compila tutti i campi");
  if (dati.password.length < 8) return mostraErrore("La password deve avere almeno 8 caratteri");

  const bottone = form.querySelector('button[type="submit"]'); // C2: non l'occhio della password
  bottone.disabled = true;
  try {
    await api("/api/auth/register", { method: "POST", body: dati });
    // registrazione riuscita: facciamo subito il login, così l'utente entra senza riscrivere tutto
    await api("/api/auth/login", { method: "POST", body: { email: dati.email, password: dati.password } });
    location.href = "/";
  } catch (err) {
    mostraErrore(err.message); // es. "Valore già presente" se l'email esiste, "Indirizzo email non valido"
  } finally {
    bottone.disabled = false;
  }
});

function mostraErrore(testo) {
  errore.textContent = testo;
  errore.hidden = false;
}
collegaRigaInstalla(document.querySelector("#riga-installa"));
