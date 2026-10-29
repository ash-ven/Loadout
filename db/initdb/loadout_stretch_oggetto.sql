-- =====================================================================
--  LOADOUT - B1 e B2: più informazioni sugli oggetti dell'armadio
--   B1: marchio e caratteristiche tecniche (utili anche per la futura scansione dell'etichetta)
--   B2: quanti pezzi ne possiedi, così nello zaino non ne metti più di quanti ne hai
--
--  Su un database nuovo parte da solo (cartella initdb, dopo gli altri file stretch).
--  Sul database che hai già, eseguilo una volta a mano:
--    docker exec loadout-db psql -U loadout -d loadout -f /docker-entrypoint-initdb.d/loadout_stretch_oggetto.sql
--  Si può rieseguire senza danni.
-- =====================================================================

BEGIN;

-- B1: marchio (corto) e caratteristiche tecniche (testo libero, es. "Gore-Tex, 20.000 mm, taglia M")
ALTER TABLE oggetto ADD COLUMN IF NOT EXISTS marchio VARCHAR(80);
ALTER TABLE oggetto ADD COLUMN IF NOT EXISTS caratteristiche VARCHAR(500);

-- B2: pezzi posseduti (da 1 a 99, come la quantità nello zaino)
ALTER TABLE oggetto
  ADD COLUMN IF NOT EXISTS quantita_posseduta SMALLINT NOT NULL DEFAULT 1
  CHECK (quantita_posseduta BETWEEN 1 AND 99);

-- I dati che ci sono già devono restare coerenti: se un oggetto è già in qualche zaino
-- con quantità 3, vuol dire che ne possiedi almeno 3.
UPDATE oggetto o
SET quantita_posseduta = z.massima
FROM (SELECT oggetto_id, MAX(quantita) AS massima FROM viaggio_oggetto GROUP BY oggetto_id) z
WHERE z.oggetto_id = o.id AND z.massima > o.quantita_posseduta;

-- La checklist restituisce anche quanti pezzi possiedi e il marchio (aggiunti IN FONDO alla vista)
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
       o.marchio
FROM viaggio_oggetto vo
JOIN oggetto o ON o.id = vo.oggetto_id;

-- Dati di esempio (utente 1): qualche marchio e un paio di oggetti in più copie
UPDATE oggetto SET marchio = 'Salewa', caratteristiche = 'Gore-Tex, cappuccio regolabile' WHERE id = 2 AND marchio IS NULL;
UPDATE oggetto SET quantita_posseduta = GREATEST(quantita_posseduta, 2) WHERE utente_id = 1 AND lower(nome) LIKE '%calz%';

COMMIT;
