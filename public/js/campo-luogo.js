// =====================================================================
//  CAMPO LUOGO con suggerimenti (B1)
//  Scrivi "malga prato": dopo mezzo secondo di pausa chiediamo al server (/api/luoghi)
//  e mostriamo fino a 6 luoghi. Scegliendone uno, il nome va nel campo e le coordinate
//  nei campi lat/lon del form, con il post-it "luogo" (vedi post-it.js): vince l'ultimo automatico
//  (luogo o mappa), ma quello che scrivi tu a mano vince sempre.
// =====================================================================
import { api, esc } from "./api.js";
import { proponi } from "./post-it.js";

// campoTesto: l'<input> del nome; lista: l'<ul> dei suggerimenti; campoLat/campoLon: gli <input> delle coordinate;
// suScelta(lat, lon): facoltativa, chiamata quando scegli un luogo (il form la usa per centrare la mappa)
export function attivaCampoLuogo({ campoTesto, lista, campoLat, campoLon, suScelta = () => {} }) {
  let timer = null;
  let ultimaRicerca = 0; // per ignorare le risposte arrivate tardi (se nel frattempo hai scritto altro)
  let trovati = [];

  campoTesto.addEventListener("input", () => {
    clearTimeout(timer);
    const testo = campoTesto.value.trim();
    if (testo.length < 3) return chiudi();
    timer = setTimeout(() => cerca(testo), 500); // aspetta che tu smetta di scrivere
  });

  async function cerca(testo) {
    const numero = ++ultimaRicerca;
    mostra('<li class="suggerimento-info">Cerco…</li>');
    try {
      const risultati = await api(`/api/luoghi?q=${encodeURIComponent(testo)}`);
      if (numero !== ultimaRicerca) return; // è arrivata una ricerca più nuova: questa non serve più
      trovati = risultati;
      mostra(risultati.length
        ? risultati.map((l, i) => `<li><button type="button" class="suggerimento" data-i="${i}">
            <span>${esc(l.etichetta)}</span>${l.tipo ? `<span class="muto">${esc(l.tipo)}</span>` : ""}</button></li>`).join("")
        : '<li class="suggerimento-info">Nessun luogo trovato: prova un nome più semplice, o scrivi le coordinate a mano.</li>');
    } catch (err) {
      if (numero === ultimaRicerca) mostra(`<li class="suggerimento-info">${esc(err.message)}</li>`);
    }
  }

  // Clic su un suggerimento: nome nel campo, coordinate nei loro campi
  lista.addEventListener("click", (e) => {
    const bottone = e.target.closest(".suggerimento");
    if (!bottone) return;
    const luogo = trovati[Number(bottone.dataset.i)];
    campoTesto.value = luogo.etichetta;
    proponi(campoLat, luogo.lat, "luogo"); // solo se il campo è vuoto o compilato in automatico
    proponi(campoLon, luogo.lon, "luogo");
    suScelta(luogo.lat, luogo.lon);
    chiudi();
    campoTesto.focus();
  });

  // Tastiera: freccia giù dal campo porta ai suggerimenti, Esc chiude
  campoTesto.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") { lista.querySelector(".suggerimento")?.focus(); e.preventDefault(); }
    if (e.key === "Escape" && !lista.hidden) { chiudi(); e.preventDefault(); e.stopPropagation(); }
  });
  lista.addEventListener("keydown", (e) => {
    const bottoni = [...lista.querySelectorAll(".suggerimento")];
    const i = bottoni.indexOf(document.activeElement);
    if (e.key === "ArrowDown") { bottoni[Math.min(i + 1, bottoni.length - 1)]?.focus(); e.preventDefault(); }
    if (e.key === "ArrowUp") { (i <= 0 ? campoTesto : bottoni[i - 1]).focus(); e.preventDefault(); }
    if (e.key === "Escape") { chiudi(); campoTesto.focus(); e.preventDefault(); e.stopPropagation(); }
  });

  function mostra(html) {
    lista.innerHTML = html;
    lista.hidden = false;
    campoTesto.setAttribute("aria-expanded", "true");
  }
  function chiudi() {
    lista.hidden = true;
    lista.innerHTML = "";
    campoTesto.setAttribute("aria-expanded", "false");
  }

  // Da chiamare quando il form viene svuotato o riempito (nuovo viaggio / modifica)
  return { aggiorna: chiudi };
}
