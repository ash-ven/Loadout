import { api } from "./api.js";
import { collegaRigaInstalla } from "./pwa.js"; // PWA: service worker + la riga «Installa Loadout sul telefono»

// Collaudo 3/11, C9: se sei già collegata, la pagina di accesso non serve: si va alla Home.
// fetch "a mano" e non api(): api() con una risposta 401 porterebbe di nuovo qui (un giro infinito)
// (non subito dopo «Esci»: lì vuoi proprio rientrare, magari con un altro utente)
if (!new URLSearchParams(location.search).has("uscita")) {
  fetch("/api/auth/me").then((r) => { if (r.ok) location.replace("/"); }).catch(() => {});
}

const form = document.querySelector("#form-login");
const errore = document.querySelector("#errore");
const daConfermare = document.querySelector("#da-confermare"); // 4/11: email non ancora confermata

// 4/11: arrivo dalla pagina «Nuova password»
if (new URLSearchParams(location.search).get("password") === "nuova") {
  const avviso = document.querySelector("#avviso-login");
  avviso.textContent = "Password cambiata: accedi con quella nuova.";
  avviso.hidden = false;
}

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

  const bottone = form.querySelector('button[type="submit"]'); // C2: non l'occhio della password
  bottone.disabled = true; // evita doppi click mentre aspettiamo il server
  daConfermare.hidden = true;
  try {
    await api("/api/auth/login", { method: "POST", body: dati });
    location.href = "/"; // login riuscito: alla home
  } catch (err) {
    // 4/11: 403 = password giusta, ma l'email non è ancora confermata
    if (err.status === 403) { daConfermare.hidden = false; return; }
    mostraErrore(err.message); // es. "Email o password errati"
  } finally {
    bottone.disabled = false;
  }
});

// 4/11: «Rimanda il link» di conferma (la risposta del server è sempre la stessa, non dice se l'email esiste)
document.querySelector("#rimanda").addEventListener("click", async (e) => {
  e.target.disabled = true;
  try {
    const { message } = await api("/api/auth/rimanda-conferma", { method: "POST", body: { email: form.elements.email.value.trim() } });
    daConfermare.querySelector("span").textContent = message;
  } catch (err) {
    mostraErrore(err.message);
  } finally {
    e.target.disabled = false;
  }
});

function mostraErrore(testo) {
  errore.textContent = testo;
  errore.hidden = false;
}
collegaRigaInstalla(document.querySelector("#riga-installa"));
import { mostraAssistenza } from "./contatti.js"; // 4/11: «Problemi o suggerimenti? Scrivi a …»
mostraAssistenza();
