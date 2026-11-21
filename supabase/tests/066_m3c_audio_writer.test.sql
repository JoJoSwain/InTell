-- Answer 1: writer may insert audio_assets; viewer may not.
begin;
select plan(2);

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('bbbbbbbb-bbbb-4ccc-8ddd-310000000001','authenticated','authenticated','m3c-aud-writer@test.local',crypt('x',gen_salt('bf')),now(),'{}','{}',now(),now()),
  ('bbbbbbbb-bbbb-4ccc-8ddd-310000000002','authenticated','authenticated','m3c-aud-viewer@test.local',crypt('x',gen_salt('bf')),now(),'{}','{}',now(),now());

insert into public.staff (user_id, display_name, role, active) values
  ('bbbbbbbb-bbbb-4ccc-8ddd-310000000001', 'Aud Writer', 'writer', true),
  ('bbbbbbbb-bbbb-4ccc-8ddd-310000000002', 'Aud Viewer', 'viewer', true);

select set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-4ccc-8ddd-310000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select lives_ok(
  $$insert into public.audio_assets (
      id, sha256, ext, bytes, duration_ms, channels, sample_rate, bitrate_kbps,
      kind, title, staging_path, created_by
    ) values (
      'aaaaaaaa-bbbb-4ccc-8ddd-ffff000000a1',
      'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      'm4a', 1000, 1000, 1, 48000, 96,
      'narration', 'Writer upload', 'staging-audio/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.m4a',
      'bbbbbbbb-bbbb-4ccc-8ddd-310000000001'
    )$$,
  'writer can insert audio_assets'
);

reset role;

select set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-4ccc-8ddd-310000000002', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select throws_ok(
  $$insert into public.audio_assets (
      id, sha256, ext, bytes, duration_ms, channels, sample_rate, bitrate_kbps,
      kind, title, staging_path, created_by
    ) values (
      'aaaaaaaa-bbbb-4ccc-8ddd-ffff000000a2',
      'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      'm4a', 1000, 1000, 1, 48000, 96,
      'narration', 'Viewer upload', 'staging-audio/bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb.m4a',
      'bbbbbbbb-bbbb-4ccc-8ddd-310000000002'
    )$$,
  '42501',
  null,
  'viewer cannot insert audio_assets'
);

select * from finish();
rollback;
