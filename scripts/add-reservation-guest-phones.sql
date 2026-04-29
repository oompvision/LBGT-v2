-- Add guest_phones to reservations so the booker can capture a phone number
-- for every guest. Aligned with `player_names` and `player_user_ids`:
--   player_names[i]     = display name for additional player i
--   player_user_ids[i]  = league user UUID for additional player i, or NULL
--                         if that seat is a guest
--   guest_phones[i]     = guest's 10-digit US phone number (digits only,
--                         no formatting), or NULL when the seat is a league
--                         player (their phone is on `users.phone_number`)
--
-- Existing rows get an empty array, which means historical guests have a
-- NULL/missing phone — acceptable since the data is test-only at the time
-- this column ships.

ALTER TABLE reservations
  ADD COLUMN IF NOT EXISTS guest_phones TEXT[] DEFAULT ARRAY[]::TEXT[];
