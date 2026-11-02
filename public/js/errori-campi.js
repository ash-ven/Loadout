// =====================================================================
//  B1 (revisione UX 2): gli errori SOTTO il campo sbagliato, non in fondo al form.
//  Usato dal form dell'uscita (viaggi.js), dal form dell'oggetto (armadio.js) e dalla pagina della mappa (mappa.js).
//  Ogni errore è { campo: "quota_min_m", testo: "La quota minima…" }.
//  Il campo prende il bordo rosso (CSS su aria-invalid), il messaggio gli sta sotto ed è collegato con
//  aria-describedby (così il lettore di schermo lo legge insieme al campo), e il cursore va al primo campo sbagliato.
// =====================================================================

// Mostra gli errori; restituisce true se ce n'erano
export function mostraErroriCampi(form, errori) {
  pulisciErroriCampi(form);
  for (const { campo, testo } of errori) {
    const input = form.elements[campo];
    if (!input || input.getAttribute("aria-invalid") === "true") continue; // un messaggio per campo basta
    const messaggio = document.createElement("span");
    messaggio.className = "errore-campo";
    messaggio.id = `errore-${form.id}-${campo}`;
    messaggio.textContent = testo; // textContent: niente XSS
    input.after(messaggio);        // subito sotto il campo (dentro la sua etichetta)
    input.setAttribute("aria-invalid", "true");
    input.setAttribute("aria-describedby", messaggio.id);
  }
  const primo = errori.map((e) => form.elements[e.campo]).find(Boolean);
  primo?.focus();
  return errori.length > 0;
}

// Toglie tutti i messaggi (prima di un nuovo controllo, o quando il form si svuota)
export function pulisciErroriCampi(form) {
  form.querySelectorAll(".errore-campo").forEach((m) => m.remove());
  form.querySelectorAll('[aria-invalid="true"]').forEach((input) => togliStato(input));
}

// Appena correggi un campo, il suo messaggio sparisce (da chiamare una volta per form)
export function pulisciScrivendo(form) {
  form.addEventListener("input", (e) => {
    if (e.target.getAttribute?.("aria-invalid") === "true") {
      document.getElementById(e.target.getAttribute("aria-describedby"))?.remove();
      togliStato(e.target);
    }
  });
}

function togliStato(input) {
  input.removeAttribute("aria-invalid");
  input.removeAttribute("aria-describedby");
}
