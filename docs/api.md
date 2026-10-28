# Loadout – Contratto API

Base URL in sviluppo: `http://localhost:3000`. Tutte le risposte sono JSON (tranne i 204, senza corpo).
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
| POST | /api/auth/register | `{ email*, password*, nome* }` – password ≥ 8 caratteri, email max 255, nome max 100 | `{ id, email, nome }` (mai la password né l'hash) | 201, 400, 409 (email già usata) |
| POST | /api/auth/login | `{ email*, password* }` | `{ id, nome }` + cookie `token` | 200, 400, 401 ("Email o password errati", stesso messaggio per email inesistente e password sbagliata) |
| POST | /api/auth/logout | — | nessun corpo, cookie cancellato | 204 |
| GET | /api/auth/me | — | payload del token `{ sub, nome, iat, exp }` | 200, 401 |

## Armadio (oggetti dell'utente loggato)
| Metodo | URL | Body | Risposta | Status |
| --- | --- | --- | --- | --- |
| GET | /api/oggetti?q=&limit=&offset= | — | array dei miei oggetti, ordinati per categoria e nome; `q` cerca nel nome; limit 1–200 (default 50), offset ≥ 0 | 200, 400, 401 |
| GET | /api/oggetti/:id | — | un oggetto | 200, 400, 401, 404 |
| POST | /api/oggetti | `{ nome*, categoria*, peso_g*, is_indispensabile, is_preferito, codice_etichetta, note }` – nome max 120; categoria tra abbigliamento, attrezzatura, cucina, sicurezza, igiene, elettronica, cibo, altro; peso_g intero ≥ 1; codice_etichetta max 64; note max 1000 | l'oggetto creato | 201, 400, 401, 409 (nome già nel mio armadio) |
| PUT | /api/oggetti/:id | come POST (si manda l'oggetto intero: i campi facoltativi non inviati tornano a false/null) | l'oggetto aggiornato | 200, 400, 401, 404, 409 |
| DELETE | /api/oggetti/:id | — | nessun corpo (sparisce anche dagli zaini: ON DELETE CASCADE) | 204, 400, 401, 404 |

## Viaggi
| Metodo | URL | Body | Risposta | Status |
| --- | --- | --- | --- | --- |
| GET | /api/viaggi?pianificato= | — | array dei miei viaggi, ordinati per data di partenza (senza data in fondo); `pianificato=true` solo i percorsi da fare in futuro, `false` solo gli altri | 200, 400, 401 |
| GET | /api/viaggi/:id?ore_cammino= | — | il viaggio + `peso` (vedi Zaino) + `consigli` (vedi sotto); `ore_cammino` facoltativo, 0.5–16 | 200, 400, 401, 404 |
| POST | /api/viaggi | `{ nome*, attivita*, n_persone, n_giorni, pernotto, serve_cucina, data_partenza, lat_partenza, lon_partenza, lat_arrivo, lon_arrivo, dislivello_m, distanza_km, note, pianificato }` – vedi regole sotto | il viaggio creato | 201, 400, 401 |
| PUT | /api/viaggi/:id | come POST (viaggio intero) | il viaggio aggiornato | 200, 400, 401, 404 |
| DELETE | /api/viaggi/:id | — | nessun corpo (lo zaino del viaggio viene cancellato: ON DELETE CASCADE) | 204, 400, 401, 404 |

Regole dei campi del viaggio (* = obbligatorio):
- `nome`* max 150; `attivita`* tra escursione, trekking, alpinismo, ciaspolata, ferrata
- `n_persone` intero 1–50 (default 1); `n_giorni` intero 1–60 (default 1)
- `pernotto` tra nessuno, rifugio, tenda, bivacco (default nessuno); `serve_cucina` booleano (default false)
- `data_partenza` data `AAAA-MM-GG` valida
- `lat_*` tra −90 e 90; `lon_*` tra −180 e 180
- `dislivello_m` intero 0–9000; `distanza_km` 0.1–999 (lunghezza del sentiero, inserita dall'utente)
- `note` max 1000; `pianificato` booleano (default false) – percorsi da fare in futuro

Blocco `consigli` del dettaglio:
- `ore_cammino_giorno`: da `?ore_cammino=` se presente (`fonte_ore: "utente"`), altrimenti stimate dal percorso
  con 4 km/h in piano + 1 h ogni 400 m di salita, divise per i giorni e arrotondate alla mezz'ora (`fonte_ore: "percorso"`); `null` se mancano i km
- `acqua_litri`: `fn_acqua_consigliata(n_giorni, n_persone, ore_cammino_giorno)`; `null` se mancano le ore
- `distanza_linea_aria_km`: tra partenza e arrivo (formula di haversine); `null` se mancano le coordinate
- `sole`: `{ disponibile: true, alba, tramonto }` in ora italiana, chiesti dal server a sunrise-sunset.org;
  `{ disponibile: false, motivo }` se mancano coordinate/data o se il servizio esterno non risponde entro 3 secondi

## Zaino
| Metodo | URL | Body | Risposta | Status |
| --- | --- | --- | --- | --- |
| POST | /api/viaggi/:id/genera | — | `{ aggiunti: n }` – indispensabili + preferiti, cucina solo se `serve_cucina`; generare di nuovo non duplica | 200, 400, 401, 404 |
| GET | /api/viaggi/:id/zaino | — | `{ peso: { n_oggetti, peso_totale_g, peso_inserito_g, peso_totale_kg, peso_inserito_kg }, oggetti: [ { oggetto_id, nome, categoria, peso_g, quantita, peso_riga_g, inserito, is_indispensabile, is_preferito } ] }` | 200, 400, 401, 404 |
| POST | /api/viaggi/:id/zaino | `{ oggetto_id*, quantita }` – quantita intero 1–99 (default 1); l'oggetto deve essere mio | la riga dello zaino | 201, 400, 401, 404, 409 (già nello zaino) |
| PATCH | /api/viaggi/:id/zaino/:oggettoId | `{ inserito, quantita }` – almeno uno dei due; cambia solo i campi inviati | la riga aggiornata | 200, 400, 401, 404 |
| DELETE | /api/viaggi/:id/zaino/:oggettoId | — | nessun corpo (l'oggetto resta nell'armadio) | 204, 400, 401, 404 |
| POST | /api/viaggi/:id/zaino/svuota | — | `{ svuotati: n }` – tutti gli oggetti tornano "non inseriti" | 200, 400, 401, 404 |

## Note sugli status code
- **400**: dati non validi nel body o nell'URL (campo mancante, tipo sbagliato, fuori dai limiti, id non numerico o troppo grande, JSON malformato); il `message` spiega cosa correggere. Codici: `VALIDATION_ERROR`, `BAD_ID`, `BAD_QUERY`, `BAD_JSON`, `BAD_INPUT`, `WEAK_PASSWORD`.
- **401**: non autenticato (manca il cookie, token scaduto o manomesso) oppure credenziali errate al login.
- **404**: la risorsa non esiste **oppure non è mia**: non riveliamo che esiste (niente 403).
- **409**: violazione di unicità (email già registrata, nome già nel mio armadio, oggetto già nello zaino).
- **422**: vincolo del database violato che il validatore non ha intercettato (rete di sicurezza).
- **500**: errore interno; il dettaglio resta nel log del server, al client arriva solo "Errore interno".

## Scelte da confermare con il tutor
- Ore di cammino: stimate dal percorso (`distanza_km` + `dislivello_m`) o inserite dall'utente con `?ore_cammino=`.
- Svuota checklist: endpoint "azione" `POST /api/viaggi/:id/zaino/svuota` (coerente con `/genera`) invece di una PATCH sull'intera collezione.
- Km lungo i sentieri calcolati automaticamente: fuori dallo scope di questa settimana (serve un servizio di routing esterno); per ora `distanza_km` è inserita dall'utente.