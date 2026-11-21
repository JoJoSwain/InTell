-- M3g: service_role has SIDU on every public table/view and EXECUTE on every
-- public function. anon/authenticated table + definer-execute surface unchanged
-- (110_definer_grants still owns the definer allowlist).
begin;
select plan(4);

select is(
  (
    select coalesce(array_agg(miss order by miss), '{}'::text[])
    from (
      select format(
        '%s.%s missing %s',
        n.nspname,
        c.relname,
        priv
      ) as miss
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      cross join (values ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE')) as p(priv)
      where n.nspname = 'public'
        and c.relkind in ('r', 'p', 'v', 'm')
        and not has_table_privilege('service_role', c.oid, priv)
    ) s
  ),
  '{}'::text[],
  'service_role has SELECT/INSERT/UPDATE/DELETE on every public table and view'
);

select is(
  (
    select coalesce(array_agg(miss order by miss), '{}'::text[])
    from (
      select format(
        '%s(%s) missing EXECUTE',
        p.proname,
        pg_get_function_identity_arguments(p.oid)
      ) as miss
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.prokind = 'f'
        and not has_function_privilege('service_role', p.oid, 'EXECUTE')
    ) s
  ),
  '{}'::text[],
  'service_role has EXECUTE on every public function'
);

-- anon still has no table SELECT (unchanged by M3g; matches 060 spirit).
select ok(
  (
    select coalesce(bool_and(not has_table_privilege('anon', c.oid, 'SELECT')), true)
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'p', 'v', 'm')
  ),
  'anon still has no SELECT on public tables/views after M3g'
);

-- authenticated keeps selective grants (staff RLS); M3g must not give it
-- EXECUTE on every public function the way service_role gets.
select ok(
  (
    select count(*) > 0
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prokind = 'f'
      and not has_function_privilege('authenticated', p.oid, 'EXECUTE')
  ),
  'authenticated does not have blanket EXECUTE on every public function'
);

select * from finish();
rollback;
