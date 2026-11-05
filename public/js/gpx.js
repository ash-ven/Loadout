// =====================================================================
//  GPX: il percorso disegnato, in un file da aprire nelle app di mappe offline
//  (OsmAnd, Organic Maps, Komoot, Gaia GPS…), che lo seguono con il GPS anche senza rete.
//  GPX è un formato XML standard: una <trk> (traccia) fatta di <trkpt> (punti con la quota <ele>)
//  e dei <wpt> (punti con un nome: qui partenza e arrivo).
//  Il file lo crea il BROWSER: nessuna richiesta al server, funziona anche con la traccia non ancora salvata.
// =====================================================================

// Nel testo dell'XML <, >, & e le virgolette vanno "scappati", come in HTML (il nome lo scrive l'utente)
function escXml(testo) {
  return String(testo).replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[c]);
}

const punto = (tag, [lat, lon, quota], dentro = "") =>
  `<${tag} lat="${lat}" lon="${lon}">${quota != null ? `<ele>${quota}</ele>` : ""}${dentro}</${tag}>`;

// nome: il nome del viaggio; traccia: { tappe, linea: [[lat, lon, quota], …] } → il testo del file GPX
export function creaGpx(nome, traccia) {
  const { linea } = traccia;
  const partenza = linea[0];
  const arrivo = linea.at(-1);
  const anello = Math.abs(partenza[0] - arrivo[0]) < 0.0005 && Math.abs(partenza[1] - arrivo[1]) < 0.0005;
  // 4/11: se hai dato un nome al punto (traccia.nomi, uno per tappa), il segnaposto usa quello
  const nomi = traccia.nomi ?? [];
  const nomeDi = (i, diSerie) => `<name>${escXml(nomi[i] || diSerie)}</name>`;
  const segnaposti = [punto("wpt", partenza, nomeDi(0, anello ? "Partenza e arrivo" : "Partenza"))];
  // Collaudo 3/11, C11: anche le tappe hanno il loro punto con il nome ("Tappa 1", "Tappa 2"…), come nell'elenco della mappa.
  // Nelle tappe salvate la prima è la partenza e (senza anello) l'ultima è l'arrivo: quelle le abbiamo già
  const tappe = traccia.tappe ?? [];
  const intermedie = anello ? tappe.slice(1) : tappe.slice(1, -1);
  intermedie.forEach(([lat, lon], i) => segnaposti.push(punto("wpt", [lat, lon], nomeDi(i + 1, `Tappa ${i + 1}`))));
  if (!anello) segnaposti.push(punto("wpt", arrivo, nomeDi(tappe.length - 1, "Arrivo")));
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Loadout" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata><name>${escXml(nome)}</name><copyright author="OpenStreetMap contributors"><license>https://opendatacommons.org/licenses/odbl/</license></copyright></metadata>
  ${segnaposti.join("\n  ")}
  <trk>
    <name>${escXml(nome)}</name>
    <trkseg>
      ${linea.map((p) => punto("trkpt", p)).join("\n      ")}
    </trkseg>
  </trk>
</gpx>
`;
}

// Fa scaricare il file: un Blob (un "file" in memoria), un link invisibile con download="…" e un clic
export function scaricaGpx(nome, traccia) {
  const blob = new Blob([creaGpx(nome, traccia)], { type: "application/gpx+xml" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  // il nome del file: solo lettere, numeri e trattini ("Monte Cimone (anello)" → "monte-cimone-anello.gpx")
  link.download = `${nome.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "percorso"}.gpx`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000); // la memoria del Blob si libera dopo il download
}
