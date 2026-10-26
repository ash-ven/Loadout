-- =====================================================================
--  LOADOUT - Schema database di partenza
--  Tirocinio ITS Futura @ Hubenture - Settimana 2
--  Studente: Asiha Venturi
--  Target: PostgreSQL 16 (Docker: postgres:16)
-- ---------------------------------------------------------------------
--  Come si usa:
--    1. Copia questo file nella cartella ./initdb del tuo progetto
--    2. docker compose up -d   (vedi docker-compose.yml nel PDF)
--    3. Il container esegue automaticamente lo script al PRIMO avvio
--  Per rieseguirlo a mano:
--    psql -h localhost -U loadout -d loadout -f loadout_schema.sql
-- ---------------------------------------------------------------------
--  Lo script e' IDEMPOTENTE: puo' essere lanciato piu' volte senza
--  errori (DROP ... IF EXISTS all'inizio). ATTENZIONE: cancella i dati.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 0. Pulizia (ordine inverso rispetto alle dipendenze)
-- ---------------------------------------------------------------------
DROP VIEW     IF EXISTS v_zaino_dettaglio;
DROP VIEW     IF EXISTS v_zaino_peso;
DROP FUNCTION IF EXISTS fn_genera_zaino(INT);
DROP FUNCTION IF EXISTS fn_acqua_consigliata(INT, INT, NUMERIC);
DROP TABLE    IF EXISTS viaggio_oggetto;
DROP TABLE    IF EXISTS viaggio;
DROP TABLE    IF EXISTS oggetto;
DROP TABLE    IF EXISTS utente;
DROP FUNCTION IF EXISTS fn_set_updated_at();   -- dopo le tabelle: i trigger dipendono da essa
DROP TYPE     IF EXISTS tipo_attivita;
DROP TYPE     IF EXISTS tipo_pernotto;
DROP TYPE     IF EXISTS categoria_oggetto;

-- ---------------------------------------------------------------------
-- 1. Tipi enumerati (ENUM): valori chiusi, controllati dal database
-- ---------------------------------------------------------------------
CREATE TYPE tipo_attivita     AS ENUM ('escursione', 'trekking', 'alpinismo', 'ciaspolata', 'ferrata');
CREATE TYPE tipo_pernotto     AS ENUM ('nessuno', 'rifugio', 'tenda', 'bivacco');
CREATE TYPE categoria_oggetto AS ENUM ('abbigliamento', 'attrezzatura', 'cucina', 'sicurezza', 'igiene', 'elettronica', 'cibo', 'altro');

-- ---------------------------------------------------------------------
-- 2. Tabelle
-- ---------------------------------------------------------------------

-- Utente registrato. La password NON viene mai salvata in chiaro:
-- il backend salva l'hash (bcrypt) nella colonna password_hash.
CREATE TABLE utente (
    id            SERIAL PRIMARY KEY,
    email         VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    nome          VARCHAR(100) NOT NULL,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- "Armadio": tutta l'attrezzatura posseduta dall'utente.
CREATE TABLE oggetto (
    id                SERIAL PRIMARY KEY,
    utente_id         INT NOT NULL REFERENCES utente(id) ON DELETE CASCADE,
    nome              VARCHAR(120) NOT NULL,
    categoria         categoria_oggetto NOT NULL DEFAULT 'altro',
    peso_g            INT NOT NULL CHECK (peso_g > 0),       -- peso in grammi
    is_indispensabile BOOLEAN NOT NULL DEFAULT FALSE,         -- sezione "Indispensabili"
    is_preferito      BOOLEAN NOT NULL DEFAULT FALSE,         -- sezione "Preferiti"
    codice_etichetta  VARCHAR(64),                            -- es. barcode / QR scansionato
    note              TEXT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (utente_id, nome)                                  -- niente duplicati nell'armadio
);

-- "Prepara il tuo cammino": i parametri dell'uscita.
CREATE TABLE viaggio (
    id             SERIAL PRIMARY KEY,
    utente_id      INT NOT NULL REFERENCES utente(id) ON DELETE CASCADE,
    nome           VARCHAR(150) NOT NULL,
    attivita       tipo_attivita NOT NULL,
    n_persone      SMALLINT NOT NULL DEFAULT 1 CHECK (n_persone BETWEEN 1 AND 50),
    n_giorni       SMALLINT NOT NULL DEFAULT 1 CHECK (n_giorni BETWEEN 1 AND 60),
    pernotto       tipo_pernotto NOT NULL DEFAULT 'nessuno',
    serve_cucina   BOOLEAN NOT NULL DEFAULT FALSE,
    data_partenza  DATE,
    -- "Consigli per il tuo viaggio": punto di partenza e arrivo (coordinate)
    lat_partenza   NUMERIC(9,6),
    lon_partenza   NUMERIC(9,6),
    lat_arrivo     NUMERIC(9,6),
    lon_arrivo     NUMERIC(9,6),
    dislivello_m   INT CHECK (dislivello_m IS NULL OR dislivello_m >= 0),
    note           TEXT,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- "Il tuo zaino": relazione molti-a-molti tra viaggio e oggetto.
CREATE TABLE viaggio_oggetto (
    viaggio_id  INT NOT NULL REFERENCES viaggio(id) ON DELETE CASCADE,
    oggetto_id  INT NOT NULL REFERENCES oggetto(id) ON DELETE CASCADE,
    quantita    SMALLINT NOT NULL DEFAULT 1 CHECK (quantita > 0),
    inserito    BOOLEAN NOT NULL DEFAULT FALSE,      -- checklist: messo fisicamente nello zaino?
    added_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (viaggio_id, oggetto_id)             -- chiave primaria composta
);

-- ---------------------------------------------------------------------
-- 3. Indici (velocizzano le ricerche piu' frequenti)
-- ---------------------------------------------------------------------
CREATE INDEX idx_oggetto_utente   ON oggetto (utente_id);
CREATE INDEX idx_viaggio_utente   ON viaggio (utente_id);
CREATE INDEX idx_vo_oggetto       ON viaggio_oggetto (oggetto_id);

-- ---------------------------------------------------------------------
-- 4. Trigger: aggiorna updated_at automaticamente
-- ---------------------------------------------------------------------
CREATE FUNCTION fn_set_updated_at() RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_oggetto_updated BEFORE UPDATE ON oggetto
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_viaggio_updated BEFORE UPDATE ON viaggio
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- ---------------------------------------------------------------------
-- 5. Viste
-- ---------------------------------------------------------------------

-- Peso totale e peso "gia' inserito" per ogni viaggio
CREATE VIEW v_zaino_peso AS
SELECT v.id                                   AS viaggio_id,
       v.nome                                 AS viaggio,
       v.utente_id,
       COUNT(vo.oggetto_id)                   AS n_oggetti,
       COALESCE(SUM(o.peso_g * vo.quantita), 0)                              AS peso_totale_g,
       COALESCE(SUM(o.peso_g * vo.quantita) FILTER (WHERE vo.inserito), 0)   AS peso_inserito_g,
       ROUND(COALESCE(SUM(o.peso_g * vo.quantita), 0) / 1000.0, 2)           AS peso_totale_kg
FROM viaggio v
LEFT JOIN viaggio_oggetto vo ON vo.viaggio_id = v.id
LEFT JOIN oggetto o          ON o.id = vo.oggetto_id
GROUP BY v.id, v.nome, v.utente_id;

-- Checklist completa di un viaggio (una riga per oggetto)
CREATE VIEW v_zaino_dettaglio AS
SELECT vo.viaggio_id,
       o.id            AS oggetto_id,
       o.nome,
       o.categoria,
       o.peso_g,
       vo.quantita,
       o.peso_g * vo.quantita AS peso_riga_g,
       vo.inserito,
       o.is_indispensabile,
       o.is_preferito
FROM viaggio_oggetto vo
JOIN oggetto o ON o.id = vo.oggetto_id;

-- ---------------------------------------------------------------------
-- 6. Funzioni di dominio
-- ---------------------------------------------------------------------

-- Riempie lo zaino di un viaggio con tutti gli "indispensabili" e
-- i "preferiti" dell'utente proprietario. Non duplica (ON CONFLICT).
-- Restituisce il numero di oggetti aggiunti.
CREATE FUNCTION fn_genera_zaino(p_viaggio_id INT) RETURNS INT AS $$
DECLARE
    v_utente  INT;
    v_cucina  BOOLEAN;
    v_added   INT;
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

-- Stima semplificata dell'acqua consigliata (litri) per persona:
-- 0.5 l per ora di cammino + 1 l al giorno aggiuntivo se ci sono pernotti.
-- (regola volutamente semplice: nel PDF si chiede di migliorarla)
CREATE FUNCTION fn_acqua_consigliata(p_n_giorni INT, p_n_persone INT, p_ore_cammino_giorno NUMERIC)
RETURNS NUMERIC AS $$
    SELECT ROUND((p_ore_cammino_giorno * 0.5 * p_n_giorni
                  + CASE WHEN p_n_giorni > 1 THEN p_n_giorni - 1 ELSE 0 END) * p_n_persone, 1);
$$ LANGUAGE sql IMMUTABLE;

-- ---------------------------------------------------------------------
-- 7. Dati di esempio (seed)
-- ---------------------------------------------------------------------
-- password in chiaro per i test: "Password123!"  (hash bcrypt, cost 10)
INSERT INTO utente (email, password_hash, nome) VALUES
('asiha@example.com', '$2b$10$zV9ZWPwashZEaXZbB78DCei1N2Mptvzucmb70c0XRJ9zb7FhhxCRa', 'Asiha'),
('demo@example.com',  '$2b$10$zV9ZWPwashZEaXZbB78DCei1N2Mptvzucmb70c0XRJ9zb7FhhxCRa', 'Demo');

INSERT INTO oggetto (utente_id, nome, categoria, peso_g, is_indispensabile, is_preferito, codice_etichetta) VALUES
(1, 'Zaino 40L',               'attrezzatura', 1400, TRUE,  FALSE, '8001234000011'),
(1, 'Giacca antivento',        'abbigliamento', 320, TRUE,  FALSE, NULL),
(1, 'Pile leggero',            'abbigliamento', 280, FALSE, TRUE,  NULL),
(1, 'Scarponi',                'abbigliamento', 1100, TRUE, FALSE, NULL),
(1, 'Kit pronto soccorso',     'sicurezza',     250, TRUE,  FALSE, '8001234000028'),
(1, 'Lampada frontale',        'elettronica',   90,  TRUE,  FALSE, NULL),
(1, 'Fornello a gas',          'cucina',        380, FALSE, TRUE,  NULL),
(1, 'Pentolino 1L',            'cucina',        210, FALSE, TRUE,  NULL),
(1, 'Sacco a pelo',            'attrezzatura',  950, FALSE, TRUE,  NULL),
(1, 'Borraccia 1L',            'attrezzatura',  150, TRUE,  FALSE, NULL),
(1, 'Bastoncini',              'attrezzatura',  480, FALSE, TRUE,  NULL),
(1, 'Crema solare',            'igiene',        80,  FALSE, FALSE, NULL),
(2, 'Zaino 25L',               'attrezzatura',  900, TRUE,  FALSE, NULL),
(2, 'Borraccia 0.75L',         'attrezzatura',  120, TRUE,  FALSE, NULL);

INSERT INTO viaggio (utente_id, nome, attivita, n_persone, n_giorni, pernotto, serve_cucina, data_partenza,
                     lat_partenza, lon_partenza, lat_arrivo, lon_arrivo, dislivello_m) VALUES
(1, 'Anello del Lago Santo', 'escursione', 2, 1, 'nessuno', FALSE, '2026-11-08',
    44.2200, 10.9900, 44.2350, 10.9700, 650),
(1, 'Due giorni al Rifugio Duca degli Abruzzi', 'trekking', 3, 2, 'rifugio', TRUE, '2026-11-21',
    44.1100, 10.8300, 44.1300, 10.8600, 1100);

-- Genera lo zaino del primo viaggio (senza cucina) e del secondo (con cucina)
SELECT fn_genera_zaino(1) AS oggetti_aggiunti_viaggio_1;
SELECT fn_genera_zaino(2) AS oggetti_aggiunti_viaggio_2;

-- Segna qualche oggetto come gia' inserito nello zaino del viaggio 1
UPDATE viaggio_oggetto SET inserito = TRUE
WHERE viaggio_id = 1 AND oggetto_id IN (1, 2, 4);

COMMIT;

-- ---------------------------------------------------------------------
-- 8. Query di verifica (eseguile a mano in psql)
-- ---------------------------------------------------------------------
-- SELECT * FROM v_zaino_peso;
-- SELECT * FROM v_zaino_dettaglio WHERE viaggio_id = 2 ORDER BY categoria, nome;
-- SELECT fn_acqua_consigliata(2, 3, 5);   -- 2 giorni, 3 persone, 5 h/giorno
