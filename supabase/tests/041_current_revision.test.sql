-- fn_current_revision via fn_revision_is_playable + published snapshots (M3a).
begin;
select plan(2);

select is(
  public.fn_current_revision('aaaaaaaa-bbbb-4ccc-8ddd-000000000033'),
  'aaaaaaaa-bbbb-4ccc-8ddd-00000000004b'::uuid,
  'frag4 current revision is r2 (correction published)'
);

select is(
  public.fn_current_revision('aaaaaaaa-bbbb-4ccc-8ddd-000000000039'),
  'aaaaaaaa-bbbb-4ccc-8ddd-00000000004a'::uuid,
  'frag10 current revision is r2 contingency'
);

select * from finish();
rollback;