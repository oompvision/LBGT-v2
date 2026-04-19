-- Scorecard OCR upload feature
-- Run this in the Supabase SQL editor, then create the "scorecards" Storage bucket (see notes at the bottom).

-- 1. Store the uploaded scorecard photo URL on the round it produced
ALTER TABLE rounds ADD COLUMN IF NOT EXISTS scorecard_image_url text;

-- 2. Track OCR calls per user for rate limiting (protects the Vision API free tier)
CREATE TABLE IF NOT EXISTS ocr_uploads (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ocr_uploads_user_created
  ON ocr_uploads(user_id, created_at DESC);

ALTER TABLE ocr_uploads ENABLE ROW LEVEL SECURITY;

-- Users can read their own rate-limit records; writes happen via the service-role client.
DROP POLICY IF EXISTS "ocr_uploads_select_own" ON ocr_uploads;
CREATE POLICY "ocr_uploads_select_own" ON ocr_uploads
  FOR SELECT USING (auth.uid() = user_id);

-- Storage bucket setup (do this once in the Supabase dashboard):
--   1. Storage -> New bucket -> name: "scorecards", Public: OFF
--   2. The server action uses the service-role admin client, so no additional
--      RLS policies on storage.objects are required. Access to images is via
--      short-lived signed URLs generated on demand.
