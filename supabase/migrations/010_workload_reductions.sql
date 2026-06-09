-- Arbeitspensum-Reduktionen (max. 2 Stufen) für Teilpensionierung
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS workload_reductions jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN profiles.workload_reductions IS
  'Array: [{fromAge, workloadPercent}] – Arbeitspensum ab Alter in Prozent (max. 2 Einträge)';
