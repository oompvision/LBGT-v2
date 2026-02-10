-- Migration: Add tee_time_templates table and booking window columns
-- Run this in your Supabase SQL Editor

-- 1. Create the tee_time_templates table
CREATE TABLE IF NOT EXISTS tee_time_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  season_id UUID NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  day_of_week INT NOT NULL DEFAULT 5, -- 0=Sun, 1=Mon, ... 5=Fri, 6=Sat
  time_slots TEXT[] NOT NULL DEFAULT ARRAY['15:30','15:40','15:50','16:00','16:10','16:20'],
  max_slots INT NOT NULL DEFAULT 4,
  booking_opens_days_before INT NOT NULL DEFAULT 7,
  booking_opens_time TIME NOT NULL DEFAULT '21:00',
  booking_closes_days_before INT NOT NULL DEFAULT 2,
  booking_closes_time TIME NOT NULL DEFAULT '18:00',
  timezone TEXT NOT NULL DEFAULT 'America/New_York',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(season_id)
);

-- 2. Add booking window columns to tee_times
ALTER TABLE tee_times ADD COLUMN IF NOT EXISTS booking_opens_at TIMESTAMPTZ;
ALTER TABLE tee_times ADD COLUMN IF NOT EXISTS booking_closes_at TIMESTAMPTZ;

-- 3. Enable RLS on the new table (match existing patterns)
ALTER TABLE tee_time_templates ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read templates
CREATE POLICY "Allow authenticated read on tee_time_templates"
  ON tee_time_templates FOR SELECT
  TO authenticated
  USING (true);

-- Allow authenticated users to insert/update/delete templates (admin checks happen in app code)
CREATE POLICY "Allow authenticated write on tee_time_templates"
  ON tee_time_templates FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
