-- Story Notes (Indigeny / thread+character notes): staff read; writer+ on fragments/threads/characters.
begin;
select plan(6);

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

-- editor can write groves
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

reset role;

select * from finish();
rollback;