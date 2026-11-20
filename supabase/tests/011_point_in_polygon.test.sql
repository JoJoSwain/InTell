-- C17: geography ST_Covers — outside fails; vertex / inside succeed (Farmington).
begin;
select plan(3);

-- clearly outside: translate centroid ~2 km north
select throws_ok(
  $$insert into public.fragments (
     grove_id, tier, title, location, visibility,
     trigger_radius_m, story_order, status
   ) values (
     'aaaaaaaa-bbbb-4ccc-8ddd-000000000010',
     'branch',
     '{"en":"outside"}'::jsonb,
     (
       select extensions.ST_Translate(
                extensions.ST_Centroid(boundary::geometry), 0, 0.02
              )::extensions.geography
       from public.groves
       where id = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000010'
     ),
     'standard',
     10.67,
     90,
     'draft'
   )$$,
  'P0001',
  'fragment location must be inside grove boundary',
  'point outside boundary fails'
);

-- first exterior-ring vertex of Farmington grove
select lives_ok(
  $$insert into public.fragments (
     grove_id, tier, title, location, visibility,
     trigger_radius_m, story_order, status
   ) values (
     'aaaaaaaa-bbbb-4ccc-8ddd-000000000010',
     'branch',
     '{"en":"vertex"}'::jsonb,
     (
       select extensions.ST_PointN(
                extensions.ST_ExteriorRing(boundary::geometry), 1
              )::extensions.geography
       from public.groves
       where id = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000010'
     ),
     'standard',
     10.67,
     91,
     'draft'
   )$$,
  'point on boundary vertex succeeds'
);

-- interior centroid
select lives_ok(
  $$insert into public.fragments (
     grove_id, tier, title, location, visibility,
     trigger_radius_m, story_order, status
   ) values (
     'aaaaaaaa-bbbb-4ccc-8ddd-000000000010',
     'branch',
     '{"en":"inside"}'::jsonb,
     (
       select extensions.ST_Centroid(boundary)::extensions.geography
       from public.groves
       where id = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000010'
     ),
     'standard',
     10.67,
     92,
     'draft'
   )$$,
  'point inside boundary succeeds'
);

select * from finish();
rollback;