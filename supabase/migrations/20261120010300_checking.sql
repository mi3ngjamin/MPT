-- Checking balances, the register, and recurring bills or income.

create table if not exists public.checking_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  opening_balance numeric(20, 2) not null default 0,
  opening_date date not null,
  low_balance_floor numeric(20, 2),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column public.checking_accounts.opening_balance is
  'Balance at the start of opening_date, before transactions on that date. This is the persisted starting balance.';

create table if not exists public.recurring_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  account_id uuid not null references public.checking_accounts (id) on delete cascade,
  name text not null,
  kind text not null,
  amount numeric(20, 2) not null,
  cadence text not null,
  day_of_month integer,
  interval_weeks integer,
  anchor_date date,
  month_of_year integer,
  autopay boolean not null default false,
  active boolean not null default true,
  category text not null default 'Uncategorized',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint recurring_kind_chk check (kind in ('bill', 'income')),
  constraint recurring_cadence_chk check (cadence in ('monthly', 'weekly', 'yearly', 'once')),
  constraint recurring_day_chk check (day_of_month is null or day_of_month between 1 and 31),
  constraint recurring_weeks_chk check (interval_weeks is null or interval_weeks > 0),
  constraint recurring_month_chk check (month_of_year is null or month_of_year between 1 and 12)
);

create table if not exists public.checking_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  account_id uuid not null references public.checking_accounts (id) on delete cascade,
  txn_date date not null,
  description text not null default '',
  amount numeric(20, 2) not null,
  category text not null default 'Uncategorized',
  cleared boolean not null default false,
  recurring_item_id uuid references public.recurring_items (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column public.checking_transactions.amount is 'Signed. Income is positive, spending is negative.';

create table if not exists public.recurring_occurrences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  recurring_item_id uuid not null references public.recurring_items (id) on delete cascade,
  occurrence_date date not null,
  status text not null default 'paid',
  transaction_id uuid references public.checking_transactions (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint occurrence_status_chk check (status in ('paid', 'skipped')),
  constraint occurrence_uniq unique (recurring_item_id, occurrence_date)
);

select public._mpt_protect('public.checking_accounts');
select public._mpt_protect('public.recurring_items');
select public._mpt_protect('public.checking_transactions');
select public._mpt_protect('public.recurring_occurrences');

create index if not exists checking_accounts_user_idx on public.checking_accounts (user_id);
create index if not exists recurring_user_idx on public.recurring_items (user_id);
create index if not exists recurring_account_idx on public.recurring_items (account_id);
create index if not exists checking_txns_user_idx on public.checking_transactions (user_id);
create index if not exists checking_txns_account_date_idx on public.checking_transactions (account_id, txn_date);
create index if not exists checking_txns_recurring_idx on public.checking_transactions (recurring_item_id);
create index if not exists occurrences_user_idx on public.recurring_occurrences (user_id);
create index if not exists occurrences_item_date_idx on public.recurring_occurrences (recurring_item_id, occurrence_date);
create index if not exists occurrences_txn_idx on public.recurring_occurrences (transaction_id);
