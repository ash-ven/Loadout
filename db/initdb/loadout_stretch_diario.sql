-- =====================================================================
--  LOADOUT - Punto 6 (3/11): il diario del viaggio
--  Dopo un viaggio: una nota tua e un voto da 1 a 5 (gli scarponi, scelta di Asiha).
--  Nella Home i segnaposto dei viaggi fatti diventano ricordi: il fumetto mostra voto e inizio della nota.
--
--  Su un database nuovo parte da solo (cartella initdb, ordine alfabetico).
--  Sul database che hai già, eseguilo una volta a mano:
--    docker exec loadout-db psql -U loadout -d loadout -f /docker-entrypoint-initdb.d/loadout_stretch_diario.sql
--  Si può rieseguire senza danni.
-- =====================================================================

BEGIN;

ALTER TABLE viaggio ADD COLUMN IF NOT EXISTS diario_nota VARCHAR(1000);   -- NULL = non scritta
ALTER TABLE viaggio ADD COLUMN IF NOT EXISTS diario_voto SMALLINT;        -- NULL = nessun voto

-- Il voto va da 1 a 5: lo controlla anche il database (oltre al server). Il vincolo ha un nome,
-- così lo possiamo togliere e rimettere: rieseguendo il file non nasce un secondo vincolo uguale.
ALTER TABLE viaggio DROP CONSTRAINT IF EXISTS viaggio_diario_voto_check;
ALTER TABLE viaggio ADD CONSTRAINT viaggio_diario_voto_check CHECK (diario_voto IS NULL OR diario_voto BETWEEN 1 AND 5);

COMMIT;
