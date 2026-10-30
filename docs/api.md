# Loadout – Contratto API

Base URL in sviluppo: `http://localhost:3000` (lo stesso server Express serve anche il frontend, cartella `public/`).
Tutte le risposte sono JSON (tranne i 204, senza corpo).
Le date sono in formato ISO `AAAA-MM-GG` (es. `2026-11-08`); gli orari tecnici (`created_at`) in UTC.

Errori: sempre `{ "error": "CODICE", "message": "testo leggibile" }`.

## Servizio
| Metodo | URL | Body | Risposta | Status |
| --- | --- | --- | --- | --- |
| GET | /api/health | — | `{ status, time, db }` | 200, 500 |

## Autenticazione
Dopo il login il server imposta il cookie `token` (JWT firmato, `HttpOnly`, `SameSite=Lax`, `Secure` in produzione, durata 8 ore).
Il browser lo rimanda da solo: tutte le rotte di Armadio, Viaggi e Zaino lo richiedono (senza → 401).

| Metodo | URL | Body | Risposta | Status |
| --- | --- | --- | --- | --- |
| POST | /api/auth/register | `{ email*, password*, nome* }` – email valida (max 255), password ≥ 8 caratteri, nome max 100 | `{ id, email, nome }` (mai la password né l'hash) | 201, 400 (`BAD_EMAIL`, `WEAK_PASSWORD`, `VALIDATION_ERROR`), 409 (email già usata) |
| POST | /api/auth/login | `{ email*, password* }` | `{ id, nome }` + cookie `token` | 200, 400, 401 ("Email o password errati", stesso messaggio per email inesistente e password sbagliata) |
| POST | /api/auth/logout | — | nessun corpo, cookie cancellato | 204 |
| GET | /api/auth/me | — | il profilo, letto dal database: `{ id, email, nome, peso_corporeo_kg, livello_esperienza, emergenza_nome, emergenza_telefono, note_mediche, tessera_soccorso, sensibilita_freddo, ha_foto }` (la foto ha un indirizzo suo, sotto) | 200, 401 |
| PATCH | /api/auth/me | uno o più tra `{ peso_corporeo_kg, livello_esperienza, emergenza_nome, emergenza_telefono, note_mediche, tessera_soccorso, sensibilita_freddo, foto }` – modifica **parziale**: cambia solo i campi inviati; `""` o `null` svuota il campo. Regole sotto | il profilo aggiornato (come GET) | 200, 400 (`VALIDATION_ERROR`, `BAD_TELEFONO`, `BAD_FOTO`), 401 |
| GET | /api/auth/me/foto | — | l'immagine (byte veri, `Content-Type: image/jpeg` o png/webp), da usare in `<img src>` | 200, 401, 404 (nessuna foto) |

Regole dei campi del profilo:
- `peso_corporeo_kg` tra 20 e 300; `livello_esperienza` tra principiante, intermedio, esperto
- `emergenza_nome` max 100; `emergenza_telefono` max 30, solo cifre, spazi e un `+` iniziale
- `note_mediche` max 300 (dati sulla salute: li inserisce solo l'utente e li vede solo lui); `tessera_soccorso` max 80
- `sensibilita_freddo` tra `alta` (soffro il freddo), `normale`, `bassa` (sento poco il freddo): sposta di 4 °C le soglie dei consigli di vestiario del meteo
- `foto`: data URL `data:image/(jpeg|png|webp);base64,...`, max 200.000 caratteri (il frontend la riduce a 256×256 prima di mandarla). Body JSON massimo 300 kB

### Account e privacy (B7)
| Metodo | URL | Body | Risposta | Status |
| --- | --- | --- | --- | --- |
| PUT | /api/auth/me/password | `{ attuale*, nuova* }` – nuova ≥ 8 caratteri e diversa dall'attuale | nessun corpo | 204, 400 (`WEAK_PASSWORD`, `SAME_PASSWORD`), 401, 403 (`WRONG_PASSWORD`), 429 |
| GET | /api/auth/me/dati | — | file JSON scaricabile `{ esportato_il, profilo, oggetti, viaggi: [ { …, zaino } ] }` (diritto di accesso e portabilità) | 200, 401 |
| DELETE | /api/auth/me | `{ password* }` | nessun corpo; cancella l'utente e, a cascata, oggetti, viaggi e zaini; toglie il cookie | 204, 400, 401, 403 (`WRONG_PASSWORD`), 429 |

Password sbagliata qui = **403** e non 401: sei loggata, è la conferma a essere sbagliata (con 401 il frontend ti rimanderebbe al login).
Cambio password ed eliminazione hanno lo stesso limite di tentativi del login.

## Armadio (oggetti dell'utente loggato)
| Metodo | URL | Body | Risposta | Status |
| --- | --- | --- | --- | --- |
| GET | /api/oggetti?q=&categoria=&limit=&offset= | — | array dei miei oggetti, ordinati per categoria e nome; `q` cerca nel nome; `categoria` tra quelle ammesse; limit 1–200 (default 50), offset ≥ 0 | 200, 400, 401 |
| GET | /api/oggetti/:id | — | un oggetto | 200, 400, 401, 404 |
| POST | /api/oggetti | `{ nome*, categoria*, peso_g*, is_indispensabile, is_preferito, codice_etichetta, note, marchio, caratteristiche, quantita_posseduta }` – vedi regole sotto | l'oggetto creato | 201, 400, 401, 409 (nome già nel mio armadio) |
| PUT | /api/oggetti/:id | come POST (si manda l'oggetto intero: i campi facoltativi non inviati tornano al valore di default) | l'oggetto aggiornato. Se `quantita_posseduta` scende sotto la quantità messa in qualche zaino, in quegli zaini la quantità scende allo stesso valore (stessa query, atomica) | 200, 400, 401, 404, 409 |
| DELETE | /api/oggetti/:id | — | nessun corpo (sparisce anche dagli zaini: ON DELETE CASCADE) | 204, 400, 401, 404 |

Regole dei campi dell'oggetto (* = obbligatorio):
- `nome`* max 120, unico nel mio armadio **senza distinguere maiuscole e minuscole** ("Guanti" e "guanti" sono lo stesso oggetto → 409)
- `categoria`* tra abbigliamento, attrezzatura, cucina, sicurezza, igiene, elettronica, cibo, altro
- `peso_g`* intero ≥ 1 (peso di **un** pezzo)
- `is_indispensabile`, `is_preferito` booleani (default false)
- `codice_etichetta` max 64; `note` max 1000
- `marchio` max 80; `caratteristiche` max 500 (caratteristiche tecniche, testo libero)
- `quantita_posseduta` intero 1–99 (default 1): quanti pezzi ne possiedo

## Viaggi
| Metodo | URL | Body | Risposta | Status |
| --- | --- | --- | --- | --- |
| GET | /api/viaggi?pianificato= | — | array dei miei viaggi, ordinati per data di partenza (senza data in fondo); `pianificato=true` solo i percorsi da fare in futuro, `false` solo gli altri | 200, 400, 401 |
| GET | /api/viaggi/:id?ore_cammino= | — | il viaggio + `peso` (vedi Zaino) + `consigli` (vedi sotto); `ore_cammino` facoltativo, 0.5–16 | 200, 400, 401, 404 |
| POST | /api/viaggi?genera= | `{ nome*, attivita*, n_persone, n_giorni, pernotto, serve_cucina, data_partenza, lat_partenza, lon_partenza, lat_arrivo, lon_arrivo, dislivello_m, distanza_km, note, pianificato }` – vedi regole sotto | il viaggio creato; con `genera=true` lo zaino viene generato subito, nella stessa transazione, e la risposta contiene anche `aggiunti` | 201, 400, 401 |
| PUT | /api/viaggi/:id | come POST (viaggio intero) | il viaggio aggiornato | 200, 400, 401, 404 |
| DELETE | /api/viaggi/:id | — | nessun corpo (lo zaino del viaggio viene cancellato: ON DELETE CASCADE) | 204, 400, 401, 404 |

Regole dei campi del viaggio (* = obbligatorio):
- `nome`* max 150; `attivita`* tra escursione (comprende il trekking: in giornata o su più giorni lo dicono `n_giorni` e `pernotto`), alpinismo, ciaspolata, ferrata
- `n_persone` intero 1–50 (default 1); `n_giorni` intero 1–60 (default 1)
- `pernotto` tra nessuno, rifugio, tenda, bivacco (default nessuno); `serve_cucina` booleano (default false)
- `data_partenza` data `AAAA-MM-GG` valida
- `lat_*` tra −90 e 90; `lon_*` tra −180 e 180
- `dislivello_m` intero 0–9000 (salita di **tutto** il percorso); `distanza_km` 0.1–999 (lunghezza del sentiero, inserita dall'utente)
- `note` max 1000; `pianificato` booleano (default false) – percorsi da fare in futuro
- `luogo_partenza`, `luogo_arrivo` testo max 200 (B1); `quota_max_m` intero 0–9000 (B3, il punto più alto del percorso)

Blocco `consigli` del dettaglio:
- `ore_cammino_giorno`: da `?ore_cammino=` se presente (`fonte_ore: "utente"`), altrimenti stimate dal percorso
  con 4 km/h in piano + 1 h ogni 400 m di salita, divise per i giorni e arrotondate alla mezz'ora (`fonte_ore: "percorso"`); `null` se mancano i km
- `acqua_persona_giorno`: litri a persona per un giorno di cammino, da `fn_acqua_persona_giorno` (database):
  0,5 L per ora di cammino + 0,5 L ogni 1.000 m di salita al giorno, minimo 1 L; +25% sopra i 25 °C, +50% sopra i 30 °C;
  +1 L se `serve_cucina`; arrotondato al mezzo litro per eccesso. `null` se mancano le ore
- `acqua_litri`: totale del viaggio per tutto il gruppo, da `fn_acqua_consigliata(n_giorni, n_persone, ore, temperatura_max, dislivello_giorno, cucina)`
  = litri a persona al giorno × giorni × persone
- `acqua_con_temperatura`, `acqua_con_dislivello`, `acqua_con_cucina`: quali fattori sono entrati nel calcolo (il frontend li elenca)
- `distanza_linea_aria_km`: tra partenza e arrivo (formula di haversine); `null` se mancano le coordinate
- `sole`: `{ disponibile: true, alba, tramonto }` in ora italiana, chiesti dal server a sunrise-sunset.org;
  `{ disponibile: false, motivo }` se mancano coordinate/data o se il servizio esterno non risponde entro 3 secondi
- `meteo`: `{ disponibile: true, temp_max, temp_min, prob_pioggia, vestiario: [...] }` da Open-Meteo per la data e le coordinate di partenza;
  `{ disponibile: false, motivo }` se mancano coordinate/data, se la partenza è passata o oltre 16 giorni, o se il servizio non risponde
  I consigli di `vestiario` tengono conto della `sensibilita_freddo` del profilo (temperatura percepita ±4 °C).
  In più (B3): `quota_partenza_m` (da Open-Meteo), `cima` = `{ quota_m, temp_min, temp_max }` stimata con −6 °C ogni 1000 m se il viaggio
  ha `quota_max_m` (altrimenti `null`), `vento_kmh` e `raffiche_kmh`; il vestiario si decide sulla minima in cima.
- `ora_limite_partenza` (B2): `{ ora: "09:25", prima_dell_alba, margine_ore: 1 }` = tramonto − ore di cammino − 1 h; `null` senza alba/tramonto o ore
- `neve_ghiaccio` (B3): `true` se `quota_max_m` ≥ 2000 e la data è tra ottobre e maggio (o senza data, o con minima in cima ≤ 0 °C)
- `bollettino_valanghe` (B3): `true` con neve possibile oppure attività ciaspolata/alpinismo
- `avviso_peso`: `{ disponibile: true, peso_corporeo_kg, soglia_percento, soglia_kg, troppo_pesante }` – soglia = **10%** del peso corporeo in giornata
  (`pernotto` nessuno), **20%** con pernotto; confrontata con il **peso base** (zaino senza acqua e cibo, senza gli oggetti indossati); `{ disponibile: false, motivo }` se il peso corporeo non è impostato

## Zaino
Le liste del kit (voci, parole chiave, quando servono) sono in `api/src/services/kit.js`: gli oggetti si riconoscono per parole chiave nel nome, nel marchio e nelle caratteristiche (senza maiuscole e accenti, a inizio parola); tra più oggetti adatti vince un indispensabile/preferito, poi il più leggero.

| Metodo | URL | Body | Risposta | Status |
| --- | --- | --- | --- | --- |
| POST | /api/viaggi/:id/genera | — | `{ aggiunti, base, dal_kit, esclusi }` – **zaino intelligente** (B5), in una transazione: indispensabili + preferiti con `fn_genera_zaino` (cucina solo se `serve_cucina`) = `base`; in giornata toglie tra i nuovi quello che serve solo per dormire fuori (`esclusi`); aggiunge dall'armadio l'attrezzatura del kit dell'uscita (`dal_kit`); generare di nuovo non duplica | 200, 400, 401, 404 |
| GET | /api/viaggi/:id/kit | — | `[ { voce, perche, categoria, stato, oggetto } ]` – l'attrezzatura che serve per l'uscita (attività, pernotto, cucina, freddo, neve): `stato` = `nello_zaino` / `nell_armadio` (con `oggetto: { id, nome }`) / `manca` | 200, 400, 401, 404 |
| GET | /api/viaggi/:id/zaino | — | `{ peso, oggetti }` – vedi sotto | 200, 400, 401, 404 |
| POST | /api/viaggi/:id/zaino | `{ oggetto_id*, quantita }` – quantita intero 1–99 (default 1) e non oltre i pezzi posseduti; l'oggetto deve essere mio | la riga dello zaino | 201, 400 (`QUANTITA_OLTRE_POSSEDUTI`), 401, 404, 409 (già nello zaino) |
| PATCH | /api/viaggi/:id/zaino/:oggettoId | `{ inserito, quantita, indossato }` – almeno uno; cambia solo i campi inviati. `quantita` non oltre i pezzi posseduti; `indossato: true` solo per l'abbigliamento | la riga aggiornata | 200, 400 (`QUANTITA_OLTRE_POSSEDUTI`, `NON_INDOSSABILE`), 401, 404 |
| DELETE | /api/viaggi/:id/zaino/:oggettoId | — | nessun corpo (l'oggetto resta nell'armadio) | 204, 400, 401, 404 |
| POST | /api/viaggi/:id/zaino/svuota | — | `{ svuotati: n }` – tutti gli oggetti tornano "non inseriti" | 200, 400, 401, 404 |

Forma di `GET /api/viaggi/:id/zaino` (vista `v_zaino_peso` per `peso`, `v_zaino_dettaglio` per `oggetti`):
- `peso`: `{ n_oggetti, peso_totale_g, peso_inserito_g, peso_totale_kg, peso_inserito_kg, peso_addosso_g, peso_addosso_kg }`.
  Gli oggetti **indossati** non contano in `peso_totale` e `peso_inserito`: il loro peso è in `peso_addosso`
- `oggetti`: `[ { oggetto_id, nome, categoria, peso_g, quantita, peso_riga_g, inserito, is_indispensabile, is_preferito, indossato, quantita_posseduta, marchio } ]`

## Luoghi (B1)
| Metodo | URL | Body | Risposta | Status |
| --- | --- | --- | --- | --- |
| GET | /api/luoghi?q=malga prato | — | fino a 6 luoghi: `[ { etichetta, tipo, lat, lon } ]` (es. `"Rifugio Vajolet (Pozza di Fassa, TN)"`, `"rifugio"`) | 200, 400 (`BAD_QUERY`: 3–100 caratteri), 401, 502 (`LUOGHI_NON_DISPONIBILI`) |

- Il server interroga Nominatim (OpenStreetMap), al massimo una richiesta al secondo, e tiene i risultati in memoria.
- Nel viaggio si salvano `luogo_partenza` e `luogo_arrivo` (testo, max 200) insieme alle coordinate. Nel form "Da dove parti" è
  obbligatorio; l'API lo accetta facoltativo (viaggi creati prima, richieste di prova). Le coordinate restano facoltative e modificabili a mano.

## Prodotti (dal codice a barre, stretch 2)
| Metodo | URL | Body | Risposta | Status |
| --- | --- | --- | --- | --- |
| GET | /api/prodotti/:codice | — | `{ trovato: true, fonte, nome, marchio, peso_g, categoria }` oppure `{ trovato: false, irraggiungibile }` | 200, 400 (`BAD_CODICE`: servono 8–14 cifre), 401 |

- Il server cerca il codice in Open Products Facts, Open Food Facts, Open Beauty Facts (in parallelo, vince la prima
  nell'ordine) e, solo se nessuna lo conosce, in UPCitemdb (prova gratuita, circa 100 ricerche al giorno).
- `peso_g` e `marchio` possono essere `null`; `categoria` è un suggerimento (`cibo` da Open Food Facts, `igiene` da
  Open Beauty Facts, altrimenti `null`).
- `irraggiungibile: true` = nessuna banca dati ha risposto (rete giù). Ogni banca dati ha 5 secondi per rispondere.
- I risultati restano in memoria (max 500 codici) finché il server è acceso.

## Note sugli status code
- **400**: dati non validi nel body o nell'URL (campo mancante, tipo sbagliato, fuori dai limiti, id non numerico o troppo grande, JSON malformato) oppure una regola dell'app non rispettata; il `message` spiega cosa correggere.
  Codici: `VALIDATION_ERROR`, `BAD_ID`, `BAD_QUERY`, `BAD_JSON`, `BAD_INPUT`, `WEAK_PASSWORD`, `BAD_EMAIL`, `BAD_TELEFONO`, `BAD_FOTO`, `QUANTITA_OLTRE_POSSEDUTI`, `NON_INDOSSABILE`.
- **401**: non autenticato (manca il cookie, token scaduto o manomesso) oppure credenziali errate al login.
- **404**: la risorsa non esiste **oppure non è mia**: non riveliamo che esiste (niente 403).
- **409**: violazione di unicità (email già registrata, nome già nel mio armadio anche con maiuscole diverse, oggetto già nello zaino). Il messaggio dipende dal vincolo violato.
- **422**: vincolo del database violato che il validatore non ha intercettato (rete di sicurezza, es. `CHECK (peso_g > 0)`). Codici: `CHECK_VIOLATION`, `FK_VIOLATION`, `DOMAIN_RULE`.
- **500**: errore interno; il dettaglio resta nel log del server, al client arriva solo "Errore interno".

## Scelte da confermare con il tutor
- Ore di cammino: stimate dal percorso (`distanza_km` + `dislivello_m`) o inserite dall'utente con `?ore_cammino=`.
- Svuota checklist: endpoint "azione" `POST /api/viaggi/:id/zaino/svuota` (coerente con `/genera`) invece di una PATCH sull'intera collezione.
- Acqua: la formula è una stima ragionevole (non una regola medica); i coefficienti stanno in `fn_acqua_persona_giorno` e si cambiano in un punto solo.
- Oggetti indossati e pezzi posseduti: i controlli (solo abbigliamento, non oltre i posseduti) sono nelle rotte; il frontend li ripete solo per comodità.
- Km lungo i sentieri: inseriti dall'utente (calcolarli in automatico richiede un servizio di routing esterno; provato con BRouter e mappe Leaflet, poi tolto per scelta di design).
