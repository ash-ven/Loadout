// =====================================================================
//  B3 (revisione UX 2): numeri e parole accordati ("1 ora", "2 ore"; "Aggiunto 1 oggetto", "Aggiunti 3 oggetti").
// =====================================================================

const numero = (n) => Number(n).toLocaleString("it-IT", { useGrouping: "always" });

// plurale(1, "oggetto", "oggetti") → "1 oggetto"; plurale(3, …) → "3 oggetti".
// In italiano si usa il singolare solo con 1 esatto: "1,5 ore", "0,5 ore".
export function plurale(n, singolare, plurale) {
  return `${numero(n)} ${Number(n) === 1 ? singolare : plurale}`;
}

// Le ore di cammino: "mezz'ora", "1 ora", "1,5 ore", "4 ore" (collaudo 3/11, C4: "mezz'ora" invece di "0,5 ore")
export const ore = (n) => (Number(n) === 0.5 ? "mezz'ora" : plurale(n, "ora", "ore"));

// Singolare o plurale per le parole che si accordano con le ore: "1 ora stimata", "mezz'ora stimata", "2 ore stimate"
export const unaSola = (n) => Number(n) === 1 || Number(n) === 0.5;
