// =====================================================================
//  INVIO DELLE EMAIL (4/11): conferma dell'indirizzo e «password dimenticata».
//  Render gratuito blocca le porte SMTP (25, 465, 587): niente invio "diretto" da Node.
//  Usiamo l'API di Brevo, che si chiama via https (porta 443, quella permessa): piano gratuito, 300 email al giorno.
//    BREVO_API_KEY   la chiave dell'API (Brevo → SMTP & API → API Keys)
//    EMAIL_MITTENTE  l'indirizzo da cui partono (verificato su Brevo come "sender")
//    EMAIL_ASSISTENZA (facoltativa) dove arrivano le risposte e i messaggi degli utenti; senza, è EMAIL_MITTENTE
//  Senza BREVO_API_KEY (sul PC, in sviluppo) le email NON partono: il testo e il link compaiono nel terminale
//  del container (docker compose logs api). Così si prova tutto senza account esterni.
// =====================================================================

const URL_BREVO = "https://api.brevo.com/v3/smtp/email";

// Rende "innocuo" un testo prima di metterlo nell'HTML dell'email (il nome lo sceglie l'utente)
function esc(testo) {
  return String(testo ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

// 4/11: l'indirizzo per assistenza e suggerimenti (per ora lo stesso Gmail che spedisce: scelta di Asiha)
export const indirizzoAssistenza = () => process.env.EMAIL_ASSISTENZA || process.env.EMAIL_MITTENTE || "";

// Il modello di tutte le email: titolo, una frase, il pulsante con il link, la riga per chi non ha chiesto niente
export function componiEmail({ nome, titolo, frase, pulsante, link, nota }) {
  const assistenza = indirizzoAssistenza();
  const righeAssistenza = assistenza ? `\n\nProblemi o suggerimenti? Scrivi a ${assistenza}` : "";
  const testo = `Ciao ${nome},\n\n${frase}\n\n${pulsante}: ${link}\n\n${nota}${righeAssistenza}\n\n— Loadout`;
  const html = `<!doctype html><html lang="it"><body style="margin:0;padding:24px;background:#ece3cf;font-family:Arial,sans-serif;color:#2e3a2f">
  <div style="max-width:480px;margin:0 auto;background:#f6efdf;border-radius:16px;padding:28px">
    <p style="margin:0 0 4px;font-size:20px;font-weight:bold;color:#31503f">Loadout</p>
    <h1 style="margin:16px 0 8px;font-size:22px;color:#31503f">${esc(titolo)}</h1>
    <p style="margin:0 0 8px">Ciao ${esc(nome)},</p>
    <p style="margin:0 0 20px;line-height:1.5">${esc(frase)}</p>
    <p style="margin:0 0 20px"><a href="${esc(link)}" style="display:inline-block;background:#c8962b;color:#2b1f05;text-decoration:none;font-weight:bold;padding:12px 20px;border-radius:999px">${esc(pulsante)}</a></p>
    <p style="margin:0 0 8px;font-size:13px;color:#6d6553">Se il pulsante non funziona, copia questo indirizzo nel browser:<br>${esc(link)}</p>
    <p style="margin:16px 0 0;font-size:13px;color:#6d6553">${esc(nota)}</p>
    ${assistenza ? `<p style="margin:12px 0 0;font-size:13px;color:#6d6553">Problemi o suggerimenti? Scrivi a <a href="mailto:${esc(assistenza)}" style="color:#31503f">${esc(assistenza)}</a></p>` : ""}
  </div></body></html>`;
  return { testo, html };
}

// rispondiA (facoltativo): chi riceve la risposta; senza, l'indirizzo di assistenza. html (facoltativo): senza, solo testo
export async function inviaEmail({ a, oggetto, testo, html, rispondiA }) {
  if (!process.env.BREVO_API_KEY) {
    // sviluppo: niente invio, solo il terminale
    console.log(`\n=== EMAIL (non inviata: manca BREVO_API_KEY) ===\nA: ${a}\nOggetto: ${oggetto}\n\n${testo}\n================================================\n`);
    return;
  }
  const risposta = await fetch(URL_BREVO, {
    method: "POST",
    // trim(): un copia-incolla nelle impostazioni di Render può portarsi dietro uno spazio o un a capo, e Brevo risponde «Key not found»
    headers: { "api-key": process.env.BREVO_API_KEY.trim(), "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      sender: { name: "Loadout", email: process.env.EMAIL_MITTENTE?.trim() },
      to: [{ email: a }],
      // «Rispondi a»: di solito l'assistenza; per un feedback firmato, chi l'ha scritto
      ...((rispondiA || indirizzoAssistenza()) ? { replyTo: { email: rispondiA || indirizzoAssistenza() } } : {}),
      subject: oggetto,
      textContent: testo,
      ...(html ? { htmlContent: html } : {}),
    }),
    signal: AbortSignal.timeout(10_000), // se Brevo non risponde in 10 secondi, lasciamo perdere (e lo scriviamo nel log)
  });
  if (!risposta.ok) throw new Error(`Brevo ha risposto ${risposta.status}: ${await risposta.text()}`);
}
