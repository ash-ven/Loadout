// =====================================================================
//  B3 (revisione UX 2): numeri e parole accordati ("1 ora", "2 ore"; "Aggiunto 1 oggetto", "Aggiunti 3 oggetti").
// =====================================================================

const numero = (n) => Number(n).toLocaleString("it-IT", { useGrouping: "always" });

// plurale(1, "oggetto", "oggetti") → "1 oggetto"; plurale(3, …) → "3 oggetti".
// In italiano si usa il singolare solo con 1 esatto: "1,5 ore", "0,5 ore".
export function plurale(n, singolare, plurale) {
  return `${numero(n)} ${Number(n) === 1 ? singolare : plurale}`;
}

// Le ore di cammino: "1 ora", "1,5 ore", "4 ore"
export const ore = (n) => plurale(n, "ora", "ore");
