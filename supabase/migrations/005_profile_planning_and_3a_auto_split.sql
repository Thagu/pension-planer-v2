-- Planungshorizont, Pensionsaufwände, automatische 3a-Konto-Eröffnung

alter table public.profiles
  add column if not exists planning_horizon_age integer check (
    planning_horizon_age is null
    or (planning_horizon_age >= 58 and planning_horizon_age <= 110)
  ),
  add column if not exists annual_retirement_expenses numeric(14, 2) not null default 0,
  add column if not exists pillar3a_auto_split_enabled boolean not null default false,
  add column if not exists pillar3a_auto_split_threshold numeric(14, 2),
  add column if not exists pillar3a_auto_split_contribution_mode text not null default 'max'
    check (pillar3a_auto_split_contribution_mode in ('max', 'last')),
  add column if not exists pillar3a_auto_split_name_prefix text not null default '3a-Konto';

comment on column public.profiles.planning_horizon_age is
  'Alter bis wohin die Vermögensprojektion reicht (z. B. 90).';
comment on column public.profiles.annual_retirement_expenses is
  'Jährliche Ausgaben ab Pensionierung – reduziert das freie Vermögen.';
comment on column public.profiles.pillar3a_auto_split_enabled is
  'Bei Erreichen des Schwellenkapitals automatisch neues 3a-Konto eröffnen.';
comment on column public.profiles.pillar3a_auto_split_threshold is
  'Kontostand (CHF), ab dem ein neues 3a-Konto eröffnet wird.';
comment on column public.profiles.pillar3a_auto_split_contribution_mode is
  'max = maximal abzugsfähig, last = Satz des Vorgänger-Kontos.';
