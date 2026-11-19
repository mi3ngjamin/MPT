-- Live quotes, manual prices, what-if prices, named scenarios, and saved buy-more amounts.

create table if not exists public.quotes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  symbol text not null,
  price numeric(24, 8) not null,
  previous_close numeric(24, 8),
  source text not null,
  fetched_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint quotes_source_chk check (source in ('finnhub', 'manual')),
  constraint quotes_symbol_source_uniq unique (user_id, symbol, source)
);

comment on table public.quotes is
  'finnhub rows are live market data and win for stocks. manual rows are explicit current prices for options, crypto, and other assets.';

create table if not exists public.what_if_prices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  symbol text not null,
  price numeric(24, 8) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint what_if_symbol_uniq unique (user_id, symbol)
);

create table if not exists public.price_scenarios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.price_scenario_prices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  scenario_id uuid not null references public.price_scenarios (id) on delete cascade,
  symbol text not null,
  price numeric(24, 8) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint scenario_symbol_uniq unique (scenario_id, symbol)
);

create table if not exists public.modeled_buys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  account_id uuid not null references public.accounts (id) on delete cascade,
  symbol text not null,
  amount numeric(24, 8),
  amount_source text not null default 'custom',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint modeled_source_chk check (amount_source in ('custom', 'account_cash', 'portfolio_cash')),
  constraint modeled_account_symbol_uniq unique (user_id, account_id, symbol)
);

select public._mpt_protect('public.quotes');
select public._mpt_protect('public.what_if_prices');
select public._mpt_protect('public.price_scenarios');
select public._mpt_protect('public.price_scenario_prices');
select public._mpt_protect('public.modeled_buys');

create index if not exists quotes_user_symbol_idx on public.quotes (user_id, symbol);
create index if not exists what_if_user_idx on public.what_if_prices (user_id);
create index if not exists price_scenarios_user_idx on public.price_scenarios (user_id);
create index if not exists scenario_prices_user_idx on public.price_scenario_prices (user_id);
create index if not exists scenario_prices_scenario_idx on public.price_scenario_prices (scenario_id);
create index if not exists modeled_user_idx on public.modeled_buys (user_id);
create index if not exists modeled_account_idx on public.modeled_buys (account_id);
