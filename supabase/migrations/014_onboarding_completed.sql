-- Onboarding-Wizard: Abschluss / Überspringen
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS onboarding_skipped_at timestamptz;

COMMENT ON COLUMN profiles.onboarding_completed_at IS 'Wizard erfolgreich abgeschlossen';
COMMENT ON COLUMN profiles.onboarding_skipped_at IS 'User hat Wizard mit «Später» geschlossen';
