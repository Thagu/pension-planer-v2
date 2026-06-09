-- Globale Steuer-Referenztabellen (Bund + Kanton/Gemeinde)
-- 5 Stützpunkte pro Zivilstand; gemeinsam nutzbar für alle Nutzer

create type public.tax_marital_status as enum ('single', 'married');

comment on type public.tax_marital_status is
  'Zivilstand für Kapital-/Zusatzeinkommensteuer: ledig / verheiratet';

-- ---------------------------------------------------------------------------
-- Bundessteuer (Art. 38 DBG) – effektive Steuerbeträge pro Stützpunkt
-- ---------------------------------------------------------------------------
create table public.tax_federal_reference (
  marital_status public.tax_marital_status primary key,
  tax_amounts jsonb not null,
  source_notes text,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint tax_federal_reference_amounts_object check (jsonb_typeof(tax_amounts) = 'object')
);

comment on table public.tax_federal_reference is
  'Globale Bundessteuer-Referenz: CHF-Steuer bei 50k/100k/250k/500k/1000k Zusatzeinkommen (JSON keys als String).';

create trigger tax_federal_reference_set_updated_at
  before update on public.tax_federal_reference
  for each row
  execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Kanton + Gemeinde (lokal zusammen) – effektive Steuerbeträge pro Stützpunkt
-- ---------------------------------------------------------------------------
create table public.tax_local_reference (
  id uuid primary key default gen_random_uuid(),
  canton_code text not null check (char_length(canton_code) = 2),
  municipality text not null check (char_length(trim(municipality)) > 0),
  municipality_key text not null check (char_length(trim(municipality_key)) > 0),
  marital_status public.tax_marital_status not null,
  tax_amounts jsonb not null,
  canton_share_of_local numeric(5, 4),
  default_steuerfuss numeric(7, 2),
  source_notes text,
  contributed_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint tax_local_reference_amounts_object check (jsonb_typeof(tax_amounts) = 'object'),
  constraint tax_local_reference_unique unique (canton_code, municipality_key, marital_status)
);

create index tax_local_reference_lookup_idx
  on public.tax_local_reference (canton_code, municipality_key, marital_status);

comment on table public.tax_local_reference is
  'Globale Kanton+Gemeinde-Referenz (Kapitalleistungssteuer); gemeinsam nutzbar.';

create trigger tax_local_reference_set_updated_at
  before update on public.tax_local_reference
  for each row
  execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Zivilstand im Profil
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists marital_status public.tax_marital_status;

comment on column public.profiles.marital_status is
  'Zivilstand für Steuerberechnung (ledig / verheiratet)';

-- ---------------------------------------------------------------------------
-- RLS: lesen + beitragen für alle authentifizierten Nutzer
-- ---------------------------------------------------------------------------
alter table public.tax_federal_reference enable row level security;
alter table public.tax_local_reference enable row level security;

create policy "tax_federal_reference_select_authenticated"
  on public.tax_federal_reference for select to authenticated using (true);

create policy "tax_federal_reference_insert_authenticated"
  on public.tax_federal_reference for insert to authenticated with check (true);

create policy "tax_federal_reference_update_authenticated"
  on public.tax_federal_reference for update to authenticated using (true) with check (true);

create policy "tax_local_reference_select_authenticated"
  on public.tax_local_reference for select to authenticated using (true);

create policy "tax_local_reference_insert_authenticated"
  on public.tax_local_reference for insert to authenticated with check (true);

create policy "tax_local_reference_update_authenticated"
  on public.tax_local_reference for update to authenticated using (true) with check (true);

grant select, insert, update on public.tax_federal_reference to authenticated;
grant select, insert, update on public.tax_local_reference to authenticated;
