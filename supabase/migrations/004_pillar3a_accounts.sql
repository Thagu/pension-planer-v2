-- Säule 3a: mehrere Konten pro Nutzer mit gestaffeltem Bezug

create table public.pillar3a_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,

  name text not null default '3a-Konto',
  provider text,
  current_value numeric(14, 2) not null default 0,
  annual_contribution numeric(14, 2) not null default 0,
  return_rate numeric(8, 6),
  -- Legacy: Bezug relativ BVG (-10..+10); Staffelung primär im Szenario-JSON
  withdrawal_year_offset integer not null default 0 check (
    withdrawal_year_offset >= -10 and withdrawal_year_offset <= 10
  ),
  sort_order integer not null default 0,

  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

comment on table public.pillar3a_accounts is
  'Säule-3a-Konten pro Nutzer; gestaffelter Bezug über withdrawal_year_offset.';

create index pillar3a_accounts_user_id_idx on public.pillar3a_accounts (user_id);
create index pillar3a_accounts_user_sort_idx
  on public.pillar3a_accounts (user_id, sort_order);

create trigger pillar3a_accounts_set_updated_at
  before update on public.pillar3a_accounts
  for each row
  execute function public.set_updated_at();

alter table public.pillar3a_accounts enable row level security;

create policy "pillar3a_accounts_select_own"
  on public.pillar3a_accounts for select to authenticated
  using (user_id = auth.uid());

create policy "pillar3a_accounts_insert_own"
  on public.pillar3a_accounts for insert to authenticated
  with check (user_id = auth.uid());

create policy "pillar3a_accounts_update_own"
  on public.pillar3a_accounts for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "pillar3a_accounts_delete_own"
  on public.pillar3a_accounts for delete to authenticated
  using (user_id = auth.uid());

grant select, insert, update, delete on public.pillar3a_accounts to authenticated;
