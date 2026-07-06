-- Vorname pro Person (persönlichere Labels statt «Person 1/2»).
-- Primärperson: profiles.first_name; Partner: partner_profile->>'first_name' (JSON).
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS first_name text;

COMMENT ON COLUMN profiles.first_name IS 'Vorname der Primärperson (ersetzt «Person 1» in der UI)';
