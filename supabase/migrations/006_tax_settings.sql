-- Steuerdomizil & optionale manuelle Sätze (Kapital-/Zusatzeinkommen ohne Lohn)
alter table public.profiles
  add column if not exists tax_canton text,
  add column if not exists tax_municipality text,
  add column if not exists tax_municipality_steuerfuss numeric(7, 2),
  add column if not exists tax_use_manual_rates boolean not null default false,
  add column if not exists tax_federal_rate_override numeric(8, 6),
  add column if not exists tax_canton_rate_override numeric(8, 6),
  add column if not exists tax_municipal_rate_override numeric(8, 6);

comment on column public.profiles.tax_canton is 'Kantonskürzel CH (ZH, BE, …) für Kapital-/Zusatzeinkommensteuer';
comment on column public.profiles.tax_municipality is 'Gemeinde (Anzeige / Referenz)';
comment on column public.profiles.tax_municipality_steuerfuss is 'Gemeinde-Steuerfuss in % (z. B. 119 für Zürich Stadt)';
comment on column public.profiles.tax_use_manual_rates is 'Manuelle effektive Steuersätze statt Referenztabelle';
comment on column public.profiles.tax_federal_rate_override is 'Effektiver Bundessteuersatz als Dezimal (0.008 = 0.8%)';
comment on column public.profiles.tax_canton_rate_override is 'Effektiver Kantonssteuersatz als Dezimal';
comment on column public.profiles.tax_municipal_rate_override is 'Effektiver Gemeindesteuersatz als Dezimal';
