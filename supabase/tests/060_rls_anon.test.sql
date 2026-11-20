-- R1: anon has no table/function privileges; no-staff authenticated sees nothing.
begin;
select plan(4);

select ok(
  (
    select coalesce(bool_and(not has_table_privilege('anon', c.oid, 'SELECT')), true)
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'p')
  ),
  'anon has SELECT=false on every public table'
);

select ok(
  (
    select coalesce(bool_and(not has_function_privilege('anon', p.oid, 'EXECUTE')), true)
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prokind = 'f'
  ),
  'anon has EXECUTE=false on every public function'
);

-- authenticated user with no staff row
insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  'bbbbbbbb-bbbb-4ccc-8ddd-100000000001',
  'authenticated', 'authenticated', 'nostaff@test.local',
  crypt('x', gen_salt('bf')), now(), '{}'::jsonb, '{}'::jsonb, now(), now()
);

select set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-4ccc-8ddd-100000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select is(
  (select count(*)::int from public.regions),
  0,
  'authenticated with no staff cannot select regions'
);

select is(
  (select count(*)::int from public.groves),
  0,
  'authenticated with no staff cannot select groves'
);

reset role;

select * from finish();
rollback;
