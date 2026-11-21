-- B1: viewer cannot delete fragment_threads / fragment_characters / journal_terms;
-- writer can delete fragment_threads; editor can delete journal_terms.
-- Also: for-all policies must not have USING wider than WITH CHECK.
begin;
select plan(6);

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('bbbbbbbb-bbbb-4ccc-8ddd-300000000001','authenticated','authenticated','m3c-viewer@test.local',crypt('x',gen_salt('bf')),now(),'{}','{}',now(),now()),
  ('bbbbbbbb-bbbb-4ccc-8ddd-300000000002','authenticated','authenticated','m3c-writer@test.local',crypt('x',gen_salt('bf')),now(),'{}','{}',now(),now()),
  ('bbbbbbbb-bbbb-4ccc-8ddd-300000000003','authenticated','authenticated','m3c-editor@test.local',crypt('x',gen_salt('bf')),now(),'{}','{}',now(),now());

insert into public.staff (user_id, display_name, role, active) values
  ('bbbbbbbb-bbbb-4ccc-8ddd-300000000001', 'M3c Viewer', 'viewer', true),
  ('bbbbbbbb-bbbb-4ccc-8ddd-300000000002', 'M3c Writer', 'writer', true),
  ('bbbbbbbb-bbbb-4ccc-8ddd-300000000003', 'M3c Editor', 'editor', true);

-- Seed already has fragment_characters / journal_terms; ensure a fragment_threads row
insert into public.fragment_threads (fragment_id, thread_id)
values ('aaaaaaaa-bbbb-4ccc-8ddd-000000000030', 'aaaaaaaa-bbbb-4ccc-8ddd-000000000020')
on conflict do nothing;

-- viewer delete leaves fragment_threads row
select set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-4ccc-8ddd-300000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

do $$
declare n int;
begin
  delete from public.fragment_threads
   where fragment_id = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000030'
     and thread_id = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000020';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'viewer deleted % fragment_threads rows', n; end if;
end $$;
select pass('viewer delete leaves fragment_threads');

reset role;

select ok(
  exists (
    select 1 from public.fragment_threads
    where fragment_id = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000030'
      and thread_id = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000020'
  ),
  'fragment_threads row still present after viewer delete'
);

-- writer can delete fragment_threads
select set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-4ccc-8ddd-300000000002', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

do $$
declare n int;
begin
  delete from public.fragment_threads
   where fragment_id = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000030'
     and thread_id = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000020';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'writer expected to delete 1 row, got %', n; end if;
end $$;
select pass('writer can delete fragment_threads');

reset role;

-- viewer cannot delete journal_terms
select set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-4ccc-8ddd-300000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

do $$
declare n int;
begin
  delete from public.journal_terms where version = 1;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'viewer deleted % journal_terms', n; end if;
end $$;
select pass('viewer cannot delete journal_terms');

reset role;

-- editor can delete a disposable journal_terms row
insert into public.journal_terms (version, body, effective_at)
values (999, '{"en":"m3c delete test"}'::jsonb, now());

select set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-4ccc-8ddd-300000000003', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

do $$
declare n int;
begin
  delete from public.journal_terms where version = 999;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'editor expected to delete 1 journal_terms, got %', n; end if;
end $$;
select pass('editor can delete journal_terms');

reset role;

-- Guard: no for-all policy with USING wider than WITH CHECK (qual mentions more roles than with_check)
select is(
  (
    select count(*)::int
    from pg_policies
    where schemaname = 'public'
      and cmd = 'ALL'
      and qual is not null
      and with_check is not null
      and qual <> with_check
  ),
  0,
  'no for-all policy has USING distinct from WITH CHECK'
);

select * from finish();
rollback;
