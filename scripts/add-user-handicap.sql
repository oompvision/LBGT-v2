-- Add a self-reported `handicap` to the users table.
--
-- Distinct from `strokes_given` (which is admin-only and used for course-handicap
-- math). `handicap` is a USGA-style handicap index that the user maintains
-- themselves. Decimals allowed; nullable so existing users start unset.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS handicap NUMERIC(4, 1);
