-- A1: device rate limit and register-device upsert. anon stays closed.
begin;
select plan(9);

select ok(
  (
    select bool_and(public.fn_device_rate_allow(
      '22222222-2222-4222-8222-222222222222'::uuid,
      'register-device',
      30,
      3600
    ))
    from generate_series(1, 30)
  ),
  'thirty calls in the window are allowed'
);

select ok(
  not public.fn_device_rate_allow(
    '22222222-2222-4222-8222-222222222222'::uuid,
    'register-device',
    30,
    3600
  ),
  'the thirty-first call in the window is refused'
);

select ok(
  public.fn_device_rate_allow(
    '33333333-3333-4333-8333-333333333333'::uuid,
    'register-device',
    30,
    3600
  ),
  'a different device has its own window'
);

select ok(
  public.fn_device_rate_allow(
    '22222222-2222-4222-8222-222222222222'::uuid,
    'other-endpoint',
    30,
    3600
  ),
  'a different endpoint has its own window'
);

create temp table a1_seen (first_seen timestamptz);

insert into a1_seen (first_seen)
select public.fn_register_device(
  '11111111-1111-4111-8111-111111111111'::uuid,
  'ios',
  '1.0.0',
  'en'::public.lang,
  '18_plus',
  true
);

select is(
  (select first_seen from a1_seen),
  (
    select first_seen_at
    from public.devices
    where id = '11111111-1111-4111-8111-111111111111'::uuid
  ),
  'register returns first_seen_at'
);

select is(
  (
    select public.fn_register_device(
      '11111111-1111-4111-8111-111111111111'::uuid,
      'android',
      '2.0.0',
      'es'::public.lang,
      null,
      false
    )
  ),
  (select first_seen from a1_seen),
  're-register keeps first_seen_at'
);

select results_eq(
  $$
    select platform, app_version, ui_language::text, age_gate
    from public.devices
    where id = '11111111-1111-4111-8111-111111111111'::uuid
  $$,
  $$ values ('android'::text, '2.0.0'::text, 'es'::text, '18_plus'::text) $$,
  're-register updates platform, version and language, and leaves age_gate'
);

select ok(
  (
    select coalesce(bool_and(
      not has_table_privilege('anon', c.oid, 'SELECT')
      and not has_table_privilege('anon', c.oid, 'INSERT')
      and not has_table_privilege('authenticated', c.oid, 'SELECT')
    ), false)
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'device_rate_limits'
  ),
  'anon and authenticated have no read or insert on device_rate_limits'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.fn_device_rate_allow(uuid, text, integer, integer)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'authenticated',
    'public.fn_device_rate_allow(uuid, text, integer, integer)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'anon',
    'public.fn_register_device(uuid, text, text, public.lang, text, boolean)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'authenticated',
    'public.fn_register_device(uuid, text, text, public.lang, text, boolean)',
    'EXECUTE'
  )
  and has_function_privilege(
    'service_role',
    'public.fn_device_rate_allow(uuid, text, integer, integer)',
    'EXECUTE'
  )
  and has_function_privilege(
    'service_role',
    'public.fn_register_device(uuid, text, text, public.lang, text, boolean)',
    'EXECUTE'
  ),
  'only service_role may execute the register-device helpers'
);

select * from finish();
rollback;
