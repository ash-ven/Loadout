import { api, esc } from "./api.js";
import "./menu.js";
import { creaMappa, icona, tipoDelPunto, disegnaTracciato, eUnAnello, scriviStato } from "./mappa-base.js";

// Pagina della mappa di un'uscita, in sola lettura: mappa.html?id=7
// (la mappa si disegna e si modifica nel form dell'uscita, in «Percorso»)
const id = Number(new URLSearchParams(location.search).get("id"));
const titolo = document.querySelector("#titolo");
const stato = document.querySelector("#stato-mappa");
const elDati = document.querySelector("#dati-percorso");
const num = (n) => Number(n).toLocaleString("it-IT", { useGrouping: "always" });

if (!Number.isInteger(id) || id <= 0) {
  location.href = "/mappe.html";
} else {
  document.querySelector("#torna").href = `/scheda-viaggio.html?id=${id}`;
  document.querySelector("#modifica").href = `/viaggi.html?modifica=${id}&mappa=1`;
  try {
    const v = await api(`/api/viaggi/${id}`);
    document.title = `Loadout – Mappa: ${v.nome}`;
    titolo.textContent = `Mappa: ${v.nome}`;
    document.querySelector("#intestazione").hidden = false;
    document.querySelector("#corpo-mappa").hidden = false;

    // I dati del percorso in una riga (gli stessi del form)
    const parti = [];
    if (v.distanza_km != null) parti.push(`${num(v.distanza_km)} km`);
    if (v.dislivello_m != null) parti.push(`${num(v.dislivello_m)} m di dislivello positivo`);
    if (v.quota_min_m != null || v.quota_max_m != null) {
      parti.push(`quota da ${v.quota_min_m != null ? num(v.quota_min_m) : "–"} a ${v.quota_max_m != null ? num(v.quota_max_m) : "–"} m`);
    }
    elDati.innerHTML = parti.map(esc).join(" · ");

    if (!v.traccia?.linea?.length) {
      scriviStato(stato, "Questa uscita non ha ancora una mappa: la disegni con «Modifica il percorso».", "errore");
    } else {
      const { chiave } = await api("/api/mappe/config");
      const linea = v.traccia.linea.map(([lat, lon]) => [lat, lon]);
      const mappa = creaMappa(document.querySelector("#mappa"), chiave, {
        suTessereSbagliate: () => scriviStato(stato, "Le tessere della mappa non arrivano: controlla la chiave MapTiler nel file .env.", "errore"),
      });
      const livello = L.layerGroup().addTo(mappa);
      disegnaTracciato(livello, linea);
      // Le puntine, ferme (non trascinabili): stesso disegno del form
      const anello = eUnAnello(v.traccia);
      v.traccia.tappe.forEach(([lat, lon], i, tutte) =>
        L.marker([lat, lon], { icon: icona(tipoDelPunto(i, tutte.length, anello)), interactive: false }).addTo(livello));
      mappa.fitBounds(L.latLngBounds(linea), { padding: [30, 30] });
    }
  } catch (err) {
    document.querySelector("#intestazione").hidden = false;
    titolo.textContent = err.status === 404 ? "Questa uscita non esiste più o è stata eliminata" : err.message;
  }
}
