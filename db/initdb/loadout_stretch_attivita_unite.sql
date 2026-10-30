-- =====================================================================
--  LOADOUT - Escursione e trekking diventano UNA sola attività
--  (prova con utenti veri: "che differenza c'è tra trekking ed escursione?").
--  In giornata o su più giorni lo dicono già i campi n_giorni e pernotto.
--  Nel database resta il valore 'escursione'; l'app lo mostra come "Escursione / trekking".
--
--  Sul database che hai già, eseguilo una volta a mano:
--    docker exec loadout-db psql -U loadout -d loadout -f /docker-entrypoint-initdb.d/loadout_stretch_attivita_unite.sql
--  Si può rieseguire senza danni.
-- =====================================================================

BEGIN;

-- 1. I viaggi "trekking" diventano "escursione"
UPDATE viaggio SET attivita = 'escursione' WHERE attivita = 'trekking';

-- 2. Negli oggetti, "trekking" tra le attività adatte diventa "escursione" (senza doppioni)
UPDATE oggetto
SET attivita_adatte = ARRAY(SELECT DISTINCT unnest(array_replace(attivita_adatte, 'trekking', 'escursione')))
WHERE 'trekking' = ANY(attivita_adatte);

-- 3. D'ora in poi "trekking" non si può più inserire.
--    Un valore di un ENUM in Postgres non si può togliere facilmente: lo blocchiamo con un CHECK.
ALTER TABLE viaggio DROP CONSTRAINT IF EXISTS viaggio_attivita_senza_trekking;
ALTER TABLE viaggio ADD CONSTRAINT viaggio_attivita_senza_trekking CHECK (attivita <> 'trekking');

--    Il CHECK sulle attività adatte degli oggetti, rifatto senza 'trekking'
ALTER TABLE oggetto DROP CONSTRAINT IF EXISTS oggetto_attivita_adatte_check;
ALTER TABLE oggetto ADD CONSTRAINT oggetto_attivita_adatte_check
  CHECK (attivita_adatte <@ ARRAY['escursione', 'alpinismo', 'ciaspolata', 'ferrata']);

COMMIT;
