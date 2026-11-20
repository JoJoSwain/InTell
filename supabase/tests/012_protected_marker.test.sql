-- protected visibility requires marker_code.
begin;
select plan(1);

select throws_ok(
  $$insert into public.fragments (
     grove_id, tier, parent_id, title, location, visibility,
     trigger_radius_m, marker_code, story_order, status
   ) values (
     'aaaaaaaa-bbbb-4ccc-8ddd-000000000010',
     'leaf',
     'aaaaaaaa-bbbb-4ccc-8ddd-000000000031',
     '{"en":"no code"}'::jsonb,
     extensions.ST_GeogFromText('SRID=4326;POINT(-111.9000 40.9000)'),
     'protected',
     25,
     null,
     93,
     'draft'
   )$$,
  '23514',
  'new row for relation "fragments" violates check constraint "protected_requires_marker_code"',
  'protected without marker_code fails'
);

select * from finish();
rollback;
