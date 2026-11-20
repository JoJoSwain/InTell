-- Release-scoped fn_publish_check / fn_publish_commit + snapshots (M3a).
begin;
select plan(6);

select set_config('request.jwt.claim.role', 'service_role', true);

insert into public.releases (id, name, status)
values ('aaaaaaaa-bbbb-4ccc-8ddd-ffff00000081', 'pgtap-commit', 'draft');

insert into public.release_items (release_id, entity, entity_id) values
  ('aaaaaaaa-bbbb-4ccc-8ddd-ffff00000081', 'grove', 'aaaaaaaa-bbbb-4ccc-8ddd-000000000010'),
  ('aaaaaaaa-bbbb-4ccc-8ddd-ffff00000081', 'fragment', 'aaaaaaaa-bbbb-4ccc-8ddd-000000000036'),
  ('aaaaaaaa-bbbb-4ccc-8ddd-ffff00000081', 'revision', 'aaaaaaaa-bbbb-4ccc-8ddd-000000000046');

select ok(
  (public.fn_publish_check('aaaaaaaa-bbbb-4ccc-8ddd-ffff00000081')->>'ok')::boolean,
  'fn_publish_check ok for partial release (frag7)'
);

delete from public.jobs where payload->>'release_id' = 'aaaaaaaa-bbbb-4ccc-8ddd-ffff00000081';

select ok(
  (public.fn_publish_commit('aaaaaaaa-bbbb-4ccc-8ddd-ffff00000081')->>'committed')::boolean,
  'fn_publish_commit sets committed'
);

select is(
  (select status from public.fragment_revisions
    where id = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000046'),
  'published'::public.publish_status,
  'revision status becomes published'
);

select ok(
  exists (
    select 1 from public.published_snapshots
    where entity = 'fragment' and entity_id = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000036'
  ),
  'publish_commit writes fragment snapshot'
);

select is(
  (select status from public.releases where id = 'aaaaaaaa-bbbb-4ccc-8ddd-ffff00000081'),
  'publishing'::public.release_status,
  'release status becomes publishing'
);

select ok(
  exists (
    select 1 from public.jobs
    where kind = 'rebuild_pack'
      and payload->>'release_id' = 'aaaaaaaa-bbbb-4ccc-8ddd-ffff00000081'
  ),
  'publish_commit enqueues rebuild_pack jobs for release'
);

select * from finish();
rollback;