-- =====================================================================
--  LOADOUT - Percorso, mappa e meteo in vetta (branch mappe-v2)
--    quota_min_m  → il punto più basso del percorso (lo compila la mappa, o lo scrivi tu)
--    traccia      → il percorso disegnato sulla mappa: { "tappe": [[lat, lon], …], "linea": [[lat, lon, quota], …] }
--                   le tappe servono a rimettere le puntine quando modifichi il viaggio;
--                   l'anello non si salva: si ricava (arrivo = partenza)
--    ora_partenza → a che ora parti: serve a stimare quando arrivi in vetta (meteo in vetta "all'ora giusta")
--
--  Sul database che hai già, eseguilo una volta a mano:
--    docker exec loadout-db psql -U loadout -d loadout -f /docker-entrypoint-initdb.d/loadout_stretch_percorso.sql
--  Si può rieseguire senza danni.
-- =====================================================================

BEGIN;

ALTER TABLE viaggio ADD COLUMN IF NOT EXISTS quota_min_m INTEGER
  CHECK (quota_min_m IS NULL OR quota_min_m BETWEEN -500 AND 9000);

ALTER TABLE viaggio ADD COLUMN IF NOT EXISTS traccia JSONB;

ALTER TABLE viaggio ADD COLUMN IF NOT EXISTS ora_partenza TIME;

COMMIT;
