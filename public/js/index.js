import { api } from "./api.js";
import "./menu.js";

const saluto = document.querySelector("#saluto");
const formProfilo = document.querySelector("#form-profilo");
const campoPeso = formProfilo.elements.peso_corporeo_kg;
const info = document.querySelector("#profilo-info");
const errore = document.querySelector("#profilo-errore");

// Chi sono? Se non sono loggata, api() mi porta da sola alla pagina di login
const utente = await api("/api/auth/me");
saluto.textContent = `Ciao, ${utente.nome}!`;
campoPeso.value = utente.peso_corporeo_kg ?? "";
mostraSoglia(utente.peso_corporeo_kg);

// Salvataggio del peso corporeo (stretch 5)
formProfilo.addEventListener("submit", async (e) => {
  e.preventDefault();
  errore.hidden = true;

  const peso = Number(campoPeso.value);
  if (campoPeso.value === "" || Number.isNaN(peso) || peso < 20 || peso > 300) {
    errore.textContent = "Inserisci un peso tra 20 e 300 kg";
    errore.hidden = false;
    return;
  }

  try {
    const aggiornato = await api("/api/auth/me", { method: "PATCH", body: { peso_corporeo_kg: peso } });
    mostraSoglia(aggiornato.peso_corporeo_kg);
  } catch (err) {
    errore.textContent = err.message;
    errore.hidden = false;
  }
});

function mostraSoglia(peso) {
  if (peso == null) {
    info.textContent = "Peso non ancora impostato: l'avviso sullo zaino è disattivato.";
  } else {
    const soglia = (peso * 0.2).toLocaleString("it-IT", { maximumFractionDigits: 1 });
    info.textContent = `Il tuo zaino non dovrebbe superare ${soglia} kg.`;
  }
  info.hidden = false;
}