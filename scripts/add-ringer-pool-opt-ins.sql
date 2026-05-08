-- Per-user, per-season opt-in record for the Net Ringer Pool prize pool.
--
-- A row exists once the user has decided. `opted_in = true` means they're in
-- (and have agreed to Zelle the entry); `opted_in = false` means they've
-- explicitly declined and don't want to be re-prompted this season.
--
-- The presence/absence of a row controls whether the profile-completion
-- banner shows the "Ringer Pool Opt In" CTA. Admins may upsert any value,
-- including deleting a row to surface the prompt again.

CREATE TABLE IF NOT EXISTS ringer_pool_opt_ins (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  season_year INTEGER NOT NULL,
  opted_in BOOLEAN NOT NULL,
  decided_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, season_year)
);

CREATE INDEX IF NOT EXISTS ringer_pool_opt_ins_season_idx
  ON ringer_pool_opt_ins (season_year)
  WHERE opted_in = TRUE;
