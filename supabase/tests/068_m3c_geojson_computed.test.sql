-- C1: boundary_geojson / location_geojson return GeoJSON for staff; nothing for anon.
begin;
select plan(5);

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('bbbbbbbb-bbbb-4ccc-8ddd-680000000001','authenticated','authenticated','m3c-geo-editor@test.local',crypt('x',gen_salt('bf')),now(),'{}','{}',now(),now());

insert into public.staff (user_id, display_name, role, active) values
  ('bbbbbbbb-bbbb-4ccc-8ddd-680000000001', 'M3c Geo Editor', 'editor', true);

select set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-4ccc-8ddd-680000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select ok(
  (
    select (public.boundary_geojson(g)->>'type') = 'Polygon'
    from public.groves g
    where g.id = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000010'
  ),
  'staff boundary_geojson returns Polygon GeoJSON'
);

select ok(
  (
    select (public.location_geojson(f)->>'type') = 'Point'
      and jsonb_array_length(public.location_geojson(f)->'coordinates') = 2
    from public.fragments f
    where f.id = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000030'
  ),
  'staff location_geojson returns Point GeoJSON'
);

reset role;

-- anon: no EXECUTE on computed helpers; no row access via RLS
select ok(
  not has_function_privilege(
    'anon',
    'public.boundary_geojson(public.groves)'::regprocedure,
    'EXECUTE'
  ),
  'anon cannot execute boundary_geojson'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.location_geojson(public.fragments)'::regprocedure,
    'EXECUTE'
  ),
  'anon cannot execute location_geojson'
);

select ok(
  not has_table_privilege('anon', 'public.groves', 'SELECT'),
  'anon has no SELECT on groves (computed column returns nothing)'
);

select * from finish();
rollback;
