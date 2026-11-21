-- M3e: journey_mode enum, grove_journeys RLS (viewer refuse / writer allow), B1 split
begin;
select plan(6);

select is(
  (
    select array_agg(e::text order by e::text)
    from unnest(enum_range(null::public.journey_mode)) e
  ),
  array['bike', 'transit', 'walk']::text[],
  'journey_mode is walk/bike/transit only (no drive)'
);

select ok(
  not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'groves' and column_name = 'access_notes'
  ),
  'groves.access_notes is gone'
);

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('bbbbbbbb-bbbb-4ccc-8ddd-400000000001','authenticated','authenticated','m3e-viewer@test.local',crypt('x',gen_salt('bf')),now(),'{}','{}',now(),now()),
  ('bbbbbbbb-bbbb-4ccc-8ddd-400000000002','authenticated','authenticated','m3e-writer@test.local',crypt('x',gen_salt('bf')),now(),'{}','{}',now(),now());

insert into public.staff (user_id, display_name, role, active) values
  ('bbbbbbbb-bbbb-4ccc-8ddd-400000000001', 'M3e Viewer', 'viewer', true),
  ('bbbbbbbb-bbbb-4ccc-8ddd-400000000002', 'M3e Writer', 'writer', true);

-- viewer cannot insert
select set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-4ccc-8ddd-400000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select throws_ok(
  $$insert into public.grove_journeys (grove_id, mode, passage)
    values ('aaaaaaaa-bbbb-4ccc-8ddd-0000000000c0', 'walk', '{"en":"viewer"}'::jsonb)$$,
  '42501',
  null,
  'viewer cannot insert grove_journeys'
);

reset role;

-- writer can upsert on nearby grove
select set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-4ccc-8ddd-400000000002', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select lives_ok(
  $$insert into public.grove_journeys (grove_id, mode, passage)
    values ('aaaaaaaa-bbbb-4ccc-8ddd-0000000000c0', 'walk', '{"en":"TEST writer walk"}'::jsonb)
    on conflict (grove_id, mode) do update set passage = excluded.passage$$,
  'writer can upsert grove_journeys'
);

reset role;

select is(
  (
    select count(*)::int
    from pg_policies
    where schemaname = 'public'
      and tablename = 'grove_journeys'
      and cmd = 'ALL'
  ),
  0,
  'grove_journeys has no for-all policy (B1 split)'
);

select ok(
  exists (
    select 1 from public.grove_journeys
    where grove_id = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000010'
      and mode = 'walk'
  ),
  'Farmington seed has a walk journey'
);

select * from finish();
rollback;
