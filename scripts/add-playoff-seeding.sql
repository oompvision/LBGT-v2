-- Migration: Standard-seeding bracket generation
-- Run this AFTER scripts/add-playoff-brackets.sql (which creates
-- playoff_brackets / playoff_matches). Safe to run once; re-running is a
-- no-op thanks to IF NOT EXISTS / IF EXISTS guards.
--
-- Adds a seed list per bracket and lets generatePlayoffBracket() lay out the
-- full standard tournament tree in one shot: round 1 is real seed pairings
-- (with byes to the top seeds when the field isn't a power of 2), and every
-- later round starts as a "TBD vs TBD" placeholder linked back to the two
-- matches that feed it (next_match_id / next_match_slot) so a recorded
-- winner advances automatically.

-- ============================================
-- 1. Seed list (entered before generating a bracket)
-- ============================================
CREATE TABLE IF NOT EXISTS playoff_seeds (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  bracket_id UUID NOT NULL REFERENCES playoff_brackets(id) ON DELETE CASCADE,
  seed_number INTEGER NOT NULL CHECK (seed_number > 0),
  player_id UUID NOT NULL REFERENCES users(id),
  player_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (bracket_id, seed_number),
  UNIQUE (bracket_id, player_id)
);

CREATE INDEX IF NOT EXISTS idx_playoff_seeds_bracket_id ON playoff_seeds(bracket_id);

ALTER TABLE playoff_seeds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage playoff seeds" ON playoff_seeds;
CREATE POLICY "Admins can manage playoff seeds"
  ON playoff_seeds FOR ALL
  USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.is_admin = true)
  );

-- ============================================
-- 2. playoff_matches: allow TBD slots and link matches to what they feed into
-- ============================================
ALTER TABLE playoff_matches ALTER COLUMN player1_id DROP NOT NULL;
ALTER TABLE playoff_matches ALTER COLUMN player1_name DROP NOT NULL;

ALTER TABLE playoff_matches
  ADD COLUMN IF NOT EXISTS next_match_id UUID REFERENCES playoff_matches(id) ON DELETE SET NULL;
ALTER TABLE playoff_matches
  ADD COLUMN IF NOT EXISTS next_match_slot SMALLINT CHECK (next_match_slot IN (1, 2));

CREATE INDEX IF NOT EXISTS idx_playoff_matches_next_match_id ON playoff_matches(next_match_id);
