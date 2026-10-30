-- =====================================================================
--  LOADOUT - C1: profilo più ricco (dati personali e foto)
--  Solo dati che servono in montagna (minimizzazione, GDPR): livello di
--  esperienza, contatto di emergenza, note mediche, tessera/assicurazione
--  per il soccorso, sensibilità al freddo, foto.
--  (Venerdì: tolta la "città da cui parti di solito", non serviva a niente.)
--
--  Sul database che hai già, eseguilo una volta a mano:
--    docker exec loadout-db psql -U loadout -d loadout -f /docker-entrypoint-initdb.d/loadout_stretch_profilo.sql
--  Si può rieseguire senza danni.
-- =====================================================================

BEGIN;

ALTER TABLE utente
  ADD COLUMN IF NOT EXISTS livello_esperienza TEXT
  CHECK (livello_esperienza IS NULL OR livello_esperienza IN ('principiante', 'intermedio', 'esperto'));

ALTER TABLE utente DROP COLUMN IF EXISTS citta; -- c'era nella prima versione: sui DB vecchi la togliamo
ALTER TABLE utente ADD COLUMN IF NOT EXISTS emergenza_nome VARCHAR(100);
ALTER TABLE utente ADD COLUMN IF NOT EXISTS emergenza_telefono VARCHAR(30);

-- Note mediche per chi ti soccorre (allergie, farmaci, gruppo sanguigno).
-- Sono dati sulla salute: per il GDPR una "categoria particolare". Le scrive solo l'utente,
-- se vuole, e le vede solo lui (nella scheda del viaggio, riquadro Emergenza).
ALTER TABLE utente ADD COLUMN IF NOT EXISTS note_mediche VARCHAR(300);

-- Tessera CAI o polizza che copre il soccorso (es. "CAI 1234567 · Sezione di Bologna")
ALTER TABLE utente ADD COLUMN IF NOT EXISTS tessera_soccorso VARCHAR(80);

-- Sensibilità al freddo: adatta i consigli di vestiario del meteo
--   alta = soffro il freddo, normale, bassa = sento poco il freddo
ALTER TABLE utente
  ADD COLUMN IF NOT EXISTS sensibilita_freddo TEXT
  CHECK (sensibilita_freddo IS NULL OR sensibilita_freddo IN ('alta', 'normale', 'bassa'));

-- La foto: un'immagine piccola (il browser la riduce a 256×256) salvata come "data URL",
-- cioè testo: "data:image/jpeg;base64,....". Il CHECK accetta solo immagini e mette un tetto alla dimensione.
ALTER TABLE utente
  ADD COLUMN IF NOT EXISTS foto TEXT
  CHECK (foto IS NULL OR (foto LIKE 'data:image/%' AND length(foto) <= 200000));

COMMIT;
