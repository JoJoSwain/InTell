-- M3b: F1 allowlist, last-admin (A1), audit_log editor+ select.
begin;
select plan(11);

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('bbbbbbbb-bbbb-4ccc-8ddd-640000000001','authenticated','authenticated','m3b-admin1@test.local',crypt('x',gen_salt('bf')),now(),'{}','{}',now(),now()),
  ('bbbbbbbb-bbbb-4ccc-8ddd-640000000002','authenticated','authenticated','m3b-admin2@test.local',crypt('x',gen_salt('bf')),now(),'{}','{}',now(),now()),
  ('bbbbbbbb-bbbb-4ccc-8ddd-640000000003','authenticated','authenticated','m3b-writer@test.local',crypt('x',gen_salt('bf')),now(),'{}','{}',now(),now()),
  ('bbbbbbbb-bbbb-4ccc-8ddd-640000000004','authenticated','authenticated','m3b-viewer@test.local',crypt('x',gen_salt('bf')),now(),'{}','{}',now(),now()),
  ('bbbbbbbb-bbbb-4ccc-8ddd-640000000005','authenticated','authenticated','m3b-editor@test.local',crypt('x',gen_salt('bf')),now(),'{}','{}',now(),now());

insert into public.staff (user_id, display_name, role, active) values
  ('bbbbbbbb-bbbb-4ccc-8ddd-640000000001', 'M3b Admin1', 'admin', true),
  ('bbbbbbbb-bbbb-4ccc-8ddd-640000000002', 'M3b Admin2', 'admin', true),
  ('bbbbbbbb-bbbb-4ccc-8ddd-640000000003', 'M3b Writer', 'writer', true),
  ('bbbbbbbb-bbbb-4ccc-8ddd-640000000004', 'M3b Viewer', 'viewer', true),
  ('bbbbbbbb-bbbb-4ccc-8ddd-640000000005', 'M3b Editor', 'editor', true);

-- A1: last admin cannot demote / deactivate
select set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-4ccc-8ddd-640000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

-- demote admin2 while admin1 remains → ok
select lives_ok(
  $$update public.staff
      set role = 'editor'
    where user_id = 'bbbbbbbb-bbbb-4ccc-8ddd-640000000002'$$,
  'demoting a non-last admin succeeds'
);

-- restore admin2 for next case
reset role;
update public.staff
   set role = 'admin'
 where user_id = 'bbbbbbbb-bbbb-4ccc-8ddd-640000000002';

select set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-4ccc-8ddd-640000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

-- deactivate admin2 while admin1 remains → ok
select lives_ok(
  $$update public.staff
      set active = false
    where user_id = 'bbbbbbbb-bbbb-4ccc-8ddd-640000000002'$$,
  'deactivating a non-last admin succeeds'
);

-- now only admin1 is active admin; demoting admin1 fails
select throws_ok(
  $$update public.staff
      set role = 'editor'
    where user_id = 'bbbbbbbb-bbbb-4ccc-8ddd-640000000001'$$,
  '42501', null, 'cannot demote the last active admin'
);

select throws_ok(
  $$update public.staff
      set active = false
    where user_id = 'bbbbbbbb-bbbb-4ccc-8ddd-640000000001'$$,
  '42501', null, 'cannot deactivate the last active admin'
);

reset role;

-- F1 allowlist: writer Indigeny ok; teaser refused (existing); prove new-column protection
-- by checking trigger still refuses status (and jsonb allowlist covers future cols)
select set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-4ccc-8ddd-640000000003', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select lives_ok(
  $$update public.fragments
      set indigeny_world = 'allowlist world'
    where id = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000030'$$,
  'writer can update Indigeny under allowlist'
);

select throws_ok(
  $$update public.fragments
      set teaser = '{"en":"blocked"}'::jsonb
    where id = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000030'$$,
  '42501', null, 'writer cannot update teaser under allowlist'
);

select throws_ok(
  $$update public.fragments
      set status = 'draft'
    where id = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000030'$$,
  '42501', null, 'writer cannot update status under allowlist'
);

reset role;

-- Prove allowlist protects a newly added column by name: alter in transaction,
-- writer update refused, then rollback (this test file already rolls back).
alter table public.fragments add column if not exists m3b_probe_col text;

select set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-4ccc-8ddd-640000000003', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select throws_ok(
  $$update public.fragments
      set m3b_probe_col = 'nope'
    where id = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000030'$$,
  '42501', null, 'writer cannot update newly added fragment column (allowlist)'
);

reset role;

-- Audit log: writer/viewer refused; editor can select
select set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-4ccc-8ddd-640000000003', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select is(
  (select count(*)::int from public.audit_log),
  0,
  'writer cannot see audit_log rows'
);

reset role;

select set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-4ccc-8ddd-640000000004', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select is(
  (select count(*)::int from public.audit_log),
  0,
  'viewer cannot see audit_log rows'
);

reset role;

-- seed an audit row as service, then editor can see it
insert into public.audit_log (actor, action, entity, entity_id, detail)
values (
  'bbbbbbbb-bbbb-4ccc-8ddd-640000000001',
  'test',
  'staff',
  'bbbbbbbb-bbbb-4ccc-8ddd-640000000001',
  '{}'::jsonb
);

select set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-4ccc-8ddd-640000000005', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select ok(
  (select count(*) from public.audit_log where action = 'test') >= 1,
  'editor can select audit_log'
);

reset role;

select * from finish();
rollback;
