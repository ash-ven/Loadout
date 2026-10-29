-- =====================================================================
--  LOADOUT - B3: oggetti "indossati"
--  I vestiti che porti addosso (maglietta, pantaloni, scarponi...) restano
--  nella checklist ma NON pesano nello zaino.
--
--  Su un database nuovo parte da solo (cartella initdb, dopo loadout_stretch.sql).
--  Sul database che hai già, eseguilo una volta a mano:
--    docker exec loadout-db psql -U loadout -d loadout -f /docker-entrypoint-initdb.d/loadout_stretch_indossato.sql
--  È scritto per poter essere rieseguito senza danni (IF NOT EXISTS, CREATE OR REPLACE).
-- =====================================================================

BEGIN;  -- tutto o niente: se una riga fallisce, il database resta com'era

-- 1. La nuova colonna: per ogni oggetto di uno zaino, lo indosso o lo porto nello zaino?
ALTER TABLE viaggio_oggetto
  ADD COLUMN IF NOT EXISTS indossato BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Il peso dello zaino NON conta gli oggetti indossati; in più dice quanto porti addosso.
--    CREATE OR REPLACE VIEW permette di cambiare i calcoli e di AGGIUNGERE colonne in fondo,
--    ma non di togliere o rinominare quelle che ci sono: per questo peso_addosso_g è l'ultima.
CREATE OR REPLACE VIEW v_zaino_peso AS
SELECT v.id                                   AS viaggio_id,
       v.nome                                 AS viaggio,
       v.utente_id,
       COUNT(vo.oggetto_id)                   AS n_oggetti,
       COALESCE(SUM(o.peso_g * vo.quantita) FILTER (WHERE NOT vo.indossato), 0)                  AS peso_totale_g,
       COALESCE(SUM(o.peso_g * vo.quantita) FILTER (WHERE vo.inserito AND NOT vo.indossato), 0)  AS peso_inserito_g,
       ROUND(COALESCE(SUM(o.peso_g * vo.quantita) FILTER (WHERE NOT vo.indossato), 0) / 1000.0, 2) AS peso_totale_kg,
       COALESCE(SUM(o.peso_g * vo.quantita) FILTER (WHERE vo.indossato), 0)                      AS peso_addosso_g
FROM viaggio v
LEFT JOIN viaggio_oggetto vo ON vo.viaggio_id = v.id
LEFT JOIN oggetto o          ON o.id = vo.oggetto_id
GROUP BY v.id, v.nome, v.utente_id;

-- 3. La checklist restituisce anche "indossato" (aggiunto in fondo, per lo stesso motivo)
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
       vo.indossato
FROM viaggio_oggetto vo
JOIN oggetto o ON o.id = vo.oggetto_id;

COMMIT;

-- Verifica (a mano, in psql):
-- SELECT viaggio, peso_totale_g, peso_addosso_g FROM v_zaino_peso;
