-- Highest playable revision_no; fallback when newest unplayable.
begin;
select plan(3);

select is(
  public.fn_current_revision('aaaaaaaa-bbbb-4ccc-8ddd-000000000030'),
  'aaaaaaaa-bbbb-4ccc-8ddd-000000000040'::uuid,
  'current revision is highest playable (rev 1)'
);

insert into public.fragment_revisions (
  id, fragment_id, revision_no, ring_id, status, publish_at, content_note, change_note
) values (
  'aaaaaaaa-bbbb-4ccc-8ddd-000000000046',
  'aaaaaaaa-bbbb-4ccc-8ddd-000000000030',
  2,
  'aaaaaaaa-bbbb-4ccc-8ddd-000000000011',
  'published',
  now() - interval '1 minute',
  '{}'::jsonb,
  '{}'::jsonb
);

insert into public.revision_versions (
  revision_id, language, narration_asset_id, transcript
) values (
  'aaaaaaaa-bbbb-4ccc-8ddd-000000000046',
  'en',
  'aaaaaaaa-bbbb-4ccc-8ddd-000000000100',
  'Second revision transcript.'
);

insert into public.revision_contributors (
  revision_id, contributor_id, role, consent_id
) values (
  'aaaaaaaa-bbbb-4ccc-8ddd-000000000046',
  'aaaaaaaa-bbbb-4ccc-8ddd-000000000050',
  'narrator',
  'aaaaaaaa-bbbb-4ccc-8ddd-000000000051'
);

select is(
  public.fn_current_revision('aaaaaaaa-bbbb-4ccc-8ddd-000000000030'),
  'aaaaaaaa-bbbb-4ccc-8ddd-000000000046'::uuid,
  'newest playable revision wins'
);

-- make newest unplayable via future publish_at
update public.fragment_revisions
   set publish_at = now() + interval '1 day'
 where id = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000046';

select is(
  public.fn_current_revision('aaaaaaaa-bbbb-4ccc-8ddd-000000000030'),
  'aaaaaaaa-bbbb-4ccc-8ddd-000000000040'::uuid,
  'falls back when newest unplayable'
);

select * from finish();
rollback;
