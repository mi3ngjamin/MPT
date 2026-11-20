-- Proves RLS, grants, and auth.uid() defaults against the local stub.
insert into auth.users (id) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb')
on conflict (id) do nothing;

grant usage on schema auth to authenticated;
grant execute on function auth.uid() to authenticated;

do $$
declare
  missing int;
begin
  select count(*) into missing
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind = 'r'
    and c.relname in (
      'portfolios', 'accounts', 'activities', 'tax_lots', 'quotes', 'what_if_prices',
      'price_scenarios', 'price_scenario_prices', 'modeled_buys', 'checking_accounts',
      'checking_transactions', 'recurring_items', 'recurring_occurrences', 'liabilities',
      'net_worth_snapshots', 'preferences',
      'budget_categories', 'budget_targets', 'budget_settings', 'budget_import_raw',
      'budget_entries', 'card_accounts', 'card_transactions'
    )
    and c.relrowsecurity is not true;
  if missing <> 0 then
    raise exception 'RLS is not enabled on every MPT table';
  end if;
  if exists (
    select 1 from information_schema.role_table_grants
    where grantee = 'anon' and table_schema = 'public'
      and privilege_type in ('SELECT', 'INSERT', 'UPDATE', 'DELETE')
  ) then
    raise exception 'anon still has table privileges';
  end if;
  if to_regprocedure('public._mpt_protect(regclass)') is not null then
    raise exception 'migration helper was not dropped';
  end if;
end
$$;

select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', false);
set role authenticated;

insert into public.portfolios (name, include_in_net_worth)
values ('Primary', true);

do $$
begin
  begin
    insert into public.portfolios (user_id, name)
    values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Spoof');
    raise exception 'spoof insert was allowed';
  exception
    when insufficient_privilege then
      null;
  end;
end
$$;

do $$
declare
  seen int;
  owner uuid;
begin
  select count(*) into seen from public.portfolios;
  select user_id into owner from public.portfolios limit 1;
  if seen <> 1 or owner <> 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' then
    raise exception 'owner insert or select failed: % %', seen, owner;
  end if;
end
$$;

reset role;
select set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', false);
set role authenticated;

do $$
declare
  seen int;
begin
  select count(*) into seen from public.portfolios;
  if seen <> 0 then
    raise exception 'another user can read portfolios';
  end if;
  update public.portfolios set name = 'hacked';
  delete from public.portfolios;
end
$$;

reset role;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', false);

do $$
declare
  seen int;
begin
  set role authenticated;
  select count(*) into seen from public.portfolios;
  if seen <> 1 then
    raise exception 'owner lost or gained a portfolio during the cross-user attempt';
  end if;
  reset role;
end
$$;

set role anon;
do $$
begin
  begin
    perform 1 from public.portfolios;
    raise exception 'anon was able to read portfolios';
  exception
    when insufficient_privilege then
      null;
  end;
  if has_function_privilege('anon', 'public.apply_budget_import(uuid)', 'execute') then
    raise exception 'anon can execute budget import';
  end if;
  if has_function_privilege('anon', 'public.load_budget_import(uuid, jsonb)', 'execute') then
    raise exception 'anon can load budget history';
  end if;
end
$$;
reset role;

select set_config('request.jwt.claim.sub', '', false);

insert into auth.users (id) values ('b1ec7e4d-f966-4238-9d91-6f3131dac7ac')
on conflict (id) do nothing;

select public.seed_budget_defaults('b1ec7e4d-f966-4238-9d91-6f3131dac7ac');
select public.seed_budget_defaults('b1ec7e4d-f966-4238-9d91-6f3131dac7ac');

do $$
declare
  categories int;
  targets int;
begin
  select count(*) into categories from public.budget_categories
    where user_id = 'b1ec7e4d-f966-4238-9d91-6f3131dac7ac';
  select count(*) into targets from public.budget_targets
    where user_id = 'b1ec7e4d-f966-4238-9d91-6f3131dac7ac';
  if categories <> 27 or targets <> 15 then
    raise exception 'budget defaults did not seed once: % categories, % targets', categories, targets;
  end if;
end
$$;

insert into public.checking_accounts (id, user_id, name, opening_balance, opening_date)
values
  ('11111111-1111-1111-1111-111111111111', 'b1ec7e4d-f966-4238-9d91-6f3131dac7ac', 'FFCU Checking', 2050.00, '2026-01-15'),
  ('22222222-2222-2222-2222-222222222222', 'b1ec7e4d-f966-4238-9d91-6f3131dac7ac', 'SoFi Checking', 2110.86, '2026-01-15');

select public.load_budget_import(
  'b1ec7e4d-f966-4238-9d91-6f3131dac7ac',
  '[
    {"account_name":"FFCU Checking","date":"2019-07-01","category":"Monthly Bills","description":"Rent","amount":-2050,"running_balance":4100,"source":"archive","source_row":1},
    {"account_name":"SoFi Checking","date":"2025-12-01","category":"Income","description":"Paycheck","amount":100,"source":"sofi","source_row":2}
  ]'::jsonb
);

select public.load_budget_import(
  'b1ec7e4d-f966-4238-9d91-6f3131dac7ac',
  '[
    {"account_name":"FFCU Checking","date":"2019-07-01","category":"Monthly Bills","description":"Rent","amount":-2050,"running_balance":4100,"source":"archive","source_row":1},
    {"account_name":"FFCU Checking","date":"2026-02-01","category":"Shopping","description":"After opening","amount":-40,"source":"ffcu","source_row":9}
  ]'::jsonb
);

do $$
declare
  entries int;
  txns int;
  ffcu numeric;
  sofi numeric;
begin
  select count(*) into entries from public.budget_entries
    where user_id = 'b1ec7e4d-f966-4238-9d91-6f3131dac7ac';
  select count(*) into txns from public.checking_transactions
    where user_id = 'b1ec7e4d-f966-4238-9d91-6f3131dac7ac';
  select opening_balance into ffcu from public.checking_accounts where id = '11111111-1111-1111-1111-111111111111';
  select opening_balance into sofi from public.checking_accounts where id = '22222222-2222-2222-2222-222222222222';
  if entries <> 3 or txns <> 0 or ffcu <> 2050.00 or sofi <> 2110.86 then
    raise exception 'import changed balances or duplicated rows: entries % txns % ffcu % sofi %', entries, txns, ffcu, sofi;
  end if;
end
$$;
