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

