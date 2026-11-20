-- M3a: anon may execute get_pack_index only; index lists live builds with published grove snapshots.
begin;
select plan(6);

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
  'anon has execute on exactly one public function'
);

select ok(
  has_function_privilege('anon', 'public.get_pack_index()', 'EXECUTE'),
  'anon can execute get_pack_index'
);

-- Empty index when no live pack_builds (seed queues rebuilds but does not insert builds)
select is(
  public.get_pack_index(),
  '[]'::jsonb,
  'get_pack_index returns [] with no live pack_builds'
);

-- Non-live build is invisible
insert into public.pack_builds (
  scope, scope_id, version, manifest_path, manifest_sha256, asset_hashes, bytes_total, live
) values (
  'grove',
  'aaaaaaaa-bbbb-4ccc-8ddd-000000000010',
  99,
  'packs/grove/test/nonlive.json',
  repeat('a', 64),
  '{}',
  1,
  false
);

select is(
  public.get_pack_index(),
  '[]'::jsonb,
  'non-live pack_build omitted from index'
);

-- Live grove build included when grove snapshot is published
insert into public.pack_builds (
  scope, scope_id, version, manifest_path, manifest_sha256, asset_hashes, bytes_total,
  live, release_id
) values (
  'grove',
  'aaaaaaaa-bbbb-4ccc-8ddd-000000000010',
  100,
  'packs/grove/test/live.json',
  repeat('b', 64),
  '{}',
  2,
  true,
  'aaaaaaaa-bbbb-4ccc-8ddd-0000000000e0'
);

select ok(
  (
    select count(*) = 1
    from jsonb_array_elements(public.get_pack_index()) e
    where e->>'scope' = 'grove'
      and e->>'id' = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000010'
      and (e->>'version')::int = 100
  ),
  'live grove build appears in get_pack_index'
);

-- Unpublished grove snapshot removes grove from index even if build is live
update public.published_snapshots
   set data = jsonb_set(data, '{status}', '"unpublished"')
 where entity = 'grove' and entity_id = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000010';

select is(
  public.get_pack_index(),
  '[]'::jsonb,
  'unpublished grove snapshot hides grove from index'
);

select * from finish();
rollback;