-- =====================================================================
--  LOADOUT - Zaino intelligente (B5): via "Adatto a"
--  Prima: ogni oggetto aveva le attività per cui andava bene (attivita_adatte),
--  da spuntare a mano nell'armadio. Scomodo e limitante (prova con utenti veri).
--  Ora è l'app a sapere cosa serve per ogni uscita (le liste "kit" in api/src/services/kit.js)
--  e a cercarlo nell'armadio. Quindi:
--    1. fn_genera_zaino torna alla versione senza filtro per attività
--       (indispensabili + preferiti, la cucina solo se serve);
--    2. la colonna attivita_adatte sparisce (con il suo CHECK).
--  Le migrazioni di prima (loadout_stretch_attivita*.sql) restano come storia del progetto.
--
--  Sul database che hai già, eseguilo una volta a mano:
--    docker exec loadout-db psql -U loadout -d loadout -f /docker-entrypoint-initdb.d/loadout_stretch_zaino_intelligente.sql
--  Si può rieseguire senza danni.
-- =====================================================================

BEGIN;

-- 1. La funzione PRIMA di togliere la colonna (la versione vecchia la usa)
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
    ON CONFLICT (viaggio_id, oggetto_id) DO NOTHING;

    GET DIAGNOSTICS v_added = ROW_COUNT;
    RETURN v_added;
END;
$$ LANGUAGE plpgsql;

-- 2. Via la colonna (il CHECK sulla colonna se ne va con lei)
ALTER TABLE oggetto DROP COLUMN IF EXISTS attivita_adatte;

COMMIT;
