-- =====================================================================
--  LOADOUT - Il luogo di partenza (e di arrivo) per NOME
--  Le coordinate c'erano già (lat_/lon_partenza e arrivo): ora salviamo anche
--  il nome scelto ("Malga Prato (TN)"), da mostrare nella scheda del viaggio.
--
--  Sul database che hai già, eseguilo una volta a mano:
--    docker exec loadout-db psql -U loadout -d loadout -f /docker-entrypoint-initdb.d/loadout_stretch_luoghi.sql
--  Si può rieseguire senza danni.
-- =====================================================================

BEGIN;

ALTER TABLE viaggio ADD COLUMN IF NOT EXISTS luogo_partenza VARCHAR(200);
ALTER TABLE viaggio ADD COLUMN IF NOT EXISTS luogo_arrivo   VARCHAR(200);

COMMIT;
