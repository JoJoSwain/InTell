-- M3e A18: fn_snapshot_projection contract — journeys, no accessNotes, homeGroveId
begin;
select plan(5);

select set_config('request.jwt.claim.role', 'service_role', true);

select ok(
  (public.fn_snapshot_projection('grove', 'aaaaaaaa-bbbb-4ccc-8ddd-000000000010')
    -> 'journeys' -> 'walk' ->> 'en') like 'TEST walk%',
  'grove projection includes walk journey'
);

select ok(
  not (public.fn_snapshot_projection('grove', 'aaaaaaaa-bbbb-4ccc-8ddd-000000000010')
    ? 'accessNotes'),
  'grove projection has no accessNotes'
);

select is(
  public.fn_snapshot_projection('character', 'aaaaaaaa-bbbb-4ccc-8ddd-000000000020')
    ->> 'homeGroveId',
  'aaaaaaaa-bbbb-4ccc-8ddd-000000000010',
  'character projection includes homeGroveId'
);

select ok(
  public.fn_l10n_blank(
    public.fn_snapshot_projection('grove', 'aaaaaaaa-bbbb-4ccc-8ddd-000000000010')
      -> 'journeys' -> 'drive'
  ),
  'no drive journey key in projection (blank/missing)'
);

-- pack_builds opening columns exist
select ok(
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'pack_builds'
      and column_name = 'opening_lat'
  )
  and exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'pack_builds'
      and column_name = 'opening_lng'
  ),
  'pack_builds has opening_lat/opening_lng'
);

select * from finish();
rollback;
