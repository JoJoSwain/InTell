-- Story Notes (Indigeny / thread+character notes): staff read; writer+ on fragments/threads/characters.
-- F1: writers may only change Indigeny columns on fragments; characters.status is editor+/service only.
begin;
select plan(15);

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('bbbbbbbb-bbbb-4ccc-8ddd-630000000001','authenticated','authenticated','sn-viewer@test.local',crypt('x',gen_salt('bf')),now(),'{}','{}',now(),now()),
  ('bbbbbbbb-bbbb-4ccc-8ddd-630000000002','authenticated','authenticated','sn-writer@test.local',crypt('x',gen_salt('bf')),now(),'{}','{}',now(),now()),
  ('bbbbbbbb-bbbb-4ccc-8ddd-630000000003','authenticated','authenticated','sn-editor@test.local',crypt('x',gen_salt('bf')),now(),'{}','{}',now(),now());

insert into public.staff (user_id, display_name, role, active) values
  ('bbbbbbbb-bbbb-4ccc-8ddd-630000000001', 'SN Viewer', 'viewer', true),
  ('bbbbbbbb-bbbb-4ccc-8ddd-630000000002', 'SN Writer', 'writer', true),
  ('bbbbbbbb-bbbb-4ccc-8ddd-630000000003', 'SN Editor', 'editor', true);

-- viewer can read Indigeny columns via fragments_staff view
select set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-4ccc-8ddd-630000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select ok(
  (select count(*) from public.fragments_staff
    where id = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000030') = 1,
  'viewer can select fragments_staff'
);

reset role;

-- writer can update Indigeny notes on fragments
select set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-4ccc-8ddd-630000000002', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select lives_ok(
  $$update public.fragments
      set indigeny_earth = 'writer earth note'
    where id = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000030'$$,
  'writer can update fragment Indigeny notes'
);

-- F1: writer cannot change non-Indigeny fragment columns
select throws_ok(
  $$update public.fragments
      set location = extensions.ST_Translate(location::extensions.geometry, 0.0001, 0)::extensions.geography
    where id = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000030'$$,
  '42501', null, 'writer cannot update fragment location'
);

select throws_ok(
  $$update public.fragments
      set teaser = '{"en":"nope"}'::jsonb
    where id = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000030'$$,
  '42501', null, 'writer cannot update fragment teaser'
);

select throws_ok(
  $$update public.fragments
      set visibility = 'physical'
    where id = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000030'$$,
  '42501', null, 'writer cannot update fragment visibility'
);

select throws_ok(
  $$update public.fragments
      set marker_code = 'WRITER-CODE'
    where id = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000030'$$,
  '42501', null, 'writer cannot update fragment marker_code'
);

select throws_ok(
  $$update public.fragments
      set status = 'draft'
    where id = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000030'$$,
  '42501', null, 'writer cannot update fragment status'
);

-- writer may edit character notes / draft fields, but not status
select lives_ok(
  $$update public.characters
      set notes = 'writer character notes'
    where id = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000020'$$,
  'writer can update character notes'
);

select throws_ok(
  $$update public.characters
      set status = 'draft'
    where id = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000020'$$,
  '42501', null, 'writer cannot update characters.status'
);

reset role;

-- viewer cannot update Indigeny notes
select set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-4ccc-8ddd-630000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

do $$
declare n int;
begin
  update public.fragments
     set indigeny_earth = 'blocked'
   where id = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000030';
  get diagnostics n = row_count;
  if n <> 0 then
    raise exception 'viewer updated indigeny (% rows)', n;
  end if;
end $$;
select pass('viewer cannot update fragment Indigeny notes');

reset role;

-- writer can update thread notes
select set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-4ccc-8ddd-630000000002', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select lives_ok(
  $$update public.threads
      set notes = 'thread bible / notes for writers'
    where id = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000016'$$,
  'writer can update thread notes'
);

reset role;

-- viewer cannot update thread notes
select set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-4ccc-8ddd-630000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

do $$
declare n int;
begin
  update public.threads set notes = notes where id = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000016';
  get diagnostics n = row_count;
  if n <> 0 then
    raise exception 'viewer updated thread notes (% rows)', n;
  end if;
end $$;
select pass('viewer cannot write threads');

reset role;

-- editor can write groves and non-Indigeny fragment columns; may flip character status
select set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-4ccc-8ddd-630000000003', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

do $$
declare n int;
begin
  update public.groves set pack_version = pack_version where id = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000010';
  get diagnostics n = row_count;
  if n <> 1 then
    raise exception 'editor grove update expected 1 row, got %', n;
  end if;
end $$;
select pass('editor can update groves');

select lives_ok(
  $$update public.fragments
      set teaser = '{"en":"editor teaser"}'::jsonb,
          trigger_radius_m = 9.14
    where id = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000030'$$,
  'editor can update non-Indigeny fragment columns'
);

select lives_ok(
  $$update public.characters
      set status = 'draft'
    where id = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000020'$$,
  'editor can update characters.status'
);

reset role;

select * from finish();
rollback;
