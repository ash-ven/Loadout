-- Esercizio 1: tutte le righe di oggetto ordinate per categoria e nome
-- Risultato: 14 righe. Le categorie NON sono in ordine alfabetico perché
-- categoria è un ENUM: Postgres ordina secondo l'ordine di dichiarazione.
SELECT * FROM oggetto ORDER BY categoria, nome;

-- Esercizio 2: numero di righe di ogni tabella
-- Risultato: utente 2, oggetto 14, viaggio 2, viaggio_oggetto 20
-- (viaggio_oggetto ha una riga per ogni coppia viaggio-oggetto: 9 nel viaggio 1 + 11 nel viaggio 2)
SELECT COUNT(*) FROM utente;
SELECT COUNT(*) FROM oggetto;
SELECT COUNT(*) FROM viaggio;
SELECT COUNT(*) FROM viaggio_oggetto;

-- Esercizio 3: query di verifica dello schema

-- 3a. Peso degli zaini
-- Risultato: (n_oggetti dei due viaggi e perché diversi; perché peso_inserito del viaggio 2 è 0)
SELECT * FROM v_zaino_peso;

-- 3b. Checklist del viaggio 2
-- Risultato: (quante righe, cosa fa WHERE, come si calcola peso_riga_g)
SELECT * FROM v_zaino_dettaglio WHERE viaggio_id = 2 ORDER BY categoria, nome;

-- 3c. Acqua consigliata: 2 giorni, 3 persone, 5 ore/giorno
-- Risultato: (il tuo calcolo a mano: 5 + 1 = 6, x 3 persone = 18 litri)
SELECT fn_acqua_consigliata(2, 3, 5);

-- Esercizio 4: inserimento che viola un vincolo CHECK
-- Risultato: ERROR: new row for relation "oggetto" violates check constraint "oggetto_peso_g_check"
-- Il database rifiuta la riga perché lo schema impone CHECK (peso_g > 0) e il peso è 0.
-- Nessuna riga viene inserita. Il DETAIL mostra la riga rifiutata: id 15 (consumato dalla
-- sequenza anche se l'insert fallisce), categoria 'altro' e flag a false presi dai default.
-- Nel backend questo errore ha codice 23514 e l'errorHandler (L5.7) lo trasforma in HTTP 422.
INSERT INTO oggetto (utente_id, nome, peso_g)
VALUES (1, 'Coltellino', 0);

-- Esercizio 5 (consegna): violazione dei vincoli
-- a) peso_g = 0 → vedi esercizio 4: violazione del CHECK "oggetto_peso_g_check"
-- b) oggetto inesistente nello zaino:
-- Risultato: ERROR: violates foreign key constraint "viaggio_oggetto_oggetto_id_fkey"
-- DETAIL: Key (oggetto_id)=(999) is not present in table "oggetto".
-- La chiave esterna impedisce di riferirsi a un oggetto che non esiste. Nel backend: codice 23503 → HTTP 422.
INSERT INTO viaggio_oggetto (viaggio_id, oggetto_id) VALUES (1, 999);

-- Esercizio 1 (consegna): indispensabili dell'utente 1, dal più pesante
-- Risultato: 6 righe, da Zaino 40L (1400 g) a Lampada frontale (90 g)
SELECT * FROM oggetto WHERE utente_id = 1 AND is_indispensabile = TRUE ORDER BY peso_g DESC;

-- L4.8 Esercizio 6 + Consegna Esercizio 2: peso dell'armadio dell'utente 1 per categoria
-- Risultato: 6 righe, una per categoria presente nell'armadio di Asiha.
-- WHERE tiene solo l'utente 1, GROUP BY fa un gruppo per categoria,
-- COUNT(*) conta gli oggetti del gruppo, SUM(peso_g) somma i pesi.
-- La più pesante è attrezzatura: 4 oggetti, 2980 g.
SELECT categoria, COUNT(*) AS n, SUM(peso_g) AS peso_totale_g
FROM oggetto
WHERE utente_id = 1
GROUP BY categoria
ORDER BY peso_totale_g DESC;

-- L4.8 Esercizio 7: transazione con ROLLBACK
-- Risultato: peso degli Scarponi 1100 -> 1200 dentro la transazione (prompt loadout=*#)
-- -> di nuovo 1100 dopo il ROLLBACK. ROLLBACK annulla tutto quello fatto dopo BEGIN.
SELECT nome, peso_g FROM oggetto WHERE id = 4;
BEGIN;
UPDATE oggetto SET peso_g = 1200 WHERE id = 4;
SELECT nome, peso_g FROM oggetto WHERE id = 4;
ROLLBACK;
SELECT nome, peso_g FROM oggetto WHERE id = 4;


