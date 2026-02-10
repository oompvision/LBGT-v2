-- Add start_date and end_date columns to the seasons table
-- Run this in your Supabase SQL Editor: https://supabase.com/dashboard → SQL Editor

-- Add the new columns
ALTER TABLE seasons ADD COLUMN IF NOT EXISTS start_date DATE;
ALTER TABLE seasons ADD COLUMN IF NOT EXISTS end_date DATE;

-- Backfill the existing 2025 season with its dates
UPDATE seasons
SET start_date = '2025-05-23', end_date = '2025-09-01'
WHERE year = 2025;

-- Make the columns required for future inserts
ALTER TABLE seasons ALTER COLUMN start_date SET NOT NULL;
ALTER TABLE seasons ALTER COLUMN end_date SET NOT NULL;
