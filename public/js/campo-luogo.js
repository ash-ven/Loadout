// =====================================================================
//  CAMPO LUOGO con suggerimenti (B1)
//  Scrivi "malga prato": dopo mezzo secondo di pausa chiediamo al server (/api/luoghi)
//  e mostriamo fino a 6 luoghi. Scegliendone uno, il nome va nel campo e le coordinate
//  nei campi lat/lon del form. Le coordinate restano modificabili a mano: vince quello che scrivi tu.
// =====================================================================
import { api, esc } from "./api.js";

// campoTesto: l'<input> del nome; lista: l'<ul> dei suggerimenti; campoLat/campoLon: gli <input> delle coordinate;
// nota: un <p> dove scrivere "Coordinate impostate: …"
export function attivaCampoLuogo({ campoTesto, lista, campoLat, campoLon, nota }) {
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
    campoLat.value = luogo.lat;
    campoLon.value = luogo.lon;
    aggiornaNota();
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

  // Se le coordinate le scrivi o le cambi a mano, la nota si aggiorna
  campoLat.addEventListener("input", aggiornaNota);
  campoLon.addEventListener("input", aggiornaNota);

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
  function aggiornaNota() {
    const ok = campoLat.value !== "" && campoLon.value !== "";
    nota.textContent = ok ? `Coordinate: ${campoLat.value}, ${campoLon.value} (modificabili in "Percorso e coordinate")` : "";
    nota.hidden = !ok;
  }

  // Da chiamare quando il form viene svuotato o riempito (nuovo viaggio / modifica)
  return { aggiorna: () => { chiudi(); aggiornaNota(); } };
}
