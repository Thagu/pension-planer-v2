-- Postleitzahl für Steuerdomizil (Gemeinde-Auflösung)

alter table public.profiles
  add column if not exists tax_postal_code text;

alter table public.profiles
  drop constraint if exists profiles_tax_postal_code_format_check;

alter table public.profiles
  add constraint profiles_tax_postal_code_format_check check (
    tax_postal_code is null or tax_postal_code ~ '^\d{4}$'
  );

comment on column public.profiles.tax_postal_code is
  '4-stellige PLZ für Steuerdomizil; Gemeinde wird daraus abgeleitet';
