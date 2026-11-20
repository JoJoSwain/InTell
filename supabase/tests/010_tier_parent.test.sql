-- tier_parent check + fn_fragment_guard parent-tier rules.
begin;
select plan(2);

-- leaf with root parent: guard rejects (leaf parent must be branch)
select throws_ok(
  $$insert into public.fragments (
     grove_id, tier, parent_id, title, location, visibility,
     trigger_radius_m, story_order, status
   ) values (
     'aaaaaaaa-bbbb-4ccc-8ddd-000000000010',
     'leaf',
     'aaaaaaaa-bbbb-4ccc-8ddd-000000000030',
     '{"en":"bad leaf"}'::jsonb,
     extensions.ST_GeogFromText('SRID=4326;POINT(-111.9000 40.9000)'),
     'marked',
     25,
     99,
     'draft'
   )$$,
  'P0001',
  'leaf parent must be branch',
  'reject leaf with root parent'
);

-- root with parent: tier_parent check constraint
select throws_ok(
  $$insert into public.fragments (
     grove_id, tier, parent_id, title, location, visibility,
     trigger_radius_m, story_order, status
   ) values (
     'aaaaaaaa-bbbb-4ccc-8ddd-000000000010',
     'root',
     'aaaaaaaa-bbbb-4ccc-8ddd-000000000030',
     '{"en":"bad root"}'::jsonb,
     extensions.ST_GeogFromText('SRID=4326;POINT(-111.9000 40.9000)'),
     'marked',
     25,
     98,
     'draft'
   )$$,
  '23514',
  'new row for relation "fragments" violates check constraint "tier_parent"',
  'reject root with parent'
);

select * from finish();
rollback;
