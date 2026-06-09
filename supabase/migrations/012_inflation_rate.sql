-- Annual inflation assumption (master data only; applied in projection engine)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS inflation_rate numeric(8, 6);

COMMENT ON COLUMN public.profiles.inflation_rate IS
  'Annual inflation as decimal (0.02 = 2%). Applied to salary, savings, 3a contributions, and retirement expenses in projections.';
