-- Reconcile public.users rows whose id diverges from auth.users.id.
--
-- The app uses auth.uid() / session.user.id everywhere that touches a user
-- (reservations.user_id, is_confirmed lookups, RLS policies, the embedded
-- users(id, name) join on /my-reservations, etc.). For a row to behave
-- correctly, public.users.id MUST equal the matching auth.users.id.
--
-- A couple of users (matched by email) have public.users.id != auth.users.id
-- — likely from a legacy import or an older signup path. This breaks:
--   - /my-reservations (query returns no rows or 400s on the embedded join)
--   - POST /api/reservations/create (is_confirmed lookup finds nothing,
--     user gets "pending admin approval" even when confirmed)
--
-- This script finds every such divergence (email match, id mismatch) and
-- rewrites public.users.id to auth.users.id, propagating the change through
-- every FK that points at public.users(id) plus the uuid[] player_user_ids
-- column on reservations.
--
-- Run once in the Supabase SQL editor. Idempotent — no-op after it succeeds.

BEGIN;

DO $$
DECLARE
  mismatch         RECORD;
  fk               RECORD;
  mismatch_count   int;
  collision_count  int;
  fk_drop_stmts    text[] := ARRAY[]::text[];
  fk_add_stmts     text[] := ARRAY[]::text[];
  fk_update_stmts  text[] := ARRAY[]::text[];
  stmt             text;
BEGIN
  -- 1. How many rows need reconciling?
  SELECT COUNT(*) INTO mismatch_count
  FROM public.users pu
  JOIN auth.users au ON lower(au.email) = lower(pu.email)
  WHERE pu.id <> au.id;

  IF mismatch_count = 0 THEN
    RAISE NOTICE 'No mismatched users — nothing to do.';
    RETURN;
  END IF;

  RAISE NOTICE 'Reconciling % user row(s) where public.users.id != auth.users.id', mismatch_count;

  -- 2. Safety: bail if any target auth.users.id is ALREADY present as a
  --    different public.users row (would require a conscious merge).
  SELECT COUNT(*) INTO collision_count
  FROM public.users pu
  JOIN auth.users au ON lower(au.email) = lower(pu.email)
  WHERE pu.id <> au.id
    AND EXISTS (SELECT 1 FROM public.users pu2 WHERE pu2.id = au.id);

  IF collision_count > 0 THEN
    RAISE EXCEPTION
      'Aborting: % target auth.users.id value(s) already exist as a separate row in public.users. Manual merge required.',
      collision_count;
  END IF;

  -- 3. Discover every FK that references public.users(id). We'll drop them
  --    while we rewrite ids, then recreate them with the exact same definition.
  FOR fk IN
    SELECT
      c.conname,
      n.nspname AS schema_name,
      t.relname AS table_name,
      a.attname AS column_name,
      pg_get_constraintdef(c.oid) AS def
    FROM pg_constraint c
    JOIN pg_class     t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
    WHERE c.contype = 'f'
      AND c.confrelid = 'public.users'::regclass
      AND array_length(c.conkey, 1) = 1  -- single-column FKs only (all of ours)
  LOOP
    fk_drop_stmts := fk_drop_stmts || format(
      'ALTER TABLE %I.%I DROP CONSTRAINT %I',
      fk.schema_name, fk.table_name, fk.conname
    );
    fk_add_stmts := fk_add_stmts || format(
      'ALTER TABLE %I.%I ADD CONSTRAINT %I %s',
      fk.schema_name, fk.table_name, fk.conname, fk.def
    );
    fk_update_stmts := fk_update_stmts || format(
      'UPDATE %I.%I SET %I = $1 WHERE %I = $2',
      fk.schema_name, fk.table_name, fk.column_name, fk.column_name
    );
    RAISE NOTICE 'Will rewrite %.%.% (FK %)',
      fk.schema_name, fk.table_name, fk.column_name, fk.conname;
  END LOOP;

  -- 4. Drop FKs so we can update public.users.id without cascade fights.
  FOREACH stmt IN ARRAY fk_drop_stmts LOOP
    EXECUTE stmt;
  END LOOP;

  -- 5. For each mismatched row: move the parent, then every FK column,
  --    then the player_user_ids array on reservations.
  FOR mismatch IN
    SELECT pu.id AS old_id, au.id AS new_id, pu.email
    FROM public.users pu
    JOIN auth.users au ON lower(au.email) = lower(pu.email)
    WHERE pu.id <> au.id
  LOOP
    RAISE NOTICE 'Reconciling %: % -> %', mismatch.email, mismatch.old_id, mismatch.new_id;

    UPDATE public.users SET id = mismatch.new_id WHERE id = mismatch.old_id;

    FOREACH stmt IN ARRAY fk_update_stmts LOOP
      EXECUTE stmt USING mismatch.new_id, mismatch.old_id;
    END LOOP;

    -- player_user_ids is a uuid[] without FK enforcement — handle explicitly.
    UPDATE public.reservations
    SET player_user_ids = array_replace(player_user_ids, mismatch.old_id, mismatch.new_id)
    WHERE mismatch.old_id = ANY(player_user_ids);
  END LOOP;

  -- 6. Recreate FKs exactly as they were.
  FOREACH stmt IN ARRAY fk_add_stmts LOOP
    EXECUTE stmt;
  END LOOP;

  -- 7. Assert we're clean.
  SELECT COUNT(*) INTO mismatch_count
  FROM public.users pu
  JOIN auth.users au ON lower(au.email) = lower(pu.email)
  WHERE pu.id <> au.id;

  IF mismatch_count > 0 THEN
    RAISE EXCEPTION 'Reconciliation incomplete: % mismatched row(s) remain', mismatch_count;
  END IF;

  RAISE NOTICE 'Reconciliation complete.';
END $$;

COMMIT;
