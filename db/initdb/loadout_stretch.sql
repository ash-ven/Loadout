-- =====================================================================
--  LOADOUT - Aggiunte per le funzionalità Stretch
--  Eseguito dopo loadout_schema.sql (ordine alfabetico in initdb)
-- =====================================================================

-- Stretch 5: peso corporeo dell'utente, per l'avviso "zaino > 20%"
ALTER TABLE utente
  ADD COLUMN IF NOT EXISTS peso_corporeo_kg NUMERIC(5,1)
  CHECK (peso_corporeo_kg IS NULL OR peso_corporeo_kg > 0);

-- Dati di esempio
UPDATE utente SET peso_corporeo_kg = 60 WHERE id = 1;  -- Asiha
UPDATE utente SET peso_corporeo_kg = 75 WHERE id = 2;  -- Demo


-- Query per l'avviso "zaino > 20% del peso corporeo" (da usare nel backend,
-- in GET /api/viaggi/:id, aggiungendo WHERE v_zaino_peso.viaggio_id = $1)
-- SELECT v_zaino_peso.viaggio,
--        v_zaino_peso.peso_totale_kg,
--        utente.peso_corporeo_kg,
--        utente.peso_corporeo_kg * 0.20 AS soglia_kg,
--        v_zaino_peso.peso_totale_kg > utente.peso_corporeo_kg * 0.20 AS troppo_pesante
-- FROM v_zaino_peso
-- JOIN utente ON utente.id = v_zaino_peso.utente_id;
--
-- Nota: se peso_corporeo_kg è NULL (utente che non l'ha inserito),
-- troppo_pesante vale NULL → il frontend non mostra l'avviso.


-- Stretch 4: percorsi da fare in futuro
ALTER TABLE viaggio
  ADD COLUMN IF NOT EXISTS pianificato BOOLEAN NOT NULL DEFAULT FALSE;

-- Dato di esempio: il viaggio 2 diventa un percorso da fare in futuro
UPDATE viaggio SET pianificato = TRUE WHERE id = 2;


-- Percorso (livello 1): lunghezza del sentiero in km, inserita dall'utente
-- (es. dal cartello CAI o dalla guida). Serve a stimare le ore di cammino.
ALTER TABLE viaggio
  ADD COLUMN IF NOT EXISTS distanza_km NUMERIC(5,1)
  CHECK (distanza_km IS NULL OR distanza_km > 0);

UPDATE viaggio SET distanza_km = 7.5  WHERE id = 1;  -- Anello del Lago Santo
UPDATE viaggio SET distanza_km = 14.0 WHERE id = 2;  -- Rifugio Duca degli Abruzzi


-- Acqua consigliata con la temperatura (consegna 7 + stretch 1 meteo):
-- sopra i 25 °C la quantità aumenta del 25%. Con temperatura NULL si comporta come l'originale.
-- Si elimina prima la versione a 3 parametri: con entrambe, una chiamata a 3 argomenti sarebbe ambigua.
DROP FUNCTION IF EXISTS fn_acqua_consigliata(INT, INT, NUMERIC);

CREATE OR REPLACE FUNCTION fn_acqua_consigliata(
    p_n_giorni            INT,
    p_n_persone           INT,
    p_ore_cammino_giorno  NUMERIC,
    p_temperatura_max     NUMERIC DEFAULT NULL
) RETURNS NUMERIC AS $$
    SELECT ROUND(
        (p_ore_cammino_giorno * 0.5 * p_n_giorni
         + CASE WHEN p_n_giorni > 1 THEN p_n_giorni - 1 ELSE 0 END) * p_n_persone
        * CASE WHEN p_temperatura_max > 25 THEN 1.25 ELSE 1 END,
    1);
$$ LANGUAGE sql IMMUTABLE;

-- Nome dell'oggetto unico nell'armadio SENZA distinguere maiuscole e minuscole
-- ("Guanti" e "guanti" sono lo stesso oggetto). Si affianca a UNIQUE (utente_id, nome) dello schema.
CREATE UNIQUE INDEX IF NOT EXISTS oggetto_utente_nome_ci
  ON oggetto (utente_id, lower(nome));