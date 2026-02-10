-- Add start_date and end_date columns to the seasons table
-- Run this in your Supabase SQL Editor: https://supabase.com/dashboard → SQL Editor

-- Add the new columns
ALTER TABLE seasons ADD COLUMN IF NOT EXISTS start_date DATE;
ALTER TABLE seasons ADD COLUMN IF NOT EXISTS end_date DATE;

-- Backfill ALL existing seasons with default dates based on their year
-- (last Friday of May through Labor Day weekend)
UPDATE seasons
SET
  start_date = COALESCE(start_date, make_date(year, 5, 23)),
  end_date = COALESCE(end_date, make_date(year, 9, 1))
WHERE start_date IS NULL OR end_date IS NULL;

-- Make the columns required for future inserts
ALTER TABLE seasons ALTER COLUMN start_date SET NOT NULL;
ALTER TABLE seasons ALTER COLUMN end_date SET NOT NULL;
