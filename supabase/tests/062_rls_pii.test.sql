-- PII columns null for viewer/writer via staff views; editor sees values.
begin;
select plan(6);

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('bbbbbbbb-bbbb-4ccc-8ddd-300000000001','authenticated','authenticated','pii-viewer@test.local',crypt('x',gen_salt('bf')),now(),'{}','{}',now(),now()),
  ('bbbbbbbb-bbbb-4ccc-8ddd-300000000002','authenticated','authenticated','pii-writer@test.local',crypt('x',gen_salt('bf')),now(),'{}','{}',now(),now()),
  ('bbbbbbbb-bbbb-4ccc-8ddd-300000000003','authenticated','authenticated','pii-editor@test.local',crypt('x',gen_salt('bf')),now(),'{}','{}',now(),now());

insert into public.staff (user_id, display_name, role, active) values
  ('bbbbbbbb-bbbb-4ccc-8ddd-300000000001', 'PII Viewer', 'viewer', true),
  ('bbbbbbbb-bbbb-4ccc-8ddd-300000000002', 'PII Writer', 'writer', true),
  ('bbbbbbbb-bbbb-4ccc-8ddd-300000000003', 'PII Editor', 'editor', true);

update public.contributors
   set legal_name = 'Secret Legal Name'
 where id = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000050';

insert into public.devices (id, platform) values
  ('bbbbbbbb-bbbb-4ccc-8ddd-300000000010', 'test');

insert into public.seeds (
  id, device_id, client_seed_id, grove_id, ring_id, planted_on_site,
  kind, body, memory_contact, terms_version, planted_at
) values (
  'aaaaaaaa-bbbb-4ccc-8ddd-000000000055',
  'bbbbbbbb-bbbb-4ccc-8ddd-300000000010',
  'bbbbbbbb-bbbb-4ccc-8ddd-300000000011',
  'aaaaaaaa-bbbb-4ccc-8ddd-000000000010',
  'aaaaaaaa-bbbb-4ccc-8ddd-000000000011',
  true,
  'memory',
  'test seed body',
  'secret@example.com',
  1,
  now()
);

-- viewer
select set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-4ccc-8ddd-300000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select is(
  (select legal_name from public.contributors_staff
    where id = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000050'),
  null,
  'viewer sees null legal_name'
);

select is(
  (select memory_contact from public.seeds_staff
    where id = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000055'),
  null,
  'viewer sees null memory_contact'
);

reset role;

-- writer
select set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-4ccc-8ddd-300000000002', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select is(
  (select legal_name from public.contributors_staff
    where id = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000050'),
  null,
  'writer sees null legal_name'
);

select is(
  (select memory_contact from public.seeds_staff
    where id = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000055'),
  null,
  'writer sees null memory_contact'
);

reset role;

-- editor
select set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-4ccc-8ddd-300000000003', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select is(
  (select legal_name from public.contributors_staff
    where id = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000050'),
  'Secret Legal Name',
  'editor sees legal_name'
);

select is(
  (select memory_contact from public.seeds_staff
    where id = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000055'),
  'secret@example.com',
  'editor sees memory_contact'
);

reset role;

select * from finish();
rollback;
