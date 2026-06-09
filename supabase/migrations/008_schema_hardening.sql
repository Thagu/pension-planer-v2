-- Schema-Härtung: Constraints, Normalisierung, Sicherheit, Konsistenz

-- ---------------------------------------------------------------------------
-- Funktionen: search_path fixen (Supabase Advisor)
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create or replace function public.enforce_wealth_row_ownership()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  scenario_owner uuid;
  account_owner uuid;
  account_scenario uuid;
begin
  if new.scenario_id is not null then
    select s.user_id into scenario_owner
    from public.scenarios s
    where s.id = new.scenario_id;

    if scenario_owner is null then
      raise exception 'scenario_id % existiert nicht', new.scenario_id;
    end if;

    if scenario_owner <> new.user_id then
      raise exception 'scenario_id gehört nicht zu user_id';
    end if;
  end if;

  if tg_table_name in ('wealth_transactions', 'wealth_snapshots')
     and new.account_id is not null then
    select a.user_id, a.scenario_id
      into account_owner, account_scenario
    from public.wealth_accounts a
    where a.id = new.account_id;

    if account_owner is null then
      raise exception 'account_id % existiert nicht', new.account_id;
    end if;

    if account_owner <> new.user_id then
      raise exception 'account_id gehört nicht zu user_id';
    end if;

    if new.scenario_id is distinct from account_scenario then
      raise exception 'scenario_id muss mit dem Konto übereinstimmen';
    end if;
  end if;

  return new;
end;
$$;

-- handle_new_user nur für internen Trigger, nicht via RPC aufrufbar
revoke all on function public.handle_new_user() from public;
revoke execute on function public.handle_new_user() from anon, authenticated;

-- ---------------------------------------------------------------------------
-- pillar3a: Offset-Bereich an App-Logik anpassen (negativ = vor BVG)
-- ---------------------------------------------------------------------------
alter table public.pillar3a_accounts
  drop constraint if exists pillar3a_accounts_withdrawal_year_offset_check;

alter table public.pillar3a_accounts
  add constraint pillar3a_accounts_withdrawal_year_offset_check check (
    withdrawal_year_offset >= -10 and withdrawal_year_offset <= 10
  );

comment on column public.pillar3a_accounts.withdrawal_year_offset is
  'Legacy-Spalte; Bezugsstaffelung liegt primär im Szenario-JSON. Bereich -10..+10 Jahre relativ BVG.';

-- ---------------------------------------------------------------------------
-- profiles: veraltete manuelle Steuersätze entfernen, Checks ergänzen
-- ---------------------------------------------------------------------------
alter table public.profiles
  drop column if exists tax_use_manual_rates,
  drop column if exists tax_federal_rate_override,
  drop column if exists tax_canton_rate_override,
  drop column if exists tax_municipal_rate_override;

alter table public.profiles
  drop constraint if exists profiles_tax_canton_format_check;

alter table public.profiles
  add constraint profiles_tax_canton_format_check check (
    tax_canton is null or tax_canton ~ '^[A-Z]{2}$'
  );

alter table public.profiles
  drop constraint if exists profiles_tax_steuerfuss_range_check;

alter table public.profiles
  add constraint profiles_tax_steuerfuss_range_check check (
    tax_municipality_steuerfuss is null
    or (tax_municipality_steuerfuss >= 50 and tax_municipality_steuerfuss <= 200)
  );

-- ---------------------------------------------------------------------------
-- Steuer-Referenz: Normalisierung + Validierung
-- ---------------------------------------------------------------------------
create extension if not exists unaccent with schema extensions;

create or replace function public.normalize_municipality_key(input text)
returns text
language sql
immutable
set search_path = public, extensions
as $$
  select lower(trim(regexp_replace(extensions.unaccent(input), '\s+', ' ', 'g')));
$$;

create or replace function public.is_valid_tax_reference_amounts(payload jsonb)
returns boolean
language sql
immutable
set search_path = public
as $$
  select jsonb_typeof(payload) = 'object'
    and (payload ? '50000')
    and (payload ? '100000')
    and (payload ? '250000')
    and (payload ? '500000')
    and (payload ? '1000000')
    and (payload->>'50000')::numeric >= 0
    and (payload->>'100000')::numeric >= 0
    and (payload->>'250000')::numeric >= 0
    and (payload->>'500000')::numeric >= 0
    and (payload->>'1000000')::numeric >= 0;
$$;

create or replace function public.normalize_tax_local_reference_row()
returns trigger
language plpgsql
set search_path = public, extensions
as $$
begin
  new.canton_code := upper(trim(new.canton_code));
  new.municipality := trim(new.municipality);
  new.municipality_key := public.normalize_municipality_key(new.municipality);

  if not public.is_valid_tax_reference_amounts(new.tax_amounts) then
    raise exception 'tax_amounts muss 5 nicht-negative Stützpunkte (50000..1000000) enthalten';
  end if;

  if new.canton_share_of_local is not null
     and (new.canton_share_of_local < 0 or new.canton_share_of_local > 1) then
    raise exception 'canton_share_of_local muss zwischen 0 und 1 liegen';
  end if;

  return new;
end;
$$;

drop trigger if exists tax_local_reference_normalize on public.tax_local_reference;
create trigger tax_local_reference_normalize
  before insert or update on public.tax_local_reference
  for each row
  execute function public.normalize_tax_local_reference_row();

create or replace function public.validate_tax_federal_reference_row()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if not public.is_valid_tax_reference_amounts(new.tax_amounts) then
    raise exception 'tax_amounts muss 5 nicht-negative Stützpunkte (50000..1000000) enthalten';
  end if;
  return new;
end;
$$;

drop trigger if exists tax_federal_reference_validate on public.tax_federal_reference;
create trigger tax_federal_reference_validate
  before insert or update on public.tax_federal_reference
  for each row
  execute function public.validate_tax_federal_reference_row();

alter table public.tax_federal_reference
  drop constraint if exists tax_federal_reference_amounts_valid;

alter table public.tax_federal_reference
  add constraint tax_federal_reference_amounts_valid check (
    public.is_valid_tax_reference_amounts(tax_amounts)
  );

alter table public.tax_local_reference
  drop constraint if exists tax_local_reference_amounts_valid;

alter table public.tax_local_reference
  add constraint tax_local_reference_amounts_valid check (
    public.is_valid_tax_reference_amounts(tax_amounts)
  );

alter table public.tax_local_reference
  drop constraint if exists tax_local_reference_canton_format_check;

alter table public.tax_local_reference
  add constraint tax_local_reference_canton_format_check check (
    canton_code ~ '^[A-Z]{2}$'
  );

-- Redundanter Index (Unique-Constraint erzeugt bereits Index)
drop index if exists public.tax_local_reference_lookup_idx;

-- Bestehende Zeilen normalisieren
update public.tax_local_reference
set
  canton_code = upper(trim(canton_code)),
  municipality = trim(municipality),
  municipality_key = public.normalize_municipality_key(municipality)
where canton_code is not null;

update public.profiles
set tax_canton = upper(trim(tax_canton))
where tax_canton is not null;

-- ---------------------------------------------------------------------------
-- wealth_snapshots: Unique-Index mit NULL-sicherer Semantik
-- ---------------------------------------------------------------------------
drop index if exists public.wealth_snapshots_unique_scope_idx;

create unique index wealth_snapshots_unique_scope_idx
  on public.wealth_snapshots (
    user_id,
    coalesce(scenario_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(account_id, '00000000-0000-0000-0000-000000000000'::uuid),
    snapshot_date
  );

-- ---------------------------------------------------------------------------
-- RLS: auth.uid() einmal pro Query auswerten (Performance)
-- ---------------------------------------------------------------------------
-- profiles
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()));

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles for insert to authenticated
  with check (id = (select auth.uid()));

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

drop policy if exists "profiles_delete_own" on public.profiles;
create policy "profiles_delete_own"
  on public.profiles for delete to authenticated
  using (id = (select auth.uid()));

-- scenarios
drop policy if exists "scenarios_select_own" on public.scenarios;
create policy "scenarios_select_own"
  on public.scenarios for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "scenarios_insert_own" on public.scenarios;
create policy "scenarios_insert_own"
  on public.scenarios for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "scenarios_update_own" on public.scenarios;
create policy "scenarios_update_own"
  on public.scenarios for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "scenarios_delete_own" on public.scenarios;
create policy "scenarios_delete_own"
  on public.scenarios for delete to authenticated
  using (user_id = (select auth.uid()));

-- pillar3a_accounts
drop policy if exists "pillar3a_accounts_select_own" on public.pillar3a_accounts;
create policy "pillar3a_accounts_select_own"
  on public.pillar3a_accounts for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "pillar3a_accounts_insert_own" on public.pillar3a_accounts;
create policy "pillar3a_accounts_insert_own"
  on public.pillar3a_accounts for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "pillar3a_accounts_update_own" on public.pillar3a_accounts;
create policy "pillar3a_accounts_update_own"
  on public.pillar3a_accounts for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "pillar3a_accounts_delete_own" on public.pillar3a_accounts;
create policy "pillar3a_accounts_delete_own"
  on public.pillar3a_accounts for delete to authenticated
  using (user_id = (select auth.uid()));

-- wealth tables
drop policy if exists "wealth_accounts_select_own" on public.wealth_accounts;
create policy "wealth_accounts_select_own"
  on public.wealth_accounts for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "wealth_accounts_insert_own" on public.wealth_accounts;
create policy "wealth_accounts_insert_own"
  on public.wealth_accounts for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "wealth_accounts_update_own" on public.wealth_accounts;
create policy "wealth_accounts_update_own"
  on public.wealth_accounts for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "wealth_accounts_delete_own" on public.wealth_accounts;
create policy "wealth_accounts_delete_own"
  on public.wealth_accounts for delete to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "wealth_transactions_select_own" on public.wealth_transactions;
create policy "wealth_transactions_select_own"
  on public.wealth_transactions for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "wealth_transactions_insert_own" on public.wealth_transactions;
create policy "wealth_transactions_insert_own"
  on public.wealth_transactions for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "wealth_transactions_update_own" on public.wealth_transactions;
create policy "wealth_transactions_update_own"
  on public.wealth_transactions for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "wealth_transactions_delete_own" on public.wealth_transactions;
create policy "wealth_transactions_delete_own"
  on public.wealth_transactions for delete to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "wealth_snapshots_select_own" on public.wealth_snapshots;
create policy "wealth_snapshots_select_own"
  on public.wealth_snapshots for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "wealth_snapshots_insert_own" on public.wealth_snapshots;
create policy "wealth_snapshots_insert_own"
  on public.wealth_snapshots for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "wealth_snapshots_update_own" on public.wealth_snapshots;
create policy "wealth_snapshots_update_own"
  on public.wealth_snapshots for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "wealth_snapshots_delete_own" on public.wealth_snapshots;
create policy "wealth_snapshots_delete_own"
  on public.wealth_snapshots for delete to authenticated
  using (user_id = (select auth.uid()));
