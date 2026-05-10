-- Migration: Add payment_statuses table
-- Tracks per-player green-fee and cash-game payment status for each
-- reservation slot (player_index 0 = booker, 1..n = additional players).
-- Run this in Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS payment_statuses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  reservation_id UUID NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
  player_index INTEGER NOT NULL CHECK (player_index >= 0),
  green_fee_paid BOOLEAN NOT NULL DEFAULT FALSE,
  cash_game_paid BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE (reservation_id, player_index)
);

CREATE INDEX IF NOT EXISTS idx_payment_statuses_reservation
  ON payment_statuses(reservation_id);

ALTER TABLE payment_statuses ENABLE ROW LEVEL SECURITY;

-- Admin-only access. Server actions use the service-role admin client,
-- which bypasses RLS, but we still lock down direct API access.
CREATE POLICY "Admins can manage payment statuses"
  ON payment_statuses FOR ALL
  USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.is_admin = true)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.is_admin = true)
  );
