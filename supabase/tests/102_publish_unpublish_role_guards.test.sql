-- S2: direct RPC publish/unpublish refused for non-editors; editor succeeds
begin;
select plan(8);

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('bbbbbbbb-bbbb-4ccc-8ddd-520000000001','authenticated','authenticated','pub-nostaff@test.local',crypt('x',gen_salt('bf')),now(),'{}','{}',now(),now()),
  ('bbbbbbbb-bbbb-4ccc-8ddd-520000000002','authenticated','authenticated','pub-viewer@test.local',crypt('x',gen_salt('bf')),now(),'{}','{}',now(),now()),
  ('bbbbbbbb-bbbb-4ccc-8ddd-520000000003','authenticated','authenticated','pub-writer@test.local',crypt('x',gen_salt('bf')),now(),'{}','{}',now(),now()),
  ('bbbbbbbb-bbbb-4ccc-8ddd-520000000004','authenticated','authenticated','pub-editor@test.local',crypt('x',gen_salt('bf')),now(),'{}','{}',now(),now());

insert into public.staff (user_id, display_name, role, active) values
  ('bbbbbbbb-bbbb-4ccc-8ddd-520000000002', 'Pub Viewer', 'viewer', true),
  ('bbbbbbbb-bbbb-4ccc-8ddd-520000000003', 'Pub Writer', 'writer', true),
  ('bbbbbbbb-bbbb-4ccc-8ddd-520000000004', 'Pub Editor', 'editor', true);

insert into public.fragment_revisions (
  id, fragment_id, revision_no, ring_id, status, content_note, change_note
) values (
  'aaaaaaaa-bbbb-4ccc-8ddd-ffff00000082',
  'aaaaaaaa-bbbb-4ccc-8ddd-000000000030',
  4,
  'aaaaaaaa-bbbb-4ccc-8ddd-000000000011',
  'draft',
  '{}'::jsonb,
  '{}'::jsonb
);

insert into public.revision_versions (
  revision_id, language, narration_asset_id, transcript
) values (
  'aaaaaaaa-bbbb-4ccc-8ddd-ffff00000082',
  'en',
  'aaaaaaaa-bbbb-4ccc-8ddd-000000000100',
  'TEST transcript — role-guard publish commit.'
);

insert into public.revision_contributors (
  revision_id, contributor_id, role, consent_id
) values (
  'aaaaaaaa-bbbb-4ccc-8ddd-ffff00000082',
  'aaaaaaaa-bbbb-4ccc-8ddd-000000000050',
  'narrator',
  'aaaaaaaa-bbbb-4ccc-8ddd-000000000051'
);

-- non-staff: unpublish refused
select set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-4ccc-8ddd-520000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;
select throws_ok(
  $$select public.fn_unpublish_commit(
      'grove',
      array['aaaaaaaa-bbbb-4ccc-8ddd-000000000010'::uuid]
    )$$,
  '42501',
  null,
  'non-staff cannot fn_unpublish_commit'
);
select throws_ok(
  $$select public.fn_publish_commit(
      'revision',
      array['aaaaaaaa-bbbb-4ccc-8ddd-ffff00000082'::uuid]
    )$$,
  '42501',
  null,
  'non-staff cannot fn_publish_commit'
);
reset role;

-- viewer
select set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-4ccc-8ddd-520000000002', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;
select throws_ok(
  $$select public.fn_unpublish_commit(
      'grove',
      array['aaaaaaaa-bbbb-4ccc-8ddd-000000000010'::uuid]
    )$$,
  '42501',
  null,
  'viewer cannot fn_unpublish_commit'
);
select throws_ok(
  $$select public.fn_publish_commit(
      'revision',
      array['aaaaaaaa-bbbb-4ccc-8ddd-ffff00000082'::uuid]
    )$$,
  '42501',
  null,
  'viewer cannot fn_publish_commit'
);
reset role;

-- writer
select set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-4ccc-8ddd-520000000003', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;
select throws_ok(
  $$select public.fn_unpublish_commit(
      'grove',
      array['aaaaaaaa-bbbb-4ccc-8ddd-000000000010'::uuid]
    )$$,
  '42501',
  null,
  'writer cannot fn_unpublish_commit'
);
select throws_ok(
  $$select public.fn_publish_commit(
      'revision',
      array['aaaaaaaa-bbbb-4ccc-8ddd-ffff00000082'::uuid]
    )$$,
  '42501',
  null,
  'writer cannot fn_publish_commit'
);
reset role;

-- editor succeeds
select set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-4ccc-8ddd-520000000004', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select ok(
  (public.fn_publish_commit(
    'revision',
    array['aaaaaaaa-bbbb-4ccc-8ddd-ffff00000082'::uuid]
  )->>'committed')::boolean,
  'editor can fn_publish_commit'
);

select ok(
  (public.fn_unpublish_commit(
    'revision',
    array['aaaaaaaa-bbbb-4ccc-8ddd-ffff00000082'::uuid]
  )->>'ok')::boolean,
  'editor can fn_unpublish_commit'
);

reset role;

select * from finish();
rollback;
