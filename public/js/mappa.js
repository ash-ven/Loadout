// Mappe con Leaflet (C3, stretch 3). Leaflet arriva da un <script> classico nella pagina
// e crea la variabile globale L; qui ci sono solo le impostazioni comuni alle due pagine.

// Sfondo: OpenTopoMap, mappa topografica con curve di livello e sentieri
const SFONDO = "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png";
// Sopra: Waymarked Trails "hiking", che colora i SENTIERI SEGNATI (CAI e simili) da OpenStreetMap
const SENTIERI = "https://tile.waymarkedtrails.org/hiking/{z}/{x}/{y}.png";
const FONTE = 'Dati © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, SRTM · ' +
              'Stile © <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA) · ' +
              'Sentieri © <a href="https://hiking.waymarkedtrails.org">Waymarked Trails</a>';

// Centro di partenza se non ci sono punti: l'Appennino modenese
export const CENTRO_ITALIA = [44.25, 10.7];

export function creaMappa(idElemento, centro = CENTRO_ITALIA, zoom = 10) {
  const mappa = L.map(idElemento).setView(centro, zoom);
  L.tileLayer(SFONDO, { maxZoom: 17, attribution: FONTE }).addTo(mappa);
  L.tileLayer(SENTIERI, { maxZoom: 17, opacity: 0.8 }).addTo(mappa); // trasparente: si vede lo sfondo sotto
  return mappa;
}

// Un punto colorato (cerchio disegnato, niente immagini): partenza muschio, arrivo senape, tappa salvia piccola
export function punto(lat, lon, tipo) {
  const stile = {
    partenza: { radius: 9, fillColor: "#31503f", testo: "Partenza" },
    arrivo:   { radius: 9, fillColor: "#c8962b", testo: "Arrivo" },
    tappa:    { radius: 6, fillColor: "#5f8463", testo: "Tappa" },
  }[tipo];
  return L.circleMarker([lat, lon], { radius: stile.radius, color: "#fbf6ec", weight: 3, fillColor: stile.fillColor, fillOpacity: 1 })
    .bindTooltip(stile.testo);
}

// Il percorso vero lungo i sentieri: linea piena
export function tracciato(traccia) {
  return L.polyline(traccia, { color: "#31503f", weight: 5, opacity: 0.9 });
}

// Linea tratteggiata tra i punti (in linea d'aria): si usa quando il percorso sui sentieri non c'è
export function lineaDritta(punti) {
  return L.polyline(punti, { color: "#31503f", weight: 3, dashArray: "6 8" });
}

// Legge un numero da un campo del form: null se vuoto o non valido
export function numeroDa(campo) {
  const n = Number(campo.value);
  return campo.value === "" || Number.isNaN(n) ? null : n;
}
