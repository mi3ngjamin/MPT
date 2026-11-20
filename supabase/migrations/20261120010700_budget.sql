-- Budget categories, archived checking history, card statements, and targets.
-- Re-runnable. Historical rows live in budget_entries and do not post to checking_transactions,
-- so opening balances (for example FFCU 2050.00 and SoFi 2110.86) stay put.
--
-- Seed JSON array, one object per spreadsheet row:
-- [
--   {
--     "account_name": "FFCU Checking",
--     "date": "2019-07-15",
--     "category": "Monthly Bills",
--     "description": "Rent",
--     "amount": -2050.00,
--     "running_balance": 4100.00,
--     "source": "archive",
--     "source_row": 1
--   }
-- ]
-- source is archive | ffcu | sofi. source_row is unique per source (use the sheet row number).
-- amount is signed: negative leaves the account. running_balance is optional and is not the live balance.
-- category may be blank. Rows dated before a checking account's opening date are analytics-only.
--
-- One-call load (service role or SQL editor). Safe to repeat: source + source_row is the key.
-- select public.load_budget_import(
--   'b1ec7e4d-f966-4238-9d91-6f3131dac7ac',
--   '[...]'::jsonb
-- );
--
-- Or stage, then promote:
-- insert into public.budget_import_raw (
--   user_id, account_name, txn_date, category, description, amount, running_balance, source, source_row
-- )
-- select
--   'b1ec7e4d-f966-4238-9d91-6f3131dac7ac',
--   x.account_name, x.date::date, x.category, x.description, x.amount, x.running_balance, x.source, x.source_row
-- from jsonb_to_recordset(:payload::jsonb) as x(
--   account_name text, date text, category text, description text,
--   amount numeric, running_balance numeric, source text, source_row integer
-- )
-- on conflict (user_id, source, source_row) do update set
--   account_name = excluded.account_name,
--   txn_date = excluded.txn_date,
--   category = excluded.category,
--   description = excluded.description,
--   amount = excluded.amount,
--   running_balance = excluded.running_balance;
-- select public.apply_budget_import('b1ec7e4d-f966-4238-9d91-6f3131dac7ac');

create or replace function public._mpt_protect(tbl regclass)
returns void
language plpgsql
as $$
declare
  tname text;
begin
  select c.relname into tname from pg_class c where c.oid = tbl;
  execute format('alter table %s enable row level security', tbl);
  execute format('revoke all on table %s from public, anon, authenticated', tbl);
  execute format('grant select, insert, update, delete on table %s to authenticated', tbl);
  execute format('drop policy if exists mpt_select_own on %s', tbl);
  execute format('drop policy if exists mpt_insert_own on %s', tbl);
  execute format('drop policy if exists mpt_update_own on %s', tbl);
  execute format('drop policy if exists mpt_delete_own on %s', tbl);
  execute format(
    'create policy mpt_select_own on %s for select to authenticated using (user_id = (select auth.uid()))',
    tbl
  );
  execute format(
    'create policy mpt_insert_own on %s for insert to authenticated with check (user_id = (select auth.uid()))',
    tbl
  );
  execute format(
    'create policy mpt_update_own on %s for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))',
    tbl
  );
  execute format(
    'create policy mpt_delete_own on %s for delete to authenticated using (user_id = (select auth.uid()))',
    tbl
  );
  execute format('drop trigger if exists set_updated_at on %s', tbl);
  execute format(
    'create trigger set_updated_at before update on %s for each row execute function public.set_updated_at()',
    tbl
  );
end;
$$;

revoke all on function public._mpt_protect(regclass) from public, anon, authenticated;

alter table public.checking_transactions
  add column if not exists flow_override text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'checking_flow_override_chk') then
    alter table public.checking_transactions
      add constraint checking_flow_override_chk
      check (
        flow_override is null or flow_override in (
          'income', 'core_spending', 'taxes', 'debt_payment', 'investment', 'savings',
          'dependent_savings', 'transfer_internal', 'needs_review', 'card_payment', 'adjustment'
        )
      );
  end if;
end
$$;

create table if not exists public.budget_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  flow_type text not null,
  group_name text not null default 'other',
  budget_monthly numeric(20, 2),
  color text not null default '#94a3b8',
  hidden boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint budget_flow_chk check (
    flow_type in (
      'income', 'core_spending', 'taxes', 'debt_payment', 'investment', 'savings',
      'dependent_savings', 'transfer_internal', 'needs_review', 'card_payment', 'adjustment'
    )
  )
);

create unique index if not exists budget_categories_user_name_uniq
  on public.budget_categories (user_id, lower(name));

create table if not exists public.budget_targets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  label text not null,
  monthly_amount numeric(20, 2) not null,
  category_name text,
  payee text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists budget_targets_user_label_uniq
  on public.budget_targets (user_id, label);

create table if not exists public.budget_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  payroll_amount numeric(20, 2) not null default 0,
  payroll_cadence text not null default 'none',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint budget_payroll_cadence_chk check (payroll_cadence in ('none', 'monthly', 'biweekly'))
);

create table if not exists public.budget_import_raw (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  account_name text not null,
  txn_date date not null,
  category text not null default '',
  description text not null default '',
  amount numeric(20, 2) not null,
  running_balance numeric(20, 2),
  source text not null,
  source_row integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint budget_import_source_chk check (source in ('archive', 'ffcu', 'sofi')),
  constraint budget_import_row_uniq unique (user_id, source, source_row)
);

comment on table public.budget_import_raw is
  'Staging rows for archived checking history. Promote with apply_budget_import. Does not change checking balances.';

create table if not exists public.budget_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  account_name text not null,
  txn_date date not null,
  category text not null default 'Uncategorized',
  description text not null default '',
  amount numeric(20, 2) not null,
  running_balance numeric(20, 2),
  source text not null,
  source_row integer not null,
  flow_override text,
  category_locked boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint budget_entry_source_chk check (source in ('archive', 'ffcu', 'sofi')),
  constraint budget_entry_flow_chk check (
    flow_override is null or flow_override in (
      'income', 'core_spending', 'taxes', 'debt_payment', 'investment', 'savings',
      'dependent_savings', 'transfer_internal', 'needs_review', 'card_payment', 'adjustment'
    )
  ),
  constraint budget_entry_row_uniq unique (user_id, source, source_row)
);

comment on table public.budget_entries is
  'Archived checking rows for the budget. Excluded from checking balance math. A manual register row with the same account, date, amount, and description wins.';

create table if not exists public.card_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  match_names text[] not null default '{}',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.card_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  card_account_id uuid not null references public.card_accounts (id) on delete cascade,
  txn_date date not null,
  description text not null default '',
  amount numeric(20, 2) not null,
  category text not null default 'Uncategorized',
  flow_override text,
  statement_month date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint card_txn_flow_chk check (
    flow_override is null or flow_override in (
      'income', 'core_spending', 'taxes', 'debt_payment', 'investment', 'savings',
      'dependent_savings', 'transfer_internal', 'needs_review', 'card_payment', 'adjustment'
    )
  )
);

comment on column public.card_transactions.amount is
  'Signed like checking: a charge is negative, a refund or payment credit is positive.';

select public._mpt_protect('public.budget_categories');
select public._mpt_protect('public.budget_targets');
select public._mpt_protect('public.budget_settings');
select public._mpt_protect('public.budget_import_raw');
select public._mpt_protect('public.budget_entries');
select public._mpt_protect('public.card_accounts');
select public._mpt_protect('public.card_transactions');

create index if not exists budget_categories_user_idx on public.budget_categories (user_id);
create index if not exists budget_targets_user_idx on public.budget_targets (user_id);
create index if not exists budget_import_user_idx on public.budget_import_raw (user_id);
create index if not exists budget_entries_user_date_idx on public.budget_entries (user_id, txn_date);
create index if not exists card_accounts_user_idx on public.card_accounts (user_id);
create index if not exists card_txns_user_idx on public.card_transactions (user_id);
create index if not exists card_txns_card_month_idx on public.card_transactions (card_account_id, statement_month);

create or replace function public.apply_budget_import(p_user uuid default null)
returns integer
language plpgsql
as $$
declare
  target uuid := coalesce(p_user, auth.uid());
  changed integer := 0;
begin
  if target is null then
    raise exception 'user id required';
  end if;
  if auth.uid() is not null and target <> auth.uid() then
    raise exception 'cannot import another user''s rows';
  end if;

  insert into public.budget_entries (
    user_id, account_name, txn_date, category, description, amount, running_balance, source, source_row
  )
  select
    r.user_id,
    r.account_name,
    r.txn_date,
    coalesce(nullif(btrim(r.category), ''), 'Uncategorized'),
    coalesce(r.description, ''),
    r.amount,
    r.running_balance,
    r.source,
    r.source_row
  from public.budget_import_raw r
  where r.user_id = target
  on conflict (user_id, source, source_row) do update set
    account_name = excluded.account_name,
    txn_date = excluded.txn_date,
    description = excluded.description,
    amount = excluded.amount,
    running_balance = excluded.running_balance,
    category = case
      when budget_entries.category_locked then budget_entries.category
      else excluded.category
    end;

  get diagnostics changed = row_count;
  return changed;
end;
$$;

create or replace function public.load_budget_import(p_user uuid, p_rows jsonb)
returns integer
language plpgsql
as $$
declare
  target uuid := coalesce(p_user, auth.uid());
begin
  if target is null then
    raise exception 'user id required';
  end if;
  if auth.uid() is not null and target <> auth.uid() then
    raise exception 'cannot import another user''s rows';
  end if;
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    raise exception 'payload must be a JSON array';
  end if;

  insert into public.budget_import_raw (
    user_id, account_name, txn_date, category, description, amount, running_balance, source, source_row
  )
  select
    target,
    x.account_name,
    x.date::date,
    coalesce(x.category, ''),
    coalesce(x.description, ''),
    x.amount,
    x.running_balance,
    x.source,
    x.source_row
  from jsonb_to_recordset(p_rows) as x(
    account_name text,
    date text,
    category text,
    description text,
    amount numeric,
    running_balance numeric,
    source text,
    source_row integer
  )
  on conflict (user_id, source, source_row) do update set
    account_name = excluded.account_name,
    txn_date = excluded.txn_date,
    category = excluded.category,
    description = excluded.description,
    amount = excluded.amount,
    running_balance = excluded.running_balance;

  return public.apply_budget_import(target);
end;
$$;

create or replace function public.seed_budget_defaults(p_user uuid)
returns void
language plpgsql
as $$
begin
  if p_user is null then
    raise exception 'user id required';
  end if;
  if auth.uid() is not null and p_user <> auth.uid() then
    raise exception 'cannot seed another user';
  end if;

  insert into public.budget_categories (user_id, name, flow_type, group_name, budget_monthly, color, sort_order)
  values
    (p_user, 'Income', 'income', 'income', null, '#34d399', 0),
    (p_user, 'Interest', 'income', 'income', null, '#6ee7b7', 1),
    (p_user, 'Monthly Bills', 'core_spending', 'bills', null, '#38bdf8', 2),
    (p_user, 'Auto', 'core_spending', 'bills', null, '#22d3ee', 3),
    (p_user, 'Life Insurance', 'core_spending', 'bills', null, '#818cf8', 4),
    (p_user, 'Insurance', 'core_spending', 'bills', null, '#a78bfa', 5),
    (p_user, 'Childcare', 'core_spending', 'dependents', null, '#f0abfc', 6),
    (p_user, 'Cash', 'core_spending', 'lifestyle', null, '#f5c16c', 7),
    (p_user, 'Withdrawal', 'core_spending', 'lifestyle', null, '#fdba74', 8),
    (p_user, 'Gym', 'core_spending', 'lifestyle', null, '#fb7185', 9),
    (p_user, 'Health', 'core_spending', 'lifestyle', null, '#fda4af', 10),
    (p_user, 'Shopping', 'core_spending', 'lifestyle', 1000, '#e879f9', 11),
    (p_user, 'Food & Groceries', 'core_spending', 'lifestyle', 1100, '#2dd4bf', 12),
    (p_user, 'Gift', 'core_spending', 'lifestyle', null, '#f9a8d4', 13),
    (p_user, 'Petcare', 'core_spending', 'lifestyle', null, '#99f6e4', 14),
    (p_user, 'Fee', 'core_spending', 'other', null, '#94a3b8', 15),
    (p_user, 'Taxes', 'taxes', 'taxes', null, '#f87171', 16),
    (p_user, 'Loan', 'debt_payment', 'debt', null, '#fb923c', 17),
    (p_user, 'Investments', 'investment', 'investments', null, '#67e8f9', 18),
    (p_user, 'Investment Property', 'investment', 'investments', null, '#7dd3fc', 19),
    (p_user, 'Savings', 'savings', 'savings', null, '#5eead4', 20),
    (p_user, 'Emmy', 'needs_review', 'dependents', null, '#c4b5fd', 21),
    (p_user, 'Transfer', 'transfer_internal', 'transfers', null, '#cbd5e1', 22),
    (p_user, 'Credit Card', 'card_payment', 'cards', null, '#f472b6', 23),
    (p_user, 'Check', 'needs_review', 'review', null, '#a8a29e', 24),
    (p_user, 'Adjustment', 'adjustment', 'ignored', null, '#64748b', 25),
    (p_user, 'Uncategorized', 'needs_review', 'review', null, '#94a3b8', 26)
  on conflict (user_id, lower(name)) do nothing;

  insert into public.budget_targets (user_id, label, monthly_amount, category_name, payee)
  values
    (p_user, 'Rent', 2050, 'Monthly Bills', 'Rent'),
    (p_user, 'Cell Phone', 201, null, null),
    (p_user, 'Electricity', 270, 'Monthly Bills', 'SCE'),
    (p_user, 'Gas', 40, 'Monthly Bills', 'Socal Gas'),
    (p_user, 'Renter Insurance', 27.09, 'Insurance', 'Renter'),
    (p_user, 'Internet', 110, 'Monthly Bills', 'Internet'),
    (p_user, 'Car Insurance', 156, 'Insurance', 'Car Insurance'),
    (p_user, 'Food & Groceries', 1100, 'Food & Groceries', null),
    (p_user, 'Shopping', 1000, 'Shopping', null),
    (p_user, 'Golf', 300, null, null),
    (p_user, 'Tennis', 100, null, null),
    (p_user, 'Tutoring/Emmy''s Activities', 150, null, null),
    (p_user, 'Entertainment', 100, null, null),
    (p_user, 'Emmy''s Savings', 500, 'Emmy', 'Emmy''s Savings'),
    (p_user, 'Subscriptions', 180, null, null)
  on conflict (user_id, label) do nothing;

  insert into public.budget_settings (user_id)
  values (p_user)
  on conflict (user_id) do nothing;
end;
$$;

revoke all on function public.apply_budget_import(uuid) from public, anon;
revoke all on function public.load_budget_import(uuid, jsonb) from public, anon;
revoke all on function public.seed_budget_defaults(uuid) from public, anon;
grant execute on function public.apply_budget_import(uuid) to authenticated;
grant execute on function public.load_budget_import(uuid, jsonb) to authenticated;
grant execute on function public.seed_budget_defaults(uuid) to authenticated;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.apply_budget_import(uuid) to service_role;
    grant execute on function public.load_budget_import(uuid, jsonb) to service_role;
    grant execute on function public.seed_budget_defaults(uuid) to service_role;
  end if;
end
$$;

do $$
begin
  if exists (select 1 from auth.users where id = 'b1ec7e4d-f966-4238-9d91-6f3131dac7ac') then
    perform public.seed_budget_defaults('b1ec7e4d-f966-4238-9d91-6f3131dac7ac');
  end if;
end
$$;

drop function if exists public._mpt_protect(regclass);
