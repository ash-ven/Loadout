-- =====================================================================
--  LOADOUT - 5/11 (privacy, scelta di Asiha): via le note mediche
--  Erano gli unici dati sulla salute (GDPR, art. 9) e chiedevano un consenso a parte, il registro dei trattamenti
--  e più cautele. Si tolgono la colonna delle note e la data del consenso.
--  ATTENZIONE: le note già scritte vengono CANCELLATE per sempre.
--
--  Su un database nuovo parte da solo (cartella initdb, dopo loadout_stretch_profilo*.sql: l'ordine è alfabetico).
--  Sul database che hai già, eseguilo una volta a mano:
--    docker exec loadout-db psql -U loadout -d loadout -f /docker-entrypoint-initdb.d/loadout_stretch_senza_note_mediche.sql
--  Si può rieseguire senza danni (IF EXISTS).
-- =====================================================================
ALTER TABLE utente DROP COLUMN IF EXISTS note_mediche;
ALTER TABLE utente DROP COLUMN IF EXISTS consenso_salute_il;
