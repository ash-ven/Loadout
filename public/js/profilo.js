import { api } from "./api.js";
import { esci } from "./menu.js"; // importare menu.js collega anche il link "Esci" della barra

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
const CAMPI_DATI = ["livello_esperienza", "sensibilita_freddo", "emergenza_nome", "emergenza_telefono", "note_mediche", "tessera_soccorso"];
for (const nome of CAMPI_DATI) {
  formDati.elements[nome].value = utente[nome] ?? "";
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
formDati.addEventListener("submit", async (e) => {
  e.preventDefault();
  infoDati.hidden = true;
  erroreDati.hidden = true;
  // Mando tutti i campi: quelli vuoti ("") il server li svuota
  const dati = {};
  for (const nome of CAMPI_DATI) {
    dati[nome] = formDati.elements[nome].value.trim();
  }
  try {
    utente = await api("/api/auth/me", { method: "PATCH", body: dati });
    infoDati.textContent = "Dati salvati.";
    infoDati.hidden = false;
  } catch (err) {
    erroreDati.textContent = err.message; // es. "Numero di telefono non valido"
    erroreDati.hidden = false;
  }
});

// =====================================================================
//  PESO CORPOREO (stretch 5)
// =====================================================================

// Pulsante "Esci dall'account": stessa funzione del link nel menu
document.querySelector("#bottone-esci").addEventListener("click", esci);

// Salvataggio del peso corporeo
formProfilo.addEventListener("submit", async (e) => {
  e.preventDefault();
  errore.hidden = true;

  // Validazione lato client: stesso intervallo che controlla il server (20–300)
  const peso = Number(campoPeso.value);
  if (campoPeso.value === "" || Number.isNaN(peso) || peso < 20 || peso > 300) {
    errore.textContent = "Inserisci un peso tra 20 e 300 kg";
    errore.hidden = false;
    return;
  }

  try {
    const aggiornato = await api("/api/auth/me", { method: "PATCH", body: { peso_corporeo_kg: peso } });
    mostraSoglia(aggiornato.peso_corporeo_kg, true);
  } catch (err) {
    errore.textContent = err.message;
    errore.hidden = false;
  }
});

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
