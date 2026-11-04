// =====================================================================
//  B12 (revisione UX 2): la finestra "Prepara il tuo cammino" / "Modifica" in un modulo condiviso.
//  La usano la pagina Viaggi (per creare un'uscita) e la scheda dell'uscita (per modificarla SENZA cambiare pagina).
//  Il markup della finestra sta qui sotto (prima era in viaggi.html): attivaFormUscita() lo aggiunge alla pagina.
//  Tutto il resto è il codice che prima stava in viaggi.js, spostato senza cambiarne il comportamento.
// =====================================================================
import { api } from "./api.js";
import { attivaCampoLuogo } from "./campo-luogo.js";
import { staccaPostItScrivendo } from "./post-it.js";
import { erroriCoordinate, erroriQuote, uniformaDecimali } from "./controlli.js";
import { mostraErroriCampi, pulisciErroriCampi, pulisciScrivendo } from "./errori-campi.js";

const HTML_FINESTRA = `
    <dialog class="finestra" id="finestra" aria-labelledby="titolo-form">
      <div class="finestra-contenuto">
      <div class="finestra-testa">
        <h2><img class="icona" src="/img/icone/percorso.svg" alt="" width="24" height="24"><span id="titolo-form">Nuovo viaggio</span></h2>
        <button type="button" class="chiudi" id="chiudi" aria-label="Chiudi"><svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg></button>
      </div>
      <form id="form-viaggio" novalidate>
        <label>Nome del viaggio
          <input name="nome" type="text" maxlength="150" required>
        </label>
        <label>Attività
          <select name="attivita" required>
            <option value="escursione">Escursione e trekking</option>
            <option value="alpinismo">Alpinismo</option>
            <option value="ciaspolata">Ciaspolata</option>
            <option value="ferrata">Ferrata</option>
          </select>
        </label>
        <div class="riga2">
          <label>Persone
            <input name="n_persone" type="number" min="1" max="50" step="1" value="1">
          </label>
          <label>Giorni
            <input name="n_giorni" type="number" min="1" max="60" step="1" value="1">
          </label>
        </div>
        <label>Pernotto
          <select name="pernotto">
            <option value="nessuno">Nessuno (in giornata)</option>
            <option value="rifugio">Rifugio</option>
            <option value="tenda">Tenda</option>
            <option value="bivacco">Bivacco</option>
          </select>
        </label>
        <div class="riga2">
          <label>Data di partenza
            <input name="data_partenza" type="date">
          </label>
          <!-- Mappe, fase 1: serve a stimare a che ora arrivi in vetta (per il meteo lassù) e se parti troppo tardi -->
          <label>Ora di partenza
            <input name="ora_partenza" type="time" value="08:00">
          </label>
        </div>

        <!-- B1: il luogo per nome, con i suggerimenti (OpenStreetMap). Scegliendo un suggerimento
             si compilano anche le coordinate qui sotto (post-it "dal luogo"). -->
        <div class="campo-luogo">
          <label>Da dove parti
            <input name="luogo_partenza" type="text" maxlength="200" required autocomplete="off"
                   placeholder="es. Malga Prato"
                   role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="suggerimenti-partenza">
          </label>
          <ul class="suggerimenti" id="suggerimenti-partenza" role="listbox" hidden></ul>
        </div>
        <!-- Le coordinate sono sempre visibili: le compila il luogo, ma quello che scrivi tu vince sempre.
             Se l'uscita ha una mappa diventano non modificabili qui: si cambiano nella pagina della mappa (revisione UX 2) -->
        <p class="muto nota-mappa" hidden>Questi dati vengono dalla mappa: per cambiarli <a class="link-mappa" href="#">apri la mappa</a>.</p>
        <div class="riga2">
          <label><span class="nome-campo">Latitudine partenza <span class="origine"></span></span>
            <input name="lat_partenza" type="number" min="-90" max="90" step="any" placeholder="es. 44,22">
          </label>
          <label><span class="nome-campo">Longitudine partenza <span class="origine"></span></span>
            <input name="lon_partenza" type="number" min="-180" max="180" step="any" placeholder="es. 10,99">
          </label>
        </div>
        <div class="campo-luogo">
          <label><span>Arrivo <span class="muto">(se diverso)</span></span>
            <input name="luogo_arrivo" type="text" maxlength="200" autocomplete="off" placeholder="es. Rifugio Lagazuoi"
                   role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="suggerimenti-arrivo">
          </label>
          <ul class="suggerimenti" id="suggerimenti-arrivo" role="listbox" hidden></ul>
        </div>
        <div class="riga2">
          <label><span class="nome-campo">Latitudine arrivo <span class="origine"></span></span>
            <input name="lat_arrivo" type="number" min="-90" max="90" step="any">
          </label>
          <label><span class="nome-campo">Longitudine arrivo <span class="origine"></span></span>
            <input name="lon_arrivo" type="number" min="-180" max="180" step="any">
          </label>
        </div>
        <label class="check"><input name="serve_cucina" type="checkbox"> Serve la cucina</label>

        <details>
          <summary>Percorso (facoltativo)</summary>
          <!-- 4/11 (Asiha): la nota «Questi dati vengono dalla mappa…» resta una volta sola, sopra le coordinate -->
          <!-- Il percorso si può anche disegnare sulla mappa, nella pagina della mappa dell'uscita (dalla scheda: «Disegna la mappa») -->
          <div class="riga2">
            <label>Lunghezza (km)
              <input name="distanza_km" type="number" min="0.1" max="999" step="0.1">
            </label>
            <label>Dislivello positivo (m)
              <input name="dislivello_m" type="number" min="0" max="9000" step="1">
            </label>
          </div>
          <!-- B3: il punto più alto del percorso → meteo in vetta, avviso neve e ghiaccio -->
          <div class="riga2">
            <label>Quota minima (m)
              <input name="quota_min_m" type="number" min="-500" max="9000" step="1" placeholder="es. 900">
            </label>
            <label>Quota massima (m)
              <input name="quota_max_m" type="number" min="0" max="9000" step="1" placeholder="es. 2400">
            </label>
          </div>
          <label>Note
            <textarea name="note" maxlength="1000" rows="2"></textarea>
          </label>
        </details>

        <!-- C5 (revisione UX 2): niente più casella «Percorso da fare in futuro»: un viaggio senza data è da fare
             (pianificato lo calcoliamo noi al salvataggio, così il filtro «Da fare» continua a funzionare) -->
        <label class="check" id="riga-genera"><input name="genera" type="checkbox" checked> <img class="icona" src="/img/icone/zaino.svg" alt="" width="24" height="24">Genera subito lo zaino</label>
        <p class="errore" id="form-errore" hidden></p>
        <div class="azioni">
          <button type="submit" id="salva">Crea il viaggio</button>
          <button type="button" class="secondario" id="annulla">Annulla</button>
        </div>
      </form>
      </div>
    </dialog>`;

// suSalvato({ id, nuova, zainoDaAggiornare }): cosa fare dopo il salvataggio (la pagina decide: andare alla scheda, aggiornarla…)
// Restituisce { nuova(), modifica(viaggio, { alChiudere }) }
export function attivaFormUscita({ suSalvato }) {
  document.body.insertAdjacentHTML("beforeend", HTML_FINESTRA);
  const finestra = document.querySelector("#finestra");          // il <dialog> con il form
  const form = finestra.querySelector("#form-viaggio");
  const campi = form.elements;
  const erroreForm = finestra.querySelector("#form-errore");
  const bottoneSalva = finestra.querySelector("#salva");
  const titoloForm = finestra.querySelector("#titolo-form");
  const rigaGenera = finestra.querySelector("#riga-genera");     // "Genera subito lo zaino": solo quando crei

  let inModifica = null; // id del viaggio in modifica, oppure null se creo
  let prima = null;      // il viaggio com'era prima della modifica (per capire se lo zaino va aggiornato)
  let alChiudere = null; // facoltativa: cosa fare quando la finestra si chiude senza salvare

  // --- La finestra (dialog) ---
  // showModal() la apre sopra la pagina (il resto non è cliccabile); close() la chiude. Esc la chiude da sola.
  function apriFinestra() {
    finestra.showModal();
    campi.nome.focus(); // il cursore va nel primo campo
  }
  finestra.querySelector("#chiudi").addEventListener("click", () => finestra.close());
  finestra.querySelector("#annulla").addEventListener("click", () => finestra.close());
  // Clic sullo sfondo scuro fuori dalla finestra: chiude (il contenuto è dentro .finestra-contenuto)
  finestra.addEventListener("click", (e) => { if (e.target === finestra) finestra.close(); });

  // Le coordinate possono avere il post-it (compilate dal luogo, o dalla mappa nella sua pagina): scrivendo a mano diventano tue
  const CAMPI_POST_IT = ["lat_partenza", "lon_partenza", "lat_arrivo", "lon_arrivo"];
  // Se l'uscita ha una mappa, questi dati si cambiano SOLO nella pagina della mappa (un posto solo, niente contraddizioni)
  const CAMPI_DELLA_MAPPA = [...CAMPI_POST_IT, "distanza_km", "dislivello_m", "quota_min_m", "quota_max_m"];
  const noteMappa = finestra.querySelectorAll(".nota-mappa");

  // Blocca (o sblocca) i dati del percorso. Bloccati = si vedono ma non si scrivono (readonly, non disabled:
  // un campo disabled non verrebbe mandato, e il PUT, che sostituisce l'uscita intera, li cancellerebbe)
  function bloccaDatiDellaMappa(idUscita) {
    const blocca = idUscita != null;
    for (const nome of CAMPI_DELLA_MAPPA) {
      campi[nome].readOnly = blocca;
      if (blocca) delete campi[nome].dataset.auto; // la nota sopra dice già da dove vengono
    }
    noteMappa.forEach((nota) => {
      nota.hidden = !blocca;
      if (blocca) nota.querySelector(".link-mappa").href = `/mappa.html?id=${idUscita}`;
    });
  }
  staccaPostItScrivendo(CAMPI_POST_IT.map((nome) => campi[nome]));
  pulisciScrivendo(form); // correggendo un campo, il suo messaggio d'errore sparisce
  uniformaDecimali(CAMPI_DELLA_MAPPA.map((nome) => campi[nome])); // C1: sempre la virgola

  // I due campi luogo con i suggerimenti (il nome e, scegliendo, le coordinate)
  const luogoPartenza = attivaCampoLuogo({
    campoTesto: campi.luogo_partenza, lista: finestra.querySelector("#suggerimenti-partenza"),
    campoLat: campi.lat_partenza, campoLon: campi.lon_partenza,
  });
  const luogoArrivo = attivaCampoLuogo({
    campoTesto: campi.luogo_arrivo, lista: finestra.querySelector("#suggerimenti-arrivo"),
    campoLat: campi.lat_arrivo, campoLon: campi.lon_arrivo,
  });

  // Quando la finestra si chiude, il form torna pulito per la prossima volta
  function svuotaForm() {
    form.reset(); // rimette i valori iniziali scritti nell'HTML (1 persona, 1 giorno, "genera" spuntato)
    CAMPI_POST_IT.forEach((nome) => delete campi[nome].dataset.auto); // reset() non toglie i post-it
    pulisciErroriCampi(form);
    bloccaDatiDellaMappa(null); // uscita nuova: niente mappa, tutto modificabile
    erroreForm.hidden = true;
    inModifica = null;
    titoloForm.textContent = "Nuovo viaggio";
    bottoneSalva.textContent = "Crea il viaggio";
    bottoneSalva.disabled = false;
    rigaGenera.hidden = false;
    luogoPartenza.aggiorna();
    luogoArrivo.aggiorna();
  }

  let salvato = false;
  finestra.addEventListener("close", () => {
    const funzione = salvato ? null : alChiudere;
    salvato = false;
    alChiudere = null;
    svuotaForm();
    funzione?.();
  });

  // --- Modifica: riempie il form con i dati del viaggio e apre la finestra ---
  function apriModifica(v) {
    svuotaForm();
    inModifica = v.id;
    prima = v;
    titoloForm.textContent = `Modifica: ${v.nome}`;
    bottoneSalva.textContent = "Salva le modifiche";
    rigaGenera.hidden = true; // lo zaino c'è già: "genera" lo trovi nella scheda
    for (const nome of ["nome", "attivita", "n_persone", "n_giorni", "pernotto", "data_partenza", "distanza_km",
                        "dislivello_m", "lat_partenza", "lon_partenza", "lat_arrivo", "lon_arrivo", "note",
                        "luogo_partenza", "luogo_arrivo", "quota_max_m", "quota_min_m"]) {
      campi[nome].value = v[nome] ?? "";
    }
    campi.ora_partenza.value = v.ora_partenza ?? "08:00"; // senza ora salvata, vale quella di default
    if (v.traccia) {
      bloccaDatiDellaMappa(v.id); // c'è la mappa: i dati del percorso si cambiano nella sua pagina
    } else {
      // Senza mappa le coordinate in modifica le consideriamo "dal luogo": scegliendo un altro luogo si aggiornano
      for (const nome of CAMPI_POST_IT) {
        if (campi[nome].value !== "") campi[nome].dataset.auto = "luogo";
      }
    }
    campi.serve_cucina.checked = v.serve_cucina;
    apriFinestra();
  }

  // --- Lettura e validazione del form ---
  function leggiForm() {
    // campo numerico facoltativo: vuoto → undefined (non viene mandato), altrimenti numero
    const numero = (nome) => (campi[nome].value === "" ? undefined : Number(campi[nome].value));
    return {
      nome: campi.nome.value.trim(),
      attivita: campi.attivita.value,
      n_persone: numero("n_persone"),
      n_giorni: numero("n_giorni"),
      pernotto: campi.pernotto.value,
      serve_cucina: campi.serve_cucina.checked,
      data_partenza: campi.data_partenza.value || undefined,
      distanza_km: numero("distanza_km"),
      dislivello_m: numero("dislivello_m"),
      lat_partenza: numero("lat_partenza"),
      lon_partenza: numero("lon_partenza"),
      lat_arrivo: numero("lat_arrivo"),
      lon_arrivo: numero("lon_arrivo"),
      note: campi.note.value.trim(),
      pianificato: campi.data_partenza.value === "", // C5: senza data = da fare in futuro
      luogo_partenza: campi.luogo_partenza.value.trim(),
      luogo_arrivo: campi.luogo_arrivo.value.trim(),
      quota_max_m: numero("quota_max_m"),
      quota_min_m: numero("quota_min_m"),
      ora_partenza: campi.ora_partenza.value || undefined,
      // la traccia della mappa non è un campo del form (si disegna nella pagina della mappa): in modifica
      // la rimandiamo com'era, altrimenti il PUT (che sostituisce il viaggio intero) la cancellerebbe
      traccia: inModifica ? (prima?.traccia ?? undefined) : undefined,
    };
  }

  // Ogni errore dice a quale campo si riferisce, e il messaggio compare sotto quel campo (B1)
  function validaLatoClient(d) {
    const errori = [];
    if (!d.nome) errori.push({ campo: "nome", testo: "Scrivi il nome del viaggio" });
    if (!d.luogo_partenza) errori.push({ campo: "luogo_partenza", testo: "Scrivi da dove parti" });
    if (d.n_persone !== undefined && (!Number.isInteger(d.n_persone) || d.n_persone < 1 || d.n_persone > 50)) {
      errori.push({ campo: "n_persone", testo: "Le persone vanno da 1 a 50" });
    }
    if (d.n_giorni !== undefined && (!Number.isInteger(d.n_giorni) || d.n_giorni < 1 || d.n_giorni > 60)) {
      errori.push({ campo: "n_giorni", testo: "I giorni vanno da 1 a 60" });
    }
    errori.push(...erroriCoordinate(d)); // A3: coordinate fuori dai limiti, con un esempio
    errori.push(...erroriQuote(d));
    // Le quote stanno nel riquadro «Percorso»: se lì c'è un errore, lo apriamo, altrimenti il campo non si vedrebbe
    if (errori.some((e) => e.campo === "quota_min_m" || e.campo === "quota_max_m")) form.querySelector("details").open = true;
    return errori;
  }

  // --- Salvataggio ---
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    erroreForm.hidden = true;
    const dati = leggiForm();
    if (mostraErroriCampi(form, validaLatoClient(dati))) return; // sotto i campi sbagliati, e il cursore va al primo

    bottoneSalva.disabled = true;
    try {
      let id = inModifica;
      let zainoDaAggiornare = false;
      const nuova = !inModifica;
      if (inModifica) {
        // Modifica: PUT con il viaggio intero. Lo zaino non cambia da solo, ma se sono cambiati
        // i dati che decidono cosa ci va dentro, la scheda propone di aggiornarlo.
        await api(`/api/viaggi/${inModifica}`, { method: "PUT", body: dati });
        zainoDaAggiornare = ["attivita", "pernotto", "serve_cucina", "n_giorni"]
          .some((campo) => String(dati[campo]) !== String(prima[campo]));
      } else {
        const url = campi.genera.checked ? "/api/viaggi?genera=true" : "/api/viaggi";
        id = (await api(url, { method: "POST", body: dati })).id;
      }
      salvato = true;
      finestra.close();
      await suSalvato({ id, nuova, zainoDaAggiornare });
    } catch (err) {
      erroreForm.textContent = err.message; // gli errori del server mostrati nel form
      erroreForm.hidden = false;
      bottoneSalva.disabled = false;
    }
  });

  return {
    nuova() { svuotaForm(); apriFinestra(); },
    modifica(viaggio, opzioni = {}) { apriModifica(viaggio); alChiudere = opzioni.alChiudere ?? null; },
  };
}
