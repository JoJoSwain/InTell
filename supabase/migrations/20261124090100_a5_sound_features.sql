-- A5 Part 1: sound feature columns, asset kinds, grove_sound_cues, publish helpers.

-- ---------------------------------------------------------------------------
-- Enum: music_moment (resolves/motifs), beacon
-- ---------------------------------------------------------------------------
alter type public.asset_kind add value if not exists 'music_moment';
alter type public.asset_kind add value if not exists 'beacon';

-- ---------------------------------------------------------------------------
-- Columns
-- ---------------------------------------------------------------------------
alter table public.audio_assets
  add column if not exists crest_factor_db numeric(5,2),
  add column if not exists safe_for_walkers_checked boolean not null default false;

alter table public.groves
  add column if not exists depth_bloom_texture_m numeric(6,2) not null default 15
    constraint groves_depth_bloom_texture_m_positive check (depth_bloom_texture_m > 0);

alter table public.fragments
  add column if not exists beacon_asset_id uuid references public.audio_assets(id),
  add column if not exists resolve_asset_id uuid references public.audio_assets(id),
  add column if not exists teaser_locked_asset_id uuid references public.audio_assets(id);

alter table public.revision_versions
  add column if not exists breath_points_ms int[] not null default '{}',
  add column if not exists swell_cues_ms int[] not null default '{}';

alter table public.music_cues
  add column if not exists resolve_root_asset_id uuid references public.audio_assets(id),
  add column if not exists resolve_branch_asset_id uuid references public.audio_assets(id),
  add column if not exists resolve_leaf_asset_id uuid references public.audio_assets(id);

-- ---------------------------------------------------------------------------
-- grove_sound_cues
-- ---------------------------------------------------------------------------
create table if not exists public.grove_sound_cues (
  id uuid primary key default gen_random_uuid(),
  grove_id uuid not null references public.groves(id) on delete cascade,
  kind text not null check (kind in (
    'beacon_root', 'beacon_branch', 'beacon_leaf',
    'threshold_motif_day', 'threshold_motif_night'
  )),
  asset_id uuid not null references public.audio_assets(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (grove_id, kind)
);

create index if not exists grove_sound_cues_grove_id_idx
  on public.grove_sound_cues (grove_id);

alter table public.grove_sound_cues enable row level security;

drop policy if exists grove_sound_cues_staff_select on public.grove_sound_cues;
create policy grove_sound_cues_staff_select on public.grove_sound_cues
  for select to authenticated
  using (public.has_role(array['viewer','moderator','writer','sound','editor','admin']::public.staff_role[]));

drop policy if exists grove_sound_cues_staff_write on public.grove_sound_cues;
create policy grove_sound_cues_staff_write on public.grove_sound_cues
  for all to authenticated
  using (public.has_role(array['sound','editor','admin']::public.staff_role[]))
  with check (public.has_role(array['sound','editor','admin']::public.staff_role[]));

revoke all on table public.grove_sound_cues from public, anon;
grant select on table public.grove_sound_cues to authenticated;
grant insert, update, delete on table public.grove_sound_cues to authenticated;
grant all on table public.grove_sound_cues to service_role;

-- ---------------------------------------------------------------------------
-- Loudness / bitrate / format targets for new kinds + bed mono error + TRANSIENT
-- ---------------------------------------------------------------------------
create or replace function public.fn_audio_loudness_target(p_kind public.asset_kind)
returns numeric
language sql
immutable
set search_path = ''
as $$
  select case p_kind
    when 'narration' then -16::numeric
    when 'sfx_oneshot' then -24::numeric
    when 'sfx_bed' then -30::numeric
    when 'music_stem' then -23::numeric
    when 'music_moment' then -20::numeric
    when 'beacon' then -30::numeric
    when 'voice_cue' then -18::numeric
    when 'growth_cue' then -18::numeric
    else -16::numeric
  end;
$$;

create or replace function public.fn_audio_bitrate_target(p_kind public.asset_kind)
returns int
language sql
immutable
set search_path = ''
as $$
  select case p_kind
    when 'narration' then 96
    when 'sfx_oneshot' then 128
    when 'sfx_bed' then 128
    when 'music_stem' then 160
    when 'music_moment' then 160
    when 'beacon' then 96
    when 'voice_cue' then 96
    when 'growth_cue' then 96
    else 96
  end;
$$;

create or replace function public.fn_check_audio_asset(p_asset public.audio_assets)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  failures jsonb := '[]'::jsonb;
  measured numeric;
  target numeric;
  br_target int;
  channels_ok boolean;
begin
  target := public.fn_audio_loudness_target(p_asset.kind);
  if p_asset.kind = 'sfx_oneshot' then
    measured := coalesce(p_asset.max_short_term_lufs, p_asset.loudness_lufs);
  else
    measured := p_asset.loudness_lufs;
  end if;

  if measured is null then
    failures := failures || jsonb_build_array(public.fn_check_issue(
      'LOUDNESS', 'warning', 'not measured', 'audio_asset', p_asset.id));
  elsif abs(measured - target) > 2 then
    failures := failures || jsonb_build_array(public.fn_check_issue(
      'LOUDNESS', 'warning', 'loudness off target', 'audio_asset', p_asset.id));
  end if;

  br_target := public.fn_audio_bitrate_target(p_asset.kind);
  channels_ok := case p_asset.kind
    when 'narration' then p_asset.channels in (1, 2)
    when 'voice_cue' then p_asset.channels = 1
    when 'growth_cue' then p_asset.channels = 1
    when 'beacon' then p_asset.channels = 1
    when 'sfx_oneshot' then p_asset.channels in (1, 2)
    when 'sfx_bed' then p_asset.channels = 2
    when 'music_stem' then p_asset.channels = 2
    when 'music_moment' then p_asset.channels = 2
    else true
  end;

  if p_asset.kind = 'sfx_bed' and p_asset.channels = 1 then
    failures := failures || jsonb_build_array(public.fn_check_issue(
      'BED_MONO', 'error', 'beds must be stereo', 'audio_asset', p_asset.id));
  end if;

  if p_asset.kind = 'sfx_bed' and p_asset.duration_ms > 120000 then
    failures := failures || jsonb_build_array(public.fn_check_issue(
      'BED_LONG', 'warning', 'bed longer than 2 minutes', 'audio_asset', p_asset.id));
  end if;

  if p_asset.crest_factor_db is not null and p_asset.crest_factor_db > 20 then
    failures := failures || jsonb_build_array(public.fn_check_issue(
      'TRANSIENT', 'warning', 'crest factor over 20 dB', 'audio_asset', p_asset.id));
  end if;

  if p_asset.ext is distinct from 'm4a'
     or not channels_ok
     or p_asset.sample_rate is null
     or p_asset.sample_rate not in (44100, 48000)
     or p_asset.bitrate_kbps is null
     or abs(p_asset.bitrate_kbps::numeric - br_target) > (br_target * 0.15) then
    failures := failures || jsonb_build_array(public.fn_check_issue(
      'AUDIO_FORMAT', 'warning', 'format differs from AUDIO_SPEC', 'audio_asset', p_asset.id));
  end if;

  return failures;
end;
$$;

-- ---------------------------------------------------------------------------
-- Snapshot projection: A5 additive fields (omit nulls; packs omit empty keys)
-- ---------------------------------------------------------------------------
create or replace function public.fn_snapshot_projection(p_entity text, p_entity_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result jsonb;
  v_boundary jsonb;
  loc jsonb;
  journeys jsonb;
begin
  if p_entity = 'grove' then
    select coalesce(
      (
        select jsonb_object_agg(j.mode::text, j.passage)
        from public.grove_journeys j
        where j.grove_id = p_entity_id
          and not public.fn_l10n_blank(j.passage)
      ),
      '{}'::jsonb
    ) into journeys;

    select jsonb_strip_nulls(jsonb_build_object(
      'id', g.id,
      'regionId', g.region_id,
      'name', g.name,
      'premise', g.premise,
      'websiteUrl', g.website_url,
      'gatheringsUrl', g.gatherings_url,
      'allowsSpeakerWildlifeSounds', g.allows_speaker_wildlife_sounds,
      'growthCueAssetSha', (select a.sha256 from public.audio_assets a where a.id = g.growth_cue_id),
      'depthBloomTextureM', g.depth_bloom_texture_m,
      'status', g.status,
      'journeys', journeys
    )) into result
    from public.groves g where g.id = p_entity_id;

  elsif p_entity = 'fragment' then
    select extensions.ST_AsGeoJSON(f.location)::jsonb into loc
      from public.fragments f where f.id = p_entity_id;
    select jsonb_strip_nulls(jsonb_build_object(
      'id', f.id,
      'groveId', f.grove_id,
      'tier', f.tier,
      'isEnding', f.is_ending,
      'title', f.title,
      'teaser', f.teaser,
      'location', loc,
      'visibility', f.visibility,
      'triggerRadiusM', case when f.visibility = 'physical' then null else f.trigger_radius_m end,
      'markerHash', case
        when f.visibility = 'physical' and f.marker_code is not null
        then encode(extensions.digest(f.marker_code, 'sha256'), 'hex')
        else null end,
      'storyOrder', f.story_order,
      'status', f.status,
      'beaconAssetSha', (select a.sha256 from public.audio_assets a where a.id = f.beacon_asset_id),
      'resolveAssetSha', (select a.sha256 from public.audio_assets a where a.id = f.resolve_asset_id),
      'teaserLockedAssetSha', (select a.sha256 from public.audio_assets a where a.id = f.teaser_locked_asset_id),
      'requires', coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'sortOrder', g.sort_order,
            'members', (
              select coalesce(jsonb_agg(
                jsonb_build_object('fragmentId', m.requires_fragment_id, 'sortOrder', m.sort_order)
                order by m.sort_order, m.requires_fragment_id
              ), '[]'::jsonb)
              from public.fragment_prereq_members m where m.group_id = g.id
            )
          )
          order by g.sort_order, g.id
        )
        from public.fragment_prereq_groups g where g.fragment_id = f.id
      ), '[]'::jsonb),
      'threadIds', coalesce((
        select jsonb_agg(ft.thread_id order by ft.thread_id)
        from public.fragment_threads ft where ft.fragment_id = f.id
      ), '[]'::jsonb),
      'characters', coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'characterId', fc.character_id,
            'prominence', fc.prominence,
            'introduces', fc.introduces,
            'cardLine', fc.card_line
          )
          order by fc.character_id
        )
        from public.fragment_characters fc where fc.fragment_id = f.id
      ), '[]'::jsonb)
    )) into result
    from public.fragments f where f.id = p_entity_id;

  elsif p_entity = 'character' then
    select jsonb_build_object(
      'id', c.id,
      'publicName', c.public_name,
      'publicIntro', c.public_intro,
      'portraitImageId', c.portrait_image_id,
      'homeGroveId', c.home_grove_id,
      'status', c.status
    ) into result
    from public.characters c where c.id = p_entity_id;

  elsif p_entity = 'image' then
    select jsonb_build_object(
      'id', i.id,
      'sha256', i.sha256,
      'ext', i.ext,
      'bytes', i.bytes,
      'width', i.width,
      'height', i.height,
      'altText', i.alt_text
    ) into result
    from public.image_assets i where i.id = p_entity_id;

  elsif p_entity = 'ambience_profile' then
    select jsonb_build_object(
      'id', p.id,
      'regionId', p.region_id,
      'slug', p.slug,
      'name', p.name,
      'density', p.density,
      'layers', coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'id', l.id,
            'name', l.name,
            'kind', l.kind,
            'timeWindow', l.time_window,
            'wildlifeCall', l.wildlife_call,
            'speakerSafe', l.speaker_safe,
            'months', l.months,
            'nestingMuteMonths', l.nesting_mute_months,
            'gainDbMin', l.gain_db_min,
            'gainDbMax', l.gain_db_max,
            'panMin', l.pan_min,
            'panMax', l.pan_max,
            'pitchCentsMin', l.pitch_cents_min,
            'pitchCentsMax', l.pitch_cents_max,
            'meanIntervalS', l.mean_interval_s,
            'minIntervalS', l.min_interval_s,
            'maxConcurrent', l.max_concurrent,
            'noRepeatLast', l.no_repeat_last,
            'crossfadeMs', l.crossfade_ms,
            'assetShas', (
              select coalesce(jsonb_agg(a.sha256 order by a.sha256), '[]'::jsonb)
              from public.ambience_layer_assets la
              join public.audio_assets a on a.id = la.asset_id
              where la.layer_id = l.id
            ),
            'assetWeights', (
              select coalesce(jsonb_agg(la.weight order by a.sha256), '[]'::jsonb)
              from public.ambience_layer_assets la
              join public.audio_assets a on a.id = la.asset_id
              where la.layer_id = l.id
            )
          )
          order by l.name, l.id
        )
        from public.ambience_layers l where l.profile_id = p.id
      ), '[]'::jsonb)
    ) into result
    from public.ambience_profiles p where p.id = p_entity_id;

  elsif p_entity = 'ambience_zone' then
    select extensions.ST_AsGeoJSON(z.boundary)::jsonb into v_boundary
      from public.ambience_zones z where z.id = p_entity_id;
    select jsonb_build_object(
      'id', z.id,
      'regionId', z.region_id,
      'name', z.name,
      'boundary', v_boundary,
      'profileId', z.profile_id,
      'profileSlug', p.slug,
      'priority', z.priority,
      'edgeFadeM', z.edge_fade_m,
      'status', z.status
    ) into result
    from public.ambience_zones z
    join public.ambience_profiles p on p.id = z.profile_id
    where z.id = p_entity_id;

  elsif p_entity = 'music_zone' then
    select extensions.ST_AsGeoJSON(z.boundary)::jsonb into v_boundary
      from public.music_zones z where z.id = p_entity_id;
    select jsonb_build_object(
      'id', z.id,
      'regionId', z.region_id,
      'name', z.name,
      'boundary', v_boundary,
      'priority', z.priority,
      'edgeFadeM', z.edge_fade_m,
      'status', z.status
    ) into result
    from public.music_zones z where z.id = p_entity_id;

  elsif p_entity = 'music_cue' then
    select jsonb_strip_nulls(jsonb_build_object(
      'id', c.id,
      'name', c.name,
      'musicZoneId', c.music_zone_id,
      'groveId', c.grove_id,
      'timeWindow', c.time_window,
      'priority', c.priority,
      'conditions', coalesce(c.conditions, '{}'::jsonb),
      'minDwellS', c.min_dwell_s,
      'crossfadeMs', c.crossfade_ms,
      'status', c.status,
      'resolveRootAssetSha', (select a.sha256 from public.audio_assets a where a.id = c.resolve_root_asset_id),
      'resolveBranchAssetSha', (select a.sha256 from public.audio_assets a where a.id = c.resolve_branch_asset_id),
      'resolveLeafAssetSha', (select a.sha256 from public.audio_assets a where a.id = c.resolve_leaf_asset_id),
      'stems', coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'assetSha', a.sha256,
            'role', s.role,
            'gainDb', s.gain_db,
            'stateGains', coalesce(s.state_gains, '[]'::jsonb),
            'loopStartMs', a.loop_start_ms,
            'loopEndMs', a.loop_end_ms,
            'durationMs', a.duration_ms,
            'bytes', a.bytes
          )
          order by s.id
        )
        from public.music_cue_stems s
        join public.audio_assets a on a.id = s.asset_id
        where s.cue_id = c.id
      ), '[]'::jsonb)
    )) into result
    from public.music_cues c where c.id = p_entity_id;

  elsif p_entity = 'ui_cue' then
    select jsonb_build_object(
      'id', u.id,
      'regionId', u.region_id,
      'key', u.key,
      'language', u.language,
      'assetSha', a.sha256,
      'status', u.status
    ) into result
    from public.ui_cues u
    join public.audio_assets a on a.id = u.asset_id
    where u.id = p_entity_id;

  else
    raise exception 'fn_snapshot_projection: unknown entity %', p_entity;
  end if;

  if result is null then
    raise exception 'fn_snapshot_projection: % % not found', p_entity, p_entity_id;
  end if;

  return result;
end;
$$;

revoke all on function public.fn_snapshot_projection(text, uuid) from public, anon, authenticated;
grant execute on function public.fn_snapshot_projection(text, uuid) to service_role;

-- ---------------------------------------------------------------------------
-- A5 release checks (stems, growth steps, resolve, narration stereo, budget)
-- ---------------------------------------------------------------------------
create or replace function public.fn_a5_sound_check_issues(p_release_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  issues jsonb := '[]'::jsonb;
  cue record;
  stem_count int;
  v_grove_id uuid;
  v_tw text;
  growth_count int;
  asset_rec record;
  dur int;
  v_region_id uuid;
  ambience_bytes bigint;
  frag record;
begin
  for cue in
    select c.*
    from public.release_items ri
    join public.music_cues c on c.id = ri.entity_id
    where ri.release_id = p_release_id and ri.entity = 'music_cue'
  loop
    select count(*)::int into stem_count
    from public.music_cue_stems s where s.cue_id = cue.id;
    if stem_count > 4 then
      issues := issues || jsonb_build_array(public.fn_check_issue(
        'STEMS_OVER_MAX', 'error', 'cue has more than 4 stems', 'music_cue', cue.id));
    end if;

    if cue.resolve_root_asset_id is null
       and cue.resolve_branch_asset_id is null
       and cue.resolve_leaf_asset_id is null then
      issues := issues || jsonb_build_array(public.fn_check_issue(
        'RESOLVE_MISSING', 'warning', 'cue has no resolve assets', 'music_cue', cue.id));
    end if;

    -- RESOLVE_DURATION per tier when asset present
    for asset_rec in
      select 'root' as tier, a.duration_ms, a.id as asset_id
      from public.audio_assets a where a.id = cue.resolve_root_asset_id
      union all
      select 'branch', a.duration_ms, a.id
      from public.audio_assets a where a.id = cue.resolve_branch_asset_id
      union all
      select 'leaf', a.duration_ms, a.id
      from public.audio_assets a where a.id = cue.resolve_leaf_asset_id
    loop
      dur := asset_rec.duration_ms;
      if (asset_rec.tier = 'root' and (dur < 4000 or dur > 8000))
         or (asset_rec.tier = 'branch' and (dur < 3000 or dur > 6000))
         or (asset_rec.tier = 'leaf' and (dur < 2000 or dur > 4000)) then
        issues := issues || jsonb_build_array(public.fn_check_issue(
          'RESOLVE_DURATION', 'warning',
          'resolve duration outside tier range',
          'music_cue', cue.id,
          jsonb_build_object('tier', asset_rec.tier, 'duration_ms', dur)));
      end if;
    end loop;
  end loop;

  -- Growth steps: per grove + window, base (empty conditions) + heardAll-only cues ≤ 4
  for v_grove_id, v_tw in
    select distinct c.grove_id, c.time_window::text
    from public.release_items ri
    join public.music_cues c on c.id = ri.entity_id
    where ri.release_id = p_release_id
      and ri.entity = 'music_cue'
      and c.grove_id is not null
  loop
    select count(*)::int into growth_count
    from public.music_cues c
    join public.release_items ri on ri.entity_id = c.id and ri.entity = 'music_cue'
    where ri.release_id = p_release_id
      and c.grove_id = v_grove_id
      and c.time_window::text = v_tw
      and (
        c.conditions = '{}'::jsonb
        or (
          c.conditions ? 'heardAll'
          and jsonb_typeof(c.conditions->'heardAll') = 'array'
          and jsonb_array_length(c.conditions->'heardAll') > 0
          and (c.conditions - 'heardAll') = '{}'::jsonb
        )
      );

    if growth_count > 4 then
      issues := issues || jsonb_build_array(public.fn_check_issue(
        'GROWTH_STEPS_OVER_MAX', 'error',
        'more than 4 growth/base cues for grove window',
        'grove', v_grove_id,
        jsonb_build_object('time_window', v_tw, 'count', growth_count)));
    end if;
  end loop;

  -- NARRATION_STEREO: stereo narration with no fragment_characters (linked characters)
  for frag in
    select f.id as fragment_id, rv.id as version_id, a.id as asset_id
    from public.release_items ri
    join public.fragments f on f.id = ri.entity_id
    join public.fragment_revisions fr on fr.fragment_id = f.id
    join public.revision_versions rv on rv.revision_id = fr.id
    join public.audio_assets a on a.id = rv.narration_asset_id
    where ri.release_id = p_release_id
      and ri.entity = 'fragment'
      and a.kind = 'narration'
      and a.channels = 2
      and not exists (
        select 1 from public.fragment_characters fc where fc.fragment_id = f.id
      )
  loop
    issues := issues || jsonb_build_array(public.fn_check_issue(
      'NARRATION_STEREO', 'warning',
      'stereo narration without linked characters on the fragment',
      'fragment', frag.fragment_id,
      jsonb_build_object('version_id', frag.version_id, 'asset_id', frag.asset_id)));
  end loop;

  -- REGION_AMBIENCE_BUDGET: sum of ambience assets for profiles in the release > 40 MB
  for v_region_id in
    select distinct p.region_id
    from public.release_items ri
    join public.ambience_profiles p on p.id = ri.entity_id
    where ri.release_id = p_release_id
      and ri.entity = 'ambience_profile'
      and p.region_id is not null
  loop
    select coalesce(sum(distinct a.bytes), 0)::bigint into ambience_bytes
    from public.ambience_profiles p
    join public.ambience_layers l on l.profile_id = p.id
    join public.ambience_layer_assets la on la.layer_id = l.id
    join public.audio_assets a on a.id = la.asset_id
    where p.region_id = v_region_id;

    if ambience_bytes > (40 * 1024 * 1024) then
      issues := issues || jsonb_build_array(public.fn_check_issue(
        'REGION_AMBIENCE_BUDGET', 'warning',
        'region ambience library over 40 MB',
        'region', v_region_id,
        jsonb_build_object('bytes', ambience_bytes)));
    end if;
  end loop;

  return issues;
end;
$$;

revoke all on function public.fn_a5_sound_check_issues(uuid) from public, anon, authenticated;
grant execute on function public.fn_a5_sound_check_issues(uuid) to service_role;

-- Wrap publish_check to merge A5 issues
alter function public.fn_publish_check(uuid) rename to fn_publish_check_pre_a5;

create or replace function public.fn_publish_check(p_release_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  result jsonb;
  extra jsonb;
  failures jsonb;
begin
  result := public.fn_publish_check_pre_a5(p_release_id);
  extra := public.fn_a5_sound_check_issues(p_release_id);
  failures := coalesce(result->'failures', '[]'::jsonb) || coalesce(extra, '[]'::jsonb);
  result := result || jsonb_build_object(
    'failures', failures,
    'ok', not exists (
      select 1 from jsonb_array_elements(failures) e where e->>'severity' = 'error'
    )
  );
  update public.releases set last_check = result where id = p_release_id;
  return result;
end;
$$;

revoke all on function public.fn_publish_check(uuid) from public, anon;
grant execute on function public.fn_publish_check(uuid) to authenticated, service_role;
revoke all on function public.fn_publish_check_pre_a5(uuid) from public, anon, authenticated;
grant execute on function public.fn_publish_check_pre_a5(uuid) to service_role;
