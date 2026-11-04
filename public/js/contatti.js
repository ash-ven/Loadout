// 4/11: «Problemi o suggerimenti? Scrivi a …». L'indirizzo arriva dal server (GET /api/contatti), così si cambia
// in un posto solo (EMAIL_ASSISTENZA su Render). Riempie ogni .riga-assistenza della pagina; senza indirizzo restano nascoste.
// fetch "a mano": la pagina di accesso non deve finire nel giro dei 401 di api()
export async function mostraAssistenza() {
  try {
    const { assistenza } = await (await fetch("/api/contatti")).json();
    if (!assistenza) return;
    for (const riga of document.querySelectorAll(".riga-assistenza")) {
      const link = document.createElement("a");
      link.href = `mailto:${assistenza}`;
      link.textContent = assistenza;
      riga.replaceChildren("Problemi o suggerimenti? Scrivi a ", link);
      riga.hidden = false;
    }
  } catch { /* senza rete o senza server: la riga resta nascosta */ }
}
