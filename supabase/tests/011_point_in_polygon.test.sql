-- C17: geography ST_Covers — ~1 m outside fails; vertex / inside succeed.
begin;
select plan(3);

-- ~1 m south of the southern edge (lat 40.8985); 1 m ≈ 9e-6 deg
select throws_ok(
  $$insert into public.fragments (
     grove_id, tier, parent_id, title, location, visibility,
     trigger_radius_m, story_order, status
   ) values (
     'aaaaaaaa-bbbb-4ccc-8ddd-000000000010',
     'branch',
     'aaaaaaaa-bbbb-4ccc-8ddd-000000000030',
     '{"en":"outside"}'::jsonb,
     extensions.ST_GeogFromText('SRID=4326;POINT(-111.9000 40.898491)'),
     'marked',
     25,
     90,
     'draft'
   )$$,
  'P0001',
  'fragment location must be inside grove boundary',
  'point ~1m outside boundary fails'
);

-- exact southwest vertex of demo park polygon
select lives_ok(
  $$insert into public.fragments (
     grove_id, tier, parent_id, title, location, visibility,
     trigger_radius_m, story_order, status
   ) values (
     'aaaaaaaa-bbbb-4ccc-8ddd-000000000010',
     'branch',
     'aaaaaaaa-bbbb-4ccc-8ddd-000000000030',
     '{"en":"vertex"}'::jsonb,
     extensions.ST_GeogFromText('SRID=4326;POINT(-111.9015 40.8985)'),
     'marked',
     25,
     91,
     'draft'
   )$$,
  'point on boundary vertex succeeds'
);

-- interior center
select lives_ok(
  $$insert into public.fragments (
     grove_id, tier, parent_id, title, location, visibility,
     trigger_radius_m, story_order, status
   ) values (
     'aaaaaaaa-bbbb-4ccc-8ddd-000000000010',
     'branch',
     'aaaaaaaa-bbbb-4ccc-8ddd-000000000030',
     '{"en":"inside"}'::jsonb,
     extensions.ST_GeogFromText('SRID=4326;POINT(-111.9000 40.9000)'),
     'marked',
     25,
     92,
     'draft'
   )$$,
  'point inside boundary succeeds'
);

select * from finish();
rollback;
