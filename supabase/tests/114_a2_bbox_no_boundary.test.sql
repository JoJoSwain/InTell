-- A2 Part 2: groves have no boundary column; pack index uses pack_builds.bbox.
begin;
select plan(4);

select set_config('request.jwt.claim.role', 'service_role', true);

select ok(
  not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'groves'
      and column_name = 'boundary'
  ),
  'groves.boundary column is gone'
);

select lives_ok(
  $$insert into public.groves (
     id, region_id, slug, name, premise, status, pack_version
   ) values (
     'aaaaaaaa-bbbb-4ccc-8ddd-ffffa2140001',
     'aaaaaaaa-bbbb-4ccc-8ddd-000000000001',
     'a2-no-boundary',
     '{"en":"No drawn boundary"}'::jsonb,
     '{}'::jsonb,
     'draft',
     0
   )$$,
  'a grove inserts with no boundary'
);

update public.pack_builds set live = false;

insert into public.pack_builds (
  scope, scope_id, version, manifest_path, manifest_sha256, asset_hashes, bytes_total,
  live, release_id, bbox, opening_lat, opening_lng
) values (
  'grove',
  'aaaaaaaa-bbbb-4ccc-8ddd-000000000010',
  200,
  'packs/grove/test/a2-bbox.json',
  repeat('c', 64),
  '{}',
  3,
  true,
  'aaaaaaaa-bbbb-4ccc-8ddd-0000000000e0',
  array[-111.93, 40.96, -111.91, 40.97]::double precision[],
  40.9612169,
  -111.92895673
);

select ok(
  (
    select (e->'bbox') = '[-111.93, 40.96, -111.91, 40.97]'::jsonb
    from jsonb_array_elements(public.get_pack_index()) e
    where e->>'scope' = 'grove'
      and e->>'id' = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000010'
      and (e->>'version')::int = 200
  ),
  'get_pack_index returns the bbox stored on the live build'
);

select lives_ok(
  $$insert into public.fragments (
     grove_id, tier, title, location, visibility,
     trigger_radius_m, story_order, status
   ) values (
     'aaaaaaaa-bbbb-4ccc-8ddd-ffffa2140001',
     'root',
     '{"en":"anywhere"}'::jsonb,
     extensions.ST_SetSRID(extensions.ST_MakePoint(-112.5, 41.5), 4326)::extensions.geography,
     'standard',
     10.67,
     1,
     'draft'
   )$$,
  'a fragment insert does not check a grove polygon'
);

select * from finish();
rollback;
