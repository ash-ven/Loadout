// 4/11: la nuova password, dal link dell'email (?codice=…). Poi si accede con la password nuova
import { api } from "./api.js";
import "./pwa.js";

const form = document.querySelector("#form-nuova");
const errore = document.querySelector("#errore");
const codice = new URLSearchParams(location.search).get("codice");
const mostraErrore = (testo) => { errore.textContent = testo; errore.hidden = false; };

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  errore.hidden = true;
  const { password, ripeti } = Object.fromEntries(new FormData(form));
  if (!codice) return mostraErrore("Il link non è completo: aprilo di nuovo dall'email");
  if (password.length < 8) return mostraErrore("La password deve avere almeno 8 caratteri");
  if (password !== ripeti) return mostraErrore("Le due password non sono uguali");
  const bottone = form.querySelector('button[type="submit"]');
  bottone.disabled = true;
  try {
    await api("/api/auth/nuova-password", { method: "POST", body: { codice, password } });
    location.replace("/login.html?password=nuova&uscita=1");
  } catch (err) {
    mostraErrore(err.message); // es. "Il link non è valido o è scaduto: chiedine uno nuovo"
  } finally {
    bottone.disabled = false;
  }
});
