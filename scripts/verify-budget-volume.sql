-- Seed ~2,300 archived checking rows and prove trailing-12 income is $117,600.
-- The first 1,000 rows by date contain none of that income, which is the PostgREST page bug.
-- Local only. Does not change a hosted project.

insert into auth.users (id) values ('b1ec7e4d-f966-4238-9d91-6f3131dac7ac')
on conflict (id) do nothing;

insert into public.checking_accounts (id, user_id, name, opening_balance, opening_date)
values
  ('11111111-1111-1111-1111-111111111111', 'b1ec7e4d-f966-4238-9d91-6f3131dac7ac', 'FFCU Checking', 2050.00, '2026-01-15'),
  ('22222222-2222-2222-2222-222222222222', 'b1ec7e4d-f966-4238-9d91-6f3131dac7ac', 'SoFi Checking', 2110.86, '2026-01-15')
on conflict (id) do nothing;

delete from public.budget_entries
where user_id = 'b1ec7e4d-f966-4238-9d91-6f3131dac7ac' and source = 'archive';

insert into public.budget_entries (user_id, account_name, txn_date, category, description, amount, source, source_row)
select
  'b1ec7e4d-f966-4238-9d91-6f3131dac7ac',
  case when n % 2 = 0 then 'FFCU Checking' else 'SoFi Checking' end,
  date '2019-07-24' + (n % 2200),
  'Shopping',
  'Old',
  -12,
  'archive',
  n
from generate_series(1, 2063) as n;

insert into public.budget_entries (user_id, account_name, txn_date, category, description, amount, source, source_row)
select
  'b1ec7e4d-f966-4238-9d91-6f3131dac7ac',
  'FFCU Checking',
  (date '2025-12-01' + (m || ' months')::interval)::date,
  'Income',
  'Paycheck',
  4900,
  'archive',
  30000 + m
from generate_series(0, 11) as m;

insert into public.budget_entries (user_id, account_name, txn_date, category, description, amount, source, source_row)
select
  'b1ec7e4d-f966-4238-9d91-6f3131dac7ac',
  'SoFi Checking',
  case
    when (date '2025-12-01' + (m || ' months')::interval)::date = date '2026-11-01' then date '2026-11-13'
    else (date '2025-12-01' + (m || ' months')::interval)::date + 14
  end,
  'Income',
  'Paycheck',
  4900,
  'archive',
  31000 + m
from generate_series(0, 11) as m;

insert into public.budget_entries (user_id, account_name, txn_date, category, description, amount, source, source_row)
select
  'b1ec7e4d-f966-4238-9d91-6f3131dac7ac',
  'FFCU Checking',
  (date '2025-12-01' + (m || ' months')::interval)::date + 1,
  'Monthly Bills',
  'Rent',
  -2050,
  'archive',
  40000 + m
from generate_series(0, 11) as m;

insert into public.budget_entries (user_id, account_name, txn_date, category, description, amount, source, source_row)
select
  'b1ec7e4d-f966-4238-9d91-6f3131dac7ac',
  'FFCU Checking',
  (date '2025-12-01' + ((n % 12) || ' months')::interval)::date + (n % 12),
  case
    when n <= 49 then 'Emmy'
    when n <= 54 then 'Check'
    when n <= 70 then 'Transfer'
    else 'Shopping'
  end,
  case when n <= 70 and n > 54 then 'Venmo' else 'Store' end,
  -20,
  'archive',
  50000 + n
from generate_series(1, 177) as n;

do $$
declare
  total int;
  recent int;
  income numeric;
  oldest_income numeric;
  ffcu numeric;
  sofi numeric;
begin
  select count(*) into total
  from public.budget_entries
  where user_id = 'b1ec7e4d-f966-4238-9d91-6f3131dac7ac';

  select count(*) into recent
  from public.budget_entries
  where user_id = 'b1ec7e4d-f966-4238-9d91-6f3131dac7ac'
    and txn_date >= date '2025-12-01'
    and txn_date <= date '2026-11-13';

  select coalesce(sum(amount), 0) into income
  from public.budget_entries
  where user_id = 'b1ec7e4d-f966-4238-9d91-6f3131dac7ac'
    and category = 'Income'
    and txn_date >= date '2025-12-01'
    and txn_date <= date '2026-11-20';

  select coalesce(sum(amount), 0) into oldest_income
  from (
    select amount, category, txn_date
    from public.budget_entries
    where user_id = 'b1ec7e4d-f966-4238-9d91-6f3131dac7ac'
    order by txn_date, source_row
    limit 1000
  ) page
  where category = 'Income' and txn_date >= date '2025-12-01';

  select opening_balance into ffcu from public.checking_accounts where id = '11111111-1111-1111-1111-111111111111';
  select opening_balance into sofi from public.checking_accounts where id = '22222222-2222-2222-2222-222222222222';

  if total <> 2276 or recent <> 213 or income <> 117600 or oldest_income <> 0 or ffcu <> 2050 or sofi <> 2110.86 then
    raise exception 'budget volume check failed: total % recent % income % oldest % ffcu % sofi %',
      total, recent, income, oldest_income, ffcu, sofi;
  end if;
end
$$;
