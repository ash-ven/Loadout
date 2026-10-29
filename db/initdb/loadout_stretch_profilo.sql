-- =====================================================================
--  LOADOUT - C1: profilo più ricco (dati personali e foto)
--  Solo dati che servono in montagna (minimizzazione, GDPR): livello di
--  esperienza, città di partenza abituale, contatto di emergenza, foto.
--
--  Sul database che hai già, eseguilo una volta a mano:
--    docker exec loadout-db psql -U loadout -d loadout -f /docker-entrypoint-initdb.d/loadout_stretch_profilo.sql
--  Si può rieseguire senza danni.
-- =====================================================================

BEGIN;

ALTER TABLE utente
  ADD COLUMN IF NOT EXISTS livello_esperienza TEXT
  CHECK (livello_esperienza IS NULL OR livello_esperienza IN ('principiante', 'intermedio', 'esperto'));

ALTER TABLE utente ADD COLUMN IF NOT EXISTS citta VARCHAR(100);
ALTER TABLE utente ADD COLUMN IF NOT EXISTS emergenza_nome VARCHAR(100);
ALTER TABLE utente ADD COLUMN IF NOT EXISTS emergenza_telefono VARCHAR(30);

-- La foto: un'immagine piccola (il browser la riduce a 256×256) salvata come "data URL",
-- cioè testo: "data:image/jpeg;base64,....". Il CHECK accetta solo immagini e mette un tetto alla dimensione.
ALTER TABLE utente
  ADD COLUMN IF NOT EXISTS foto TEXT
  CHECK (foto IS NULL OR (foto LIKE 'data:image/%' AND length(foto) <= 200000));

COMMIT;
