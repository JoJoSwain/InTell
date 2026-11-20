-- fn_enqueue_due_publish_at enqueues rebuild for recent publish_at.
begin;
select plan(1);

delete from public.jobs;

update public.fragment_revisions
   set publish_at = now() - interval '2 minutes'
 where id = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000040';

select public.fn_enqueue_due_publish_at();

select ok(
  exists (
    select 1 from public.jobs
    where kind = 'rebuild_pack'
      and (
        payload->>'grove_id' = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000010'
        or payload->>'region_id' = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000001'
      )
  ),
  'due publish_at enqueues rebuild_pack'
);

select * from finish();
rollback;
