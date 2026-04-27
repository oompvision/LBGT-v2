-- Migration: Add cash_games table
-- Replaces the per-player "Playing for Money" flag with a date-scoped
-- cash game that admins configure (title, description, entry amount).
-- Per-player opt-in continues to use reservations.play_for_money.
-- Run this in Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS cash_games (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  entry_amount INTEGER NOT NULL CHECK (entry_amount >= 0),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cash_games_date ON cash_games(date);

ALTER TABLE cash_games ENABLE ROW LEVEL SECURITY;

-- Anyone can view cash games (booking page shows the upcoming one to users).
CREATE POLICY "Anyone can view cash games"
  ON cash_games FOR SELECT
  USING (true);

-- Admin full access.
CREATE POLICY "Admins can manage cash games"
  ON cash_games FOR ALL
  USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.is_admin = true)
  );
