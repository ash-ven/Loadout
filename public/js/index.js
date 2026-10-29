import { api } from "./api.js";
import "./menu.js";

// Chi sono? Se non sono loggata, api() mi porta da sola alla pagina di login
const utente = await api("/api/auth/me");
document.querySelector("#saluto").textContent = `Ciao, ${utente.nome}!`;