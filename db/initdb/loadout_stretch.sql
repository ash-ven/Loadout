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