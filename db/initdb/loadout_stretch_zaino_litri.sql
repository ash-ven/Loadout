-- =====================================================================
--  LOADOUT - Gli zaini nell'armadio, con la capienza in litri
--  (Il nome del file viene DOPO loadout_stretch_zaino_intelligente.sql in ordine alfabetico: su un database nuovo
--   gli script girano in quell'ordine, e questa versione di fn_genera_zaino deve essere l'ultima.)
--    1. nuova categoria 'zaini' (prima di 'altro', così nell'elenco viene prima)
--    2. colonna litri: la capienza dello zaino (solo per la categoria 'zaini', da 1 a 150 litri)
--    3. fn_genera_zaino NON aggiunge più gli zaini indispensabili o preferiti:
--       lo zaino giusto per il viaggio lo sceglie l'app (api/src/services/kit.js, scegliZaino),
--       in base ai litri che servono (in giornata, in rifugio, in tenda…)
--
--  Sul database che hai già, eseguilo una volta a mano:
--    docker exec loadout-db psql -U loadout -d loadout -f /docker-entrypoint-initdb.d/loadout_stretch_zaino_litri.sql
--  Si può rieseguire senza danni.
-- =====================================================================

-- ADD VALUE fuori dalla transazione: un valore nuovo di un ENUM non si può usare
-- nella stessa transazione in cui lo si crea (e qui sotto la funzione lo usa)
ALTER TYPE categoria_oggetto ADD VALUE IF NOT EXISTS 'zaini' BEFORE 'altro';

BEGIN;

ALTER TABLE oggetto ADD COLUMN IF NOT EXISTS litri SMALLINT
  CHECK (litri IS NULL OR litri BETWEEN 1 AND 150);

CREATE OR REPLACE FUNCTION fn_genera_zaino(p_viaggio_id INT) RETURNS INT AS $$
DECLARE
    v_utente    INT;
    v_cucina    BOOLEAN;
    v_added     INT;
BEGIN
    SELECT utente_id, serve_cucina INTO v_utente, v_cucina
    FROM viaggio WHERE id = p_viaggio_id;

    IF v_utente IS NULL THEN
        RAISE EXCEPTION 'Viaggio % non trovato', p_viaggio_id;
    END IF;

    INSERT INTO viaggio_oggetto (viaggio_id, oggetto_id, quantita)
    SELECT p_viaggio_id, o.id, 1
    FROM oggetto o
    WHERE o.utente_id = v_utente
      AND (o.is_indispensabile OR o.is_preferito)
      -- regola di dominio: la categoria 'cucina' entra solo se serve_cucina
      AND (o.categoria <> 'cucina' OR v_cucina)
      -- lo zaino non entra qui: lo sceglie l'app in base ai litri che servono per il viaggio
      AND o.categoria <> 'zaini'
    ON CONFLICT (viaggio_id, oggetto_id) DO NOTHING;

    GET DIAGNOSTICS v_added = ROW_COUNT;
    RETURN v_added;
END;
$$ LANGUAGE plpgsql;

COMMIT;
