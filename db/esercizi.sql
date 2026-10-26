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

-- L4.8 Esercizio 5: JOIN non presente nelle viste (viaggio + utente)
-- Risultato: 2 righe, ogni viaggio con il nome del proprietario (entrambi di Asiha).
-- Il JOIN segue la chiave esterna viaggio.utente_id -> utente.id.
SELECT viaggio.nome, utente.nome FROM viaggio JOIN utente ON viaggio.utente_id = utente.id;

-- Consegna Esercizio 3: nuovo viaggio di 3 giorni in tenda con cucina
-- Risultato: id 4. fn_genera_zaino(4) aggiunge 11 oggetti: 6 indispensabili + 5 preferiti
-- (compresi Fornello e Pentolino, perché serve_cucina = TRUE). Peso totale 5610 g.
-- Il viaggio 1 ne ha 9 perché non ha la cucina: la regola esclude gli oggetti di categoria cucina.
INSERT INTO viaggio (utente_id, nome, attivita, n_giorni, pernotto, serve_cucina)
VALUES (1, 'Tre giorni in tenda', 'trekking', 3, 'tenda', TRUE)
RETURNING id;
SELECT fn_genera_zaino(4);
SELECT * FROM v_zaino_peso;

-- Consegna Esercizio 4
-- Segna come inseriti tutti gli oggetti di categoria abbigliamento del viaggio 2,
-- con un solo UPDATE e una sottoquery.
-- La sottoquery (tra parentesi) viene eseguita per prima e restituisce gli id
-- degli oggetti di abbigliamento: 2 (Giacca), 3 (Pile), 4 (Scarponi).
-- L'UPDATE poi mette inserito = TRUE solo per quegli oggetti nel viaggio 2.
-- Risultato: UPDATE 3. In v_zaino_peso il peso_inserito_g del viaggio 2
-- passa da 0 a 1700 (320 + 280 + 1100).
UPDATE viaggio_oggetto SET inserito = TRUE
WHERE viaggio_id = 2
  AND oggetto_id IN (SELECT id FROM oggetto WHERE categoria = 'abbigliamento');

  -- Consegna Esercizio 6
-- Per ogni viaggio, l'oggetto più pesante nello zaino.
-- ORDER BY mette in cima, per ogni viaggio, l'oggetto più pesante;
-- DISTINCT ON (viaggio_id) tiene solo la prima riga di ogni viaggio.
-- Risultato: viaggi 1, 2 e 4 -> Zaino 40L (1400 g), che è indispensabile
-- e quindi è in tutti gli zaini. Il viaggio 3 non esiste (id consumato
-- da un INSERT fallito).
SELECT DISTINCT ON (viaggio_id) viaggio_id, nome, peso_g
FROM v_zaino_dettaglio
ORDER BY viaggio_id, peso_g DESC;


-- Consegna Esercizio 7
-- Aggiunto il parametro temperatura_max a fn_acqua_consigliata:
-- sopra i 25 °C la quantità aumenta del 25% (× 1.25).
-- Prima faccio DROP della vecchia versione, perché aggiungere un parametro
-- cambia la "firma" della funzione e CREATE OR REPLACE ne creerebbe una seconda.
-- DEFAULT NULL: le chiamate a 3 parametri continuano a funzionare.
-- Tutto dentro BEGIN/COMMIT, così un errore non lascia il DB senza funzione.
-- Prove: (2,3,5) = 18.0 · (2,3,5,20) = 18.0 · (2,3,5,30) = 22.5
BEGIN;
DROP FUNCTION fn_acqua_consigliata(INT, INT, NUMERIC);
CREATE OR REPLACE FUNCTION fn_acqua_consigliata(p_n_giorni INT, p_n_persone INT, p_ore_cammino_giorno NUMERIC, p_temperatura_max NUMERIC DEFAULT NULL)
RETURNS NUMERIC AS $$
  SELECT ROUND((p_ore_cammino_giorno * 0.5 * p_n_giorni
               + CASE WHEN p_n_giorni > 1 THEN p_n_giorni - 1 ELSE 0 END) * p_n_persone
               * CASE WHEN p_temperatura_max > 25 THEN 1.25 ELSE 1 END, 1);
$$ LANGUAGE sql IMMUTABLE;
COMMIT;

-- L4.8 Esercizio 8
-- EXPLAIN ANALYZE mostra il "piano": come Postgres trova le righe e quanto ci mette.
-- 1) Senza filtro: Seq Scan (legge tutte le 14 righe) + Sort per categoria, nome.
--    Stima rows=160, reali 14: la tabella non ha ancora statistiche, conta "actual".
-- 2) Con WHERE id = 4: Index Scan using oggetto_pkey, cioè usa l'indice creato
--    in automatico dalla chiave primaria e va dritto all'unica riga (rows=1).
-- Conclusione: con un filtro sulla PK Postgres usa l'indice invece di leggere tutto.
-- Su 14 righe i tempi sono simili (millisecondi); la differenza si vede su tabelle grandi.
EXPLAIN ANALYZE SELECT * FROM oggetto ORDER BY categoria, nome;
EXPLAIN ANALYZE SELECT * FROM oggetto WHERE id = 4 ORDER BY categoria, nome;


