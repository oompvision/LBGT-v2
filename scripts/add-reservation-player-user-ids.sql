-- Add player_user_ids to reservations so we can link other league members
-- as additional players on a group booking.
--
-- The column is positionally aligned with `player_names`:
--   player_names[i]     = display name for additional player i
--   player_user_ids[i]  = league user UUID for additional player i, or NULL
--                         if that seat is a guest.
-- `play_for_money` keeps its existing shape (length = slots, index 0 = booker).
-- Existing rows default to an empty array, so all historical reservations
-- are treated as "booker + guests only", matching today's behavior.

ALTER TABLE reservations
  ADD COLUMN IF NOT EXISTS player_user_ids UUID[] DEFAULT ARRAY[]::UUID[];

-- GIN index so "where am I invited?" queries on /my-reservations stay fast.
CREATE INDEX IF NOT EXISTS idx_reservations_player_user_ids
  ON reservations USING GIN (player_user_ids);
