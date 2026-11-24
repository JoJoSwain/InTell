-- A5: sound publish helpers (TRANSIENT, STEMS_OVER_MAX, GROWTH_STEPS_OVER_MAX)

begin;
select plan(5);

select has_function('public', 'fn_a5_sound_check_issues', array['uuid']);
select has_function('public', 'fn_check_audio_asset', array['public.audio_assets']);

-- Seeded release: A5 adds RESOLVE_MISSING warnings for cues without resolves,
-- but no errors (ok stays true).
select ok(
  (
    select not exists (
      select 1
      from jsonb_array_elements(public.fn_a5_sound_check_issues(
        'aaaaaaaa-bbbb-4ccc-8ddd-0000000000e0'
      )) e
      where e->>'severity' = 'error'
    )
  ),
  'seed release has no A5 sound errors'
);

select ok(
  (
    select count(*) >= 4
    from jsonb_array_elements(public.fn_a5_sound_check_issues(
      'aaaaaaaa-bbbb-4ccc-8ddd-0000000000e0'
    )) e
    where e->>'code' = 'RESOLVE_MISSING'
  ),
  'seed cues without resolves emit RESOLVE_MISSING warnings'
);

-- TRANSIENT when crest_factor_db > 20
update public.audio_assets
set crest_factor_db = 21
where id = (
  select narration_asset_id from public.revision_versions limit 1
);

select ok(
  exists (
    select 1
    from public.audio_assets a,
         lateral jsonb_array_elements(public.fn_check_audio_asset(a)) e
    where a.crest_factor_db > 20
      and e->>'code' = 'TRANSIENT'
  ),
  'TRANSIENT warning when crest_factor_db > 20'
);

select * from finish();
rollback;
