-- F2: fn_publish_commit / fn_unpublish_commit have no EXECUTE for authenticated.
-- Direct RPC is refused at the grant level for every staff role; editors publish via edge (integration).
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

insert into public.releases (id, name, status)
values ('aaaaaaaa-bbbb-4ccc-8ddd-ffff00000082', 'role-guard release', 'draft');

insert into public.release_items (release_id, entity, entity_id) values
  ('aaaaaaaa-bbbb-4ccc-8ddd-ffff00000082', 'grove', 'aaaaaaaa-bbbb-4ccc-8ddd-000000000010'),
  ('aaaaaaaa-bbbb-4ccc-8ddd-ffff00000082', 'fragment', 'aaaaaaaa-bbbb-4ccc-8ddd-000000000036'),
  ('aaaaaaaa-bbbb-4ccc-8ddd-ffff00000082', 'revision', 'aaaaaaaa-bbbb-4ccc-8ddd-000000000046');

-- non-staff
select set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-4ccc-8ddd-520000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;
select throws_ok(
  $$select public.fn_unpublish_commit(
      'grove', array['aaaaaaaa-bbbb-4ccc-8ddd-000000000010'::uuid]
    )$$,
  '42501', null, 'non-staff cannot fn_unpublish_commit'
);
select throws_ok(
  $$select public.fn_publish_commit('aaaaaaaa-bbbb-4ccc-8ddd-ffff00000082')$$,
  '42501', null, 'non-staff cannot fn_publish_commit'
);
reset role;

-- viewer
select set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-4ccc-8ddd-520000000002', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;
select throws_ok(
  $$select public.fn_unpublish_commit(
      'grove', array['aaaaaaaa-bbbb-4ccc-8ddd-000000000010'::uuid]
    )$$,
  '42501', null, 'viewer cannot fn_unpublish_commit'
);
select throws_ok(
  $$select public.fn_publish_commit('aaaaaaaa-bbbb-4ccc-8ddd-ffff00000082')$$,
  '42501', null, 'viewer cannot fn_publish_commit'
);
reset role;

-- writer
select set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-4ccc-8ddd-520000000003', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;
select throws_ok(
  $$select public.fn_unpublish_commit(
      'grove', array['aaaaaaaa-bbbb-4ccc-8ddd-000000000010'::uuid]
    )$$,
  '42501', null, 'writer cannot fn_unpublish_commit'
);
select throws_ok(
  $$select public.fn_publish_commit('aaaaaaaa-bbbb-4ccc-8ddd-ffff00000082')$$,
  '42501', null, 'writer cannot fn_publish_commit'
);
reset role;

-- editor: direct RPC refused (F2 — edge/service_role only)
select set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-4ccc-8ddd-520000000004', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select throws_ok(
  $$select public.fn_publish_commit('aaaaaaaa-bbbb-4ccc-8ddd-ffff00000082')$$,
  '42501', null, 'editor cannot fn_publish_commit via direct RPC'
);

select throws_ok(
  $$select public.fn_unpublish_commit(
      'fragment',
      array['aaaaaaaa-bbbb-4ccc-8ddd-000000000036'::uuid]
    )$$,
  '42501', null, 'editor cannot fn_unpublish_commit via direct RPC'
);

reset role;

select * from finish();
rollback;
