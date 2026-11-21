-- M3d review E2: authenticated cannot set status/release_id; publish/unpublish still work.
-- N1: revision_no assign trigger still fires for writers after EXECUTE revoke.
begin;
select plan(7);

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('bbbbbbbb-bbbb-4ccc-8ddd-720000000001','authenticated','authenticated','m3d-e2-ed@test.local',crypt('x',gen_salt('bf')),now(),'{}','{}',now(),now()),
  ('bbbbbbbb-bbbb-4ccc-8ddd-720000000002','authenticated','authenticated','m3d-e2-wr@test.local',crypt('x',gen_salt('bf')),now(),'{}','{}',now(),now());

insert into public.staff (user_id, display_name, role, active) values
  ('bbbbbbbb-bbbb-4ccc-8ddd-720000000001', 'M3d E2 Editor', 'editor', true),
  ('bbbbbbbb-bbbb-4ccc-8ddd-720000000002', 'M3d E2 Writer', 'writer', true);

-- Draft revision owned path: insert as writer (N1 + E2 draft insert)
select set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-4ccc-8ddd-720000000002', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

insert into public.fragment_revisions (
  id, fragment_id, change_kind, status, change_note
) values (
  'aaaaaaaa-bbbb-4ccc-8ddd-ffff00000072',
  'aaaaaaaa-bbbb-4ccc-8ddd-000000000037',
  'correction',
  'draft',
  'e2 guard draft'
);

select is(
  (select revision_no from public.fragment_revisions
    where id = 'aaaaaaaa-bbbb-4ccc-8ddd-ffff00000072'),
  2,
  'N1: assign_no trigger still fires for writer insert'
);

select throws_ok(
  $$insert into public.fragment_revisions (
     id, fragment_id, change_kind, status, change_note
   ) values (
     'aaaaaaaa-bbbb-4ccc-8ddd-ffff00000073',
     'aaaaaaaa-bbbb-4ccc-8ddd-000000000037',
     'correction',
     'published',
     'illegal published insert'
   )$$,
  '42501',
  'authenticated inserts must use status = draft',
  'E2: insert with status published refused'
);

select throws_ok(
  $$insert into public.fragment_revisions (
     id, fragment_id, change_kind, status, release_id, change_note
   ) values (
     'aaaaaaaa-bbbb-4ccc-8ddd-ffff00000074',
     'aaaaaaaa-bbbb-4ccc-8ddd-000000000037',
     'correction',
     'draft',
     'aaaaaaaa-bbbb-4ccc-8ddd-0000000000e0',
     'illegal release_id insert'
   )$$,
  '42501',
  'authenticated inserts must leave release_id null',
  'E2: insert with release_id refused'
);

-- Editor cannot promote draft → published
select set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-4ccc-8ddd-720000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select throws_ok(
  $$update public.fragment_revisions
      set status = 'published'
    where id = 'aaaaaaaa-bbbb-4ccc-8ddd-ffff00000072'$$,
  '42501',
  'authenticated cannot change revision status',
  'E2: editor cannot set draft to published'
);

select throws_ok(
  $$update public.fragment_revisions
      set release_id = 'aaaaaaaa-bbbb-4ccc-8ddd-0000000000e0'
    where id = 'aaaaaaaa-bbbb-4ccc-8ddd-ffff00000072'$$,
  '42501',
  'authenticated cannot change revision release_id',
  'E2: editor cannot set release_id'
);

reset role;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claim.role', '', true);

-- Service-role / migration path (no authenticated JWT) still updates status
update public.fragment_revisions
   set status = 'published',
       release_id = 'aaaaaaaa-bbbb-4ccc-8ddd-0000000000e0'
 where id = 'aaaaaaaa-bbbb-4ccc-8ddd-ffff00000072';

select is(
  (select status::text from public.fragment_revisions
    where id = 'aaaaaaaa-bbbb-4ccc-8ddd-ffff00000072'),
  'published',
  'E2: service-role publish status update still works'
);

update public.fragment_revisions
   set status = 'unpublished',
       release_id = null
 where id = 'aaaaaaaa-bbbb-4ccc-8ddd-ffff00000072';

select is(
  (select status::text from public.fragment_revisions
    where id = 'aaaaaaaa-bbbb-4ccc-8ddd-ffff00000072'),
  'unpublished',
  'E2: service-role unpublish status update still works'
);

select * from finish();
rollback;
