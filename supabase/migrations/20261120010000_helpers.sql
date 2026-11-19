-- MPT schema helpers. Safe to re-run.
-- auth.users and auth.uid() already exist on Supabase. Do not replace them.

create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
end
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.set_updated_at() from public;
grant execute on function public.set_updated_at() to authenticated;

-- Migration-only helper. Dropped in the final migration so it is not left in the API.
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
