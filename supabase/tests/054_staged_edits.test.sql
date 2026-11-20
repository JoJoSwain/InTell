-- R1: working-row edits do not change published_snapshots until the next release commit.
begin;
select plan(3);

select set_config('request.jwt.claim.role', 'service_role', true);

select ok(
  (
    select data->'teaser'->>'en'
    from public.published_snapshots
    where entity = 'fragment'
      and entity_id = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000030'
  ) is not null,
  'snapshot has teaser before staged edit'
);

update public.fragments
   set teaser = '{"en":"STAGED edit must not leak"}'::jsonb,
       title = '{"en":"STAGED title"}'::jsonb
 where id = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000030';

select ok(
  (
    select data->'teaser'->>'en'
      <> (select teaser->>'en' from public.fragments
           where id = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000030')
    from public.published_snapshots
    where entity = 'fragment'
      and entity_id = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000030'
  ),
  'snapshot teaser unchanged while working fragment teaser was edited'
);

select ok(
  (
    public.fn_snapshot_projection(
      'fragment',
      'aaaaaaaa-bbbb-4ccc-8ddd-000000000030'
    )->'teaser'->>'en'
  ) = 'STAGED edit must not leak',
  'projection reflects working row (unreleased change)'
);

select * from finish();
rollback;