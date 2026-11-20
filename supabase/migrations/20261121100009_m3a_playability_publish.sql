-- M3a: playability, snapshot projection, release publish/check/commit, go-live (R1–R6)

-- ---------------------------------------------------------------------------
-- Drop obsolete v2 helpers (signatures that no longer apply)
-- ---------------------------------------------------------------------------
-- Drop status-enqueue triggers before dropping the function (R6)
drop trigger if exists fragment_revisions_publish_enqueue on public.fragment_revisions;
drop trigger if exists music_cues_publish_enqueue on public.music_cues;
drop trigger if exists groves_publish_enqueue on public.groves;
drop trigger if exists fragments_publish_enqueue on public.fragments;
drop trigger if exists ambience_zones_publish_enqueue on public.ambience_zones;
drop trigger if exists music_zones_publish_enqueue on public.music_zones;
drop trigger if exists ui_cues_publish_enqueue on public.ui_cues;
drop trigger if exists fragments_publish_status on public.fragments;
drop trigger if exists groves_publish_status on public.groves;
drop trigger if exists revisions_publish_status on public.fragment_revisions;

drop function if exists public.fn_asset_is_playable(uuid, text);
drop function if exists public.fn_site_ok(uuid);
drop function if exists public.fn_date_unexpired(date, text);
drop function if exists public.fn_layer_assets_playable(uuid);
drop function if exists public.fn_rights_leave_active() cascade;
drop function if exists public.fn_close_due_crossroads();
drop function if exists public.fn_enqueue_due_publish_at();
drop function if exists public.fn_publish_status_enqueue() cascade;
drop function if exists public.fn_publish_check(text, uuid[]);
drop function if exists public.fn_publish_commit(text, uuid[]);

-- ---------------------------------------------------------------------------
-- Geography helper: add region_sun
-- ---------------------------------------------------------------------------
create or replace function public.fn_pack_geog_geojson(p_scope text, p_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  g jsonb;
begin
  if p_scope = 'grove_boundary' then
    select extensions.ST_AsGeoJSON(boundary)::jsonb into g from public.groves where id = p_id;
  elsif p_scope = 'fragment_point' then
    select extensions.ST_AsGeoJSON(location)::jsonb into g from public.fragments where id = p_id;
  elsif p_scope = 'ambience_zone' then
    select extensions.ST_AsGeoJSON(boundary)::jsonb into g from public.ambience_zones where id = p_id;
  elsif p_scope = 'music_zone' then
    select extensions.ST_AsGeoJSON(boundary)::jsonb into g from public.music_zones where id = p_id;
  elsif p_scope = 'region_bounds' then
    select extensions.ST_AsGeoJSON(bounds)::jsonb into g from public.regions where id = p_id;
  elsif p_scope = 'region_sun' then
    select extensions.ST_AsGeoJSON(sun_reference)::jsonb into g from public.regions where id = p_id;
  else
    raise exception 'fn_pack_geog_geojson: unknown scope %', p_scope;
  end if;
  return g;
end;
$$;

revoke all on function public.fn_pack_geog_geojson(text, uuid) from public, anon;
grant execute on function public.fn_pack_geog_geojson(text, uuid) to service_role;

-- ---------------------------------------------------------------------------
-- Contingency + playability
-- ---------------------------------------------------------------------------
create or replace function public.fn_contingency_revision_no(p_fragment_id uuid)
returns int
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select max(r.revision_no)
      from public.fragment_revisions r
      where r.fragment_id = p_fragment_id
        and r.status = 'published'
        and r.change_kind = 'contingency'
        and r.revision_no <= (
          select max(r2.revision_no)
          from public.fragment_revisions r2
          where r2.fragment_id = p_fragment_id
            and r2.status = 'published'
        )
    ),
    (
      select max(r.revision_no)
      from public.fragment_revisions r
      where r.fragment_id = p_fragment_id
        and r.change_kind = 'contingency'
    )
  );
$$;

revoke all on function public.fn_contingency_revision_no(uuid) from public, anon;
grant execute on function public.fn_contingency_revision_no(uuid) to service_role;

create or replace function public.fn_revision_is_playable(p_revision_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.fragment_revisions r
    join public.fragments f on f.id = r.fragment_id
    join public.published_snapshots fs
      on fs.entity = 'fragment' and fs.entity_id = f.id
    join public.published_snapshots gs
      on gs.entity = 'grove' and gs.entity_id = f.grove_id
    where r.id = p_revision_id
      and r.status = 'published'
      and (fs.data->>'status') in ('published', 'retired')
      and (gs.data->>'status') = 'published'
      and exists (
        select 1 from public.revision_versions v where v.revision_id = r.id
      )
  );
$$;

revoke all on function public.fn_revision_is_playable(uuid) from public, anon;
grant execute on function public.fn_revision_is_playable(uuid) to service_role;

create or replace function public.fn_current_revision(p_fragment_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select r.id
  from public.fragment_revisions r
  where r.fragment_id = p_fragment_id
    and public.fn_revision_is_playable(r.id)
  order by r.revision_no desc
  limit 1;
$$;

revoke all on function public.fn_current_revision(uuid) from public, anon;
grant execute on function public.fn_current_revision(uuid) to service_role;

create or replace function public.fn_layer_is_playable(p_layer_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.ambience_layers l
    join public.published_snapshots ps
      on ps.entity = 'ambience_profile' and ps.entity_id = l.profile_id
    where l.id = p_layer_id
  );
$$;

revoke all on function public.fn_layer_is_playable(uuid) from public, anon;
grant execute on function public.fn_layer_is_playable(uuid) to service_role;

create or replace function public.fn_cue_is_playable(p_cue_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.music_cues c
    join public.published_snapshots cs
      on cs.entity = 'music_cue' and cs.entity_id = c.id
    where c.id = p_cue_id
      and (cs.data->>'status') = 'published'
      and (
        (c.grove_id is not null and exists (
          select 1 from public.published_snapshots gs
          where gs.entity = 'grove' and gs.entity_id = c.grove_id
            and (gs.data->>'status') = 'published'
        ))
        or
        (c.music_zone_id is not null and exists (
          select 1 from public.published_snapshots zs
          where zs.entity = 'music_zone' and zs.entity_id = c.music_zone_id
            and (zs.data->>'status') = 'published'
        ))
      )
  );
$$;

revoke all on function public.fn_cue_is_playable(uuid) from public, anon;
grant execute on function public.fn_cue_is_playable(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- Snapshot projection (R1) — camelCase matching packages/shared snapshots.ts
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
begin
  if p_entity = 'grove' then
    select extensions.ST_AsGeoJSON(g.boundary)::jsonb into v_boundary from public.groves g where g.id = p_entity_id;
    select jsonb_build_object(
      'id', g.id,
      'regionId', g.region_id,
      'name', g.name,
      'premise', g.premise,
      'accessNotes', coalesce(g.access_notes, '{}'::jsonb),
      'websiteUrl', g.website_url,
      'gatheringsUrl', g.gatherings_url,
      'allowsSpeakerWildlifeSounds', g.allows_speaker_wildlife_sounds,
      'boundary', v_boundary,
      'growthCueAssetSha', (select a.sha256 from public.audio_assets a where a.id = g.growth_cue_id),
      'status', g.status
    ) into result
    from public.groves g where g.id = p_entity_id;

  elsif p_entity = 'fragment' then
    select extensions.ST_AsGeoJSON(f.location)::jsonb into loc from public.fragments f where f.id = p_entity_id;
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
    select extensions.ST_AsGeoJSON(z.boundary)::jsonb into v_boundary from public.ambience_zones z where z.id = p_entity_id;
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
    select extensions.ST_AsGeoJSON(z.boundary)::jsonb into v_boundary from public.music_zones z where z.id = p_entity_id;
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

create or replace function public.fn_snapshot_projection_guarded(p_entity text, p_entity_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.has_role(array['editor','admin']::public.staff_role[])
     and auth.role() <> 'service_role' then
    raise exception 'editor required';
  end if;
  return public.fn_snapshot_projection(p_entity, p_entity_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- get_pack_index: latest live builds; grove needs published snapshot
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
      end as bbox
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

  return result;
end;
$$;

revoke all on function public.get_pack_index() from public;
grant execute on function public.get_pack_index() to anon, authenticated, service_role;
