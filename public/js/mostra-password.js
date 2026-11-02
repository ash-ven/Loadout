// =====================================================================
//  MOSTRA PASSWORD (C2, revisione UX 2)
//  Basta importare questo file: ogni campo password della pagina riceve,
//  a destra, un pulsante con l'occhio che mostra o nasconde quello che hai scritto.
//  Lo usano login, registrazione e profilo.
// =====================================================================

const OCCHIO = '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>';
const OCCHIO_BARRATO = OCCHIO + '<path d="M4 4l16 16"/>';
const disegno = (interno) => `<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none"
  stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${interno}</svg>`;

for (const campo of document.querySelectorAll('input[type="password"]')) {
  // Il campo va dentro un contenitore, così il pulsante si può appoggiare sopra il suo bordo destro (CSS: .campo-password)
  const contenitore = document.createElement("span");
  contenitore.className = "campo-password";
  campo.replaceWith(contenitore);
  contenitore.append(campo);

  const bottone = document.createElement("button");
  bottone.type = "button"; // "button": dentro un form, altrimenti premendolo invierebbe il form
  bottone.className = "occhio";
  bottone.setAttribute("aria-label", "Mostra la password");
  bottone.setAttribute("aria-pressed", "false"); // per i lettori di schermo: è un interruttore acceso/spento
  bottone.innerHTML = disegno(OCCHIO);
  contenitore.append(bottone);

  bottone.addEventListener("click", () => {
    const visibile = campo.type === "password"; // adesso è nascosta → la mostriamo
    campo.type = visibile ? "text" : "password";
    bottone.setAttribute("aria-pressed", String(visibile));
    bottone.innerHTML = disegno(visibile ? OCCHIO_BARRATO : OCCHIO);
    campo.focus(); // si continua a scrivere senza dover ricliccare nel campo
  });
}
