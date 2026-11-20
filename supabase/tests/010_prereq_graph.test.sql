-- ADR 0003: prerequisite graph guards + ending_is_root check.
begin;
select plan(7);

-- Self-reference rejected
insert into public.fragment_prereq_groups (id, fragment_id, sort_order)
values ('aaaaaaaa-bbbb-4ccc-8ddd-ffff00000010', 'aaaaaaaa-bbbb-4ccc-8ddd-000000000030', 99);

select throws_ok(
  $$insert into public.fragment_prereq_members (group_id, requires_fragment_id, sort_order)
    values ('aaaaaaaa-bbbb-4ccc-8ddd-ffff00000010', 'aaaaaaaa-bbbb-4ccc-8ddd-000000000030', 0)$$,
  'P0001',
  'fragment cannot require itself',
  'self-reference rejected'
);

-- Cross-grove prerequisite rejected (second grove on placeholder site)
insert into public.groves (
  id, site_id, slug, name, boundary, status
) values (
  'aaaaaaaa-bbbb-4ccc-8ddd-ffff00000011',
  'aaaaaaaa-bbbb-4ccc-8ddd-000000000003',
  'pgtap-other-grove',
  '{"en":"Other Grove"}'::jsonb,
  extensions.ST_GeogFromText(
    'SRID=4326;POLYGON((-112.0 41.0,-111.99 41.0,-111.99 41.01,-112.0 41.01,-112.0 41.0))'
  ),
  'draft'
);

insert into public.fragments (
  id, grove_id, tier, title, location, visibility,
  trigger_radius_m, story_order, status
) values (
  'aaaaaaaa-bbbb-4ccc-8ddd-ffff00000012',
  'aaaaaaaa-bbbb-4ccc-8ddd-ffff00000011',
  'root',
  '{"en":"other root"}'::jsonb,
  extensions.ST_GeogFromText('SRID=4326;POINT(-111.995 41.005)'),
  'marked',
  30,
  1,
  'draft'
);

insert into public.fragment_prereq_groups (id, fragment_id, sort_order)
values ('aaaaaaaa-bbbb-4ccc-8ddd-ffff00000013', 'aaaaaaaa-bbbb-4ccc-8ddd-000000000030', 98);

select throws_ok(
  $$insert into public.fragment_prereq_members (group_id, requires_fragment_id, sort_order)
    values ('aaaaaaaa-bbbb-4ccc-8ddd-ffff00000013', 'aaaaaaaa-bbbb-4ccc-8ddd-ffff00000012', 0)$$,
  'P0001',
  'prerequisite must be in the same grove',
  'cross-grove prerequisite rejected'
);

-- 2-cycle rejected: A → B → A
insert into public.fragments (
  id, grove_id, tier, title, location, visibility,
  trigger_radius_m, story_order, status
) values
(
  'aaaaaaaa-bbbb-4ccc-8ddd-ffff00000021',
  'aaaaaaaa-bbbb-4ccc-8ddd-000000000010',
  'leaf',
  '{"en":"cycle A"}'::jsonb,
  (select extensions.ST_Centroid(boundary)::extensions.geography
     from public.groves where id = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000010'),
  'marked', 20, 901, 'draft'
),
(
  'aaaaaaaa-bbbb-4ccc-8ddd-ffff00000022',
  'aaaaaaaa-bbbb-4ccc-8ddd-000000000010',
  'leaf',
  '{"en":"cycle B"}'::jsonb,
  (select extensions.ST_Centroid(boundary)::extensions.geography
     from public.groves where id = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000010'),
  'marked', 20, 902, 'draft'
);

insert into public.fragment_prereq_groups (id, fragment_id, sort_order) values
  ('aaaaaaaa-bbbb-4ccc-8ddd-ffff00000023', 'aaaaaaaa-bbbb-4ccc-8ddd-ffff00000021', 0),
  ('aaaaaaaa-bbbb-4ccc-8ddd-ffff00000024', 'aaaaaaaa-bbbb-4ccc-8ddd-ffff00000022', 0);

insert into public.fragment_prereq_members (group_id, requires_fragment_id, sort_order)
values ('aaaaaaaa-bbbb-4ccc-8ddd-ffff00000023', 'aaaaaaaa-bbbb-4ccc-8ddd-ffff00000022', 0);

select throws_ok(
  $$insert into public.fragment_prereq_members (group_id, requires_fragment_id, sort_order)
    values ('aaaaaaaa-bbbb-4ccc-8ddd-ffff00000024', 'aaaaaaaa-bbbb-4ccc-8ddd-ffff00000021', 0)$$,
  'P0001',
  'prerequisite edge would create a cycle',
  '2-cycle rejected'
);

-- 3-cycle rejected: A → B → C → A
insert into public.fragments (
  id, grove_id, tier, title, location, visibility,
  trigger_radius_m, story_order, status
) values
(
  'aaaaaaaa-bbbb-4ccc-8ddd-ffff00000031',
  'aaaaaaaa-bbbb-4ccc-8ddd-000000000010',
  'leaf',
  '{"en":"cycle3 A"}'::jsonb,
  (select extensions.ST_Centroid(boundary)::extensions.geography
     from public.groves where id = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000010'),
  'marked', 20, 911, 'draft'
),
(
  'aaaaaaaa-bbbb-4ccc-8ddd-ffff00000032',
  'aaaaaaaa-bbbb-4ccc-8ddd-000000000010',
  'leaf',
  '{"en":"cycle3 B"}'::jsonb,
  (select extensions.ST_Centroid(boundary)::extensions.geography
     from public.groves where id = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000010'),
  'marked', 20, 912, 'draft'
),
(
  'aaaaaaaa-bbbb-4ccc-8ddd-ffff00000033',
  'aaaaaaaa-bbbb-4ccc-8ddd-000000000010',
  'leaf',
  '{"en":"cycle3 C"}'::jsonb,
  (select extensions.ST_Centroid(boundary)::extensions.geography
     from public.groves where id = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000010'),
  'marked', 20, 913, 'draft'
);

insert into public.fragment_prereq_groups (id, fragment_id, sort_order) values
  ('aaaaaaaa-bbbb-4ccc-8ddd-ffff00000034', 'aaaaaaaa-bbbb-4ccc-8ddd-ffff00000031', 0),
  ('aaaaaaaa-bbbb-4ccc-8ddd-ffff00000035', 'aaaaaaaa-bbbb-4ccc-8ddd-ffff00000032', 0),
  ('aaaaaaaa-bbbb-4ccc-8ddd-ffff00000036', 'aaaaaaaa-bbbb-4ccc-8ddd-ffff00000033', 0);

insert into public.fragment_prereq_members (group_id, requires_fragment_id, sort_order) values
  ('aaaaaaaa-bbbb-4ccc-8ddd-ffff00000034', 'aaaaaaaa-bbbb-4ccc-8ddd-ffff00000032', 0),
  ('aaaaaaaa-bbbb-4ccc-8ddd-ffff00000035', 'aaaaaaaa-bbbb-4ccc-8ddd-ffff00000033', 0);

select throws_ok(
  $$insert into public.fragment_prereq_members (group_id, requires_fragment_id, sort_order)
    values ('aaaaaaaa-bbbb-4ccc-8ddd-ffff00000036', 'aaaaaaaa-bbbb-4ccc-8ddd-ffff00000031', 0)$$,
  'P0001',
  'prerequisite edge would create a cycle',
  '3-cycle rejected'
);

-- is_ending on non-root rejected (check constraint)
select throws_ok(
  $$insert into public.fragments (
     grove_id, tier, is_ending, title, location, visibility,
     trigger_radius_m, story_order, status
   ) values (
     'aaaaaaaa-bbbb-4ccc-8ddd-000000000010',
     'leaf',
     true,
     '{"en":"ending leaf"}'::jsonb,
     (select extensions.ST_Centroid(boundary)::extensions.geography
        from public.groves where id = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000010'),
     'marked',
     20,
     920,
     'draft'
   )$$,
  '23514',
  'new row for relation "fragments" violates check constraint "ending_is_root"',
  'is_ending on non-root rejected'
);

-- leaf requiring leaf allowed
insert into public.fragments (
  id, grove_id, tier, title, location, visibility,
  trigger_radius_m, story_order, status
) values (
  'aaaaaaaa-bbbb-4ccc-8ddd-ffff00000040',
  'aaaaaaaa-bbbb-4ccc-8ddd-000000000010',
  'leaf',
  '{"en":"leaf needs leaf"}'::jsonb,
  (select extensions.ST_Centroid(boundary)::extensions.geography
     from public.groves where id = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000010'),
  'marked',
  20,
  930,
  'draft'
);

insert into public.fragment_prereq_groups (id, fragment_id, sort_order)
values ('aaaaaaaa-bbbb-4ccc-8ddd-ffff00000041', 'aaaaaaaa-bbbb-4ccc-8ddd-ffff00000040', 0);

select lives_ok(
  $$insert into public.fragment_prereq_members (group_id, requires_fragment_id, sort_order)
    values ('aaaaaaaa-bbbb-4ccc-8ddd-ffff00000041', 'aaaaaaaa-bbbb-4ccc-8ddd-000000000033', 0)$$,
  'leaf requiring leaf allowed'
);

-- root with prerequisites allowed (seeded frag7 Pond requires Ending)
select ok(
  exists (
    select 1
    from public.fragments f
    join public.fragment_prereq_groups g on g.fragment_id = f.id
    join public.fragment_prereq_members m on m.group_id = g.id
    where f.id = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000036'
      and f.tier = 'root'
      and m.requires_fragment_id = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000035'
  ),
  'root with prerequisites allowed (frag7)'
);

select * from finish();
rollback;
