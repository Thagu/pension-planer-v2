-- Haushalt / Partner-Planung + 3a-Zuordnung pro Person
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS planning_mode text NOT NULL DEFAULT 'single'
    CHECK (planning_mode IN ('single', 'couple'));

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS partner_profile jsonb;

COMMENT ON COLUMN profiles.planning_mode IS 'single | couple – Paarplanung mit separatem partner_profile';
COMMENT ON COLUMN profiles.partner_profile IS 'Stammdaten Partner/in (Spiegel der Personenfelder, JSON)';

ALTER TABLE pillar3a_accounts
  ADD COLUMN IF NOT EXISTS person text NOT NULL DEFAULT 'primary'
    CHECK (person IN ('primary', 'partner'));
