# Loadout

## Scopo
- Loadout è una web app per escursionisti in cui ognuno registra la propria attrezzatura da montagna (l'armadio), con peso, categoria, marchio e indicazione di cosa è indispensabile o preferito.
- Per ogni uscita l'utente descrive il viaggio (attività, persone, giorni, pernotto, cucina) e con un click ottiene uno zaino proposto, composto dai suoi oggetti indispensabili e preferiti.
- Nella pagina del viaggio spunta la checklist, vede aggiornarsi in tempo reale il peso dello zaino e quello già inserito, e consulta i consigli: acqua a persona al giorno, alba e tramonto, meteo, percorso.

## Come avviare in locale

### Tutto con Docker (da zero)
Prerequisiti: Docker Desktop avviato. Node.js non serve.

```powershell
git clone <indirizzo-del-repository> loadout
cd loadout
Copy-Item .env.example .env      # poi apri .env e metti un JWT_SECRET lungo e casuale (e, per le mappe, la MAPTILER_KEY)
docker compose up -d --build     # database + API + Caddy; la prima volta scarica le immagini e crea il database
docker compose ps                # db e api devono risultare "healthy", caddy "Up"
```

Poi apri **https://localhost** nel browser (http://localhost rimanda su https da solo).

**HTTPS con certificato locale.** Caddy (il reverse proxy, file `Caddyfile`) crea al primo avvio una sua autorità di
certificazione locale e firma il certificato per `localhost`. Finché il PC non si fida di quell'autorità il browser mostra
"La connessione non è privata". Per avere la connessione sicura (una volta sola, solo per il proprio utente Windows):

```powershell
mkdir certs                                                                              # esclusa da git
docker compose cp caddy:/data/caddy/pki/authorities/local/root.crt ./certs/caddy-root.crt
certutil -user -addstore Root .\certs\caddy-root.crt                                     # conferma con "Sì"
```

Poi chiudere e riaprire il browser. Per toglierla a fine progetto:
`certutil -user -delstore Root "Caddy Local Authority - 2026 ECC Root"`.

Percorso delle richieste: browser → **Caddy** (443, https) → **api** (`api:3000`, rete interna) → **db** (`db:5432`).
La porta 3000 dell'API è aperta solo per il PC stesso (`127.0.0.1`), per l'inoltro porta di VS Code.

- Fermare tutto: `docker compose down` (i dati restano nel volume `loadout_pgdata`).
- Ripartire da un database nuovo (cancella i dati!): `docker compose down -v`, poi di nuovo `docker compose up -d --build`.
- Log dell'API: `docker compose logs -f api`.

### Per sviluppare (API sul PC, si riavvia a ogni modifica)
Prerequisiti: Docker Desktop avviato, Node.js 22, il file `.env` nella radice (vedi sopra).

```powershell
# 1. Solo il database (dalla cartella loadout)
docker compose up -d db

# 2. API + frontend (lo stesso server Express serve anche la cartella public/)
cd api
npm install
Copy-Item .env.example .env    # poi apri api/.env e inserisci valori veri (JWT_SECRET lungo e casuale)
npm run dev                    # → "API in ascolto sulla porta 3000", poi apri http://localhost:3000

# 3. Verifica (da un secondo terminale)
curl.exe http://localhost:3000/api/health
```

Attenzione: il container `loadout-api` e `npm run dev` usano entrambi la porta 3000. Se è acceso uno, ferma l'altro
(`docker compose stop caddy api` oppure Ctrl+C nel terminale di `npm run dev`).

### Database: schema e migrazioni
Al primo avvio il container esegue da solo, in ordine alfabetico, gli script in `db/initdb/`:

| File | Cosa aggiunge |
| --- | --- |
| `loadout_schema.sql` | schema fornito, viste, funzioni, dati di esempio |
| `loadout_stretch.sql` | peso corporeo, viaggi pianificati, km del percorso, acqua con la temperatura, nome unico senza distinguere maiuscole |
| `loadout_stretch_acqua.sql` | acqua a persona al giorno (salita, caldo, cucina) |
| `loadout_stretch_attivita.sql` | oggetti adatti a certe attività (poi sostituito dallo zaino intelligente, vedi sotto) |
| `loadout_stretch_attivita_unite.sql` | escursione e trekking diventano una sola attività ("Escursione / trekking") |
| `loadout_stretch_indossato.sql` | oggetti indossati: restano in checklist ma non pesano nello zaino |
| `loadout_stretch_oggetto.sql` | marchio, caratteristiche tecniche e pezzi posseduti degli oggetti |
| `loadout_stretch_luoghi.sql` | il nome del luogo di partenza e di arrivo (cercato su OpenStreetMap) |
| `loadout_stretch_quota.sql` | quota massima del percorso: freddo stimato in cima, avviso neve e ghiaccio |
| `loadout_stretch_zaino_intelligente.sql` | zaino intelligente: tolto "Adatto a", `fn_genera_zaino` di nuovo senza filtro per attività |
| `loadout_stretch_percorso.sql` | mappe, fase 1: quota minima, ora di partenza, traccia del percorso (per il meteo in vetta) |
| `loadout_stretch_profilo.sql` | profilo: livello di esperienza, contatto di emergenza, note mediche, tessera CAI/assicurazione, sensibilità al freddo, foto |

Se il volume del database esisteva già, le migrazioni nuove si applicano a mano (una volta sola; si possono rieseguire senza danni):

```powershell
docker exec loadout-db psql -U loadout -d loadout -f /docker-entrypoint-initdb.d/loadout_stretch_acqua.sql
docker exec loadout-db psql -U loadout -d loadout -f /docker-entrypoint-initdb.d/loadout_stretch_attivita.sql
docker exec loadout-db psql -U loadout -d loadout -f /docker-entrypoint-initdb.d/loadout_stretch_attivita_unite.sql
docker exec loadout-db psql -U loadout -d loadout -f /docker-entrypoint-initdb.d/loadout_stretch_indossato.sql
docker exec loadout-db psql -U loadout -d loadout -f /docker-entrypoint-initdb.d/loadout_stretch_oggetto.sql
docker exec loadout-db psql -U loadout -d loadout -f /docker-entrypoint-initdb.d/loadout_stretch_luoghi.sql
docker exec loadout-db psql -U loadout -d loadout -f /docker-entrypoint-initdb.d/loadout_stretch_percorso.sql
docker exec loadout-db psql -U loadout -d loadout -f /docker-entrypoint-initdb.d/loadout_stretch_profilo.sql
docker exec loadout-db psql -U loadout -d loadout -f /docker-entrypoint-initdb.d/loadout_stretch_quota.sql
docker exec loadout-db psql -U loadout -d loadout -f /docker-entrypoint-initdb.d/loadout_stretch_zaino_intelligente.sql
```

Il file viene letto dentro il container: `docker-compose.yml` monta `db/initdb` in `/docker-entrypoint-initdb.d`.

## Utenti di prova

| Email | Password |
| --- | --- |
| asiha@example.com | Password123! |
| demo@example.com | Password123! |

## Documentazione
- `docs/api.md` – contratto completo dell'API (URL, body, risposte, status code, regole dei campi)
- `api/api.http` – una richiesta di prova per ogni endpoint (estensione REST Client di VS Code)
- `db/esercizi.sql` – esercizi SQL svolti
- `api/test/` – test automatici (`npm test` dalla cartella `api`)
- `NOTE.md` – cosa ho imparato, cosa mi è costato di più, cosa farei diversamente

## Struttura del frontend (`public/`)

| Pagina | JavaScript | Cosa fa |
| --- | --- | --- |
| `login.html`, `register.html` | `login.js`, `register.js` | accesso e registrazione (dopo la registrazione entra da sola) |
| `index.html` | `index.js` | home (ci si arriva dal logo): saluto, frase casuale (anche "viva" sul prossimo viaggio), «La tua mappa»: tutti i viaggi su una mappa (fatti in verde, in programma in senape, pallino sulla partenza per quelli senza mappa) e i totali da sempre |
| `armadio.html` | `armadio.js` | lista per categoria con ricerca e filtri Tutti/Indispensabili/Preferiti, scheda di dettaglio, aggiungi/modifica/elimina in una finestra |
| `viaggi.html` | `viaggi.js` | viaggi divisi in in arrivo / senza data / già fatti, filtri, finestra "Prepara il tuo cammino" (da `form-uscita.js`, la stessa che nella scheda modifica l'uscita) |
| `scheda-viaggio.html?id=` | `scheda-viaggio.js` | l'uscita: collegamenti allo zaino e alla mappa (o "Genera lo zaino" / "Disegna la mappa" se non ci sono ancora), consigli (acqua, alba e tramonto, ora limite, meteo in partenza e in vetta, percorso, emergenza), modifica ed elimina viaggio |
| `zaini.html` | `zaini.js` | tutti gli zaini (uno per uscita), divisi in in arrivo / senza data / già fatti, con spuntati e peso |
| `zaino.html?id=` | `zaino.js` | lo zaino di un'uscita: checklist per categoria, peso e barra, indossato, genera/svuota/aggiungi, "Per questo viaggio"; con `&genera=1` lo riempie appena si apre |
| `mappe.html` | `mappe.js` | le uscite che hanno una mappa |
| `mappa.html?id=` | `mappa.js` | la mappa di un'uscita, come la pagina dello zaino: si disegna il percorso (partenza, tappe, anello) e «Salva il percorso» salva traccia, km, dislivello positivo, quote e coordinate (`PUT /api/viaggi/:id/percorso`) |
| `consigli.html` | — | consigli generali (peso dello zaino, acqua, strati, orari, meteo, sicurezza) |
| `profilo.html` | `profilo.js` | foto, dati personali (esperienza, sensibilità al freddo, contatto di emergenza, note mediche, tessera CAI), peso corporeo e soglia dello zaino, esci |

Moduli condivisi: `js/api.js` (funzione `api()` per tutte le richieste, `esc()` contro l'XSS, date), `js/menu.js` (logout), `js/categorie.js` (elenco delle categorie), `js/elenco-uscite.js` (gruppi per data per Zaino e Mappe), `js/post-it.js` (i campi compilati in automatico dalla mappa o dal luogo, che restano modificabili), `js/mappa-base.js` (sfondi MapTiler, puntine e tracciato, con Leaflet 1.9.4 da unpkg), `js/mappa-disegno.js` (il disegno del percorso nella pagina della mappa). `js/form-uscita.js` (la finestra per creare o modificare un'uscita), `js/errori-campi.js` (errori sotto i campi), `js/controlli.js` (controlli di coordinate e quote), `js/testi.js` (singolare e plurale).
Stile: un solo foglio, `css/style.css`. Immagini: logo, icone e sfondi SVG in `img/`.
Menu: Armadio · Zaino · Viaggi · Mappe · Profilo. Sul telefono è una barra in basso, con Viaggi al centro (la scarpa senape) e Consigli come icona accanto a "Esci"; sul computer sta nella barra in alto, con Consigli come ultima voce. Alla home si torna dal logo.

## Stato

Aggiornato a venerdì 30 ottobre, pomeriggio (dopo la consegna e la demo).

### Database
- [x] PostgreSQL 16 su Docker Compose, schema fornito + migrazioni in `db/initdb/` (vedi tabella sopra)
- [x] Esercizi SQL in `db/esercizi.sql`

### Backend (API) – `api/`
- [x] Autenticazione: registrazione (bcrypt, controllo email e password), login con JWT in cookie `httpOnly`, logout, `me` letto dal database, modifica del peso corporeo
- [x] Ogni utente vede e modifica solo i propri dati (`requireAuth` + filtro `utente_id`; risorse altrui → 404)
- [x] Armadio: lista con ricerca, filtro per categoria e paginazione, dettaglio, crea, modifica, elimina; marchio, caratteristiche, pezzi posseduti
- [x] Viaggi: lista ordinata per data (filtro pianificati), dettaglio, crea (anche con zaino generato nella stessa transazione), modifica, elimina
- [x] Zaino: genera, checklist con peso, aggiungi/modifica/togli, svuota; oggetti indossati (solo abbigliamento) fuori dal peso; quantità non oltre i pezzi posseduti
- [x] Consigli: ore di cammino stimate o inserite, acqua a persona al giorno, alba e tramonto (sunrise-sunset.org), meteo e vestiario (Open-Meteo), avviso se lo zaino supera il 20% del peso corporeo
- [x] Validazione dell'input con messaggi 400 chiari; gestione centralizzata degli errori

### Frontend – `public/`
- [x] Tutte le pagine della tabella sopra, servite da Express sulla stessa origine (cookie senza CORS)
- [x] Design "Muschio e crema": logo, icone SVG, testate con curve di livello, liste per categoria, finestre (`<dialog>`) per inserire e modificare
- [x] Responsive (controllato a 390 px), focus visibile, `prefers-reduced-motion` rispettato

### Stretch fatti
- [x] 1. Meteo del giorno di partenza (Open-Meteo) e suggerimenti sul vestiario
- [x] 4. Percorsi da fare in futuro (`pianificato`) con filtro nella lista
- [x] 5. Avviso se lo zaino supera il 10% del peso corporeo in giornata o il 20% con pernotto (sul peso base: senza acqua e cibo)
- [x] 2. Scansione dell'etichetta con la fotocamera (libreria html5-qrcode 2.3.8 da unpkg: EAN-13/8, UPC, Code 128/39, QR). Se il codice è già nell'armadio apre quell'oggetto, altrimenti il form nuovo con il codice compilato, e il server cerca nome, marchio e peso nelle banche dati gratuite (Open Facts, UPCitemdb: `GET /api/prodotti/:codice`), riempiendo solo i campi vuoti. Il pulsante "Cerca" accanto al codice fa la stessa ricerca per i codici scritti a mano. La fotocamera funziona solo su https o su localhost: altrimenti si scrive il codice a mano
- [ ] 3. Mappa con Leaflet per scegliere partenza e arrivo: provata (anche con percorso sui sentieri via BRouter e file GPX), poi tolta per scelta di design; da riprogettare

### Oltre lo scope (giovedì e venerdì, dopo la revisione UX)
- [x] Oggetti: marchio, caratteristiche tecniche, pezzi posseduti (lo zaino non ne accetta di più)
- [x] Zaino intelligente: per ogni uscita (attività, pernotto, cucina, freddo, neve, quota alta, caldo) l'app sa quale attrezzatura serve, la cerca nell'armadio e la aggiunge con «Genera zaino»; in giornata lascia fuori sacco a pelo, tenda e materassino; il riquadro «Per questo viaggio» mostra cosa c'è, cosa aggiungere e cosa manca (con «Aggiungi all'armadio»); gli oggetti si riconoscono per parole chiave con sinonimi (es. imbrago/imbragatura/harness, casco/elmetto) in `api/src/services/kit.js`
- [x] Uscite: luogo per nome (OpenStreetMap), ora limite di partenza, quota massima e minima, ora di partenza, meteo in vetta all'ora di arrivo (Open-Meteo con la quota) con avvisi di vento, zero termico e temporali, avviso neve e bollettino valanghe; peso base (senza acqua e cibo) con soglia 10% in giornata e 20% con pernotto; «Lascia detto»: messaggio già scritto per il contatto di emergenza (WhatsApp o SMS, lo invia l'utente)
- [x] Account e privacy (GDPR): cambio password, «Scarica i miei dati» (JSON con profilo, armadio, uscite e zaini), elimina l'account con conferma della password (tutto il resto si cancella da solo: ON DELETE CASCADE)
- [x] Zaino: oggetti indossati (solo abbigliamento) fuori dal peso; acqua a persona al giorno con salita, caldo e cucina
- [x] Profilo: foto (ridotta nel browser), esperienza, contatto di emergenza, note mediche e tessera CAI/assicurazione (mostrati nel riquadro Emergenza della scheda del viaggio), sensibilità al freddo (adatta i consigli di vestiario)
- [x] Home con frasi casuali e "vive" sul prossimo viaggio; pagina di consigli generali

### Venerdì: sicurezza, Docker, qualità
- [x] HTTPS con Caddy nel compose (certificato dell'autorità locale di Caddy), Dockerfile dell'API e compose completo (db + api + proxy), `.env.example` nella radice
- [x] Sicurezza: helmet con CSP severa (solo il nostro sito + Google Fonts e unpkg; niente script inline), limite di tentativi su login (10 errori in 15 min per IP) e registrazione (10 all'ora), `trust proxy` per Caddy, cookie `HttpOnly` + `Secure` (in produzione) + `SameSite=Lax`, CORS chiuso di default (`CORS_ORIGINS` per ammettere altri siti)
- [x] Mappe: nella pagina della mappa di ogni uscita (dalla scheda, «Disegna la mappa» / «La mappa») si toccano partenza e tappe e il percorso segue i sentieri (BRouter, chiamato dal server); anello con un interruttore; la mappa compila km, dislivello positivo, quote e coordinate con il "post-it" (vince l'ultimo automatico tra mappa e luogo, ma quello che scrivi a mano vince sempre); sfondi MapTiler (Outdoor, Topo, Inverno, Satellite) con il filtro Loadout; la traccia salvata dà il punto più alto per il meteo in vetta; pagina Mappe con l'elenco delle uscite che ne hanno una
- [x] 59 test automatici (`npm test` dalla cartella `api`, `node --test` + supertest): regole dell'API (401, 404, 400), sicurezza (helmet, CORS, 429 sul login), account, integrazione con il database (login → armadio; si saltano senza `DATABASE_URL`), funzioni pure (prodotti, luoghi, vestiario, ora limite, quota e neve, meteo in vetta e vento, traccia della mappa, lettura della risposta di BRouter, CSP delle mappe, soglia del peso, kit dello zaino intelligente)
- [x] `npm audit` (0 vulnerabilità), pulizia del codice (ESLint), `NOTE.md` con le riflessioni di fine settimana

### Cosa manca (prossimi passi)
- **Importazione della traccia GPX** (B8): lunghezza, dislivello, quote, partenza e arrivo letti dal file, proposti con il post-it come fa la mappa
- **Avvisi sul percorso** (pietraie, tratti esposti, catene) dai dati di OpenStreetMap che BRouter già restituisce, collegati al kit dello zaino
- **Password dimenticata**: richiede l'invio di email (un servizio SMTP); oggi c'è il cambio password da loggati
- **Attrezzatura di gruppo**: con più persone, tenda e fornello li porta uno solo (peso a persona realistico)
- **Modelli di uscita** e "duplica uscita" ("Giornata invernale", "Rifugio 2 giorni")
- **Difficoltà CAI** (T, E, EE, EEA) da usare nei consigli e nel kit
- **App installabile e offline** (PWA): checklist ed emergenza consultabili senza campo
- Ricerca del prodotto dal codice a barre: le banche dati gratuite conoscono poco l'attrezzatura da montagna
- Limite di tentativi: il contatore vive nella memoria del server (con più server servirebbe un archivio condiviso, es. Redis)
- HTTPS solo con certificato locale: online servirebbe un dominio e un certificato pubblico (Caddy lo ottiene da solo con Let's Encrypt)
- In sviluppo la porta 5432 del database è aperta sul PC: in produzione andrebbe chiusa

## User story MVP

I criteri di accettazione si spuntano quando funzionano dal browser e con curl (Definition of Done).

### US1 – Registrazione e login
Come escursionista voglio creare un account e accedere, per avere il mio armadio personale.
- [x] CA1. Registrazione con email, password (≥ 8 caratteri), nome; email duplicata → messaggio chiaro.
- [x] CA2. Login errato → "Email o password errati" (senza dire quale).
- [x] CA3. Dopo il login vedo solo i miei oggetti e i miei viaggi; un altro utente non li vede.

*Dove: `register.html`, `login.html`. Le risorse di un altro utente rispondono 404, non 403.*

### US2 – Armadio
Come escursionista voglio gestire la mia attrezzatura con il peso, per sapere cosa possiedo.
- [x] CA1. Lista con ricerca per nome e ordinamento per categoria/nome.
- [x] CA2. Inserimento con nome (obbligatorio), categoria (lista chiusa), peso in grammi (> 0), flag indispensabile/preferito, etichetta e note opzionali.
- [x] CA3. Nome duplicato nello stesso armadio → errore 409 mostrato all'utente.
- [x] CA4. Modifica ed eliminazione (con conferma). Eliminando un oggetto sparisce anche dagli zaini (ON DELETE CASCADE).

*Dove: `armadio.html`. La lista è divisa per categoria e ordinata per nome; il 409 vale anche con maiuscole diverse ("Guanti"/"guanti"). Eliminazione dalla scheda di dettaglio o dalla finestra di modifica, con conferma.*

### US3 – Prepara il tuo cammino
Come escursionista voglio descrivere la mia uscita, per avere uno zaino adatto.
- [x] CA1. Form con attività, persone (1–50), giorni (1–60), pernotto, cucina sì/no, data, coordinate di partenza (opzionali).
- [x] CA2. Validazione lato server dei limiti; errori mostrati nel form.
- [x] CA3. Lista dei miei viaggi ordinata per data di partenza.

*Dove: `viaggi.html`, pulsante "Nuovo viaggio" (finestra "Prepara il tuo cammino").*

### US4 – Genera lo zaino
Come escursionista voglio che l'app proponga lo zaino, per non dimenticare nulla.
- [x] CA1. Pulsante "Genera zaino" → chiama POST /api/viaggi/:id/genera → il backend esegue SELECT fn_genera_zaino($1).
- [x] CA2. Oggetti di categoria cucina entrano solo se serve_cucina è vero.
- [x] CA3. Generare due volte non crea duplicati; la risposta dice quanti oggetti sono stati aggiunti.

*Dove: `zaino.html` (dalla scheda: «Genera lo zaino»); si può anche generare subito alla creazione del viaggio (`?genera=true`).*

### US5 – Il tuo zaino
Come escursionista voglio vedere lo zaino riempirsi e il suo peso, per decidere cosa togliere.
- [x] CA1. Lista degli oggetti del viaggio con categoria, peso, quantità, checkbox "inserito".
- [x] CA2. Peso totale e peso inserito (in kg con 2 decimali) aggiornati senza ricaricare la pagina (vista v_zaino_peso).
- [x] CA3. Posso aggiungere un oggetto dall'armadio che non è stato proposto, cambiare la quantità, rimuoverlo.
- [x] CA4. La checklist si può "svuotare" (tutti non inseriti) con un pulsante.

*Dove: `zaino.html`. In più: oggetti indossati fuori dal peso, quantità non oltre i pezzi posseduti.*

### US6 – Consigli
Come escursionista voglio alba, tramonto e acqua consigliata, per scegliere l'ora di partenza.
- [x] CA1. Nella pagina del viaggio vedo i litri consigliati (fn_acqua_consigliata, con ore di cammino inserite dall'utente).
- [x] CA2. Se il viaggio ha coordinate e data, vedo alba e tramonto in ora italiana, ottenuti dal backend (è il server che chiama l'API sunrise-sunset.org), non dal browser.
- [x] CA3. Se l'API esterna non risponde, la pagina funziona lo stesso e mostra "non disponibile".

*Dove: `scheda-viaggio.html`, riquadro "Consigli per il viaggio". L'acqua è mostrata a persona al giorno, con il totale sotto e "Ricalcola" per le ore.*

## Percorso di una richiesta: "aggiungo Giacca antivento al mio armadio"

1. **Browser.** Nell'armadio premo "Aggiungi": si apre la finestra (`<dialog>`) con il form. Compilo nome, categoria, peso 320 g, indispensabile, e premo "Salva". Il JavaScript intercetta l'evento `submit`, legge i campi e li controlla (nome presente, peso intero ≥ 1).
   File: `public/armadio.html`, `public/js/armadio.js`
2. **Browser.** Il JavaScript chiama `api("/api/oggetti", { method: "POST", body: dati })`, che usa `fetch` con il body in JSON.
   File: `public/js/api.js`
3. **Rete.** Il browser invia la richiesta HTTP: riga di richiesta, header (con il cookie `token` del login) e body. In sviluppo arriva direttamente a Express sulla porta 3000; da venerdì passerà da Caddy in HTTPS.
4. **Server.** Express riceve la richiesta e la fa passare per i middleware: lettura del JSON e dei cookie, log, controllo del login (`requireAuth` verifica il token e ricava il mio id utente).
   File: `api/src/app.js`, `api/src/middleware/logger.js`, `api/src/middleware/auth.js`
5. **Server.** La rotta `POST /api/oggetti` controlla i dati con il validatore (nome obbligatorio, categoria nella lista, peso intero ≥ 1…). Se qualcosa non va risponde subito 400.
   File: `api/src/routes/oggetti.js`, `api/src/middleware/validate.js`
6. **Server.** Il service esegue la query parametrizzata `INSERT INTO oggetto (...) VALUES ($1, $2, ...) RETURNING *` con il mio `utente_id`, usando una connessione del pool.
   File: `api/src/services/oggetti.js`, `api/src/db.js`
7. **Database.** Postgres controlla i vincoli: `NOT NULL`, `CHECK (peso_g > 0)`, nome unico nel mio armadio (anche con maiuscole diverse), chiave esterna su `utente`. Se va bene salva la riga e la restituisce. Se viola un vincolo, il gestore degli errori lo traduce in 409 o 422 con un messaggio chiaro.
   File: `db/initdb/loadout_schema.sql` (tabella `oggetto`), `db/initdb/loadout_stretch.sql` (indice sul nome), `api/src/middleware/errors.js`
8. **Ritorno.** Il server risponde `201 Created` con la giacca in JSON (compreso il nuovo `id`). Il JavaScript chiude la finestra, ricarica la lista e la ridisegna (`render()`): la giacca compare nel gruppo "Abbigliamento", senza ricaricare la pagina.
   File: `api/src/routes/oggetti.js`, `public/js/armadio.js`
