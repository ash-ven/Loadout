import { api } from "./api.js";
import { esci } from "./menu.js"; // importare menu.js collega anche il link "Esci" della barra

const elNome = document.querySelector("#nome");
const elEmail = document.querySelector("#email");
const formProfilo = document.querySelector("#form-profilo");
const campoPeso = formProfilo.elements.peso_corporeo_kg;
const info = document.querySelector("#profilo-info");
const errore = document.querySelector("#profilo-errore");

// Chi sono? Se non sono loggata, api() mi porta da sola alla pagina di login
const utente = await api("/api/auth/me");
elNome.textContent = utente.nome;
elEmail.textContent = utente.email;
campoPeso.value = utente.peso_corporeo_kg ?? "";
mostraSoglia(utente.peso_corporeo_kg);

// Pulsante "Esci dall'account": stessa funzione del link nel menu
document.querySelector("#bottone-esci").addEventListener("click", esci);

// Salvataggio del peso corporeo
formProfilo.addEventListener("submit", async (e) => {
  e.preventDefault();
  errore.hidden = true;

  // Validazione lato client: stesso intervallo che controlla il server (20–300)
  const peso = Number(campoPeso.value);
  if (campoPeso.value === "" || Number.isNaN(peso) || peso < 20 || peso > 300) {
    errore.textContent = "Inserisci un peso tra 20 e 300 kg";
    errore.hidden = false;
    return;
  }

  try {
    const aggiornato = await api("/api/auth/me", { method: "PATCH", body: { peso_corporeo_kg: peso } });
    mostraSoglia(aggiornato.peso_corporeo_kg, true);
  } catch (err) {
    errore.textContent = err.message;
    errore.hidden = false;
  }
});

// Mostra la soglia: il 20% del peso corporeo, in formato italiano (es. "12,4")
function mostraSoglia(peso, appenaSalvato = false) {
  if (peso == null) {
    info.textContent = "Peso non ancora impostato: l'avviso sullo zaino è disattivato.";
  } else {
    const soglia = (peso * 0.2).toLocaleString("it-IT", { maximumFractionDigits: 1 });
    const prefisso = appenaSalvato ? "Peso salvato. " : "";
    info.textContent = `${prefisso}Il tuo zaino non dovrebbe superare ${soglia} kg.`;
  }
  info.hidden = false;
}
