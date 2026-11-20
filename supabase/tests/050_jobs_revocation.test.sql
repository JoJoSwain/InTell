-- Revoking demo consent enqueues rebuild_pack and purge_asset; payloads are ids-only.
begin;
select plan(4);

delete from public.jobs;

update public.consents
   set status = 'revoked', revoked_on = current_date, revoked_reason = 'pgTAP revoke'
 where id = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000051';

select ok(
  exists (select 1 from public.jobs where kind = 'rebuild_pack'),
  'rebuild_pack job appears after consent revoke'
);

select ok(
  exists (select 1 from public.jobs where kind = 'purge_asset'),
  'purge_asset job appears after consent revoke'
);

select ok(
  not exists (
    select 1 from public.jobs j
    where j.payload::text ~* '(location|marker_code|"lat"|"lng"|markerCode|DEMO-001)'
  ),
  'job payloads have no coords or marker_code'
);

select ok(
  not exists (
    select 1 from public.jobs j
    where j.payload::text like '%40.89%'
       or j.payload::text like '%-111.9%'
  ),
  'job payloads have no coordinate numbers'
);

select * from finish();
rollback;
