-- Migration: Add playoff_brackets and playoff_matches tables
-- Run this in Supabase SQL Editor.
--
-- Two brackets (A Flight, B Flight) per year. Each bracket is built up
-- round-by-round by an admin: add a round, add matches pairing players
-- (a match with only player1 represents a bye), then record the winner
-- and match-play score ("4&3", "1 up", "20th hole", ...) once played.
-- A bracket is hidden from the public /playoffs page until published.

-- ============================================
-- 1. Playoff Brackets table
-- ============================================
CREATE TABLE IF NOT EXISTS playoff_brackets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  year INTEGER NOT NULL,
  flight TEXT NOT NULL CHECK (flight IN ('A', 'B')),
  is_published BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (year, flight)
);

CREATE INDEX IF NOT EXISTS idx_playoff_brackets_year ON playoff_brackets(year);

ALTER TABLE playoff_brackets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view published playoff brackets"
  ON playoff_brackets FOR SELECT
  USING (is_published = true);

CREATE POLICY "Admins can manage playoff brackets"
  ON playoff_brackets FOR ALL
  USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.is_admin = true)
  );

-- ============================================
-- 2. Playoff Matches table
-- ============================================
CREATE TABLE IF NOT EXISTS playoff_matches (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  bracket_id UUID NOT NULL REFERENCES playoff_brackets(id) ON DELETE CASCADE,
  round_number INTEGER NOT NULL,
  round_label TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  player1_id UUID NOT NULL REFERENCES users(id),
  player1_name TEXT NOT NULL,
  player2_id UUID REFERENCES users(id),
  player2_name TEXT,
  winner_player_num SMALLINT CHECK (winner_player_num IN (1, 2)),
  score TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CHECK (player2_id IS NULL OR player2_id <> player1_id),
  CHECK (winner_player_num IS NULL OR winner_player_num = 1 OR player2_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_playoff_matches_bracket_id ON playoff_matches(bracket_id);

ALTER TABLE playoff_matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view matches in published playoff brackets"
  ON playoff_matches FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM playoff_brackets pb
      WHERE pb.id = playoff_matches.bracket_id AND pb.is_published = true
    )
  );

CREATE POLICY "Admins can manage playoff matches"
  ON playoff_matches FOR ALL
  USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.is_admin = true)
  );

-- ============================================
-- 3. Keep cached player names honest on rename
--
-- Extends the existing users_name_sync_player_names trigger (see
-- sync-player-names-on-user-rename.sql) so playoff_matches.player1_name /
-- player2_name stay in sync the same way reservations.player_names[] does.
-- ============================================
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

    UPDATE playoff_matches
    SET player1_name = NEW.name, updated_at = NOW()
    WHERE player1_id = NEW.id AND player1_name IS DISTINCT FROM NEW.name;

    UPDATE playoff_matches
    SET player2_name = NEW.name, updated_at = NOW()
    WHERE player2_id = NEW.id AND player2_name IS DISTINCT FROM NEW.name;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Backfill: refresh any cached name that's already stale.
UPDATE playoff_matches m
SET player1_name = u.name
FROM users u
WHERE u.id = m.player1_id AND u.name IS DISTINCT FROM m.player1_name;

UPDATE playoff_matches m
SET player2_name = u.name
FROM users u
WHERE u.id = m.player2_id AND u.name IS DISTINCT FROM m.player2_name;
