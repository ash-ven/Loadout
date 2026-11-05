-- =====================================================================
--  LOADOUT - 5/11 (privacy, scelta di Asiha): account inattivi
--  Un account che non entra da 24 mesi si cancella (con un'email di avviso un mese prima): non teniamo i dati
--  più del necessario (GDPR, art. 5.1.e). Per saperlo salviamo SOLO la data dell'ultimo accesso: niente IP,
--  niente storico (si sovrascrive a ogni accesso). La cancellazione la fa api/src/services/pulizia.js.
--
--  Su un database nuovo parte da solo (cartella initdb, ordine alfabetico).
--  Sul database che hai già, eseguilo una volta a mano:
--    docker exec loadout-db psql -U loadout -d loadout -f /docker-entrypoint-initdb.d/loadout_stretch_ultimo_accesso.sql
--  Si può rieseguire senza danni (IF NOT EXISTS). Gli account che esistono già partono da oggi (DEFAULT now()):
--  nessuno viene cancellato prima di due anni.
-- =====================================================================
ALTER TABLE utente ADD COLUMN IF NOT EXISTS ultimo_accesso_il TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE utente ADD COLUMN IF NOT EXISTS avviso_inattivita_il TIMESTAMPTZ;   -- quando abbiamo mandato l'email «tra un mese cancelliamo»
