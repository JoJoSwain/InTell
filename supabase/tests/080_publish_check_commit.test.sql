-- Happy-path publish check/commit on a draft revision.
begin;
select plan(4);

-- Guard requires service_role or editor/admin (S2).
select set_config('request.jwt.claim.role', 'service_role', true);

insert into public.fragment_revisions (
  id, fragment_id, revision_no, ring_id, status, content_note, change_note
) values (
  'aaaaaaaa-bbbb-4ccc-8ddd-ffff00000080',
  'aaaaaaaa-bbbb-4ccc-8ddd-000000000030',
  3,
  'aaaaaaaa-bbbb-4ccc-8ddd-000000000011',
  'draft',
  '{}'::jsonb,
  '{}'::jsonb
);

insert into public.revision_versions (
  revision_id, language, narration_asset_id, transcript
) values (
  'aaaaaaaa-bbbb-4ccc-8ddd-ffff00000080',
  'en',
  'aaaaaaaa-bbbb-4ccc-8ddd-000000000100',
  'TEST transcript — draft publish commit path.'
);

insert into public.revision_contributors (
  revision_id, contributor_id, role, consent_id
) values (
  'aaaaaaaa-bbbb-4ccc-8ddd-ffff00000080',
  'aaaaaaaa-bbbb-4ccc-8ddd-000000000050',
  'narrator',
  'aaaaaaaa-bbbb-4ccc-8ddd-000000000051'
);

select ok(
  (public.fn_publish_check(
    'revision',
    array['aaaaaaaa-bbbb-4ccc-8ddd-ffff00000080'::uuid]
  )->>'ok')::boolean,
  'fn_publish_check ok for draft revision'
);

delete from public.jobs;

select ok(
  (public.fn_publish_commit(
    'revision',
    array['aaaaaaaa-bbbb-4ccc-8ddd-ffff00000080'::uuid]
  )->>'committed')::boolean,
  'fn_publish_commit sets committed'
);

select is(
  (select status from public.fragment_revisions
    where id = 'aaaaaaaa-bbbb-4ccc-8ddd-ffff00000080'),
  'published'::public.publish_status,
  'revision status becomes published'
);

select ok(
  exists (
    select 1 from public.jobs where kind = 'rebuild_pack'
  ),
  'publish_commit enqueues rebuild_pack'
);

select * from finish();
rollback;
