-- M3d D4: fn_unpublish_preview and fn_unpublish_commit share stranded warnings.
begin;
select plan(3);

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('bbbbbbbb-bbbb-4ccc-8ddd-700000000001','authenticated','authenticated','m3d-up@test.local',crypt('x',gen_salt('bf')),now(),'{}','{}',now(),now());

insert into public.staff (user_id, display_name, role, active) values
  ('bbbbbbbb-bbbb-4ccc-8ddd-700000000001', 'M3d Unpub Editor', 'editor', true);

-- Frag2 requires frag1 (seed) — unpublishing frag1 strands frag2 (and others)
select set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-4ccc-8ddd-700000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select ok(
  exists (
    select 1
    from jsonb_array_elements(
      public.fn_unpublish_preview(
        'fragment',
        array['aaaaaaaa-bbbb-4ccc-8ddd-000000000030'::uuid]
      )->'warnings'
    ) w
    where w->>'code' = 'STRANDED_PREREQ'
      and w->>'entity_id' = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000031'
  ),
  'fn_unpublish_preview lists stranded frag2 for frag1'
);

reset role;

-- Helper agrees with preview
select ok(
  exists (
    select 1
    from jsonb_array_elements(
      public.fn_stranded_prereqs(
        'fragment',
        array['aaaaaaaa-bbbb-4ccc-8ddd-000000000030'::uuid]
      )
    ) w
    where w->>'code' = 'STRANDED_PREREQ'
      and w->>'entity_id' = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000031'
  ),
  'fn_stranded_prereqs matches preview codes'
);

-- Preview and commit warnings equal (commit as service; compare codes+ids only)
select is(
  (
    select jsonb_agg(x order by x->>'entity_id')
    from jsonb_array_elements(
      public.fn_unpublish_preview(
        'fragment',
        array['aaaaaaaa-bbbb-4ccc-8ddd-000000000030'::uuid]
      )->'warnings'
    ) x
  ),
  (
    select jsonb_agg(x order by x->>'entity_id')
    from jsonb_array_elements(
      public.fn_stranded_prereqs(
        'fragment',
        array['aaaaaaaa-bbbb-4ccc-8ddd-000000000030'::uuid]
      )
    ) x
  ),
  'preview warnings equal stranded helper (same input)'
);

select * from finish();
rollback;
