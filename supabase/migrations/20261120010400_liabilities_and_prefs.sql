-- Liabilities, net-worth history, and per-user preferences.

create table if not exists public.liabilities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  liability_type text not null,
  balance numeric(20, 2) not null,
  as_of date not null,
  include_in_net_worth boolean not null default true,
  unresolved boolean not null default false,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint liability_type_chk check (liability_type in ('credit_card', 'loan', 'tax', 'other'))
);

comment on column public.liabilities.unresolved is
  'Unresolved balances are not subtracted. Net worth is labeled before unresolved taxes and liabilities.';
comment on column public.liabilities.balance is 'Amount owed, stored as a positive number.';

create table if not exists public.net_worth_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  snapshot_date date not null,
  net_worth numeric(20, 2) not null,
  invested_value numeric(20, 2) not null default 0,
  brokerage_cash numeric(20, 2) not null default 0,
  checking_cash numeric(20, 2) not null default 0,
  liabilities numeric(20, 2) not null default 0,
  unrealized_pl numeric(20, 2) not null default 0,
  realized_pl numeric(20, 2) not null default 0,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.preferences (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  price_mode text not null default 'live',
  theme text not null default 'dark',
  legacy_import_status text not null default 'pending',
  projection_days integer not null default 90,
  active_scenario_id uuid references public.price_scenarios (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint preferences_mode_chk check (price_mode in ('live', 'what_if')),
  constraint preferences_theme_chk check (theme in ('dark', 'light')),
  constraint preferences_legacy_chk check (legacy_import_status in ('pending', 'imported', 'dismissed')),
  constraint preferences_days_chk check (projection_days between 30 and 180)
);

select public._mpt_protect('public.liabilities');
select public._mpt_protect('public.net_worth_snapshots');
select public._mpt_protect('public.preferences');

create index if not exists liabilities_user_idx on public.liabilities (user_id);
create index if not exists liabilities_as_of_idx on public.liabilities (user_id, as_of);
create index if not exists snapshots_user_date_idx on public.net_worth_snapshots (user_id, snapshot_date);
create index if not exists preferences_scenario_idx on public.preferences (active_scenario_id);
