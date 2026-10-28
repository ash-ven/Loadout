# Loadout

## Scopo
- Loadout è una web app per escursionisti in cui ognuno registra la propria attrezzatura da montagna (l'armadio), con peso, categoria e indicazione di cosa è indispensabile o preferito.
- Per ogni uscita l'utente descrive il viaggio (attività, persone, giorni, pernotto, cucina) e con un click ottiene uno zaino proposto, composto dai suoi oggetti indispensabili e preferiti.
- Nella pagina del viaggio spunta la checklist, vede aggiornarsi in tempo reale il peso totale e quello già inserito, e consulta i consigli su acqua, alba e tramonto.

## Come avviare in locale

Prerequisiti: Docker Desktop avviato, Node.js 22.

```powershell
# 1. Database (dalla cartella loadout)
docker compose up -d db

# 2. API
cd api
npm install
Copy-Item .env.example .env    # poi apri .env e inserisci valori veri (JWT_SECRET lungo e casuale)
npm run dev                    # → "API in ascolto su http://localhost:3000"

# 3. Verifica (da un secondo terminale)
curl.exe http://localhost:3000/api/health
```

Al primo avvio il container esegue da solo, in ordine alfabetico, gli script in `db/initdb/` (schema + aggiunte stretch).
Se il volume del database esisteva già, le aggiunte si applicano a mano:

```powershell
docker compose exec db psql -U loadout -d loadout -f /docker-entrypoint-initdb.d/loadout_stretch.sql
```

## Utenti di prova

| Email | Password |
| --- | --- |
| asiha@example.com | Password123! |
| demo@example.com | Password123! |

## Documentazione
- `docs/api.md` – contratto completo dell'API (URL, body, risposte, status code, regole dei campi)
- `api/api.http` – una richiesta di prova per ogni endpoint (estensione REST Client di VS Code)
- `db/esercizi.sql` – esercizi SQL svolti

## Stato

Aggiornato a mercoledì 28 ottobre.

### Database
- [x] PostgreSQL 16 su Docker Compose, schema fornito + `db/initdb/loadout_stretch.sql` (peso corporeo, viaggi pianificati, distanza del percorso)
- [x] Esercizi SQL in `db/esercizi.sql`

### Backend (API) – `api/`
- [x] Autenticazione: registrazione (bcrypt), login con JWT in cookie `httpOnly`, logout, `me`
- [x] Ogni utente vede e modifica solo i propri dati (`requireAuth` + filtro `utente_id`; risorse altrui → 404)
- [x] Armadio: lista con ricerca, filtro per categoria e paginazione, dettaglio, crea, modifica, elimina
- [x] Viaggi: lista ordinata per data, dettaglio, crea, modifica, elimina
- [x] Zaino: genera (indispensabili + preferiti, cucina solo se serve, senza duplicati), checklist con peso, aggiungi/modifica/togli, svuota checklist
- [x] Consigli nel dettaglio del viaggio: ore di cammino stimate dal percorso, acqua consigliata, distanza in linea d'aria, alba e tramonto da sunrise-sunset.org con fallback "non disponibile"
- [x] Validazione dell'input con messaggi 400 chiari; gestione centralizzata degli errori

### Da fare
- [ ] Frontend: login, armadio, viaggi, pagina del viaggio con zaino e consigli (giovedì)
- [ ] HTTPS, helmet, limite tentativi sul login, Dockerfile e compose completo, test automatici, NOTE.md (venerdì)

## User story MVP

I criteri di accettazione si spuntano quando funzionano dal browser e con curl (Definition of Done).

### US1 – Registrazione e login
Come escursionista voglio creare un account e accedere, per avere il mio armadio personale.
- [ ] CA1. Registrazione con email, password (≥ 8 caratteri), nome; email duplicata → messaggio chiaro.
- [ ] CA2. Login errato → "Email o password errati" (senza dire quale).
- [ ] CA3. Dopo il login vedo solo i miei oggetti e i miei viaggi; un altro utente non li vede.

*Stato: backend completo e provato; manca il frontend.*

### US2 – Armadio
Come escursionista voglio gestire la mia attrezzatura con il peso, per sapere cosa possiedo.
- [ ] CA1. Lista con ricerca per nome e ordinamento per categoria/nome.
- [ ] CA2. Inserimento con nome (obbligatorio), categoria (lista chiusa), peso in grammi (> 0), flag indispensabile/preferito, etichetta e note opzionali.
- [ ] CA3. Nome duplicato nello stesso armadio → errore 409 mostrato all'utente.
- [ ] CA4. Modifica ed eliminazione (con conferma). Eliminando un oggetto sparisce anche dagli zaini (ON DELETE CASCADE).

*Stato: backend completo e provato; manca il frontend (form, conferma di eliminazione).*

### US3 – Prepara il tuo cammino
Come escursionista voglio descrivere la mia uscita, per avere uno zaino adatto.
- [ ] CA1. Form con attività, persone (1–50), giorni (1–60), pernotto, cucina sì/no, data, coordinate di partenza (opzionali).
- [ ] CA2. Validazione lato server dei limiti; errori mostrati nel form.
- [ ] CA3. Lista dei miei viaggi ordinata per data di partenza.

*Stato: backend completo e provato; manca il frontend.*

### US4 – Genera lo zaino
Come escursionista voglio che l'app proponga lo zaino, per non dimenticare nulla.
- [ ] CA1. Pulsante "Genera zaino" → chiama POST /api/viaggi/:id/genera → il backend esegue SELECT fn_genera_zaino($1).
- [ ] CA2. Oggetti di categoria cucina entrano solo se serve_cucina è vero.
- [ ] CA3. Generare due volte non crea duplicati; la risposta dice quanti oggetti sono stati aggiunti.

*Stato: backend completo e provato; manca il pulsante nel frontend.*

### US5 – Il tuo zaino
Come escursionista voglio vedere lo zaino riempirsi e il suo peso, per decidere cosa togliere.
- [ ] CA1. Lista degli oggetti del viaggio con categoria, peso, quantità, checkbox "inserito".
- [ ] CA2. Peso totale e peso inserito (in kg con 2 decimali) aggiornati senza ricaricare la pagina (vista v_zaino_peso).
- [ ] CA3. Posso aggiungere un oggetto dall'armadio che non è stato proposto, cambiare la quantità, rimuoverlo.
- [ ] CA4. La checklist si può "svuotare" (tutti non inseriti) con un pulsante.

*Stato: backend completo e provato (svuota: `POST /api/viaggi/:id/zaino/svuota`); manca il frontend.*

### US6 – Consigli
Come escursionista voglio alba, tramonto e acqua consigliata, per scegliere l'ora di partenza.
- [ ] CA1. Nella pagina del viaggio vedo i litri consigliati (fn_acqua_consigliata, con ore di cammino inserite dall'utente).
- [ ] CA2. Se il viaggio ha coordinate e data, vedo alba e tramonto in ora italiana, ottenuti dal backend (è il server che chiama l'API sunrise-sunset.org), non dal browser.
- [ ] CA3. Se l'API esterna non risponde, la pagina funziona lo stesso e mostra "non disponibile".

*Stato: backend completo e provato (ore stimate da km e dislivello, oppure inserite dall'utente con `?ore_cammino=`); manca il frontend.*

## Percorso di una richiesta: "aggiungo Giacca antivento al mio armadio"

I nomi dei file del frontend e del proxy sono provvisori: verranno aggiornati venerdì con quelli reali.

1. **Browser.** Sulla pagina dell'armadio compilo il form (nome, categoria, peso 320 g, indispensabile) e clicco "Salva". Il JavaScript della pagina intercetta l'evento `submit` e legge i campi.
   File: `public/armadio.html`, `public/js/armadio.js`
2. **Browser.** Il JavaScript chiama `fetch` con metodo `POST` verso `/api/oggetti`, mettendo i dati nel body in formato JSON.
   File: `public/js/api.js`
3. **Rete.** Il browser invia la richiesta HTTPS: riga di richiesta, header (con il cookie `token` del login) e body. Il proxy la riceve e la inoltra all'API.
   File: `Caddyfile`
4. **Server.** Express riceve la richiesta e la fa passare per i middleware: lettura del JSON e dei cookie, log, controllo del login (`requireAuth` verifica il token e ricava il mio id utente).
   File: `api/src/app.js`, `api/src/middleware/logger.js`, `api/src/middleware/auth.js`
5. **Server.** La rotta `POST /api/oggetti` controlla i dati con il validatore (nome obbligatorio, categoria nella lista, peso intero ≥ 1…). Se qualcosa non va risponde subito 400.
   File: `api/src/routes/oggetti.js`, `api/src/middleware/validate.js`
6. **Server.** Il service esegue la query parametrizzata `INSERT INTO oggetto (...) VALUES ($1, $2, ...) RETURNING *` con il mio `utente_id`, usando una connessione del pool.
   File: `api/src/services/oggetti.js`, `api/src/db.js`
7. **Database.** Postgres controlla i vincoli: `NOT NULL`, `CHECK (peso_g > 0)`, `UNIQUE (utente_id, nome)`, chiave esterna su `utente`. Se va bene salva la riga e la restituisce. Se viola un vincolo, il gestore degli errori lo traduce in 409 o 422.
   File: `db/initdb/loadout_schema.sql` (tabella `oggetto`), `api/src/middleware/errors.js`
8. **Ritorno.** Il server risponde `201 Created` con la giacca in JSON (compreso il nuovo `id`). Il JavaScript legge la risposta e aggiorna la tabella dell'armadio senza ricaricare la pagina.
   File: `api/src/routes/oggetti.js`, `public/js/armadio.js`
   