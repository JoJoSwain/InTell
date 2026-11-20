-- physical visibility: marker_code required; packs get hash only (M3a / B8).
begin;
select plan(4);

select throws_ok(
  $$insert into public.fragments (
     grove_id, tier, title, location, visibility,
     trigger_radius_m, marker_code, story_order, status
   ) values (
     'aaaaaaaa-bbbb-4ccc-8ddd-000000000010',
     'leaf',
     '{"en":"no code"}'::jsonb,
     (
       select extensions.ST_Centroid(boundary)::extensions.geography
       from public.groves where id = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000010'
     ),
     'physical',
     25,
     null,
     993,
     'draft'
   )$$,
  '23514',
  null,
  'physical without marker_code fails check constraint'
);

select ok(
  (
    select data->>'markerHash' = encode(
      extensions.digest('DEMO-001', 'sha256'),
      'hex'
    )
    from public.published_snapshots
    where entity = 'fragment'
      and entity_id = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000038'
  ),
  'published physical fragment snapshot stores markerHash from code'
);

select ok(
  (
    select data->>'triggerRadiusM' is null
       and data->'location' is not null
    from public.published_snapshots
    where entity = 'fragment'
      and entity_id = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000038'
  ),
  'physical snapshot omits triggerRadiusM but keeps location'
);

-- working marker_code is not copied into snapshot projection
select ok(
  (
    select not (public.fn_snapshot_projection(
      'fragment',
      'aaaaaaaa-bbbb-4ccc-8ddd-000000000038'
    ) ? 'markerCode')
  ),
  'fn_snapshot_projection never exposes markerCode'
);

select * from finish();
rollback;