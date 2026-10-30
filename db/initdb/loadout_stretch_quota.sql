-- =====================================================================
--  LOADOUT - Quota massima del percorso (B3)
--  Serve a stimare il freddo in cima e ad avvisare di neve e ghiaccio sopra i 2000 m.
--
--  Sul database che hai già, eseguilo una volta a mano:
--    docker exec loadout-db psql -U loadout -d loadout -f /docker-entrypoint-initdb.d/loadout_stretch_quota.sql
--  Si può rieseguire senza danni.
-- =====================================================================

BEGIN;

ALTER TABLE viaggio
  ADD COLUMN IF NOT EXISTS quota_max_m INTEGER
  CHECK (quota_max_m IS NULL OR quota_max_m BETWEEN 0 AND 9000);

COMMIT;
