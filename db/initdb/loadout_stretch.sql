-- =====================================================================
--  LOADOUT - Aggiunte per le funzionalità Stretch
--  Eseguito dopo loadout_schema.sql (ordine alfabetico in initdb)
-- =====================================================================

-- Stretch 5: peso corporeo dell'utente, per l'avviso "zaino > 20%"
ALTER TABLE utente
  ADD COLUMN IF NOT EXISTS peso_corporeo_kg NUMERIC(5,1)
  CHECK (peso_corporeo_kg IS NULL OR peso_corporeo_kg > 0);

-- Dati di esempio
UPDATE utente SET peso_corporeo_kg = 60 WHERE id = 1;  -- Asiha
UPDATE utente SET peso_corporeo_kg = 75 WHERE id = 2;  -- Demo


-- Query per l'avviso "zaino > 20% del peso corporeo" (da usare nel backend,
-- in GET /api/viaggi/:id, aggiungendo WHERE v_zaino_peso.viaggio_id = $1)
-- SELECT v_zaino_peso.viaggio,
--        v_zaino_peso.peso_totale_kg,
--        utente.peso_corporeo_kg,
--        utente.peso_corporeo_kg * 0.20 AS soglia_kg,
--        v_zaino_peso.peso_totale_kg > utente.peso_corporeo_kg * 0.20 AS troppo_pesante
-- FROM v_zaino_peso
-- JOIN utente ON utente.id = v_zaino_peso.utente_id;
--
-- Nota: se peso_corporeo_kg è NULL (utente che non l'ha inserito),
-- troppo_pesante vale NULL → il frontend non mostra l'avviso.


-- Stretch 4: percorsi da fare in futuro
ALTER TABLE viaggio
  ADD COLUMN IF NOT EXISTS pianificato BOOLEAN NOT NULL DEFAULT FALSE;

-- Dato di esempio: il viaggio 2 diventa un percorso da fare in futuro
UPDATE viaggio SET pianificato = TRUE WHERE id = 2;
