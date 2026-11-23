-- A2: fragment locations are not checked against a drawn grove polygon.
begin;
select plan(2);

select lives_ok(
  $$insert into public.fragments (
     grove_id, tier, title, location, visibility,
     trigger_radius_m, story_order, status
   ) values (
     'aaaaaaaa-bbbb-4ccc-8ddd-000000000010',
     'branch',
     '{"en":"far away"}'::jsonb,
     extensions.ST_SetSRID(extensions.ST_MakePoint(-110.0, 42.0), 4326)::extensions.geography,
     'standard',
     10.67,
     90,
     'draft'
   )$$,
  'a fragment far from the grove still inserts'
);

select lives_ok(
  $$insert into public.fragments (
     grove_id, tier, title, location, visibility,
     trigger_radius_m, story_order, status
   ) values (
     'aaaaaaaa-bbbb-4ccc-8ddd-000000000010',
     'branch',
     '{"en":"near"}'::jsonb,
     extensions.ST_SetSRID(extensions.ST_MakePoint(-111.92895673, 40.9612169), 4326)::extensions.geography,
     'standard',
     10.67,
     91,
     'draft'
   )$$,
  'a fragment near the seed root still inserts'
);

select * from finish();
rollback;
