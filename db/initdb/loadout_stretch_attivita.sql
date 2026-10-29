-- =====================================================================
--  LOADOUT - C2: oggetti "adatti a" certe attività
--  Es. lo zaino da 20 L va bene per le escursioni, quello da 40 L per il trekking.
--  Lista VUOTA = adatto a tutte le attività: così gli oggetti che hai già
--  continuano a entrare nello zaino come prima (US4 non cambia).
--
--  Sul database che hai già, eseguilo una volta a mano:
--    docker exec loadout-db psql -U loadout -d loadout -f /docker-entrypoint-initdb.d/loadout_stretch_attivita.sql
--  Si può rieseguire senza danni.
-- =====================================================================

BEGIN;

-- Un array di testo (TEXT[]): un oggetto può andare bene per più attività.
-- Il CHECK con <@ ("è contenuto in") accetta solo valori della lista delle attività.
-- (TEXT[] e non tipo_attivita[]: la libreria pg trasforma da sola TEXT[] in un array JavaScript.)
ALTER TABLE oggetto
  ADD COLUMN IF NOT EXISTS attivita_adatte TEXT[] NOT NULL DEFAULT '{}'
  CHECK (attivita_adatte <@ ARRAY['escursione', 'trekking', 'alpinismo', 'ciaspolata', 'ferrata']);

-- La generazione dello zaino ora tiene conto dell'attività del viaggio.
-- Stessi parametri e stesso risultato di prima: basta CREATE OR REPLACE.
CREATE OR REPLACE FUNCTION fn_genera_zaino(p_viaggio_id INT) RETURNS INT AS $$
DECLARE
    v_utente    INT;
    v_cucina    BOOLEAN;
    v_attivita  TEXT;
    v_added     INT;
BEGIN
    SELECT utente_id, serve_cucina, attivita::text INTO v_utente, v_cucina, v_attivita
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
      -- C2: adatto all'attività del viaggio (lista vuota = adatto a tutte)
      AND (cardinality(o.attivita_adatte) = 0 OR v_attivita = ANY (o.attivita_adatte))
    ON CONFLICT (viaggio_id, oggetto_id) DO NOTHING;

    GET DIAGNOSTICS v_added = ROW_COUNT;
    RETURN v_added;
END;
$$ LANGUAGE plpgsql;

COMMIT;

-- Verifica (a mano, in psql):
-- UPDATE oggetto SET attivita_adatte = '{trekking}' WHERE nome = 'Zaino 40L';
-- poi genera lo zaino di un'escursione: lo zaino da 40 L non entra.
