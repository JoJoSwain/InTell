-- M3g: explicit service_role grants for hosted projects created after
-- Supabase's May 2026 secure-by-default change (no API-role default privileges).
-- Restores what service_role had locally under auto_expose_new_tables=true.
-- Does not change anon or authenticated grants.

grant usage on schema public to service_role;
grant select, insert, update, delete on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;

alter default privileges for role postgres in schema public
  grant select, insert, update, delete on tables to service_role;
alter default privileges for role postgres in schema public
  grant usage, select on sequences to service_role;
alter default privileges for role postgres in schema public
  grant execute on functions to service_role;
