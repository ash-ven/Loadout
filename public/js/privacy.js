// 5/11 (accessibilità, WCAG 3.2.3 – scelta di Asiha): l'informativa è pubblica (si legge anche prima di registrarsi),
// ma se sei entrata deve avere lo stesso menu delle altre pagine. Chiediamo chi sei con fetch() e NON con api():
// api() con una risposta 401 ti porterebbe al login, e qui chi non è entrato deve poter leggere la pagina.
try {
  const risposta = await fetch("/api/auth/me");
  if (risposta.ok) {
    for (const el of document.querySelectorAll(".topbar .menu, .topbar .consigli-alto, .topbar #esci")) el.hidden = false;
    await import("./menu.js"); // «Esci» e i nomi delle voci al passaggio del mouse, come nelle altre pagine
  }
} catch {
  // senza rete resta la pagina con il solo logo: va bene così
}
