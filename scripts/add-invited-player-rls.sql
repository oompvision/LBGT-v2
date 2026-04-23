-- Allow invited players to read and update reservations they're part of.
--
-- The existing SELECT / UPDATE policies on `reservations` scope access to
-- `auth.uid() = user_id`, which only covers the booker. With group bookings
-- we also need every linked league user (in `player_user_ids`) to be able to:
--   - see the reservation on their /my-reservations page
--   - update the row to remove themselves (splice their entry out)
--
-- Multiple policies for the same action are OR'd in Postgres, so these are
-- purely additive — they don't widen booker access.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'reservations'
      AND policyname = 'reservations_select_as_invited_player'
  ) THEN
    CREATE POLICY "reservations_select_as_invited_player"
      ON reservations
      FOR SELECT
      TO authenticated
      USING (auth.uid() = ANY(player_user_ids));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'reservations'
      AND policyname = 'reservations_update_as_invited_player'
  ) THEN
    CREATE POLICY "reservations_update_as_invited_player"
      ON reservations
      FOR UPDATE
      TO authenticated
      USING (auth.uid() = ANY(player_user_ids));
  END IF;
END
$$;
