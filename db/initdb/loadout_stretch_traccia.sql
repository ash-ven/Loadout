-- =====================================================================
--  LOADOUT - C3: il tracciato del percorso lungo i sentieri
--  Un elenco di punti [lat, lon] calcolato da BRouter (profilo escursionismo)
--  e salvato con il viaggio, per disegnarlo sulla mappa della scheda.
--
--  Sul database che hai già, eseguilo una volta a mano:
--    docker exec loadout-db psql -U loadout -d loadout -f /docker-entrypoint-initdb.d/loadout_stretch_traccia.sql
-- =====================================================================

BEGIN;

-- JSONB: JSON salvato in formato binario. Qui un array di coppie: [[44.21, 10.64], [44.22, 10.63], ...]
ALTER TABLE viaggio
  ADD COLUMN IF NOT EXISTS traccia JSONB
  CHECK (traccia IS NULL OR jsonb_typeof(traccia) = 'array');

COMMIT;
