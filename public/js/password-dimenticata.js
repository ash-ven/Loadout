// 4/11: «Password dimenticata?». Il server risponde sempre allo stesso modo (non dice se l'email è registrata)
import { api } from "./api.js";
import "./pwa.js";

const form = document.querySelector("#form-dimenticata");
const avviso = document.querySelector("#avviso");
const errore = document.querySelector("#errore");

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  errore.hidden = true;
  avviso.hidden = true;
  const email = form.elements.email.value.trim();
  if (!email) { errore.textContent = "Scrivi la tua email"; errore.hidden = false; return; }
  const bottone = form.querySelector('button[type="submit"]');
  bottone.disabled = true;
  try {
    const { message } = await api("/api/auth/password-dimenticata", { method: "POST", body: { email } });
    avviso.textContent = message;
    avviso.hidden = false;
  } catch (err) {
    errore.textContent = err.message; // es. "Troppi tentativi: riprova tra 60 minuti"
    errore.hidden = false;
  } finally {
    bottone.disabled = false;
  }
});
