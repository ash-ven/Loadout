// =====================================================================
//  PWA (3/11) – Loadout come app installata sul telefono.
//  1. Registra il service worker (public/sw.js): prima era in menu.js, ora sta qui ed è importato anche
//     dalle pagine senza menu (accesso e registrazione), così l'app funziona da qualunque pagina la apri.
//  2. Ascolta "beforeinstallprompt": Chrome (Android e computer) lo manda quando l'app si può installare.
//     Lo teniamo da parte e lo usiamo quando premi «Installa» nel Profilo (scelta di Asiha).
//  Safari su iPhone non manda questo evento: lì si installa da Condividi → «Aggiungi alla schermata Home».
// =====================================================================

if ("serviceWorker" in navigator) {
  // Funziona solo su https:// o su localhost; se il browser non lo sa fare, l'app va lo stesso, solo con la rete
  navigator.serviceWorker.register("/sw.js").catch((err) => console.warn("Service worker non registrato:", err.message));
}

let richiesta = null;                       // l'evento beforeinstallprompt, finché non lo usiamo
const chiAscolta = new Set();               // le funzioni da avvisare quando cambia qualcosa (la scheda del Profilo)
const avvisa = () => chiAscolta.forEach((f) => f(statoInstallazione()));

window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();                       // niente banner automatico del browser: decidi tu dal Profilo
  richiesta = e;
  avvisa();
});
window.addEventListener("appinstalled", () => { richiesta = null; avvisa(); });

// "installata" (la stai usando come app), "installabile" (c'è il pulsante), "iphone" (istruzioni per Safari), "altro"
export function statoInstallazione() {
  const comeApp = matchMedia("(display-mode: standalone)").matches || navigator.standalone === true; // navigator.standalone: iPhone
  if (comeApp) return "installata";
  if (richiesta) return "installabile";
  if (/iphone|ipad|ipod/i.test(navigator.userAgent)) return "iphone";
  return "altro";
}

// Chi vuole sapere quando lo stato cambia (es. arriva beforeinstallprompt dopo che la pagina è già disegnata)
export function suCambioInstallazione(f) {
  chiAscolta.add(f);
}

// Mostra la finestra «Installare Loadout?» del browser. true se hai accettato
export async function installa() {
  if (!richiesta) return false;
  richiesta.prompt();
  const { outcome } = await richiesta.userChoice; // "accepted" o "dismissed"
  richiesta = null;                               // l'evento si può usare una volta sola
  avvisa();
  return outcome === "accepted";
}
