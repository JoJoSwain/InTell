-- Seeded v3 graph + release-scoped fn_publish_check + boundary containment.
begin;
select plan(8);

-- frag5 Parking Lot 2: two groups {frag2}, {frag3}
select is(
  (
    select coalesce(jsonb_agg(members order by sort_order), '[]'::jsonb)
    from (
      select g.sort_order,
             jsonb_agg(m.requires_fragment_id order by m.sort_order, m.requires_fragment_id) as members
      from public.fragment_prereq_groups g
      join public.fragment_prereq_members m on m.group_id = g.id
      where g.fragment_id = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000034'
      group by g.id, g.sort_order
    ) s
  ),
  '[
    ["aaaaaaaa-bbbb-4ccc-8ddd-000000000031"],
    ["aaaaaaaa-bbbb-4ccc-8ddd-000000000032"]
  ]'::jsonb,
  'frag5 prereqs are {frag2},{frag3}'
);

-- frag6 Ending: five single-member groups {1}..{5}
select is(
  (
    select coalesce(jsonb_agg(members order by sort_order), '[]'::jsonb)
    from (
      select g.sort_order,
             jsonb_agg(m.requires_fragment_id order by m.sort_order, m.requires_fragment_id) as members
      from public.fragment_prereq_groups g
      join public.fragment_prereq_members m on m.group_id = g.id
      where g.fragment_id = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000035'
      group by g.id, g.sort_order
    ) s
  ),
  '[
    ["aaaaaaaa-bbbb-4ccc-8ddd-000000000030"],
    ["aaaaaaaa-bbbb-4ccc-8ddd-000000000031"],
    ["aaaaaaaa-bbbb-4ccc-8ddd-000000000032"],
    ["aaaaaaaa-bbbb-4ccc-8ddd-000000000033"],
    ["aaaaaaaa-bbbb-4ccc-8ddd-000000000034"]
  ]'::jsonb,
  'frag6 prereqs are five singles {1}..{5}'
);

-- frag10 Two Ways: one OR group {frag8, frag9}
select is(
  (
    select coalesce(jsonb_agg(members order by sort_order), '[]'::jsonb)
    from (
      select g.sort_order,
             jsonb_agg(m.requires_fragment_id order by m.sort_order, m.requires_fragment_id) as members
      from public.fragment_prereq_groups g
      join public.fragment_prereq_members m on m.group_id = g.id
      where g.fragment_id = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000039'
      group by g.id, g.sort_order
    ) s
  ),
  '[["aaaaaaaa-bbbb-4ccc-8ddd-000000000037","aaaaaaaa-bbbb-4ccc-8ddd-000000000038"]]'::jsonb,
  'frag10 prereqs are one group {frag8,frag9}'
);

-- cross-grove: bridge (grove2 frag1) requires Farmington frag1
select ok(
  exists (
    select 1
    from public.fragment_prereq_groups g
    join public.fragment_prereq_members m on m.group_id = g.id
    where g.fragment_id = 'aaaaaaaa-bbbb-4ccc-8ddd-0000000000c1'
      and m.requires_fragment_id = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000030'
  ),
  'seed cross-grove prereq: bridge requires frag1'
);

-- published release check passed at seed (stored in last_check)
select ok(
  (
    select (last_check->>'ok')::boolean
    from public.releases
    where id = 'aaaaaaaa-bbbb-4ccc-8ddd-0000000000e0'
  ),
  'seed publish release last_check ok'
);

-- published snapshots exist for grove + physical frag9
select ok(
  exists (
    select 1 from public.published_snapshots
    where entity = 'grove' and entity_id = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000010'
      and (data->>'status') = 'published'
  ),
  'farmington grove snapshot published'
);

select ok(
  (
    select (data->>'visibility') = 'physical'
       and data ? 'markerHash'
       and not data ? 'markerCode'
    from public.published_snapshots
    where entity = 'fragment' and entity_id = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000038'
  ),
  'physical frag9 snapshot has markerHash only (no marker code)'
);

-- every seeded Farmington fragment has a location (boundary column dropped in A2)
select ok(
  (
    select count(*) = 10
    from public.fragments f
    where f.grove_id = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000010'
      and f.location is not null
  ),
  'every seeded Farmington fragment has a location'
);

select * from finish();
rollback;