// =====================================================================
//  IL "POST-IT" (data-auto) – stessa regola per la mappa e per il campo luogo
//  Un campo compilato in automatico porta il post-it: data-auto="mappa" oppure data-auto="luogo".
//  - proponi() scrive SOLO se il campo è vuoto o ha ancora un post-it: così vince l'ultimo automatico;
//  - appena scrivi tu (evento "input") il post-it si stacca: il valore è tuo e nessun automatico lo tocca più;
//  - se svuoti il campo, torna a compilarlo l'automatico.
//  Il colore salvia e la scritta "dalla mappa" / "dal luogo" li fa il CSS con :has(), senza JavaScript.
// =====================================================================

export function proponi(campo, valore, origine) {
  const eAutomatico = campo.value === "" || campo.dataset.auto !== undefined;
  if (!eAutomatico) return;                 // l'hai scritto tu: non si tocca
  if (valore == null) {                     // l'automatico ritira il suo valore
    campo.value = "";
    delete campo.dataset.auto;
  } else {
    campo.value = valore;
    campo.dataset.auto = origine;           // attacca il post-it ("mappa" o "luogo")
  }
}

// Collega i campi: scrivendo a mano il post-it si stacca
export function staccaPostItScrivendo(campi) {
  for (const campo of campi) {
    campo.addEventListener("input", () => { delete campo.dataset.auto; });
  }
}
