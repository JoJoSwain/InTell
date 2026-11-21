-- B3: Story Notes-only edit does not mark unreleased.
-- B5: draft_check and publish_check share local codes for a fixture grove.
-- B4: marker_code check constraint.
begin;
select plan(5);

select set_config('request.jwt.claim.role', 'service_role', true);

-- B4 invalid code rejected
select throws_ok(
  $$update public.fragments
      set marker_code = 'DEMO-001'
    where id = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000038'$$,
  '23514',
  null,
  'non-Crockford marker_code rejected'
);

-- Restore valid code if needed
update public.fragments
   set marker_code = 'DEM00001'
 where id = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000038';

-- B3: Indigeny-only edit on a published fragment must not appear in fn_unreleased
update public.fragments
   set indigeny_earth = 'story notes only — must not unrelease'
 where id = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000030';

select ok(
  not exists (
    select 1 from public.fn_unreleased(null)
    where entity = 'fragment'
      and entity_id = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000030'
  ),
  'Story Notes-only edit does not mark fragment unreleased'
);

-- Teaser edit DOES mark unreleased
update public.fragments
   set teaser = '{"en":"changed teaser for unreleased"}'::jsonb
 where id = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000030';

select ok(
  exists (
    select 1 from public.fn_unreleased('aaaaaaaa-bbbb-4ccc-8ddd-000000000010')
    where entity = 'fragment'
      and entity_id = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000030'
  ),
  'teaser edit marks fragment unreleased for grove filter'
);

-- B5: clear teaser on a fragment → both draft_check and a release publish_check report NO_TEASER
update public.fragments
   set teaser = '{}'::jsonb
 where id = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000038';

select ok(
  exists (
    select 1
    from jsonb_array_elements(public.fn_draft_check('aaaaaaaa-bbbb-4ccc-8ddd-000000000010')->'failures') f
    where f->>'code' = 'NO_TEASER'
      and f->>'entity_id' = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000038'
  ),
  'fn_draft_check reports NO_TEASER'
);

insert into public.releases (id, name, status)
values ('aaaaaaaa-bbbb-4ccc-8ddd-ffff000000c7', 'm3c draft parity', 'draft');
insert into public.release_items (release_id, entity, entity_id) values
  ('aaaaaaaa-bbbb-4ccc-8ddd-ffff000000c7', 'grove', 'aaaaaaaa-bbbb-4ccc-8ddd-000000000010'),
  ('aaaaaaaa-bbbb-4ccc-8ddd-ffff000000c7', 'fragment', 'aaaaaaaa-bbbb-4ccc-8ddd-000000000038');

select ok(
  (
    select array_agg(distinct f->>'code' order by f->>'code')
    from jsonb_array_elements(public.fn_draft_check('aaaaaaaa-bbbb-4ccc-8ddd-000000000010')->'failures') f
    where f->>'entity_id' = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000038'
  ) = (
    select array_agg(distinct f->>'code' order by f->>'code')
    from jsonb_array_elements(
      public.fn_publish_check('aaaaaaaa-bbbb-4ccc-8ddd-ffff000000c7')->'failures'
    ) f
    where f->>'entity_id' = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000038'
      and f->>'code' in ('NO_TEASER', 'PHYSICAL_NO_CODE', 'EMPTY_PREREQ_GROUP', 'OUTSIDE_GROVE')
  ),
  'fn_draft_check and fn_publish_check share local codes for fixture fragment'
);

select * from finish();
rollback;
