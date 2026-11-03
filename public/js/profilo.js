import { api } from "./api.js";
import { esci } from "./menu.js"; // importare menu.js collega anche il link "Esci" della barra
import { statoInstallazione, suCambioInstallazione, installa } from "./pwa.js";

const elNome = document.querySelector("#nome");
const elEmail = document.querySelector("#email");
const avatar = document.querySelector("#avatar");
const scegliFoto = document.querySelector("#scegli-foto");
const rimuoviFoto = document.querySelector("#rimuovi-foto");
const erroreFoto = document.querySelector("#foto-errore");
const formDati = document.querySelector("#form-dati");
const infoDati = document.querySelector("#dati-info");
const erroreDati = document.querySelector("#dati-errore");
const formProfilo = document.querySelector("#form-profilo");
const campoPeso = formProfilo.elements.peso_corporeo_kg;
const info = document.querySelector("#profilo-info");
const errore = document.querySelector("#profilo-errore");

// Chi sono? Se non sono loggata, api() mi porta da sola alla pagina di login
let utente = await api("/api/auth/me");
elNome.textContent = utente.nome;
elEmail.textContent = utente.email;
campoPeso.value = utente.peso_corporeo_kg ?? "";
mostraSoglia(utente.peso_corporeo_kg);
mostraFoto();
// I campi del form "Dati personali" (stessi nomi delle colonne del database)
const CAMPI_DATI = ["sensibilita_freddo", "emergenza_nome", "emergenza_telefono", "note_mediche", "tessera_soccorso"];
for (const nome of CAMPI_DATI) {
  formDati.elements[nome].value = utente[nome] ?? "";
}
// C9: le note mediche si possono scrivere solo con il consenso. Il server registra QUANDO l'hai dato
// (consenso_salute_il): la casella è spuntata solo se il consenso c'è davvero
const consensoSalute = document.querySelector("#consenso-salute");
const campoNote = formDati.elements.note_mediche;
const dataConsenso = document.querySelector("#data-consenso");
consensoSalute.checked = Boolean(utente.consenso_salute_il);
campoNote.disabled = !consensoSalute.checked;
mostraDataConsenso();
// Note salvate prima che chiedessimo il consenso: restano visibili, ma per tenerle va spuntata la casella
if (utente.note_mediche && !utente.consenso_salute_il) {
  infoDati.textContent = "Le tue note mediche sono state salvate prima che chiedessimo il consenso: spunta la casella per tenerle. " +
    "Se salvi senza spunta, vengono cancellate.";
  infoDati.hidden = false;
}

function mostraDataConsenso() {
  dataConsenso.hidden = !utente.consenso_salute_il;
  if (utente.consenso_salute_il) {
    dataConsenso.textContent = `Consenso dato il ${new Date(utente.consenso_salute_il).toLocaleDateString("it-IT")}. ` +
      "Togliendo la spunta lo ritiri e le note vengono cancellate.";
  }
}

// =====================================================================
//  FOTO (C1)
// =====================================================================

// La foto è un'immagine vera all'indirizzo /api/auth/me/foto. Il "?v=" con l'ora cambia l'indirizzo
// ogni volta: così, dopo averla cambiata, il browser non mostra quella vecchia dalla sua cache.
function mostraFoto() {
  if (utente.ha_foto) {
    avatar.innerHTML = `<img src="/api/auth/me/foto?v=${Date.now()}" alt="">`;
  } else {
    avatar.textContent = utente.nome.trim().charAt(0).toUpperCase(); // l'iniziale del nome
  }
  rimuoviFoto.hidden = !utente.ha_foto;
}

// Scelta del file: il browser la ritaglia quadrata e la riduce a 256×256 PRIMA di mandarla.
// Una foto del telefono pesa 3–5 MB; ridotta così pesa circa 20–40 kB.
scegliFoto.addEventListener("change", async () => {
  const file = scegliFoto.files[0];
  scegliFoto.value = ""; // così si può riscegliere lo stesso file
  if (!file) return;
  erroreFoto.hidden = true;
  try {
    const foto = await riduciFoto(file);
    utente = await api("/api/auth/me", { method: "PATCH", body: { foto } });
    mostraFoto();
  } catch (err) {
    erroreFoto.textContent = err.message || "Immagine non leggibile";
    erroreFoto.hidden = false;
  }
});

rimuoviFoto.addEventListener("click", async () => {
  if (!confirm("Togliere la foto del profilo?")) return;
  utente = await api("/api/auth/me", { method: "PATCH", body: { foto: null } }); // null = svuota
  mostraFoto();
});

// Ritaglia al centro un quadrato e lo disegna su un <canvas> 256×256, poi lo trasforma in testo JPEG
async function riduciFoto(file, lato = 256) {
  const immagine = await createImageBitmap(file); // decodifica il file in un'immagine
  const quadrato = Math.min(immagine.width, immagine.height);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = lato;
  canvas.getContext("2d").drawImage(
    immagine,
    (immagine.width - quadrato) / 2, (immagine.height - quadrato) / 2, quadrato, quadrato, // parte da prendere
    0, 0, lato, lato                                                                        // dove disegnarla
  );
  return canvas.toDataURL("image/jpeg", 0.85); // "data:image/jpeg;base64,..." (qualità 85%)
}

// =====================================================================
//  DATI PERSONALI (C1)
// =====================================================================
// C9 (revisione UX 2): niente pulsante. Ogni campo si salva quando lo cambi (evento "change": per le tendine
// appena scegli, per i campi di testo quando esci dal campo) e accanto al titolo compare «Salvato».
const statoDati = document.querySelector("#dati-stato");
const statoPeso = document.querySelector("#peso-stato");
const timerStato = new Map();

// Il piccolo stato accanto al titolo: «Salvataggio…», poi «Salvato» che sparisce dopo 3 secondi
function mostraStato(el, testo, sparisce = false) {
  el.textContent = testo;
  clearTimeout(timerStato.get(el));
  if (sparisce) timerStato.set(el, setTimeout(() => { el.textContent = ""; }, 3000));
}

async function salvaDati() {
  infoDati.hidden = true;
  erroreDati.hidden = true;
  // Mando tutti i campi: quelli vuoti ("") il server li svuota. Senza consenso le note mediche vanno sempre vuote.
  const dati = {};
  for (const nome of CAMPI_DATI) {
    dati[nome] = formDati.elements[nome].value.trim();
  }
  if (!consensoSalute.checked) dati.note_mediche = "";
  dati.consenso_salute = consensoSalute.checked; // il server registra la data del consenso, o lo ritira
  mostraStato(statoDati, "Salvataggio…");
  try {
    utente = await api("/api/auth/me", { method: "PATCH", body: dati });
    mostraStato(statoDati, "✓ Salvato", true);
    mostraDataConsenso();
  } catch (err) {
    mostraStato(statoDati, "");
    erroreDati.textContent = err.message; // es. "Numero di telefono non valido"
    erroreDati.hidden = false;
  }
}

formDati.addEventListener("change", (e) => {
  if (e.target === consensoSalute) return; // la casella ha il suo gestore qui sotto
  salvaDati();
});
// Invio in un campo di testo: niente ricarica della pagina, si salva e basta
formDati.addEventListener("submit", (e) => { e.preventDefault(); salvaDati(); });

// Togliendo il consenso, le note mediche spariscono subito anche dal server
// Spuntare = dare il consenso (si registra subito la data); togliere la spunta = ritirarlo (note cancellate)
consensoSalute.addEventListener("change", async () => {
  campoNote.disabled = !consensoSalute.checked;
  const cherano = campoNote.value.trim() !== "";
  if (!consensoSalute.checked) campoNote.value = "";
  await salvaDati();
  if (consensoSalute.checked) {
    campoNote.focus();
  } else {
    infoDati.textContent = cherano ? "Consenso ritirato: note mediche cancellate." : "Consenso ritirato.";
    infoDati.hidden = false;
  }
});

// =====================================================================
//  PESO CORPOREO (stretch 5)
// =====================================================================

// Pulsante "Esci dall'account": stessa funzione del link nel menu
document.querySelector("#bottone-esci").addEventListener("click", esci);

// Salvataggio del peso corporeo. C9: appena cambi il valore (uscendo dal campo), senza pulsante
async function salvaPeso() {
  errore.hidden = true;

  // Validazione lato client: stesso intervallo che controlla il server (20–300)
  const peso = Number(campoPeso.value);
  if (campoPeso.value === "" || Number.isNaN(peso) || peso < 20 || peso > 300) {
    errore.textContent = "Inserisci un peso tra 20 e 300 kg";
    errore.hidden = false;
    return;
  }

  mostraStato(statoPeso, "Salvataggio…");
  try {
    const aggiornato = await api("/api/auth/me", { method: "PATCH", body: { peso_corporeo_kg: peso } });
    mostraSoglia(aggiornato.peso_corporeo_kg);
    mostraStato(statoPeso, "✓ Salvato", true);
  } catch (err) {
    mostraStato(statoPeso, "");
    errore.textContent = err.message;
    errore.hidden = false;
  }
}
campoPeso.addEventListener("change", salvaPeso);
formProfilo.addEventListener("submit", (e) => { e.preventDefault(); salvaPeso(); });

// Mostra le due soglie (B4): 10% in giornata, 20% con pernotto, in formato italiano (es. "5,7")
function mostraSoglia(peso, appenaSalvato = false) {
  if (peso == null) {
    info.textContent = "Peso non ancora impostato: l'avviso sullo zaino è disattivato.";
  } else {
    const kg = (percento) => (peso * percento / 100).toLocaleString("it-IT", { maximumFractionDigits: 1 });
    const prefisso = appenaSalvato ? "Peso salvato. " : "";
    info.textContent = `${prefisso}Il tuo zaino, senza acqua e cibo, non dovrebbe superare ${kg(10)} kg in giornata e ${kg(20)} kg con il pernotto.`;
  }
  info.hidden = false;
}

// =====================================================================
//  B7: ACCOUNT E PRIVACY
// =====================================================================

// --- Cambia password ---
const formPassword = document.querySelector("#form-password");
const infoPassword = document.querySelector("#password-info");
const errorePassword = document.querySelector("#password-errore");

formPassword.addEventListener("submit", async (e) => {
  e.preventDefault();
  infoPassword.hidden = true;
  errorePassword.hidden = true;
  const { attuale, nuova, ripeti } = Object.fromEntries(new FormData(formPassword));
  const problema = !attuale || !nuova ? "Scrivi la password attuale e quella nuova"
    : nuova.length < 8 ? "La nuova password deve avere almeno 8 caratteri"
    : nuova !== ripeti ? "Le due nuove password non sono uguali"
    : null;
  if (problema) {
    errorePassword.textContent = problema;
    errorePassword.hidden = false;
    return;
  }
  try {
    await api("/api/auth/me/password", { method: "PUT", body: { attuale, nuova } });
    formPassword.reset();
    infoPassword.textContent = "Password cambiata.";
    infoPassword.hidden = false;
  } catch (err) {
    errorePassword.textContent = err.message; // es. "La password attuale non è corretta"
    errorePassword.hidden = false;
  }
});

// --- Elimina account: una finestra di conferma con la password ---
const finestraElimina = document.querySelector("#finestra-elimina");
const formElimina = document.querySelector("#form-elimina");
const erroreElimina = document.querySelector("#elimina-errore");

document.querySelector("#apri-elimina").addEventListener("click", () => {
  formElimina.reset();
  erroreElimina.hidden = true;
  finestraElimina.showModal();
  formElimina.elements.password.focus();
});
document.querySelector("#chiudi-elimina").addEventListener("click", () => finestraElimina.close());
document.querySelector("#annulla-elimina").addEventListener("click", () => finestraElimina.close());

formElimina.addEventListener("submit", async (e) => {
  e.preventDefault();
  const password = formElimina.elements.password.value;
  if (!password) {
    erroreElimina.textContent = "Scrivi la tua password per confermare";
    erroreElimina.hidden = false;
    return;
  }
  try {
    await api("/api/auth/me", { method: "DELETE", body: { password } });
    location.href = "/login.html?eliminato=1"; // account cancellato: torniamo all'ingresso
  } catch (err) {
    erroreElimina.textContent = err.message; // es. "Password non corretta"
    erroreElimina.hidden = false;
  }
});

// =====================================================================
//  PWA (3/11): «Loadout sul telefono». Il testo cambia con lo stato (pwa.js, statoInstallazione)
// =====================================================================
const testoApp = document.querySelector("#app-testo");
const bottoneInstalla = document.querySelector("#installa-app");
const TESTI_APP = {
  installata: "✓ Stai usando Loadout come app installata.",
  installabile: "Installa Loadout come un'app: un'icona nella schermata Home e la pagina a tutto schermo, senza la barra del browser.",
  iphone: "Su iPhone: apri Loadout in Safari, tocca Condividi (il quadrato con la freccia) e poi «Aggiungi alla schermata Home».",
  android: "Il browser che stai usando non sa installare le app web: apri Loadout con Chrome e torna qui (oppure dal menu ⋮ scegli «Installa app»).",
  altro: "Per installarla apri Loadout con Chrome sul telefono: dal menu ⋮ scegli «Installa app» (o «Aggiungi a schermata Home»).",
};
function mostraApp(stato) {
  testoApp.textContent = TESTI_APP[stato];
  bottoneInstalla.hidden = stato !== "installabile";
}
mostraApp(statoInstallazione());
suCambioInstallazione(mostraApp);   // l'evento del browser può arrivare dopo che la pagina è già pronta
bottoneInstalla.addEventListener("click", () => installa());
