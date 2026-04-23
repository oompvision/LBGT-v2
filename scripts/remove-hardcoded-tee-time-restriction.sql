-- Remove the hardcoded tee-time-times restriction.
--
-- A previous migration (added directly in Supabase SQL editor — not in this
-- repo) installed a trigger on `tee_times` that rejects any insert/update
-- whose `time` is not one of: 3:30, 3:40, 3:50, 4:00, 4:10, 4:20 PM.
-- The error reads: "Tee times must be one of: 3:30 PM, 3:40 PM, ...".
--
-- That made the schedule un-editable: the admin "Generate" flow could no
-- longer create new times like 3:10 / 3:20 PM, and the per-slot Add button
-- would fail too. Allowed times now come entirely from the season template.
--
-- This script:
--   1) Finds and drops any trigger on `tee_times` whose function references
--      that error string, plus the underlying function.
--   2) Also drops any CHECK constraint on `tee_times.time` that hardcodes
--      a list of times (defensive; unlikely but cheap to check).
--
-- Run this once in the Supabase SQL editor.

-- 1) Drop the offending trigger(s) and their function(s).
DO $$
DECLARE
  rec record;
BEGIN
  FOR rec IN
    SELECT
      t.tgname  AS trigger_name,
      p.proname AS func_name,
      n.nspname AS func_schema
    FROM pg_trigger t
    JOIN pg_proc p      ON p.oid = t.tgfoid
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE t.tgrelid = 'public.tee_times'::regclass
      AND NOT t.tgisinternal
      AND pg_get_functiondef(p.oid) ILIKE '%tee times must be one of%'
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.tee_times', rec.trigger_name);
    EXECUTE format('DROP FUNCTION IF EXISTS %I.%I() CASCADE', rec.func_schema, rec.func_name);
    RAISE NOTICE 'Dropped trigger % and function %.%()',
      rec.trigger_name, rec.func_schema, rec.func_name;
  END LOOP;
END
$$;

-- 2) Defensive: drop any CHECK constraint on tee_times that pins `time` to
--    a hardcoded list. Safe no-op if none exists.
DO $$
DECLARE
  rec record;
BEGIN
  FOR rec IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.tee_times'::regclass
      AND contype  = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%time%in%(%'
  LOOP
    EXECUTE format('ALTER TABLE public.tee_times DROP CONSTRAINT %I', rec.conname);
    RAISE NOTICE 'Dropped check constraint %', rec.conname;
  END LOOP;
END
$$;
