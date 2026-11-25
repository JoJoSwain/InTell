-- M11 / A7 step 3: events RLS — anon denied; non-staff sees nothing; staff can select.
begin;
select plan(5);

select ok(
  not has_table_privilege('anon', 'public.events', 'SELECT'),
  'anon cannot SELECT events'
);

select ok(
  not has_table_privilege('anon', 'public.events', 'INSERT'),
  'anon cannot INSERT events'
);

select has_column('public', 'events', 'schema_version', 'events.schema_version exists');

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  (
    'bbbbbbbb-bbbb-4ccc-8ddd-210000000001',
    'authenticated', 'authenticated', 'nostaff-events@test.local',
    crypt('x', gen_salt('bf')), now(), '{}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    'bbbbbbbb-bbbb-4ccc-8ddd-210000000002',
    'authenticated', 'authenticated', 'viewer-events@test.local',
    crypt('x', gen_salt('bf')), now(), '{}'::jsonb, '{}'::jsonb, now(), now()
  );

insert into public.staff (user_id, display_name, role, active)
values (
  'bbbbbbbb-bbbb-4ccc-8ddd-210000000002',
  'Viewer',
  'viewer',
  true
);

insert into public.devices (id, platform, app_version, ui_language)
values (
  '11111111-1111-4111-8111-210000000001',
  'ios',
  '1.0.0',
  'en'
);

insert into public.events (
  device_id, client_event_id, name, occurred_at, props, schema_version
) values (
  '11111111-1111-4111-8111-210000000001',
  'aaaaaaaa-bbbb-4ccc-8ddd-210000000010',
  'app_opened',
  '2026-06-15T18:00:00+00',
  '{}'::jsonb,
  1
);

select set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-4ccc-8ddd-210000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select is(
  (select count(*)::int from public.events),
  0,
  'authenticated with no staff cannot select events'
);

reset role;

select set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-4ccc-8ddd-210000000002', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select is(
  (select count(*)::int from public.events where name = 'app_opened'),
  1,
  'viewer staff can select events'
);

reset role;

select * from finish();
rollback;
