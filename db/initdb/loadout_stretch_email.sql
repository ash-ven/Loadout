-- =====================================================================
--  LOADOUT - Email reali (4/11): conferma dell'email e «password dimenticata»
--   1. utente.email_confermata_il: quando l'utente ha cliccato il link di conferma (NULL = non ancora).
--      Senza conferma non si entra (scelta di Asiha). Gli account che esistono già vengono confermati d'ufficio.
--   2. utente.password_cambiata_il: quando è cambiata la password. Le sessioni (token JWT) create PRIMA
--      di quel momento non valgono più: dopo un reset, chi aveva la vecchia password viene buttato fuori.
--   3. token_email: i codici dei link mandati per email. Salviamo solo l'IMPRONTA (hash SHA-256) del codice,
--      mai il codice: chi leggesse il database non potrebbe usare i link. Ogni link scade e si usa una volta sola.
--
--  Su un database nuovo parte da solo (cartella initdb, ordine alfabetico).
--  Sul database che hai già (e su Render), eseguilo una volta a mano:
--    docker exec loadout-db psql -U loadout -d loadout -f /docker-entrypoint-initdb.d/loadout_stretch_email.sql
--  Si può rieseguire senza danni.
-- =====================================================================

BEGIN;

ALTER TABLE utente ADD COLUMN IF NOT EXISTS email_confermata_il TIMESTAMPTZ;
ALTER TABLE utente ADD COLUMN IF NOT EXISTS password_cambiata_il TIMESTAMPTZ;

-- Gli account di prima della conferma: confermati d'ufficio (scelta di Asiha), così nessuno resta chiuso fuori.
-- Il segno che serve per rieseguire il file senza confermare anche i NUOVI account non confermati:
-- lo facciamo solo se la tabella token_email non esiste ancora (cioè la prima volta che il file gira).
DO $$
BEGIN
  IF to_regclass('public.token_email') IS NULL THEN
    UPDATE utente SET email_confermata_il = now() WHERE email_confermata_il IS NULL;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS token_email (
    id          SERIAL PRIMARY KEY,
    utente_id   INT NOT NULL REFERENCES utente(id) ON DELETE CASCADE,
    tipo        TEXT NOT NULL CHECK (tipo IN ('conferma', 'reset')),
    hash        CHAR(64) NOT NULL UNIQUE,          -- SHA-256 del codice, in esadecimale
    scade_il    TIMESTAMPTZ NOT NULL,
    usato_il    TIMESTAMPTZ,                       -- NULL = non ancora usato
    creato_il   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_token_email_utente ON token_email (utente_id);

COMMIT;
