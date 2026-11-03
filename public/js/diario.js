// =====================================================================
//  DIARIO DEL VIAGGIO (punto 6, 3/11) – nella scheda di un viaggio già fatto: una nota e un voto da 1 a 5.
//  Il voto si dà con gli scarponi (versione «Senape» scelta da Asiha): img/icone/scarpone.svg e scarpone-vuoto.svg.
//  Si salva con PUT /api/viaggi/:id/diario (il server accetta solo i viaggi già fatti).
//
//  Il voto è un gruppo di 5 radio (come le stelline dei siti, ma accessibile): il pallino del radio è nascosto,
//  si vede l'immagine nel suo <label>. Con la tastiera le frecce ← → cambiano il voto, come in ogni gruppo di radio.
// =====================================================================
import { api } from "./api.js";

const PIENO = "/img/icone/scarpone.svg";
const VUOTO = "/img/icone/scarpone-vuoto.svg";

// Per il fumetto della Home (e ovunque serva solo da vedere): «🥾🥾🥾🥾· 4 su 5» come HTML
export function scarponcini(voto) {
  if (!voto) return "";
  const img = (i) => `<img src="${i <= voto ? PIENO : VUOTO}" alt="" width="18" height="18">`;
  return `<span class="scarponcini" title="${voto} su 5">${[1, 2, 3, 4, 5].map(img).join("")}<span class="solo-lettori">Voto ${voto} su 5</span></span>`;
}

const sezione = document.querySelector("#diario");
const form = document.querySelector("#form-diario");
const elScarponi = document.querySelector("#scarponi");
const togliVoto = document.querySelector("#togli-voto");
const stato = document.querySelector("#diario-stato");
const errore = document.querySelector("#errore-diario");
let viaggioId = null;
let timerStato = null;

// I 5 scarponi: <input type="radio"> + <label> con l'immagine (il testo «3 su 5» c'è, ma solo per i lettori di schermo)
if (elScarponi) {
  elScarponi.innerHTML = [1, 2, 3, 4, 5].map((n) => `
    <input type="radio" name="voto" value="${n}" id="voto-${n}">
    <label for="voto-${n}" title="${n} su 5"><img src="${VUOTO}" alt="" width="34" height="34"><span class="solo-lettori">${n} su 5</span></label>`).join("");
}

// Pieni fino al voto scelto, vuoti dopo
function disegnaVoto() {
  const voto = Number(form.elements.voto.value) || 0;
  elScarponi.querySelectorAll("label img").forEach((img, i) => { img.src = i < voto ? PIENO : VUOTO; });
  togliVoto.hidden = voto === 0;
}

// Mostra il diario solo per i viaggi già fatti (viaggio.fatto arriva dal server) e lo riempie
export function mostraDiario(viaggio) {
  if (!sezione) return;
  sezione.hidden = !viaggio.fatto;
  if (!viaggio.fatto) return;
  viaggioId = viaggio.id;
  form.elements.nota.value = viaggio.diario_nota ?? "";
  form.querySelectorAll('input[name="voto"]').forEach((r) => { r.checked = Number(r.value) === viaggio.diario_voto; });
  disegnaVoto();
}

function mostraStato(testo, sparisce = false) {
  stato.textContent = testo;
  clearTimeout(timerStato);
  if (sparisce) timerStato = setTimeout(() => { stato.textContent = ""; }, 3000);
}

elScarponi?.addEventListener("change", disegnaVoto);
togliVoto?.addEventListener("click", () => {
  form.querySelectorAll('input[name="voto"]').forEach((r) => { r.checked = false; });
  disegnaVoto();
});

form?.addEventListener("submit", async (e) => {
  e.preventDefault();
  errore.hidden = true;
  mostraStato("Salvataggio…");
  try {
    const voto = Number(form.elements.voto.value) || null;
    await api(`/api/viaggi/${viaggioId}/diario`, { method: "PUT", body: { nota: form.elements.nota.value, voto } });
    mostraStato("✓ Salvato", true);
  } catch (err) {
    mostraStato("");
    errore.textContent = err.message;
    errore.hidden = false;
  }
});

