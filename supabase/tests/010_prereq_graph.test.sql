-- ADR 0003 / M3a: story-wide cycle guard; cross-grove edges allowed (fn_prereq_guard).
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

-- Cross-grove prerequisite allowed (grove2 leaf → Farmington frag2; seed already has 0c1 → 030)
insert into public.fragments (
  id, grove_id, tier, title, location, visibility,
  trigger_radius_m, story_order, status
) values (
  'aaaaaaaa-bbbb-4ccc-8ddd-ffff00000012',
  'aaaaaaaa-bbbb-4ccc-8ddd-0000000000c0',
  'leaf',
  '{"en":"cross-grove lab"}'::jsonb,
  extensions.ST_SetSRID(extensions.ST_MakePoint(-111.92538673, 40.9612169), 4326)::extensions.geography,
  'standard', 10.67, 899, 'draft'
);

insert into public.fragment_prereq_groups (id, fragment_id, sort_order)
values ('aaaaaaaa-bbbb-4ccc-8ddd-ffff00000013', 'aaaaaaaa-bbbb-4ccc-8ddd-ffff00000012', 0);

select lives_ok(
  $$insert into public.fragment_prereq_members (group_id, requires_fragment_id, sort_order)
    values (
      'aaaaaaaa-bbbb-4ccc-8ddd-ffff00000013',
      'aaaaaaaa-bbbb-4ccc-8ddd-000000000031',
      0
    )$$,
  'cross-grove prerequisite allowed'
);

delete from public.fragment_prereq_members
 where group_id = 'aaaaaaaa-bbbb-4ccc-8ddd-ffff00000013';
delete from public.fragment_prereq_groups
 where id = 'aaaaaaaa-bbbb-4ccc-8ddd-ffff00000013';
delete from public.fragments
 where id = 'aaaaaaaa-bbbb-4ccc-8ddd-ffff00000012';

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
  extensions.ST_SetSRID(extensions.ST_MakePoint(-111.92895673, 40.9612169), 4326)::extensions.geography,
  'standard', 10.67, 901, 'draft'
),
(
  'aaaaaaaa-bbbb-4ccc-8ddd-ffff00000022',
  'aaaaaaaa-bbbb-4ccc-8ddd-000000000010',
  'leaf',
  '{"en":"cycle B"}'::jsonb,
  extensions.ST_SetSRID(extensions.ST_MakePoint(-111.92895673, 40.9612169), 4326)::extensions.geography,
  'standard', 10.67, 902, 'draft'
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
  extensions.ST_SetSRID(extensions.ST_MakePoint(-111.92895673, 40.9612169), 4326)::extensions.geography,
  'standard', 10.67, 911, 'draft'
),
(
  'aaaaaaaa-bbbb-4ccc-8ddd-ffff00000032',
  'aaaaaaaa-bbbb-4ccc-8ddd-000000000010',
  'leaf',
  '{"en":"cycle3 B"}'::jsonb,
  extensions.ST_SetSRID(extensions.ST_MakePoint(-111.92895673, 40.9612169), 4326)::extensions.geography,
  'standard', 10.67, 912, 'draft'
),
(
  'aaaaaaaa-bbbb-4ccc-8ddd-ffff00000033',
  'aaaaaaaa-bbbb-4ccc-8ddd-000000000010',
  'leaf',
  '{"en":"cycle3 C"}'::jsonb,
  extensions.ST_SetSRID(extensions.ST_MakePoint(-111.92895673, 40.9612169), 4326)::extensions.geography,
  'standard', 10.67, 913, 'draft'
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
     extensions.ST_SetSRID(extensions.ST_MakePoint(-111.92895673, 40.9612169), 4326)::extensions.geography,
     'standard',
     10.67,
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
  extensions.ST_SetSRID(extensions.ST_MakePoint(-111.92895673, 40.9612169), 4326)::extensions.geography,
  'standard',
  10.67,
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