-- =====================================================================
--  LOADOUT - Profilo: consenso per le note mediche, via l'esperienza in montagna
--    1. consenso_salute_il: QUANDO l'utente ha dato il consenso a salvare le note mediche
--       (dati sulla salute = categoria particolare del GDPR, art. 9: serve un consenso esplicito,
--       e bisogna poter dimostrare quando è stato dato). NULL = nessun consenso.
--       Le note salvate prima di oggi NON ricevono un consenso inventato: l'app chiede di confermarlo.
--    2. livello_esperienza tolta: nessuna funzione dell'app la usava (minimizzazione dei dati).
--  Il nome del file viene DOPO loadout_stretch_profilo.sql in ordine alfabetico: su un database nuovo
--  quello aggiunge livello_esperienza, questo lo toglie.
--
--  Sul database che hai già, eseguilo una volta a mano:
--    docker exec loadout-db psql -U loadout -d loadout -f /docker-entrypoint-initdb.d/loadout_stretch_profilo_consenso.sql
--  Si può rieseguire senza danni.
-- =====================================================================

BEGIN;

ALTER TABLE utente ADD COLUMN IF NOT EXISTS consenso_salute_il TIMESTAMPTZ;

ALTER TABLE utente DROP COLUMN IF EXISTS livello_esperienza;

COMMIT;
