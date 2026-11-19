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
      'net_worth_snapshots', 'preferences'
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
end
$$;
reset role;
