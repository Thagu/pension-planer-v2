-- Stammdaten: koordinierter BVG-Lohn (Override) + jährliche Sparquote ins freie Vermögen

alter table public.profiles
  add column if not exists bvg_coordinated_salary_override numeric(14, 2),
  add column if not exists annual_savings_to_free_assets numeric(14, 2) not null default 0;

comment on column public.profiles.bvg_coordinated_salary_override is
  'Optional: fester koordinierter BVG-Lohn (CHF). Wenn gesetzt, ersetzt die berechnete Koordination.';

comment on column public.profiles.annual_savings_to_free_assets is
  'Jährlicher Betrag vom Lohn ins freie Vermögen (CHF), bis zur Pensionierung.';
