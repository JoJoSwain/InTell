-- M3d: draft_check revision/audio codes via shared fn_check_revision_local.
begin;
select plan(3);

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('bbbbbbbb-bbbb-4ccc-8ddd-710000000001','authenticated','authenticated','m3d-dc@test.local',crypt('x',gen_salt('bf')),now(),'{}','{}',now(),now());

insert into public.staff (user_id, display_name, role, active) values
  ('bbbbbbbb-bbbb-4ccc-8ddd-710000000001', 'M3d Draft Staff', 'writer', true);

-- Draft revision with no versions → NO_VERSION
insert into public.fragment_revisions (
  id, fragment_id, revision_no, change_kind, status
) values (
  'aaaaaaaa-bbbb-4ccc-8ddd-ffff00000074',
  'aaaaaaaa-bbbb-4ccc-8ddd-000000000037',
  2, 'correction', 'draft'
);

select set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-4ccc-8ddd-710000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select ok(
  exists (
    select 1
    from jsonb_array_elements(
      public.fn_draft_check('aaaaaaaa-bbbb-4ccc-8ddd-000000000010')->'failures'
    ) f
    where f->>'code' = 'NO_VERSION'
      and f->>'entity_id' = 'aaaaaaaa-bbbb-4ccc-8ddd-ffff00000074'
  ),
  'fn_draft_check reports NO_VERSION for draft revision without versions'
);

reset role;

-- Shared helper agrees
select ok(
  exists (
    select 1
    from jsonb_array_elements(
      public.fn_check_revision_local(
        (select r from public.fragment_revisions r
          where id = 'aaaaaaaa-bbbb-4ccc-8ddd-ffff00000074')
      )
    ) f
    where f->>'code' = 'NO_VERSION'
  ),
  'fn_check_revision_local reports NO_VERSION'
);

-- Add empty transcript version → NO_TRANSCRIPT
insert into public.revision_versions (
  id, revision_id, language, time_window, narration_asset_id, transcript
) values (
  'aaaaaaaa-bbbb-4ccc-8ddd-ffff00000075',
  'aaaaaaaa-bbbb-4ccc-8ddd-ffff00000074',
  'en', 'day',
  'aaaaaaaa-bbbb-4ccc-8ddd-000000000107',
  '   '
);

select ok(
  exists (
    select 1
    from jsonb_array_elements(
      public.fn_check_revision_local(
        (select r from public.fragment_revisions r
          where id = 'aaaaaaaa-bbbb-4ccc-8ddd-ffff00000074')
      )
    ) f
    where f->>'code' = 'NO_TRANSCRIPT'
  ),
  'fn_check_revision_local reports NO_TRANSCRIPT for blank transcript'
);

delete from public.revision_versions where id = 'aaaaaaaa-bbbb-4ccc-8ddd-ffff00000075';
delete from public.fragment_revisions where id = 'aaaaaaaa-bbbb-4ccc-8ddd-ffff00000074';

select * from finish();
rollback;
