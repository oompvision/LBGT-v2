-- Create seasons table
CREATE TABLE IF NOT EXISTS seasons (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  year integer UNIQUE NOT NULL,
  name text NOT NULL,
  is_active boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add season column to rounds table
ALTER TABLE rounds ADD COLUMN IF NOT EXISTS season integer DEFAULT 2025;

-- Add season column to tee_times table
ALTER TABLE tee_times ADD COLUMN IF NOT EXISTS season integer DEFAULT 2025;

-- Add season column to reservations table
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS season integer DEFAULT 2025;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_rounds_season ON rounds(season);
CREATE INDEX IF NOT EXISTS idx_tee_times_season ON tee_times(season);
CREATE INDEX IF NOT EXISTS idx_reservations_season ON reservations(season);

-- Insert 2025 season as the initial active season
INSERT INTO seasons (year, name, is_active)
VALUES (2025, '2025 Season', true)
ON CONFLICT (year) DO NOTHING;

-- Update all existing records to have season = 2025
UPDATE rounds SET season = 2025 WHERE season IS NULL;
UPDATE tee_times SET season = 2025 WHERE season IS NULL;
UPDATE reservations SET season = 2025 WHERE season IS NULL;

-- Function to ensure only one active season
CREATE OR REPLACE FUNCTION ensure_single_active_season()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_active = true THEN
    UPDATE seasons SET is_active = false WHERE id != NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to maintain single active season
DROP TRIGGER IF EXISTS trigger_single_active_season ON seasons;
CREATE TRIGGER trigger_single_active_season
  AFTER INSERT OR UPDATE ON seasons
  FOR EACH ROW
  WHEN (NEW.is_active = true)
  EXECUTE FUNCTION ensure_single_active_season();
