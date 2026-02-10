-- Migration: Add info_boxes and playoff_results tables
-- Run this in Supabase SQL Editor

-- ============================================
-- 1. Info Boxes table
-- ============================================
CREATE TABLE IF NOT EXISTS info_boxes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE info_boxes ENABLE ROW LEVEL SECURITY;

-- Public read access for active boxes
CREATE POLICY "Anyone can view active info boxes"
  ON info_boxes FOR SELECT
  USING (is_active = true);

-- Admin full access
CREATE POLICY "Admins can manage info boxes"
  ON info_boxes FOR ALL
  USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.is_admin = true)
  );

-- Seed with current hardcoded data
INSERT INTO info_boxes (title, content, display_order, is_active) VALUES
  ('Where', 'Join us every Friday at **The Golf Club at Middlebay** in Oceanside, NY for weekly matches and tournaments.', 1, true),
  ('When', 'Regular season play has commenced! Book your tee time before **Wednesday afternoon** to lock in for that Friday. Players must log 4 rounds to qualify for this year''s LBGT Playoff.', 2, true);

-- ============================================
-- 2. Playoff Results table
-- ============================================
CREATE TABLE IF NOT EXISTS playoff_results (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  year INTEGER NOT NULL UNIQUE,
  champion_name TEXT NOT NULL,
  runner_up_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE playoff_results ENABLE ROW LEVEL SECURITY;

-- Public read access
CREATE POLICY "Anyone can view playoff results"
  ON playoff_results FOR SELECT
  USING (true);

-- Admin full access
CREATE POLICY "Admins can manage playoff results"
  ON playoff_results FOR ALL
  USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.is_admin = true)
  );

-- Seed with current hardcoded data
INSERT INTO playoff_results (year, champion_name, runner_up_name) VALUES
  (2024, 'Dan Elliot', 'Anthony Piazza'),
  (2023, 'Tom Chiancone', 'Devin Weinshank'),
  (2022, 'Doug Witzenbocker', 'Greg Golding'),
  (2021, 'Doug Witzenbocker', 'Joey Diamond');
