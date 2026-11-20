-- R4: fn_enqueue_due_releases + failed check stores last_check on release.
begin;
select plan(5);

select set_config('request.jwt.claim.role', 'service_role', true);

insert into public.releases (id, name, status, publish_at)
values (
  'aaaaaaaa-bbbb-4ccc-8ddd-ffff00000052',
  'scheduled ok',
  'scheduled',
  now() + interval '10 minutes'
);

select is(
  (select count(*)::int from public.jobs where kind = 'publish_release'),
  0,
  'future scheduled release is not enqueued yet'
);

update public.releases
   set publish_at = now() - interval '1 minute'
 where id = 'aaaaaaaa-bbbb-4ccc-8ddd-ffff00000052';

select public.fn_enqueue_due_releases();

select ok(
  exists (
    select 1 from public.jobs
    where kind = 'publish_release'
      and payload->>'release_id' = 'aaaaaaaa-bbbb-4ccc-8ddd-ffff00000052'
  ),
  'fn_enqueue_due_releases inserts publish_release job'
);

select is(
  (select status from public.releases
    where id = 'aaaaaaaa-bbbb-4ccc-8ddd-ffff00000052'),
  'publishing'::public.release_status,
  'due release moves to publishing'
);

-- Check failure path (edge marks failed; SQL stores last_check from fn_publish_check)
insert into public.releases (id, name, status) values
  ('aaaaaaaa-bbbb-4ccc-8ddd-ffff00000053', 'bad release', 'scheduled');

insert into public.release_items (release_id, entity, entity_id) values
  ('aaaaaaaa-bbbb-4ccc-8ddd-ffff00000053', 'image', 'aaaaaaaa-bbbb-4ccc-8ddd-000000000140');

update public.image_assets set alt_text = '{}'::jsonb
 where id = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000140';

select ok(
  (public.fn_publish_check('aaaaaaaa-bbbb-4ccc-8ddd-ffff00000053')->>'ok')::boolean is false,
  'fn_publish_check fails release with empty alt text image'
);

update public.releases
   set status = 'failed'
 where id = 'aaaaaaaa-bbbb-4ccc-8ddd-ffff00000053';

select ok(
  (
    select (last_check->>'ok')::boolean is false
       and exists (
         select 1
         from jsonb_array_elements(last_check->'failures') f
         where f->>'code' = 'NO_ALT_TEXT'
       )
    from public.releases
    where id = 'aaaaaaaa-bbbb-4ccc-8ddd-ffff00000053'
  ),
  'failed release retains last_check with checklist errors'
);

update public.image_assets
   set alt_text = '{"en":"Portrait A alt"}'::jsonb
 where id = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000140';

select * from finish();
rollback;