-- Staff role matrix: viewer/writer/sound/editor/admin/inactive + no-staff (M3a).
begin;
select plan(7);

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('bbbbbbbb-bbbb-4ccc-8ddd-200000000001','authenticated','authenticated','viewer@test.local',crypt('x',gen_salt('bf')),now(),'{}','{}',now(),now()),
  ('bbbbbbbb-bbbb-4ccc-8ddd-200000000002','authenticated','authenticated','writer@test.local',crypt('x',gen_salt('bf')),now(),'{}','{}',now(),now()),
  ('bbbbbbbb-bbbb-4ccc-8ddd-200000000003','authenticated','authenticated','sound@test.local',crypt('x',gen_salt('bf')),now(),'{}','{}',now(),now()),
  ('bbbbbbbb-bbbb-4ccc-8ddd-200000000004','authenticated','authenticated','editor@test.local',crypt('x',gen_salt('bf')),now(),'{}','{}',now(),now()),
  ('bbbbbbbb-bbbb-4ccc-8ddd-200000000005','authenticated','authenticated','admin@test.local',crypt('x',gen_salt('bf')),now(),'{}','{}',now(),now()),
  ('bbbbbbbb-bbbb-4ccc-8ddd-200000000006','authenticated','authenticated','inactive@test.local',crypt('x',gen_salt('bf')),now(),'{}','{}',now(),now()),
  ('bbbbbbbb-bbbb-4ccc-8ddd-200000000007','authenticated','authenticated','nostaff2@test.local',crypt('x',gen_salt('bf')),now(),'{}','{}',now(),now());

insert into public.staff (user_id, display_name, role, active) values
  ('bbbbbbbb-bbbb-4ccc-8ddd-200000000001', 'Viewer', 'viewer', true),
  ('bbbbbbbb-bbbb-4ccc-8ddd-200000000002', 'Writer', 'writer', true),
  ('bbbbbbbb-bbbb-4ccc-8ddd-200000000003', 'Sound', 'sound', true),
  ('bbbbbbbb-bbbb-4ccc-8ddd-200000000004', 'Editor', 'editor', true),
  ('bbbbbbbb-bbbb-4ccc-8ddd-200000000005', 'Admin', 'admin', true),
  ('bbbbbbbb-bbbb-4ccc-8ddd-200000000006', 'Inactive', 'viewer', false);

insert into public.fragment_revisions (
  id, fragment_id, revision_no, status, change_kind, change_note
) values (
  'aaaaaaaa-bbbb-4ccc-8ddd-ffff00000070',
  'aaaaaaaa-bbbb-4ccc-8ddd-000000000030',
  9,
  'draft',
  'contingency',
  'rls test'
);

-- viewer cannot write groves (USING fails → 0 rows)
select set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-4ccc-8ddd-200000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

do $$
declare
  n int;
begin
  update public.groves
     set pack_version = pack_version
   where id = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000010';
  get diagnostics n = row_count;
  if n <> 0 then
    raise exception 'viewer grove update affected % rows', n;
  end if;
end $$;
select pass('viewer cannot write groves');

reset role;

-- writer cannot publish revision to published (WITH CHECK fails)
select set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-4ccc-8ddd-200000000002', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select throws_ok(
  $$update public.fragment_revisions
      set status = 'published'
    where id = 'aaaaaaaa-bbbb-4ccc-8ddd-ffff00000070'$$,
  '42501',
  null,
  'writer cannot publish revision to published'
);

reset role;

-- sound cannot update groves
select set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-4ccc-8ddd-200000000003', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

do $$
declare
  n int;
begin
  update public.groves
     set pack_version = pack_version + 1
   where id = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000010';
  get diagnostics n = row_count;
  if n <> 0 then
    raise exception 'sound grove update affected % rows', n;
  end if;
end $$;
select pass('sound cannot update groves');

reset role;

-- editor cannot insert staff
select set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-4ccc-8ddd-200000000004', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select throws_ok(
  $$insert into public.staff (user_id, display_name, role, active)
    values ('bbbbbbbb-bbbb-4ccc-8ddd-200000000007', 'Nope', 'viewer', true)$$,
  '42501',
  null,
  'editor cannot insert staff'
);

reset role;

-- inactive staff sees nothing
select set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-4ccc-8ddd-200000000006', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select is(
  (select count(*)::int from public.regions),
  0,
  'inactive staff sees nothing'
);

reset role;

-- no-staff authenticated sees nothing
select set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-4ccc-8ddd-200000000007', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select is(
  (select count(*)::int from public.published_snapshots),
  0,
  'no-staff authenticated sees nothing'
);

reset role;

-- admin can select staff
select set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-4ccc-8ddd-200000000005', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select ok(
  (select count(*) from public.staff) >= 5,
  'admin can select staff rows'
);

reset role;

select * from finish();
rollback;