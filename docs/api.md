# API di Loadout

Contratto tra backend e frontend. Tutte le risposte sono in JSON.

- **Autenticazione:** dopo il login il server imposta il cookie `token` (httpOnly). Tutte le rotte richiedono il login, tranne register e login: senza cookie valido rispondono **401**.
- **Proprietà:** ogni oggetto e ogni viaggio appartiene all'utente loggato. Una risorsa di un altro utente risponde **404** (non 403).
- **Formato degli errori:** `{ "error": "VALIDATION_ERROR", "message": "Il campo 'nome' è obbligatorio" }`

## Servizio
| Metodo | URL | Body in ingresso | Risposta | Status code |
| --- | --- | --- | --- | --- |
| GET | /api/health | — | { status: "ok", db: true } | 200, 500 |

## Autenticazione
| Metodo | URL | Body in ingresso | Risposta | Status code |
| --- | --- | --- | --- | --- |
| POST | /api/auth/register | { email, password, nome } | l'utente creato { id, email, nome } | 201, 400, 409 |
| POST | /api/auth/login | { email, password } | { id, nome } + cookie token | 200, 401, 429 |
| POST | /api/auth/logout | — | nessun corpo (cancella il cookie) | 204 |
| GET | /api/auth/me | — | l'utente loggato { sub, nome }, mai password_hash | 200, 401 |

## Armadio
| Metodo | URL | Body in ingresso | Risposta | Status code |
| --- | --- | --- | --- | --- |
| GET | /api/oggetti?q=&categoria=&limit=&offset= | — | lista dei miei oggetti (array JSON), ordinata per categoria e nome; limit da 1 a 200 (default 50), offset ≥ 0 (default 0) | 200, 400, 401 |
| POST | /api/oggetti | { nome, categoria, peso_g, is_indispensabile, is_preferito, codice_etichetta, note } | l'oggetto creato, con il suo id | 201, 400, 401, 409, 422 |
| GET | /api/oggetti/:id | — | un oggetto | 200, 400, 401, 404 |
| PUT | /api/oggetti/:id | { nome, categoria, peso_g, is_indispensabile, is_preferito, codice_etichetta, note } | l'oggetto aggiornato | 200, 400, 401, 404, 409, 422 |
| DELETE | /api/oggetti/:id | — | nessun corpo (sparisce anche dagli zaini: ON DELETE CASCADE) | 204, 400, 401, 404 |

## Viaggi
| Metodo | URL | Body in ingresso | Risposta | Status code |
| --- | --- | --- | --- | --- |
| GET | /api/viaggi | — | lista dei miei viaggi, ordinata per data di partenza | 200, 401 |
| POST | /api/viaggi | { nome, attivita, n_persone, n_giorni, pernotto, serve_cucina, data_partenza, lat_partenza, lon_partenza, lat_arrivo, lon_arrivo, dislivello_m, note } | il viaggio creato, con il suo id | 201, 400, 401, 422 |
| GET | /api/viaggi/:id?ore_cammino= | — | il viaggio + peso (v_zaino_peso) + consigli { acqua_litri, alba, tramonto } | 200, 400, 401, 404 |
| PUT | /api/viaggi/:id | come il POST | il viaggio aggiornato | 200, 400, 401, 404, 422 |
| DELETE | /api/viaggi/:id | — | nessun corpo (sparisce anche il suo zaino: ON DELETE CASCADE) | 204, 400, 401, 404 |
| POST | /api/viaggi/:id/genera | — | { aggiunti: n } (fn_genera_zaino; la seconda volta n = 0) | 200, 400, 401, 404 |

## Zaino
| Metodo | URL | Body in ingresso | Risposta | Status code |
| --- | --- | --- | --- | --- |
| GET | /api/viaggi/:id/zaino | — | la checklist: una riga per oggetto (v_zaino_dettaglio) | 200, 400, 401, 404 |
| POST | /api/viaggi/:id/zaino | { oggetto_id, quantita } | la riga aggiunta allo zaino | 201, 400, 401, 404, 409, 422 |
| PATCH | /api/viaggi/:id/zaino/:oggettoId | { inserito, quantita } (entrambi facoltativi) | la riga aggiornata | 200, 400, 401, 404, 422 |
| DELETE | /api/viaggi/:id/zaino/:oggettoId | — | nessun corpo | 204, 400, 401, 404 |

## Note sugli status code
- **400:** body scritto male (campo mancante, tipo sbagliato) oppure parametri dell'URL non validi (id non numerico, limit < 1, offset < 0).
- **404:** la risorsa non esiste o non è mia. Nello zaino vale sia per il viaggio sia per l'oggetto che aggiungo.
- **409:** doppione. Nome già presente nel mio armadio (UNIQUE utente_id, nome), email già registrata, oggetto già nello zaino (PK composta).
- **422:** viola una regola del database. peso_g ≤ 0, quantita ≤ 0, n_persone fuori da 1–50, n_giorni fuori da 1–60 (CHECK); oggetto_id inesistente (FK).
- **429:** troppi tentativi di login (rate limit, venerdì).

## Da decidere con il tutor
- **Ore di cammino per l'acqua (US6 CA1):** proposta, passarle come `?ore_cammino=` nel GET del viaggio.
- **Pulsante "svuota checklist" (US5 CA4):** non c'è un endpoint nella consegna. Si può fare con un PATCH per ogni riga oppure con un endpoint dedicato.
