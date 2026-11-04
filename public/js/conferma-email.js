// 4/11: conferma dell'email. Il codice arriva nell'indirizzo (?codice=…), lo mandiamo al server con POST.
// Se va bene il server fa anche l'accesso (cookie), e si entra nella Home.
import { api } from "./api.js";
import "./pwa.js";

const stato = document.querySelector("#stato-conferma");
const errore = document.querySelector("#errore");
const azioni = document.querySelector("#azioni-conferma");
const codice = new URLSearchParams(location.search).get("codice");

try {
  if (!codice) throw new Error("Il link non è completo: aprilo di nuovo dall'email");
  await api("/api/auth/conferma", { method: "POST", body: { codice } });
  stato.textContent = "Email confermata! Ti porto nella tua Home…";
  setTimeout(() => location.replace("/"), 1200);
} catch (err) {
  stato.hidden = true;
  errore.textContent = err.message;
  errore.hidden = false;
  azioni.hidden = false; // dall'accesso si può chiedere un link nuovo
}
