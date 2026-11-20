-- R3: anon cannot execute funcs that return coords; audit/jobs omit codes/coords;
-- viewer cannot read private-docs. Covers frag9 (protected DEMO-001).
begin;
select plan(5);

-- M2b C19: anon may execute get_pack_index only (index has no protected coords)
select is(
  (
    select count(*)::int
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prokind = 'f'
      and has_function_privilege('anon', p.oid, 'EXECUTE')
  ),
  1,
  'anon executes exactly one public function (get_pack_index)'
);

delete from public.audit_log;
delete from public.jobs;

-- update protected fragment frag9 (Hidden Post / DEMO-001)
update public.fragments
   set title = title || jsonb_build_object('t', 'audit')
 where id = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000038';

select ok(
  not exists (
    select 1 from public.audit_log
    where detail::text like '%DEMO-001%'
       or detail::text like '%40.96%'
       or detail::text like '%-111.9%'
  ),
  'audit_log.detail has no DEMO-001 or coordinate numbers'
);

-- also force a rights job path and check payloads
update public.consents
   set status = 'revoked', revoked_on = current_date, revoked_reason = 'r3'
 where id = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000051';

select ok(
  not exists (
    select 1 from public.jobs
    where payload::text like '%DEMO-001%'
       or payload::text like '%40.96%'
       or payload::text like '%-111.9%'
       or payload::text ~* 'marker_code'
  ),
  'jobs.payload has no DEMO-001 or coordinate numbers'
);

-- storage: insert private-docs object, viewer cannot read
insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  'bbbbbbbb-bbbb-4ccc-8ddd-400000000001',
  'authenticated', 'authenticated', 'docs-viewer@test.local',
  crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now()
);

insert into public.staff (user_id, display_name, role, active) values
  ('bbbbbbbb-bbbb-4ccc-8ddd-400000000001', 'Docs Viewer', 'viewer', true);

insert into storage.objects (bucket_id, name)
values ('private-docs', 'consents/pgtap-test.pdf');

select set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-4ccc-8ddd-400000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select is(
  (select count(*)::int from storage.objects
    where bucket_id = 'private-docs' and name = 'consents/pgtap-test.pdf'),
  0,
  'viewer cannot read private-docs objects'
);

reset role;

select ok(
  exists (
    select 1 from storage.objects
    where bucket_id = 'private-docs' and name = 'consents/pgtap-test.pdf'
  ),
  'private-docs object exists for service/postgres'
);

select * from finish();
rollback;
