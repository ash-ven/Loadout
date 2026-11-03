-- =====================================================================
--  TRASLOCO 1/2 – da eseguire sul database del TUO PC (container loadout-db)
--
--  Mette in uno schema a parte, "trasloco", una COPIA dei dati di asiha@example.com:
--  il profilo, l'armadio, i viaggi e i loro zaini. Le tabelle vere (schema public) non cambiano.
--  Uno schema è come una cartella dentro il database: trasloco.oggetto e public.oggetto
--  sono due tabelle diverse, con lo stesso nome in due "cartelle" diverse.
--
--  Poi lo schema trasloco viene copiato su Render (pg_dump -n trasloco) e lì
--  2_applica_su_render.sql lo usa per sostituire i dati di asiha.
--  Si può rieseguire: ogni volta rifà la copia da zero.
-- =====================================================================
\set ON_ERROR_STOP on

BEGIN;

DROP SCHEMA IF EXISTS trasloco CASCADE;
CREATE SCHEMA trasloco;

-- CREATE TABLE … AS SELECT: crea la tabella e la riempie con il risultato della query
CREATE TABLE trasloco.utente AS
  SELECT * FROM public.utente WHERE email = 'asiha@example.com';

-- La password non serve (su Render resta quella che hai messo online): non la copiamo nemmeno
ALTER TABLE trasloco.utente DROP COLUMN password_hash;

CREATE TABLE trasloco.oggetto AS
  SELECT * FROM public.oggetto WHERE utente_id IN (SELECT id FROM trasloco.utente);

CREATE TABLE trasloco.viaggio AS
  SELECT * FROM public.viaggio WHERE utente_id IN (SELECT id FROM trasloco.utente);

-- Gli zaini: le righe di viaggio_oggetto dei viaggi copiati sopra
CREATE TABLE trasloco.viaggio_oggetto AS
  SELECT * FROM public.viaggio_oggetto WHERE viaggio_id IN (SELECT id FROM trasloco.viaggio);

COMMIT;

-- Cosa è stato copiato (questi numeri li ritroverai alla fine su Render)
SELECT (SELECT count(*) FROM trasloco.utente)          AS utenti,
       (SELECT count(*) FROM trasloco.oggetto)         AS oggetti,
       (SELECT count(*) FROM trasloco.viaggio)         AS viaggi,
       (SELECT count(*) FROM trasloco.viaggio_oggetto) AS righe_zaini;
