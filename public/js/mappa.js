// Mappe con Leaflet (C3, stretch 3). Leaflet arriva da un <script> classico nella pagina
// e crea la variabile globale L; qui ci sono solo le impostazioni comuni alle due pagine.

// OpenTopoMap: mappa topografica con sentieri e curve di livello (gratuita, va citata la fonte)
const SFONDO = "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png";
const FONTE = 'Dati © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, SRTM · Stile © <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA)';

// Centro di partenza se non ci sono punti: l'Appennino modenese
export const CENTRO_ITALIA = [44.25, 10.7];

export function creaMappa(idElemento, centro = CENTRO_ITALIA, zoom = 9) {
  const mappa = L.map(idElemento).setView(centro, zoom);
  L.tileLayer(SFONDO, { maxZoom: 17, attribution: FONTE }).addTo(mappa);
  return mappa;
}

// Un punto colorato (cerchio disegnato, niente immagini da scaricare): partenza muschio, arrivo senape
export function punto(lat, lon, tipo) {
  const colore = tipo === "partenza" ? "#31503f" : "#c8962b";
  return L.circleMarker([lat, lon], { radius: 9, color: "#fbf6ec", weight: 3, fillColor: colore, fillOpacity: 1 })
    .bindTooltip(tipo === "partenza" ? "Partenza" : "Arrivo");
}

// La linea tratteggiata tra partenza e arrivo (è "in linea d'aria", non il sentiero vero)
export function linea(partenza, arrivo) {
  return L.polyline([partenza, arrivo], { color: "#31503f", weight: 3, dashArray: "6 8" });
}

// Legge un numero da un campo del form: null se vuoto o non valido
export function numeroDa(campo) {
  const n = Number(campo.value);
  return campo.value === "" || Number.isNaN(n) ? null : n;
}
