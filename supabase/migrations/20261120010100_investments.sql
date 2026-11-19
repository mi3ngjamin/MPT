-- Portfolios, accounts, the activity ledger, and a reserved lot table.
-- Cash balances are not stored. The client derives them from activities.

create table if not exists public.portfolios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  include_in_net_worth boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  portfolio_id uuid not null references public.portfolios (id) on delete cascade,
  name text not null,
  account_type text not null default 'brokerage',
  tax_treatment text not null default 'taxable',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint accounts_type_chk check (account_type in ('brokerage', 'retirement', 'crypto', 'other')),
  constraint accounts_tax_chk check (tax_treatment in ('taxable', 'tax_deferred', 'tax_free'))
);

comment on column public.accounts.tax_treatment is
  'taxable accounts label average cost as not tax-lot basis. tax_lots is reserved for specific-lot tracking.';

create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  account_id uuid not null references public.accounts (id) on delete cascade,
  transfer_account_id uuid references public.accounts (id) on delete cascade,
  activity_date date not null,
  action text not null,
  asset_type text not null default 'stock_etf',
  symbol text,
  quantity numeric(24, 8),
  price numeric(24, 8),
  fees numeric(24, 8) not null default 0,
  amount numeric(24, 8),
  multiplier numeric(24, 8) not null default 1,
  ratio numeric(24, 8),
  delta_quantity numeric(24, 8),
  delta_cost_basis numeric(24, 8),
  delta_cash numeric(24, 8),
  underlying text,
  expiry date,
  strike numeric(24, 8),
  option_right text,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint activities_action_chk check (action in (
    'opening_position', 'opening_cash', 'buy', 'sell',
    'buy_to_open', 'sell_to_open', 'buy_to_close', 'sell_to_close',
    'expire', 'assign', 'exercise',
    'contribution', 'withdrawal', 'dividend', 'interest', 'fee',
    'transfer', 'in_kind_transfer', 'adjustment', 'split', 'dividend_reinvest'
  )),
  constraint activities_asset_chk check (asset_type in ('stock_etf', 'option', 'crypto', 'cash', 'other')),
  constraint activities_right_chk check (option_right is null or option_right in ('C', 'P')),
  constraint activities_adjustment_note_chk check (
    action <> 'adjustment' or (note is not null and length(btrim(note)) > 0)
  ),
  constraint activities_transfer_target_chk check (
    action not in ('transfer', 'in_kind_transfer') or (
      transfer_account_id is not null and transfer_account_id <> account_id
    )
  )
);

comment on table public.activities is
  'The only input to investment balances. price is a trade or last-known fallback, never a live quote.';
comment on column public.activities.amount is
  'Cash amount, or total cost basis for opening_position. May be negative for a short opening basis.';
comment on column public.activities.price is
  'Trade price or opening last-known price. Live quotes live in public.quotes.';
comment on column public.activities.ratio is
  'Split ratio as new shares per old share. 4 is a 4-for-1. Basis is unchanged.';
comment on column public.activities.delta_quantity is 'Adjustment only.';
comment on column public.activities.delta_cost_basis is 'Adjustment only.';
comment on column public.activities.delta_cash is 'Adjustment only.';

create table if not exists public.tax_lots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  account_id uuid not null references public.accounts (id) on delete cascade,
  symbol text not null,
  acquired_on date not null,
  quantity_opened numeric(24, 8) not null,
  quantity_remaining numeric(24, 8) not null,
  cost_basis numeric(24, 8) not null,
  cost_basis_remaining numeric(24, 8) not null,
  opened_by_activity_id uuid references public.activities (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.tax_lots is
  'Reserved for future specific-identification lots. The app uses average cost and does not write this table.';

select public._mpt_protect('public.portfolios');
select public._mpt_protect('public.accounts');
select public._mpt_protect('public.activities');
select public._mpt_protect('public.tax_lots');

create index if not exists portfolios_user_idx on public.portfolios (user_id);
create index if not exists accounts_user_idx on public.accounts (user_id);
create index if not exists accounts_portfolio_idx on public.accounts (portfolio_id);
create index if not exists activities_user_idx on public.activities (user_id);
create index if not exists activities_account_date_idx on public.activities (account_id, activity_date);
create index if not exists activities_transfer_idx on public.activities (transfer_account_id);
create index if not exists activities_symbol_idx on public.activities (user_id, symbol);
create index if not exists tax_lots_user_idx on public.tax_lots (user_id);
create index if not exists tax_lots_account_idx on public.tax_lots (account_id);
create index if not exists tax_lots_activity_idx on public.tax_lots (opened_by_activity_id);
