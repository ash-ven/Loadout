// =====================================================================
//  GLOSSARIO IN UNA FINESTRELLA (4/11, Asiha): toccando un «?» la spiegazione si apre lì, nella pagina,
//  invece di portarti alla pagina Consigli. Le voci sono quelle del glossario di consigli.html (una sola fonte):
//  la prima volta scarichiamo la pagina, la leggiamo con DOMParser e teniamo le voci in memoria.
//  Basta importare il file: ascolta i clic su tutti i link a.aiuto della pagina, anche quelli aggiunti dopo.
//  Se il glossario non si può caricare (es. senza rete), il link funziona come prima e apre la pagina.
// =====================================================================
const CHIUDI = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>';

let voci = null; // Map id → { titolo, contenuto (i nodi della definizione) }
async function caricaVoci() {
  if (voci) return voci;
  const html = await (await fetch("/consigli.html")).text();
  const doc = new DOMParser().parseFromString(html, "text/html");
  voci = new Map([...doc.querySelectorAll(".voci-glossario dt[id]")].map((dt) => [dt.id, { titolo: dt.textContent.trim(), dd: dt.nextElementSibling }]));
  return voci;
}

// La finestrella: una sola, creata la prima volta (stesso stile delle altre finestre dell'app)
let finestra = null;
function laFinestra() {
  if (finestra) return finestra;
  finestra = document.createElement("dialog");
  finestra.className = "finestra finestra-glossario";
  finestra.setAttribute("aria-labelledby", "glossario-titolo");
  finestra.innerHTML = `<div class="finestra-contenuto">
      <div class="finestra-testa"><h2 id="glossario-titolo"></h2>
        <button type="button" class="chiudi" aria-label="Chiudi">${CHIUDI}</button></div>
      <div class="glossario-testo"></div>
      <p class="glossario-tutto"><a href="/consigli.html#glossario">Tutto il glossario →</a></p>
    </div>`;
  finestra.querySelector(".chiudi").addEventListener("click", () => finestra.close());
  finestra.addEventListener("click", (e) => { if (e.target === finestra) finestra.close(); }); // tocco fuori: si chiude
  document.body.append(finestra);
  return finestra;
}

document.addEventListener("click", async (e) => {
  const link = e.target.closest("a.aiuto[href*='#g-']");
  if (!link || e.ctrlKey || e.metaKey || e.shiftKey) return; // Ctrl+clic: chi vuole la pagina intera la apre lo stesso
  e.preventDefault();
  const id = link.getAttribute("href").split("#")[1];
  try {
    const voce = (await caricaVoci()).get(id);
    if (!voce) throw new Error("voce non trovata");
    const f = laFinestra();
    f.querySelector("#glossario-titolo").textContent = voce.titolo;
    // importNode: copiamo i nodi della definizione (testo nostro, dalla nostra pagina) senza passare da innerHTML
    f.querySelector(".glossario-testo").replaceChildren(...[...voce.dd.childNodes].map((n) => document.importNode(n, true)));
    f.querySelector(".glossario-tutto a").href = `/consigli.html#${id}`;
    f.showModal();
  } catch {
    location.href = link.href; // senza glossario: come prima, alla pagina
  }
});
