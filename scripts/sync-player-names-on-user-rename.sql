-- Migration: Sync reservations.player_names[] with users.name renames.
--
-- reservations.player_names[] is a snapshot taken at booking time, so when
-- users.name is later edited the booking pages, /admin/cash-games, exports,
-- etc. continue to render the old name. Rather than overlay the live name
-- at every read site, we keep the cached array honest at write time:
--
--   1. AFTER UPDATE OF name on users — rewrite player_names[i] for any row
--      where player_user_ids[i] equals the renamed user.
--   2. One-time backfill at the end of this migration so existing data
--      catches up to the current users.name values.
--
-- Run this in Supabase SQL Editor.

CREATE OR REPLACE FUNCTION sync_player_names_on_user_rename()
RETURNS trigger AS $$
BEGIN
  IF NEW.name IS DISTINCT FROM OLD.name THEN
    UPDATE reservations r
    SET player_names = ARRAY(
      SELECT CASE WHEN uids.uid = NEW.id THEN NEW.name ELSE names.name END
      FROM unnest(r.player_names) WITH ORDINALITY AS names(name, idx)
      LEFT JOIN unnest(r.player_user_ids) WITH ORDINALITY AS uids(uid, idx)
        ON names.idx = uids.idx
      ORDER BY names.idx
    )
    WHERE NEW.id = ANY (r.player_user_ids);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS users_name_sync_player_names ON users;
CREATE TRIGGER users_name_sync_player_names
AFTER UPDATE OF name ON users
FOR EACH ROW
EXECUTE FUNCTION sync_player_names_on_user_rename();

-- Backfill: refresh any cached player_names[] slot whose live users.name
-- differs from the snapshot. Only updates reservations that actually need
-- it, so re-running is a no-op.
UPDATE reservations r
SET player_names = ARRAY(
  SELECT COALESCE(u.name, names.name)
  FROM unnest(r.player_names) WITH ORDINALITY AS names(name, idx)
  LEFT JOIN unnest(r.player_user_ids) WITH ORDINALITY AS uids(uid, idx)
    ON names.idx = uids.idx
  LEFT JOIN users u ON u.id = uids.uid
  ORDER BY names.idx
)
WHERE EXISTS (
  SELECT 1
  FROM unnest(r.player_user_ids) WITH ORDINALITY AS uids(uid, idx)
  JOIN users u ON u.id = uids.uid
  WHERE u.name IS DISTINCT FROM r.player_names[uids.idx]
);
