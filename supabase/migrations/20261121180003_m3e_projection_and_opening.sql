-- M3e: fn_l10n_blank; rewrite fn_snapshot_projection; pack_builds opening; get_pack_index
-- Strip accessNotes from existing grove snapshots (A12).

-- ---------------------------------------------------------------------------
-- G2: shared blank-L10n predicate
-- ---------------------------------------------------------------------------
create or replace function public.fn_l10n_blank(p jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p is null
      or p = '{}'::jsonb
      or coalesce(nullif(btrim(p->>'en'), ''), null) is null;
$$;

revoke all on function public.fn_l10n_blank(jsonb) from public, anon, authenticated;
grant execute on function public.fn_l10n_blank(jsonb) to service_role;

comment on function public.fn_l10n_blank(jsonb) is
  'True when L10n is {}, missing en, or en is blank after trim. Used by checklist and projections.';

-- ---------------------------------------------------------------------------
-- pack_builds opening columns (A1)
-- ---------------------------------------------------------------------------
alter table public.pack_builds
  add column opening_lat double precision,
  add column opening_lng double precision;

alter table public.pack_builds
  add constraint pack_builds_opening_pair_chk
  check (
    (opening_lat is null and opening_lng is null)
    or (opening_lat is not null and opening_lng is not null)
  );

comment on column public.pack_builds.opening_lat is
  'Opening root latitude (6-decimal rounded) written by build-pack for grove scopes.';
comment on column public.pack_builds.opening_lng is
  'Opening root longitude (6-decimal rounded) written by build-pack for grove scopes.';

-- ---------------------------------------------------------------------------
-- Clean old grove snapshots (A12)
-- ---------------------------------------------------------------------------
update public.published_snapshots
   set data = data - 'accessNotes'
 where entity = 'grove'
   and data ? 'accessNotes';

-- ---------------------------------------------------------------------------
-- fn_snapshot_projection — drop accessNotes; add journeys; character homeGroveId
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
    select extensions.ST_AsGeoJSON(g.boundary)::jsonb into v_boundary
      from public.groves g where g.id = p_entity_id;

    select coalesce(
      (
        select jsonb_object_agg(j.mode::text, j.passage)
        from public.grove_journeys j
        where j.grove_id = p_entity_id
          and not public.fn_l10n_blank(j.passage)
      ),
      '{}'::jsonb
    ) into journeys;

    select jsonb_build_object(
      'id', g.id,
      'regionId', g.region_id,
      'name', g.name,
      'premise', g.premise,
      'websiteUrl', g.website_url,
      'gatheringsUrl', g.gatherings_url,
      'allowsSpeakerWildlifeSounds', g.allows_speaker_wildlife_sounds,
      'boundary', v_boundary,
      'growthCueAssetSha', (select a.sha256 from public.audio_assets a where a.id = g.growth_cue_id),
      'status', g.status,
      'journeys', journeys
    ) into result
    from public.groves g where g.id = p_entity_id;

  elsif p_entity = 'fragment' then
    select extensions.ST_AsGeoJSON(f.location)::jsonb into loc
      from public.fragments f where f.id = p_entity_id;
    select jsonb_build_object(
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
    ) into result
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
            'assetShas', (
              select coalesce(jsonb_agg(a.sha256 order by a.sha256), '[]'::jsonb)
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
    select jsonb_build_object(
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
    ) into result
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
-- get_pack_index — include opening when both columns are set (grove rows)
-- ---------------------------------------------------------------------------
create or replace function public.get_pack_index()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result jsonb := '[]'::jsonb;
begin
  select coalesce(jsonb_agg(to_jsonb(t) order by t.scope, t.id), '[]'::jsonb)
  into result
  from (
    select distinct on (pb.scope, pb.scope_id)
      pb.scope,
      pb.scope_id as id,
      pb.version,
      pb.manifest_path as "manifestPath",
      pb.manifest_sha256 as "manifestSha256",
      pb.bytes_total as "bytesTotal",
      case
        when pb.scope = 'grove' then g.name
        else jsonb_build_object('en', r.name)
      end as name,
      case
        when pb.scope = 'grove' then
          array[
            extensions.ST_XMin(g.boundary::extensions.geometry),
            extensions.ST_YMin(g.boundary::extensions.geometry),
            extensions.ST_XMax(g.boundary::extensions.geometry),
            extensions.ST_YMax(g.boundary::extensions.geometry)
          ]
        else
          array[
            extensions.ST_XMin(r.bounds::extensions.geometry),
            extensions.ST_YMin(r.bounds::extensions.geometry),
            extensions.ST_XMax(r.bounds::extensions.geometry),
            extensions.ST_YMax(r.bounds::extensions.geometry)
          ]
      end as bbox,
      case
        when pb.scope = 'grove'
             and pb.opening_lat is not null
             and pb.opening_lng is not null
        then jsonb_build_object('lat', pb.opening_lat, 'lng', pb.opening_lng)
        else null
      end as opening
    from public.pack_builds pb
    left join public.groves g
      on pb.scope = 'grove' and g.id = pb.scope_id
    left join public.regions r
      on pb.scope = 'region' and r.id = pb.scope_id
    left join public.published_snapshots gs
      on pb.scope = 'grove' and gs.entity = 'grove' and gs.entity_id = pb.scope_id
    where pb.live = true
      and (
        (pb.scope = 'grove' and (gs.data->>'status') = 'published')
        or (pb.scope = 'region' and r.id is not null)
      )
    order by pb.scope, pb.scope_id, pb.id desc
  ) t;

  -- Drop null opening keys so region / legacy rows stay clean
  select coalesce(
    jsonb_agg(
      case
        when e ? 'opening' and e->'opening' = 'null'::jsonb then e - 'opening'
        else e
      end
      order by e->>'scope', e->>'id'
    ),
    '[]'::jsonb
  )
  into result
  from jsonb_array_elements(result) e;

  return result;
end;
$$;

revoke all on function public.get_pack_index() from public;
grant execute on function public.get_pack_index() to anon, authenticated, service_role;
