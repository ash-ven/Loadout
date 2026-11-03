-- =====================================================================
--  LOADOUT - Punto 5 (3/11): «cosa non hai usato»
--  Al rientro da un viaggio segni gli oggetti dello zaino che NON ti sono serviti.
--  Se lo stesso oggetto resta inutilizzato due volte di fila nella stessa attività,
--  lo zaino del viaggio dopo te lo ricorda («non usato le ultime 2 volte»). Decidi tu se lasciarlo a casa.
--
--  Di base è tutto "usato" (non_usato = FALSE): scelta di Asiha, così al rientro spunti solo le eccezioni.
--
--  Su un database nuovo parte da solo (cartella initdb, dopo loadout_stretch_oggetto.sql: l'ordine è alfabetico).
--  Sul database che hai già, eseguilo una volta a mano:
--    docker exec loadout-db psql -U loadout -d loadout -f /docker-entrypoint-initdb.d/loadout_stretch_usato.sql
--  Si può rieseguire senza danni (IF NOT EXISTS, CREATE OR REPLACE).
-- =====================================================================

BEGIN;  -- tutto o niente

-- 1. La nuova colonna: per ogni oggetto di uno zaino, al rientro è rimasto inutilizzato?
ALTER TABLE viaggio_oggetto
  ADD COLUMN IF NOT EXISTS non_usato BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. La checklist restituisce anche non_usato. CREATE OR REPLACE VIEW può solo AGGIUNGERE colonne in fondo:
--    per questo la ripetiamo uguale a loadout_stretch_oggetto.sql, con non_usato come ultima colonna.
CREATE OR REPLACE VIEW v_zaino_dettaglio AS
SELECT vo.viaggio_id,
       o.id            AS oggetto_id,
       o.nome,
       o.categoria,
       o.peso_g,
       vo.quantita,
       o.peso_g * vo.quantita AS peso_riga_g,
       vo.inserito,
       o.is_indispensabile,
       o.is_preferito,
       vo.indossato,
       o.quantita_posseduta,
       o.marchio,
       vo.non_usato
FROM viaggio_oggetto vo
JOIN oggetto o ON o.id = vo.oggetto_id;

COMMIT;
