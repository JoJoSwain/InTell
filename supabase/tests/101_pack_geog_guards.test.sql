-- S1: fn_pack_geog_geojson service_role only; physical fragments return GeoJSON points.
begin;
select plan(5);

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
) values (
  'bbbbbbbb-bbbb-4ccc-8ddd-510000000003',
  'authenticated', 'authenticated', 'geog-writer@test.local',
  crypt('x', gen_salt('bf')), now(), '{}'::jsonb, '{}'::jsonb, now(), now()
);

insert into public.staff (user_id, display_name, role, active) values
  ('bbbbbbbb-bbbb-4ccc-8ddd-510000000003', 'Geog Writer', 'writer', true);

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
  'authenticated staff cannot execute fn_pack_geog_geojson'
);
reset role;

select set_config('request.jwt.claim.role', 'service_role', true);
set local role service_role;

select ok(
  public.fn_pack_geog_geojson(
    'fragment_point',
    'aaaaaaaa-bbbb-4ccc-8ddd-000000000038'::uuid
  ) is not null,
  'service_role gets geojson for physical frag9'
);

select ok(
  public.fn_pack_geog_geojson(
    'region_sun',
    'aaaaaaaa-bbbb-4ccc-8ddd-000000000001'::uuid
  ) is not null,
  'service_role gets region_sun geojson'
);

select ok(
  (public.fn_pack_geog_geojson(
    'fragment_point',
    'aaaaaaaa-bbbb-4ccc-8ddd-000000000038'::uuid
  )->>'type') = 'Point',
  'physical fragment geojson is a Point'
);

reset role;

select * from finish();
rollback;