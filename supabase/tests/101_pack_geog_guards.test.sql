-- S1: fn_pack_geog_geojson service_role only; protected → null
begin;
select plan(6);

-- anon cannot execute
set local role anon;
select throws_ok(
  $$select public.fn_pack_geog_geojson(
      'fragment_point',
      'aaaaaaaa-bbbb-4ccc-8ddd-000000000038'::uuid
    )$$,
  '42501',
  null,
  'anon cannot execute fn_pack_geog_geojson'
);
reset role;

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('bbbbbbbb-bbbb-4ccc-8ddd-510000000001','authenticated','authenticated','geog-nostaff@test.local',crypt('x',gen_salt('bf')),now(),'{}','{}',now(),now()),
  ('bbbbbbbb-bbbb-4ccc-8ddd-510000000002','authenticated','authenticated','geog-viewer@test.local',crypt('x',gen_salt('bf')),now(),'{}','{}',now(),now()),
  ('bbbbbbbb-bbbb-4ccc-8ddd-510000000003','authenticated','authenticated','geog-writer@test.local',crypt('x',gen_salt('bf')),now(),'{}','{}',now(),now());

insert into public.staff (user_id, display_name, role, active) values
  ('bbbbbbbb-bbbb-4ccc-8ddd-510000000002', 'Geog Viewer', 'viewer', true),
  ('bbbbbbbb-bbbb-4ccc-8ddd-510000000003', 'Geog Writer', 'writer', true);

-- authenticated non-staff
select set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-4ccc-8ddd-510000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;
select throws_ok(
  $$select public.fn_pack_geog_geojson(
      'fragment_point',
      'aaaaaaaa-bbbb-4ccc-8ddd-000000000038'::uuid
    )$$,
  '42501',
  null,
  'authenticated non-staff cannot execute fn_pack_geog_geojson'
);
reset role;

-- viewer
select set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-4ccc-8ddd-510000000002', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;
select throws_ok(
  $$select public.fn_pack_geog_geojson(
      'fragment_point',
      'aaaaaaaa-bbbb-4ccc-8ddd-000000000038'::uuid
    )$$,
  '42501',
  null,
  'viewer cannot execute fn_pack_geog_geojson'
);
reset role;

-- writer
select set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-4ccc-8ddd-510000000003', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;
select throws_ok(
  $$select public.fn_pack_geog_geojson(
      'fragment_point',
      'aaaaaaaa-bbbb-4ccc-8ddd-000000000038'::uuid
    )$$,
  '42501',
  null,
  'writer cannot execute fn_pack_geog_geojson'
);
reset role;

-- service_role: frag9 protected → null
select set_config('request.jwt.claim.role', 'service_role', true);
set local role service_role;
select is(
  public.fn_pack_geog_geojson(
    'fragment_point',
    'aaaaaaaa-bbbb-4ccc-8ddd-000000000038'::uuid
  ),
  null::jsonb,
  'service_role gets null for protected frag9'
);
reset role;

-- service_role: non-protected fragment still returns geojson
select set_config('request.jwt.claim.role', 'service_role', true);
set local role service_role;
select ok(
  public.fn_pack_geog_geojson(
    'fragment_point',
    'aaaaaaaa-bbbb-4ccc-8ddd-000000000030'::uuid
  ) is not null,
  'service_role gets geojson for non-protected fragment'
);
reset role;

select * from finish();
rollback;
