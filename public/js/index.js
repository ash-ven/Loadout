import { api } from "./api.js";
import "./menu.js";

const saluto = document.querySelector("#saluto");

// Chi sono? Se non sono loggata, api() mi porta da sola alla pagina di login
const utente = await api("/api/auth/me");
saluto.textContent = `Ciao, ${utente.nome}!`;
