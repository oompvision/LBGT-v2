-- Add `is_active` to the users table to give admins a "soft-disable" lever
-- separate from confirmation status.
--
-- Rules enforced in app code (not the DB) so admins still have an escape hatch:
--   - Only confirmed users can be active.
--   - When a user is confirmed they default to active.
--   - When a user is un-confirmed they are forced back to inactive.
--   - Inactive users cannot book tee times or log scores, and are hidden from
--     player-picker lists used by other members.
--
-- Column default is TRUE so newly inserted, already-confirmed members are
-- active without needing a follow-up update. Existing pending rows are
-- backfilled to FALSE below to keep state consistent with the rules above.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

UPDATE users
  SET is_active = FALSE
  WHERE is_confirmed = FALSE;
