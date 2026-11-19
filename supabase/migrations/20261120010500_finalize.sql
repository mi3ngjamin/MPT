-- Schema usage for the signed-in role, then remove the migration helper.
grant usage on schema public to authenticated;

drop function if exists public._mpt_protect(regclass);
