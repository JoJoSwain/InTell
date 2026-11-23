-- C1: location_geojson returns GeoJSON for staff; anon has no EXECUTE.
-- A2 dropped boundary_geojson with groves.boundary.
begin;
select plan(2);

select ok(
  (
    select (public.location_geojson(f)->>'type') = 'Point'
    from public.fragments f
    where f.id = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000030'
  ),
  'staff location_geojson returns Point GeoJSON'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.location_geojson(public.fragments)'::regprocedure,
    'EXECUTE'
  ),
  'anon cannot execute location_geojson'
);

select * from finish();
rollback;
