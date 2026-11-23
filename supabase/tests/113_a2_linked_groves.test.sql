-- A2 R3: grove-level rebuild links, both directions, a move with no link of
-- its own, and a link removed from the live graph but still in the snapshot.
begin;
select plan(4);

select set_config('request.jwt.claim.role', 'service_role', true);

insert into public.releases (id, name, status)
values ('aaaaaaaa-bbbb-4ccc-8ddd-ffffa20000e0', 'a2-links', 'draft');

insert into public.groves (
  id, region_id, slug, name, premise, boundary,
  allows_speaker_wildlife_sounds, status, pack_version
) values
  (
    'aaaaaaaa-bbbb-4ccc-8ddd-ffffa2000001',
    'aaaaaaaa-bbbb-4ccc-8ddd-000000000001',
    'a2-grove-a',
    '{"en":"A"}'::jsonb,
    '{}'::jsonb,
    extensions.ST_Buffer(
      extensions.ST_SetSRID(extensions.ST_MakePoint(-112.50, 40.50), 4326)::extensions.geography,
      400
    ),
    false, 'draft', 0
  ),
  (
    'aaaaaaaa-bbbb-4ccc-8ddd-ffffa2000002',
    'aaaaaaaa-bbbb-4ccc-8ddd-000000000001',
    'a2-grove-b',
    '{"en":"B"}'::jsonb,
    '{}'::jsonb,
    extensions.ST_Buffer(
      extensions.ST_SetSRID(extensions.ST_MakePoint(-112.40, 40.50), 4326)::extensions.geography,
      400
    ),
    false, 'draft', 0
  );

insert into public.fragments (
  id, grove_id, tier, title, location, visibility, trigger_radius_m, story_order, status
) values
  (
    'aaaaaaaa-bbbb-4ccc-8ddd-ffffa2000011',
    'aaaaaaaa-bbbb-4ccc-8ddd-ffffa2000001',
    'root', '{"en":"a1"}'::jsonb,
    extensions.ST_SetSRID(extensions.ST_MakePoint(-112.50, 40.50), 4326)::extensions.geography,
    'standard', 10.67, 1, 'published'
  ),
  (
    'aaaaaaaa-bbbb-4ccc-8ddd-ffffa2000012',
    'aaaaaaaa-bbbb-4ccc-8ddd-ffffa2000001',
    'leaf', '{"en":"a2 unlinked"}'::jsonb,
    extensions.ST_SetSRID(extensions.ST_MakePoint(-112.501, 40.50), 4326)::extensions.geography,
    'standard', 10.67, 2, 'published'
  ),
  (
    'aaaaaaaa-bbbb-4ccc-8ddd-ffffa2000021',
    'aaaaaaaa-bbbb-4ccc-8ddd-ffffa2000002',
    'root', '{"en":"b1"}'::jsonb,
    extensions.ST_SetSRID(extensions.ST_MakePoint(-112.40, 40.50), 4326)::extensions.geography,
    'standard', 10.67, 1, 'published'
  );

-- Live: a1 requires b1. b1 requires nobody (the old link was removed).
insert into public.fragment_prereq_groups (id, fragment_id, sort_order)
values ('aaaaaaaa-bbbb-4ccc-8ddd-ffffa2000031', 'aaaaaaaa-bbbb-4ccc-8ddd-ffffa2000011', 0);
insert into public.fragment_prereq_members (group_id, requires_fragment_id, sort_order)
values (
  'aaaaaaaa-bbbb-4ccc-8ddd-ffffa2000031',
  'aaaaaaaa-bbbb-4ccc-8ddd-ffffa2000021',
  0
);

-- Old snapshot: b1 required a1. That edge is gone from the live graph.
insert into public.published_snapshots (entity, entity_id, release_id, data)
values (
  'fragment',
  'aaaaaaaa-bbbb-4ccc-8ddd-ffffa2000021',
  'aaaaaaaa-bbbb-4ccc-8ddd-ffffa20000e0',
  jsonb_build_object(
    'id', 'aaaaaaaa-bbbb-4ccc-8ddd-ffffa2000021',
    'groveId', 'aaaaaaaa-bbbb-4ccc-8ddd-ffffa2000002',
    'status', 'published',
    'requires', jsonb_build_array(
      jsonb_build_object(
        'members', jsonb_build_array(
          jsonb_build_object('fragmentId', 'aaaaaaaa-bbbb-4ccc-8ddd-ffffa2000011')
        )
      )
    )
  )
);

-- Direction requires: publishing a1 enqueues B.
insert into public.release_items (release_id, entity, entity_id)
values (
  'aaaaaaaa-bbbb-4ccc-8ddd-ffffa20000e0',
  'fragment',
  'aaaaaaaa-bbbb-4ccc-8ddd-ffffa2000011'
);

select ok(
  'aaaaaaaa-bbbb-4ccc-8ddd-ffffa2000002' = any (
    public.fn_release_linked_groves('aaaaaaaa-bbbb-4ccc-8ddd-ffffa20000e0')
  ),
  'publishing a fragment that requires B enqueues B'
);

-- Direction unlocks, and a move of an unlinked fragment still sees a1's link.
delete from public.release_items where release_id = 'aaaaaaaa-bbbb-4ccc-8ddd-ffffa20000e0';
insert into public.fragment_revisions (id, fragment_id, revision_no, status, change_kind)
values (
  'aaaaaaaa-bbbb-4ccc-8ddd-ffffa2000041',
  'aaaaaaaa-bbbb-4ccc-8ddd-ffffa2000012',
  1,
  'draft',
  'contingency'
);
insert into public.release_items (release_id, entity, entity_id)
values (
  'aaaaaaaa-bbbb-4ccc-8ddd-ffffa20000e0',
  'revision',
  'aaaaaaaa-bbbb-4ccc-8ddd-ffffa2000041'
);

select ok(
  'aaaaaaaa-bbbb-4ccc-8ddd-ffffa2000002' = any (
    public.fn_release_linked_groves('aaaaaaaa-bbbb-4ccc-8ddd-ffffa20000e0')
  ),
  'moving an unlinked fragment still rebuilds a grove linked to a sibling'
);

-- Incoming only: drop the old snapshot so the live edge is the only reason.
delete from public.published_snapshots
 where entity = 'fragment'
   and entity_id = 'aaaaaaaa-bbbb-4ccc-8ddd-ffffa2000021';
delete from public.release_items where release_id = 'aaaaaaaa-bbbb-4ccc-8ddd-ffffa20000e0';
insert into public.release_items (release_id, entity, entity_id)
values (
  'aaaaaaaa-bbbb-4ccc-8ddd-ffffa20000e0',
  'fragment',
  'aaaaaaaa-bbbb-4ccc-8ddd-ffffa2000021'
);

select ok(
  'aaaaaaaa-bbbb-4ccc-8ddd-ffffa2000001' = any (
    public.fn_release_linked_groves('aaaaaaaa-bbbb-4ccc-8ddd-ffffa20000e0')
  ),
  'publishing the prerequisite enqueues the grove that requires it'
);

-- Removed link: live edge is gone, the snapshot still points at a1.
delete from public.fragment_prereq_members
 where group_id = 'aaaaaaaa-bbbb-4ccc-8ddd-ffffa2000031';
insert into public.published_snapshots (entity, entity_id, release_id, data)
values (
  'fragment',
  'aaaaaaaa-bbbb-4ccc-8ddd-ffffa2000021',
  'aaaaaaaa-bbbb-4ccc-8ddd-ffffa20000e0',
  jsonb_build_object(
    'id', 'aaaaaaaa-bbbb-4ccc-8ddd-ffffa2000021',
    'groveId', 'aaaaaaaa-bbbb-4ccc-8ddd-ffffa2000002',
    'status', 'published',
    'requires', jsonb_build_array(
      jsonb_build_object(
        'members', jsonb_build_array(
          jsonb_build_object('fragmentId', 'aaaaaaaa-bbbb-4ccc-8ddd-ffffa2000011')
        )
      )
    )
  )
);

select ok(
  'aaaaaaaa-bbbb-4ccc-8ddd-ffffa2000001' = any (
    public.fn_release_linked_groves('aaaaaaaa-bbbb-4ccc-8ddd-ffffa20000e0')
  ),
  'a link removed from the live graph still rebuilds the other grove'
);

select * from finish();
rollback;
