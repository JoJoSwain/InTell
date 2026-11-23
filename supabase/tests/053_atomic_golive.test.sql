-- R4: fn_release_go_live flips all release builds live; index waits for live packs.
begin;
select plan(5);

select set_config('request.jwt.claim.role', 'service_role', true);

insert into public.releases (id, name, status)
values ('aaaaaaaa-bbbb-4ccc-8ddd-ffff00000054', 'two-grove golive', 'publishing');

insert into public.pack_builds (
  scope, scope_id, version, manifest_path, manifest_sha256, asset_hashes, bytes_total,
  live, release_id, bbox
) values
  (
    'grove',
    'aaaaaaaa-bbbb-4ccc-8ddd-000000000010',
    201,
    'packs/grove/farm/live.json',
    repeat('c', 64),
    '{}',
    10,
    false,
    'aaaaaaaa-bbbb-4ccc-8ddd-ffff00000054',
    array[-111.93, 40.96, -111.91, 40.97]::double precision[]
  ),
  (
    'grove',
    'aaaaaaaa-bbbb-4ccc-8ddd-0000000000c0',
    202,
    'packs/grove/nearby/live.json',
    repeat('d', 64),
    '{}',
    11,
    false,
    'aaaaaaaa-bbbb-4ccc-8ddd-ffff00000054',
    array[-111.93, 40.96, -111.91, 40.97]::double precision[]
  ),
  (
    'region',
    'aaaaaaaa-bbbb-4ccc-8ddd-000000000001',
    203,
    'packs/region/wasatch/live.json',
    repeat('e', 64),
    '{}',
    12,
    false,
    'aaaaaaaa-bbbb-4ccc-8ddd-ffff00000054',
    null
  );

-- Pending rebuild job blocks go-live
insert into public.jobs (kind, status, payload) values (
  'rebuild_pack',
  'queued',
  jsonb_build_object(
    'grove_id', 'aaaaaaaa-bbbb-4ccc-8ddd-000000000010',
    'release_id', 'aaaaaaaa-bbbb-4ccc-8ddd-ffff00000054'
  )
);

select ok(
  (public.fn_release_go_live('aaaaaaaa-bbbb-4ccc-8ddd-ffff00000054')->>'live')::boolean is false,
  'go-live deferred while rebuild_pack job pending'
);

delete from public.jobs
 where kind = 'rebuild_pack'
   and payload->>'release_id' = 'aaaaaaaa-bbbb-4ccc-8ddd-ffff00000054';

select ok(
  (public.fn_release_go_live('aaaaaaaa-bbbb-4ccc-8ddd-ffff00000054')->>'live')::boolean,
  'go-live succeeds when no pending jobs'
);

select ok(
  (
    select bool_and(live)
    from public.pack_builds
    where release_id = 'aaaaaaaa-bbbb-4ccc-8ddd-ffff00000054'
  ),
  'all release pack_builds flipped live'
);

select is(
  (select status from public.releases
    where id = 'aaaaaaaa-bbbb-4ccc-8ddd-ffff00000054'),
  'published'::public.release_status,
  'release status becomes published'
);

select ok(
  (
    select count(*) = 2
    from jsonb_array_elements(public.get_pack_index()) e
    where e->>'scope' = 'grove'
  ),
  'get_pack_index lists both live grove packs after go-live'
);

select * from finish();
rollback;