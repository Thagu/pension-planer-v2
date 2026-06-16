-- Netto-Lebenshaltung im Alleinerzieher-/Überlebenden-Fall (Paarmodus)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS annual_survivor_expenses numeric(14, 2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.profiles.annual_survivor_expenses IS
  'Netto-Lebenshaltung nach Tod des ersten Partners (heutige Kaufkraft, Paarmodus).';
