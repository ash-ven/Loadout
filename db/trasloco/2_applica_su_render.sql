-- =====================================================================
--  TRASLOCO 2/2 – da eseguire sul database di RENDER, dopo aver copiato lì lo schema "trasloco"
--
--  Sostituisce i dati di asiha@example.com su Render con quelli arrivati dal PC:
--    - profilo: tutte le colonne TRANNE id, email, password e data di iscrizione;
--    - armadio e viaggi: quelli su Render vengono cancellati e al loro posto entrano quelli del PC.
--  Gli altri account (gli amici) non vengono toccati: ogni comando filtra sull'id di asiha.
--
--  Il punto delicato sono gli ID. Sul PC un oggetto può avere id 40, ma su Render l'id 40 può essere
--  già di un oggetto di un amico. Quindi ogni oggetto e ogni viaggio riceve un id NUOVO dal contatore
--  SERIAL di Render (nextval), e le "mappe" (vecchio id → nuovo id) servono a ricollegare gli zaini.
--
--  Le colonne non sono scritte a mano: le leggiamo da information_schema (l'elenco delle colonne
--  che Postgres tiene per ogni tabella) e con \gexec psql esegue il comando costruito.
--  Così se un giorno aggiungi una colonna (come litri), il trasloco la copia senza modifiche.
--
--  Tutto in UNA transazione: se un controllo fallisce, ROLLBACK e Render resta esattamente com'era.
-- =====================================================================
\set ON_ERROR_STOP on

BEGIN;

-- 0. Controlli prima di toccare qualunque cosa
DO $$
BEGIN
  IF (SELECT count(*) FROM trasloco.utente) <> 1 THEN
    RAISE EXCEPTION 'Nello schema trasloco ci deve essere esattamente 1 utente';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.utente u JOIN trasloco.utente t ON t.email = u.email) THEN
    RAISE EXCEPTION 'Su Render non c''è un account con la stessa email: niente da sostituire';
  END IF;
END $$;

-- "io" = l'id di asiha SU RENDER (può essere diverso da quello sul PC)
CREATE TEMP TABLE io ON COMMIT DROP AS
  SELECT u.id FROM public.utente u JOIN trasloco.utente t ON t.email = u.email;

-- 1. Profilo
SELECT format(
  'UPDATE public.utente AS u SET %s FROM trasloco.utente AS t WHERE u.id = (SELECT id FROM io)',
  string_agg(format('%I = t.%I', column_name, column_name), ', ' ORDER BY ordinal_position))
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'utente'
  AND column_name NOT IN ('id', 'email', 'password_hash', 'created_at')
\gexec

-- 2. Via l'armadio e i viaggi di asiha su Render.
--    Le righe dei suoi zaini se ne vanno da sole: viaggio_oggetto ha ON DELETE CASCADE.
DELETE FROM public.viaggio WHERE utente_id = (SELECT id FROM io);
DELETE FROM public.oggetto WHERE utente_id = (SELECT id FROM io);

-- 3. Le mappe vecchio id (PC) → nuovo id (Render)
CREATE TEMP TABLE mappa_oggetto ON COMMIT DROP AS
  SELECT id AS vecchio, nextval(pg_get_serial_sequence('public.oggetto', 'id')) AS nuovo
  FROM trasloco.oggetto;
CREATE TEMP TABLE mappa_viaggio ON COMMIT DROP AS
  SELECT id AS vecchio, nextval(pg_get_serial_sequence('public.viaggio', 'id')) AS nuovo
  FROM trasloco.viaggio;

-- 4. L'armadio, con gli id nuovi e l'utente di Render
SELECT format(
  'INSERT INTO public.oggetto (id, utente_id, %s) SELECT m.nuovo, (SELECT id FROM io), %s '
  'FROM trasloco.oggetto AS o JOIN mappa_oggetto AS m ON m.vecchio = o.id',
  string_agg(format('%I', column_name), ', ' ORDER BY ordinal_position),
  string_agg(format('o.%I', column_name), ', ' ORDER BY ordinal_position))
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'oggetto' AND column_name NOT IN ('id', 'utente_id')
\gexec

-- 5. I viaggi, allo stesso modo
SELECT format(
  'INSERT INTO public.viaggio (id, utente_id, %s) SELECT m.nuovo, (SELECT id FROM io), %s '
  'FROM trasloco.viaggio AS v JOIN mappa_viaggio AS m ON m.vecchio = v.id',
  string_agg(format('%I', column_name), ', ' ORDER BY ordinal_position),
  string_agg(format('v.%I', column_name), ', ' ORDER BY ordinal_position))
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'viaggio' AND column_name NOT IN ('id', 'utente_id')
\gexec

-- 6. Gli zaini: ogni riga ricollegata al viaggio nuovo e all'oggetto nuovo, tramite le due mappe
SELECT format(
  'INSERT INTO public.viaggio_oggetto (viaggio_id, oggetto_id, %s) SELECT mv.nuovo, mo.nuovo, %s '
  'FROM trasloco.viaggio_oggetto AS vo '
  'JOIN mappa_viaggio AS mv ON mv.vecchio = vo.viaggio_id '
  'JOIN mappa_oggetto AS mo ON mo.vecchio = vo.oggetto_id',
  string_agg(format('%I', column_name), ', ' ORDER BY ordinal_position),
  string_agg(format('vo.%I', column_name), ', ' ORDER BY ordinal_position))
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'viaggio_oggetto' AND column_name NOT IN ('viaggio_id', 'oggetto_id')
\gexec

-- 7. Controllo finale: su Render devono esserci esattamente le righe arrivate dal PC.
--    Se un numero non torna, l'errore annulla tutta la transazione.
DO $$
DECLARE
  v_io INT := (SELECT id FROM io);
BEGIN
  IF (SELECT count(*) FROM public.oggetto WHERE utente_id = v_io) <> (SELECT count(*) FROM trasloco.oggetto)
     OR (SELECT count(*) FROM public.viaggio WHERE utente_id = v_io) <> (SELECT count(*) FROM trasloco.viaggio)
     OR (SELECT count(*) FROM public.viaggio_oggetto vo JOIN public.viaggio v ON v.id = vo.viaggio_id WHERE v.utente_id = v_io)
        <> (SELECT count(*) FROM trasloco.viaggio_oggetto) THEN
    RAISE EXCEPTION 'I conteggi non tornano: annullo tutto';
  END IF;
END $$;

SELECT (SELECT count(*) FROM public.oggetto WHERE utente_id = (SELECT id FROM io)) AS oggetti,
       (SELECT count(*) FROM public.viaggio WHERE utente_id = (SELECT id FROM io)) AS viaggi,
       (SELECT count(*) FROM public.viaggio_oggetto vo JOIN public.viaggio v ON v.id = vo.viaggio_id
         WHERE v.utente_id = (SELECT id FROM io)) AS righe_zaini,
       (SELECT count(*) FROM public.utente) AS account_su_render;

-- 8. Lo schema trasloco ha finito il suo lavoro
DROP SCHEMA trasloco CASCADE;

COMMIT;
