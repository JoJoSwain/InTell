-- Seeded Farmington prerequisite graph + publish_check + boundary containment.
begin;
select plan(6);

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

-- frag7 Pond: one group {frag6}
select is(
  (
    select coalesce(jsonb_agg(members order by sort_order), '[]'::jsonb)
    from (
      select g.sort_order,
             jsonb_agg(m.requires_fragment_id order by m.sort_order, m.requires_fragment_id) as members
      from public.fragment_prereq_groups g
      join public.fragment_prereq_members m on m.group_id = g.id
      where g.fragment_id = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000036'
      group by g.id, g.sort_order
    ) s
  ),
  '[["aaaaaaaa-bbbb-4ccc-8ddd-000000000035"]]'::jsonb,
  'frag7 prereqs are {frag6}'
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

-- fn_publish_check on all rev1 ids: ok + exactly one RADIUS_OVERLAP (frag3/frag4)
select ok(
  (
    select (r->>'ok')::boolean
       and (
         select count(*)
         from jsonb_array_elements(r->'failures') f
         where f->>'code' = 'RADIUS_OVERLAP'
       ) = 1
       and exists (
         select 1
         from jsonb_array_elements(r->'failures') f
         where f->>'code' = 'RADIUS_OVERLAP'
           and f->>'severity' = 'warning'
           and (
             (f->>'entity_id' = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000032'
              and f->>'other_id' = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000033')
             or
             (f->>'entity_id' = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000033'
              and f->>'other_id' = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000032')
           )
       )
    from public.fn_publish_check(
      'revision',
      array[
        'aaaaaaaa-bbbb-4ccc-8ddd-000000000040'::uuid,
        'aaaaaaaa-bbbb-4ccc-8ddd-000000000041'::uuid,
        'aaaaaaaa-bbbb-4ccc-8ddd-000000000042'::uuid,
        'aaaaaaaa-bbbb-4ccc-8ddd-000000000043'::uuid,
        'aaaaaaaa-bbbb-4ccc-8ddd-000000000044'::uuid,
        'aaaaaaaa-bbbb-4ccc-8ddd-000000000045'::uuid,
        'aaaaaaaa-bbbb-4ccc-8ddd-000000000046'::uuid,
        'aaaaaaaa-bbbb-4ccc-8ddd-000000000047'::uuid,
        'aaaaaaaa-bbbb-4ccc-8ddd-000000000048'::uuid,
        'aaaaaaaa-bbbb-4ccc-8ddd-000000000049'::uuid
      ]
    ) as r
  ),
  'fn_publish_check ok with exactly one RADIUS_OVERLAP (frag3/frag4)'
);

-- every seeded fragment inside grove boundary
select ok(
  not exists (
    select 1
    from public.fragments f
    join public.groves g on g.id = f.grove_id
    where f.grove_id = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000010'
      and not extensions.ST_Covers(g.boundary, f.location)
  ),
  'every seeded fragment is inside grove boundary'
);

select * from finish();
rollback;
