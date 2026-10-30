// =====================================================================
//  SEGNI: piccole icone discrete al posto delle "pillole" colorate
//  (Indispensabile, Preferito, Da fare). Stesso colore del testo grigio,
//  disegnate con le linee come le altre icone dell'app.
//  Usati da armadio.js (lista e scheda di dettaglio) e viaggi.js (lista).
// =====================================================================

// Il disegno di ogni segno: solo l'interno dell'<svg> (viewBox 24×24)
const DISEGNI = {
  indispensabile: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>', // lucchetto
  preferito: '<path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/>',  // stella
  "da-fare": '<path d="M5 21V4"/><path d="M5 4h11l-2 4 2 4H5"/>',                                        // bandierina
};
const PAROLE = { indispensabile: "Indispensabile", preferito: "Preferito", "da-fare": "Da fare" };

// Solo il disegno, nascosto ai lettori di schermo (per quando la parola c'è già accanto, es. nei filtri)
export function iconaSegno(tipo) {
  return `<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor"
    stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${DISEGNI[tipo]}</svg>`;
}

// segno("preferito")        → solo l'icona (nelle liste). Il nome c'è comunque, per chi usa un lettore di schermo
// segno("preferito", true)  → icona + parola (nella scheda di dettaglio, dove c'è spazio)
export function segno(tipo, conParola = false) {
  const parola = PAROLE[tipo];
  const icona = iconaSegno(tipo);
  return conParola
    ? `<span class="segno">${icona}${parola}</span>`
    : `<span class="segno" title="${parola}">${icona}<span class="solo-lettori">${parola}</span></span>`;
}
