-- Pension Planner Schweiz – Initial Supabase Schema
-- Ausführen im Supabase SQL Editor oder via: supabase db push
--
-- Tabellen: profiles (1:1 mit auth.users), scenarios (n:1 pro User)
-- RLS: Jeder Nutzer sieht nur eigene Zeilen (auth.uid() = user_id bzw. profiles.id)

-- ---------------------------------------------------------------------------
-- Hilfsfunktion: updated_at automatisch setzen
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles – Stammdaten & Vermögen (nicht szenario-spezifisch)
-- id = auth.users.id (1:1 mit Supabase Auth)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,

  birth_date date,
  gender text check (gender is null or gender in ('male', 'female')),
  employment_start_year integer check (
    employment_start_year is null
    or (employment_start_year >= 1900 and employment_start_year <= 2100)
  ),
  retirement_age integer not null default 65 check (
    retirement_age >= 58 and retirement_age <= 70
  ),

  current_salary_brutto numeric(14, 2) not null default 0,
  bvg_current_capital numeric(14, 2) not null default 0,
  pillar3a_current_capital numeric(14, 2) not null default 0,
  free_assets numeric(14, 2) not null default 0,

  bvg_interest_rate numeric(8, 6),
  bvg_conversion_rate numeric(8, 6),
  bvg_contribution_rates jsonb,
  pillar3a_interest_rate numeric(8, 6),
  free_assets_interest_rate numeric(8, 6),

  bvg_coordinated_salary_override numeric(14, 2),
  annual_savings_to_free_assets numeric(14, 2) not null default 0,

  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

comment on table public.profiles is
  'Persönliche Stammdaten und Vermögenswerte pro Nutzer (1:1 mit auth.users).';

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row
  execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- scenarios – What-if-Szenarien mit JSON-Overrides
-- ---------------------------------------------------------------------------
create table public.scenarios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,

  name text not null check (char_length(trim(name)) > 0),
  data jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

comment on table public.scenarios is
  'Pensionierungsszenarien; data enthält Szenario-Overrides (ScenarioInput-Teile).';

create index scenarios_user_id_idx on public.scenarios (user_id);
create index scenarios_user_id_updated_at_idx on public.scenarios (user_id, updated_at desc);

create trigger scenarios_set_updated_at
  before update on public.scenarios
  for each row
  execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Optional: leeres Profil bei Registrierung anlegen
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.scenarios enable row level security;

-- profiles: id ist gleich auth.users.id
create policy "profiles_select_own"
  on public.profiles
  for select
  to authenticated
  using (id = auth.uid());

create policy "profiles_insert_own"
  on public.profiles
  for insert
  to authenticated
  with check (id = auth.uid());

create policy "profiles_update_own"
  on public.profiles
  for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "profiles_delete_own"
  on public.profiles
  for delete
  to authenticated
  using (id = auth.uid());

-- scenarios: user_id verknüpft mit auth.users.id
create policy "scenarios_select_own"
  on public.scenarios
  for select
  to authenticated
  using (user_id = auth.uid());

create policy "scenarios_insert_own"
  on public.scenarios
  for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "scenarios_update_own"
  on public.scenarios
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "scenarios_delete_own"
  on public.scenarios
  for delete
  to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Berechtigungen für authentifizierte Clients (Supabase JS)
-- ---------------------------------------------------------------------------
grant usage on schema public to authenticated;
grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.scenarios to authenticated;
