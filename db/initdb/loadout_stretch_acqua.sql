-- =====================================================================
--  LOADOUT - B4: acqua consigliata più realistica, A PERSONA AL GIORNO
--
--  Su un database nuovo parte da solo (cartella initdb, dopo loadout_stretch.sql).
--  Sul database che hai già, eseguilo una volta a mano:
--    docker exec loadout-db psql -U loadout -d loadout -f /docker-entrypoint-initdb.d/loadout_stretch_acqua.sql
-- =====================================================================

BEGIN;

-- 1. Litri a persona per UN giorno di cammino (stima, non regola medica):
--    0,5 L per ora di cammino + 0,5 L ogni 1.000 m di salita, mai meno di 1 L;
--    +25% sopra i 25 °C, +50% sopra i 30 °C; +1 L se si cucina;
--    arrotondato al mezzo litro PER ECCESSO: CEIL(x * 2) / 2  (es. 2,2 → 2,5)
CREATE OR REPLACE FUNCTION fn_acqua_persona_giorno(
    p_ore_cammino_giorno  NUMERIC,
    p_dislivello_giorno   NUMERIC DEFAULT 0,
    p_temperatura_max     NUMERIC DEFAULT NULL,
    p_cucina              BOOLEAN DEFAULT FALSE
) RETURNS NUMERIC AS $$
    SELECT ROUND(CEIL((
        GREATEST(1, p_ore_cammino_giorno * 0.5 + COALESCE(p_dislivello_giorno, 0) / 1000.0 * 0.5)
        * CASE WHEN p_temperatura_max > 30 THEN 1.5
               WHEN p_temperatura_max > 25 THEN 1.25
               ELSE 1 END
        + CASE WHEN p_cucina THEN 1 ELSE 0 END
    ) * 2) / 2, 1);   -- ROUND(…, 1): un decimale, così in psql si legge 2.5 e non 2.5000000000000000
$$ LANGUAGE sql IMMUTABLE;

-- 2. fn_acqua_consigliata resta il punto d'ingresso (US6 CA1) e dà il TOTALE del viaggio:
--    litri a persona al giorno × giorni × persone. Due parametri nuovi in fondo, con un valore
--    di default: le chiamate vecchie a 3 o 4 argomenti (es. negli esercizi) funzionano ancora.
--    Cambiando i parametri non basta CREATE OR REPLACE: prima si elimina la versione vecchia (a 4).
--    La nuova (a 6) usa CREATE OR REPLACE: così il file si può rieseguire senza errori.
DROP FUNCTION IF EXISTS fn_acqua_consigliata(INT, INT, NUMERIC, NUMERIC);

CREATE OR REPLACE FUNCTION fn_acqua_consigliata(
    p_n_giorni            INT,
    p_n_persone           INT,
    p_ore_cammino_giorno  NUMERIC,
    p_temperatura_max     NUMERIC DEFAULT NULL,
    p_dislivello_giorno   NUMERIC DEFAULT 0,
    p_cucina              BOOLEAN DEFAULT FALSE
) RETURNS NUMERIC AS $$
    SELECT fn_acqua_persona_giorno(p_ore_cammino_giorno, p_dislivello_giorno, p_temperatura_max, p_cucina)
           * p_n_giorni * p_n_persone;
$$ LANGUAGE sql IMMUTABLE;

COMMIT;

-- Verifica (a mano, in psql):
-- SELECT fn_acqua_persona_giorno(4, 450, 12, false);    -- 2.5  (4 h, 450 m di salita, 12 °C)
-- SELECT fn_acqua_persona_giorno(6, 600, 28, true);     -- 5.5  (6 h, 600 m, 28 °C, con cucina)
-- SELECT fn_acqua_consigliata(2, 3, 5);                 -- la chiamata degli esercizi funziona ancora
