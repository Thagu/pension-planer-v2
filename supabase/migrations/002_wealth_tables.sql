-- Pension Planner Schweiz – Vermögenstabellen (Ersparnisse/Investitionen)
-- Ergänzung zur Initialmigration 001_initial_schema.sql
--
-- Zweck:
-- 1) Vermögenswerte pro Nutzer in mehreren "Konten/Töpfen" abbilden
-- 2) Cashflows (Ein-/Auszahlungen, Renditen) historisieren
-- 3) Jahres-/Stichtags-Snapshots für Auswertungen speichern

-- ---------------------------------------------------------------------------
-- wealth_accounts – Vermögenstöpfe pro User
-- ---------------------------------------------------------------------------
create table if not exists public.wealth_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  scenario_id uuid references public.scenarios (id) on delete cascade,

  account_type text not null check (
    account_type in ('cash_savings', 'etf', 'stocks', 'bonds', 'real_estate', 'other')
  ),
  name text not null check (char_length(trim(name)) > 0),
  currency char(3) not null default 'CHF',
  is_active boolean not null default true,

  current_value numeric(14, 2) not null default 0,
  expected_return_rate numeric(8, 6),

  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

comment on table public.wealth_accounts is
  'Vermögenstöpfe eines Nutzers (z. B. Sparkonto, ETF-Depot). Optional auf Szenario bezogen.';

create index if not exists wealth_accounts_user_id_idx
  on public.wealth_accounts (user_id);

create index if not exists wealth_accounts_scenario_id_idx
  on public.wealth_accounts (scenario_id);

create index if not exists wealth_accounts_user_active_idx
  on public.wealth_accounts (user_id, is_active);

drop trigger if exists wealth_accounts_set_updated_at on public.wealth_accounts;
create trigger wealth_accounts_set_updated_at
  before update on public.wealth_accounts
  for each row
  execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- wealth_transactions – Bewegungen/Erträge pro Konto
-- ---------------------------------------------------------------------------
create table if not exists public.wealth_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  scenario_id uuid references public.scenarios (id) on delete cascade,
  account_id uuid not null references public.wealth_accounts (id) on delete cascade,

  txn_date date not null default current_date,
  transaction_type text not null check (
    transaction_type in ('deposit', 'withdrawal', 'return', 'fee', 'tax', 'manual_adjustment')
  ),
  amount numeric(14, 2) not null,
  note text,
  meta jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default timezone('utc', now())
);

comment on table public.wealth_transactions is
  'Ein-/Auszahlungen und Renditen je Vermögenskonto für historische Berechnungen.';

create index if not exists wealth_transactions_user_id_idx
  on public.wealth_transactions (user_id);

create index if not exists wealth_transactions_account_date_idx
  on public.wealth_transactions (account_id, txn_date desc);

create index if not exists wealth_transactions_scenario_date_idx
  on public.wealth_transactions (scenario_id, txn_date desc);

-- ---------------------------------------------------------------------------
-- wealth_snapshots – periodische Stände (z. B. Jahresende)
-- ---------------------------------------------------------------------------
create table if not exists public.wealth_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  scenario_id uuid references public.scenarios (id) on delete cascade,
  account_id uuid references public.wealth_accounts (id) on delete cascade,

  snapshot_date date not null,
  total_value numeric(14, 2) not null,
  invested_capital numeric(14, 2),
  unrealized_gain numeric(14, 2),
  data jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

comment on table public.wealth_snapshots is
  'Verdichtete Vermögensstände (gesamt oder je Konto) für Reporting und Simulation.';

create unique index if not exists wealth_snapshots_unique_scope_idx
  on public.wealth_snapshots (user_id, scenario_id, account_id, snapshot_date);

create index if not exists wealth_snapshots_user_date_idx
  on public.wealth_snapshots (user_id, snapshot_date desc);

drop trigger if exists wealth_snapshots_set_updated_at on public.wealth_snapshots;
create trigger wealth_snapshots_set_updated_at
  before update on public.wealth_snapshots
  for each row
  execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Ownership-Guards (Server-seitig)
-- Verhindert referenzielle "Cross-User"-Verknüpfungen.
-- ---------------------------------------------------------------------------
create or replace function public.enforce_wealth_row_ownership()
returns trigger
language plpgsql
as $$
declare
  scenario_owner uuid;
  account_owner uuid;
begin
  -- scenario_id muss demselben user_id gehören
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

  -- account_id muss demselben user_id gehören (falls Spalte vorhanden)
  if tg_table_name in ('wealth_transactions', 'wealth_snapshots') and new.account_id is not null then
    select a.user_id into account_owner
    from public.wealth_accounts a
    where a.id = new.account_id;

    if account_owner is null then
      raise exception 'account_id % existiert nicht', new.account_id;
    end if;

    if account_owner <> new.user_id then
      raise exception 'account_id gehört nicht zu user_id';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists wealth_accounts_enforce_ownership on public.wealth_accounts;
create trigger wealth_accounts_enforce_ownership
  before insert or update on public.wealth_accounts
  for each row
  execute function public.enforce_wealth_row_ownership();

drop trigger if exists wealth_transactions_enforce_ownership on public.wealth_transactions;
create trigger wealth_transactions_enforce_ownership
  before insert or update on public.wealth_transactions
  for each row
  execute function public.enforce_wealth_row_ownership();

drop trigger if exists wealth_snapshots_enforce_ownership on public.wealth_snapshots;
create trigger wealth_snapshots_enforce_ownership
  before insert or update on public.wealth_snapshots
  for each row
  execute function public.enforce_wealth_row_ownership();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.wealth_accounts enable row level security;
alter table public.wealth_transactions enable row level security;
alter table public.wealth_snapshots enable row level security;

-- wealth_accounts
drop policy if exists "wealth_accounts_select_own" on public.wealth_accounts;
create policy "wealth_accounts_select_own"
  on public.wealth_accounts
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "wealth_accounts_insert_own" on public.wealth_accounts;
create policy "wealth_accounts_insert_own"
  on public.wealth_accounts
  for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "wealth_accounts_update_own" on public.wealth_accounts;
create policy "wealth_accounts_update_own"
  on public.wealth_accounts
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "wealth_accounts_delete_own" on public.wealth_accounts;
create policy "wealth_accounts_delete_own"
  on public.wealth_accounts
  for delete
  to authenticated
  using (user_id = auth.uid());

-- wealth_transactions
drop policy if exists "wealth_transactions_select_own" on public.wealth_transactions;
create policy "wealth_transactions_select_own"
  on public.wealth_transactions
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "wealth_transactions_insert_own" on public.wealth_transactions;
create policy "wealth_transactions_insert_own"
  on public.wealth_transactions
  for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "wealth_transactions_update_own" on public.wealth_transactions;
create policy "wealth_transactions_update_own"
  on public.wealth_transactions
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "wealth_transactions_delete_own" on public.wealth_transactions;
create policy "wealth_transactions_delete_own"
  on public.wealth_transactions
  for delete
  to authenticated
  using (user_id = auth.uid());

-- wealth_snapshots
drop policy if exists "wealth_snapshots_select_own" on public.wealth_snapshots;
create policy "wealth_snapshots_select_own"
  on public.wealth_snapshots
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "wealth_snapshots_insert_own" on public.wealth_snapshots;
create policy "wealth_snapshots_insert_own"
  on public.wealth_snapshots
  for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "wealth_snapshots_update_own" on public.wealth_snapshots;
create policy "wealth_snapshots_update_own"
  on public.wealth_snapshots
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "wealth_snapshots_delete_own" on public.wealth_snapshots;
create policy "wealth_snapshots_delete_own"
  on public.wealth_snapshots
  for delete
  to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Berechtigungen
-- ---------------------------------------------------------------------------
grant select, insert, update, delete on public.wealth_accounts to authenticated;
grant select, insert, update, delete on public.wealth_transactions to authenticated;
grant select, insert, update, delete on public.wealth_snapshots to authenticated;
