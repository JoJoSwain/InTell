-- M3d D1/D2: non-draft revisions immutable; revision_no assigned by trigger.
begin;
select plan(7);

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('bbbbbbbb-bbbb-4ccc-8ddd-690000000001','authenticated','authenticated','m3d-ed@test.local',crypt('x',gen_salt('bf')),now(),'{}','{}',now(),now()),
  ('bbbbbbbb-bbbb-4ccc-8ddd-690000000002','authenticated','authenticated','m3d-wr@test.local',crypt('x',gen_salt('bf')),now(),'{}','{}',now(),now());

insert into public.staff (user_id, display_name, role, active) values
  ('bbbbbbbb-bbbb-4ccc-8ddd-690000000001', 'M3d Editor', 'editor', true),
  ('bbbbbbbb-bbbb-4ccc-8ddd-690000000002', 'M3d Writer', 'writer', true);

-- Editor cannot update/delete published revision
select set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-4ccc-8ddd-690000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select throws_ok(
  $$update public.fragment_revisions
      set change_note = 'tamper'
    where id = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000040'$$,
  '42501',
  'published revisions are immutable',
  'editor cannot update published revision'
);

select throws_ok(
  $$delete from public.fragment_revisions
    where id = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000040'$$,
  '42501',
  'published revisions are immutable',
  'editor cannot delete published revision'
);

reset role;

-- Writer cannot add version to published revision
select set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-4ccc-8ddd-690000000002', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select throws_ok(
  $$insert into public.revision_versions (
     id, revision_id, language, time_window, narration_asset_id, transcript
   ) values (
     'aaaaaaaa-bbbb-4ccc-8ddd-ffff00000069',
     'aaaaaaaa-bbbb-4ccc-8ddd-000000000040',
     'en', 'night',
     'aaaaaaaa-bbbb-4ccc-8ddd-000000000100',
     'illegal night'
   )$$,
  '42501',
  'versions of non-draft revisions are immutable',
  'writer cannot add version to published revision'
);

reset role;

-- D2 numbering + draft editability (postgres / service path)
insert into public.fragment_revisions (
  id, fragment_id, revision_no, change_kind, status, change_note
) values (
  'aaaaaaaa-bbbb-4ccc-8ddd-ffff00000070',
  'aaaaaaaa-bbbb-4ccc-8ddd-000000000037',
  99,
  'correction',
  'draft',
  'm3d numbering test'
);

select is(
  (select revision_no from public.fragment_revisions
    where id = 'aaaaaaaa-bbbb-4ccc-8ddd-ffff00000070'),
  2,
  'D2 assigns next revision_no (frag8 already has rev 1)'
);

update public.fragment_revisions
   set change_note = 'editable'
 where id = 'aaaaaaaa-bbbb-4ccc-8ddd-ffff00000070';

select is(
  (select change_note from public.fragment_revisions
    where id = 'aaaaaaaa-bbbb-4ccc-8ddd-ffff00000070'),
  'editable',
  'draft revisions remain editable'
);

-- After publish (service / no JWT role), authenticated cannot edit
reset role;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claim.role', '', true);

update public.fragment_revisions
   set status = 'published'
 where id = 'aaaaaaaa-bbbb-4ccc-8ddd-ffff00000070';

select set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-4ccc-8ddd-690000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select throws_ok(
  $$update public.fragment_revisions
      set change_note = 'nope'
    where id = 'aaaaaaaa-bbbb-4ccc-8ddd-ffff00000070'$$,
  '42501',
  'published revisions are immutable',
  'authenticated cannot edit after publish'
);

reset role;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claim.role', '', true);

delete from public.fragment_revisions
 where id = 'aaaaaaaa-bbbb-4ccc-8ddd-ffff00000070';

-- First revision gets revision_no = 1
insert into public.fragments (
  id, grove_id, tier, title, teaser, location, visibility, story_order, status
) values (
  'aaaaaaaa-bbbb-4ccc-8ddd-ffff00000072',
  'aaaaaaaa-bbbb-4ccc-8ddd-000000000010',
  'leaf',
  '{"en":"M3d temp"}'::jsonb,
  '{"en":"temp teaser"}'::jsonb,
  (
    select location from public.fragments
    where id = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000030'
  ),
  'standard',
  9999,
  'draft'
);

insert into public.fragment_revisions (
  id, fragment_id, revision_no, change_kind, status
) values (
  'aaaaaaaa-bbbb-4ccc-8ddd-ffff00000073',
  'aaaaaaaa-bbbb-4ccc-8ddd-ffff00000072',
  1, 'contingency', 'draft'
);

select is(
  (select revision_no from public.fragment_revisions
    where id = 'aaaaaaaa-bbbb-4ccc-8ddd-ffff00000073'),
  1,
  'D2 first revision is 1'
);

delete from public.fragment_revisions where id = 'aaaaaaaa-bbbb-4ccc-8ddd-ffff00000073';
delete from public.fragments where id = 'aaaaaaaa-bbbb-4ccc-8ddd-ffff00000072';

select * from finish();
rollback;
