-- A2 Part 2: pack_builds.bbox from the derived shape; drop drawn groves.boundary.

-- ---------------------------------------------------------------------------
-- pack_builds.bbox (west, south, east, north)
-- ---------------------------------------------------------------------------
alter table public.pack_builds
  add column if not exists bbox double precision[4];

comment on column public.pack_builds.bbox is
  'Grove pack bbox [west, south, east, north] from the derived MultiPolygon; region rows leave this null and use regions.bounds.';

-- Backfill live grove builds from the drawn polygon so the index has a box
-- before the next republish writes the derived one.
update public.pack_builds pb
   set bbox = array[
     extensions.ST_XMin(g.boundary::extensions.geometry),
     extensions.ST_YMin(g.boundary::extensions.geometry),
     extensions.ST_XMax(g.boundary::extensions.geometry),
     extensions.ST_YMax(g.boundary::extensions.geometry)
   ]
  from public.groves g
 where pb.scope = 'grove'
   and pb.scope_id = g.id
   and pb.bbox is null
   and g.boundary is not null;

-- ---------------------------------------------------------------------------
-- get_pack_index: grove bbox from pack_builds; region still from regions.bounds
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
        when pb.scope = 'grove' then pb.bbox
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
        (pb.scope = 'grove' and (gs.data->>'status') = 'published' and pb.bbox is not null)
        or (pb.scope = 'region' and r.id is not null)
      )
    order by pb.scope, pb.scope_id, pb.id desc
  ) t;

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

-- ---------------------------------------------------------------------------
-- fn_fragment_guard: no polygon check
-- ---------------------------------------------------------------------------
create or replace function public.fn_fragment_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.groves g where g.id = new.grove_id) then
    raise exception 'fragment grove not found';
  end if;

  if new.visibility = 'physical' and new.marker_code is null then
    raise exception 'physical fragment requires marker_code';
  end if;

  return new;
end;
$$;

revoke all on function public.fn_fragment_guard() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- fn_set_fragment_location: no polygon check
-- ---------------------------------------------------------------------------
create or replace function public.fn_set_fragment_location(
  p_fragment_id uuid,
  p_lat float8,
  p_lng float8
)
returns void
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_loc extensions.geography(Point, 4326);
begin
  if p_lat is null or p_lng is null then
    raise exception 'lat and lng required' using errcode = '22023';
  end if;

  v_loc := extensions.ST_GeogFromText(
    'SRID=4326;POINT(' || p_lng::text || ' ' || p_lat::text || ')'
  );

  update public.fragments
     set location = v_loc
   where id = p_fragment_id;

  if not found then
    raise exception 'fragment not found or not permitted' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.fn_set_fragment_location(uuid, float8, float8) from public, anon;
grant execute on function public.fn_set_fragment_location(uuid, float8, float8) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Drop drawn-boundary helpers and the column
-- ---------------------------------------------------------------------------
drop function if exists public.fn_set_grove_boundary(uuid, text);
drop function if exists public.boundary_geojson(public.groves);

-- Grove projection without boundary (N4: old snapshots may still carry it)
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

    select jsonb_build_object(
      'id', g.id,
      'regionId', g.region_id,
      'name', g.name,
      'premise', g.premise,
      'websiteUrl', g.website_url,
      'gatheringsUrl', g.gatherings_url,
      'allowsSpeakerWildlifeSounds', g.allows_speaker_wildlife_sounds,
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
-- Checklist: drop OUTSIDE_GROVE (drawn polygon is gone; far pieces are admin-only)
-- ---------------------------------------------------------------------------
create or replace function public.fn_check_fragment_local(p_frag public.fragments)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  failures jsonb := '[]'::jsonb;
  grp record;
  empty_group boolean;
  ctx jsonb;
begin
  ctx := jsonb_build_object(
    'grove_id', p_frag.grove_id,
    'fragment_id', p_frag.id
  );

  if public.fn_l10n_blank(p_frag.teaser) then
    failures := failures || jsonb_build_array(public.fn_check_issue(
      'NO_TEASER', 'error', 'teaser required', 'fragment', p_frag.id, ctx));
  end if;

  if p_frag.visibility = 'physical' and p_frag.marker_code is null then
    failures := failures || jsonb_build_array(public.fn_check_issue(
      'PHYSICAL_NO_CODE', 'error', 'physical needs marker_code',
      'fragment', p_frag.id, ctx));
  end if;

  for grp in
    select g.id as group_id from public.fragment_prereq_groups g where g.fragment_id = p_frag.id
  loop
    select not exists (
      select 1 from public.fragment_prereq_members m where m.group_id = grp.group_id
    ) into empty_group;
    if empty_group then
      failures := failures || jsonb_build_array(public.fn_check_issue(
        'EMPTY_PREREQ_GROUP', 'error', 'empty prereq group',
        'fragment', p_frag.id, ctx));
    end if;
  end loop;

  return failures;
end;
$$;

revoke all on function public.fn_check_fragment_local(public.fragments)
  from public, anon, authenticated;
grant execute on function public.fn_check_fragment_local(public.fragments)
  to service_role;

create or replace function public.fn_publish_check(p_release_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  failures jsonb := '[]'::jsonb;
  audio_shas text[] := '{}';
  image_shas text[] := '{}';
  item record;
  frag public.fragments%rowtype;
  grove public.groves%rowtype;
  rev public.fragment_revisions%rowtype;
  char_rec public.characters%rowtype;
  grp record;
  prereq_ok boolean;
  asset_rec public.audio_assets%rowtype;
  has_start boolean;
  base_dur int;
  base_ls int;
  base_le int;
  in_release boolean;
  result jsonb;
begin
  if auth.role() = 'authenticated'
     and not public.has_role(array['editor','admin']::public.staff_role[]) then
    raise exception 'editor required';
  end if;

  if not exists (select 1 from public.releases where id = p_release_id) then
    return jsonb_build_object(
      'ok', false,
      'failures', jsonb_build_array(public.fn_check_issue(
        'DEPENDENCY_UNPUBLISHED', 'error', 'release not found', 'release', p_release_id)),
      'asset_shas_to_publish', '[]'::jsonb,
      'image_shas_to_publish', '[]'::jsonb
    );
  end if;

  for item in
    select * from public.release_items where release_id = p_release_id
  loop
    if item.entity = 'revision' then
      select * into rev from public.fragment_revisions where id = item.entity_id;
      if not found then
        failures := failures || jsonb_build_array(public.fn_check_issue(
          'DEPENDENCY_UNPUBLISHED', 'error', 'revision missing', 'revision', item.entity_id));
        continue;
      end if;
      select * into frag from public.fragments where id = rev.fragment_id;
      select public.fn_entity_in_release_or_published(
        p_release_id, 'fragment', frag.id, array['published','retired']
      ) into in_release;
      if not in_release then
        failures := failures || jsonb_build_array(public.fn_check_issue(
          'DEPENDENCY_UNPUBLISHED', 'error', 'revision fragment not published or in release',
          'fragment', frag.id,
          jsonb_build_object('grove_id', frag.grove_id, 'fragment_id', frag.id)));
      end if;

      failures := failures || public.fn_check_revision_local(rev);

      for asset_rec in
        select a.* from public.revision_versions v
        join public.audio_assets a on a.id = v.narration_asset_id
        where v.revision_id = rev.id
      loop
        audio_shas := array_append(audio_shas, asset_rec.sha256);
      end loop;

    elsif item.entity = 'fragment' then
      select * into frag from public.fragments where id = item.entity_id;
      if not found then continue; end if;

      select public.fn_entity_in_release_or_published(
        p_release_id, 'grove', frag.grove_id, array['published']
      ) into in_release;
      if not in_release then
        failures := failures || jsonb_build_array(public.fn_check_issue(
          'DEPENDENCY_UNPUBLISHED', 'error', 'fragment grove not published or in release',
          'grove', frag.grove_id));
      end if;

      failures := failures || public.fn_check_fragment_local(frag);

      for grp in
        select g.id as group_id from public.fragment_prereq_groups g where g.fragment_id = frag.id
      loop
        if exists (select 1 from public.fragment_prereq_members m where m.group_id = grp.group_id) then
          select exists (
            select 1
            from public.fragment_prereq_members m
            join public.fragments rf on rf.id = m.requires_fragment_id
            where m.group_id = grp.group_id
              and public.fn_entity_in_release_or_published(
                p_release_id, 'fragment', rf.id, array['published','retired'])
          ) into prereq_ok;
          if not prereq_ok then
            failures := failures || jsonb_build_array(public.fn_check_issue(
              'PREREQ_UNPUBLISHED', 'error', 'prereq group unpublished', 'fragment', frag.id,
              jsonb_build_object('grove_id', frag.grove_id, 'fragment_id', frag.id)));
          end if;
        end if;
      end loop;

      if exists (
        select 1 from public.fragment_characters fc
        where fc.fragment_id = frag.id
          and not public.fn_entity_in_release_or_published(
            p_release_id, 'character', fc.character_id, array['published'])
      ) then
        failures := failures || jsonb_build_array(public.fn_check_issue(
          'DEPENDENCY_UNPUBLISHED', 'error', 'linked character not published or in release',
          'fragment', frag.id,
          jsonb_build_object('grove_id', frag.grove_id, 'fragment_id', frag.id)));
      end if;

    elsif item.entity = 'character' then
      select * into char_rec from public.characters where id = item.entity_id;
      if found then
        failures := failures || public.fn_check_character_local(char_rec);

        if char_rec.home_grove_id is not null
           and not public.fn_entity_in_release_or_published(
             p_release_id, 'grove', char_rec.home_grove_id, array['published']) then
          failures := failures || jsonb_build_array(public.fn_check_issue(
            'DEPENDENCY_UNPUBLISHED', 'error',
            'character home grove not published or in release',
            'character', char_rec.id,
            jsonb_build_object(
              'character_id', char_rec.id,
              'grove_id', char_rec.home_grove_id
            )));
        end if;
      end if;

      if exists (
        select 1 from public.characters c
        where c.id = item.entity_id
          and c.portrait_image_id is not null
          and not (
            exists (
              select 1 from public.release_items ri
              where ri.release_id = p_release_id and ri.entity = 'image' and ri.entity_id = c.portrait_image_id
            )
            or exists (
              select 1 from public.published_snapshots ps
              where ps.entity = 'image' and ps.entity_id = c.portrait_image_id
            )
          )
      ) then
        failures := failures || jsonb_build_array(public.fn_check_issue(
          'DEPENDENCY_UNPUBLISHED', 'error', 'character portrait not published or in release',
          'character', item.entity_id,
          jsonb_build_object('character_id', item.entity_id)));
      end if;

    elsif item.entity = 'image' then
      if exists (
        select 1 from public.image_assets i
        where i.id = item.entity_id
          and public.fn_l10n_blank(i.alt_text)
      ) then
        failures := failures || jsonb_build_array(public.fn_check_issue(
          'NO_ALT_TEXT', 'error', 'alt text required', 'image', item.entity_id));
      else
        select array_append(image_shas, i.sha256) into image_shas
        from public.image_assets i where i.id = item.entity_id;
      end if;

    elsif item.entity = 'music_cue' then
      select into base_dur, base_ls, base_le
        a.duration_ms, a.loop_start_ms, a.loop_end_ms
      from public.music_cue_stems s
      join public.audio_assets a on a.id = s.asset_id
      where s.cue_id = item.entity_id
      order by s.id limit 1;

      if exists (
        select 1 from public.music_cue_stems s
        join public.audio_assets a on a.id = s.asset_id
        where s.cue_id = item.entity_id
          and (a.duration_ms is distinct from base_dur
            or a.loop_start_ms is distinct from base_ls
            or a.loop_end_ms is distinct from base_le)
      ) then
        failures := failures || jsonb_build_array(public.fn_check_issue(
          'STEM_MISMATCH', 'error', 'stem duration/loop mismatch', 'music_cue', item.entity_id));
      end if;

      for asset_rec in
        select a.* from public.music_cue_stems s
        join public.audio_assets a on a.id = s.asset_id
        where s.cue_id = item.entity_id
      loop
        audio_shas := array_append(audio_shas, asset_rec.sha256);
        failures := failures || public.fn_check_audio_asset(asset_rec);
      end loop;

      if exists (
        select 1 from public.music_cues c
        where c.id = item.entity_id
          and c.music_zone_id is not null
          and not public.fn_entity_in_release_or_published(
            p_release_id, 'music_zone', c.music_zone_id, array['published'])
      ) then
        failures := failures || jsonb_build_array(public.fn_check_issue(
          'DEPENDENCY_UNPUBLISHED', 'error', 'cue zone missing', 'music_cue', item.entity_id));
      end if;

    elsif item.entity = 'ambience_profile' then
      if exists (
        select 1 from public.ambience_layers l
        where l.profile_id = item.entity_id
          and l.wildlife_call = true and l.speaker_safe = true
      ) then
        failures := failures || jsonb_build_array(public.fn_check_issue(
          'WILDLIFE_SPEAKER', 'error', 'wildlife_call cannot be speaker_safe',
          'ambience_profile', item.entity_id));
      end if;
      for asset_rec in
        select a.* from public.ambience_layers l
        join public.ambience_layer_assets la on la.layer_id = l.id
        join public.audio_assets a on a.id = la.asset_id
        where l.profile_id = item.entity_id
      loop
        audio_shas := array_append(audio_shas, asset_rec.sha256);
        failures := failures || public.fn_check_audio_asset(asset_rec);
      end loop;

    elsif item.entity = 'ambience_zone' then
      if exists (
        select 1 from public.ambience_zones z
        where z.id = item.entity_id
          and not (
            exists (
              select 1 from public.release_items ri
              where ri.release_id = p_release_id
                and ri.entity = 'ambience_profile' and ri.entity_id = z.profile_id
            )
            or exists (
              select 1 from public.published_snapshots ps
              where ps.entity = 'ambience_profile' and ps.entity_id = z.profile_id
            )
          )
      ) then
        failures := failures || jsonb_build_array(public.fn_check_issue(
          'DEPENDENCY_UNPUBLISHED', 'error', 'zone profile missing', 'ambience_zone', item.entity_id));
      end if;

    elsif item.entity = 'ui_cue' then
      select array_append(audio_shas, a.sha256) into audio_shas
      from public.ui_cues u
      join public.audio_assets a on a.id = u.asset_id
      where u.id = item.entity_id;
      for asset_rec in
        select a.* from public.ui_cues u
        join public.audio_assets a on a.id = u.asset_id
        where u.id = item.entity_id
      loop
        failures := failures || public.fn_check_audio_asset(asset_rec);
      end loop;
    end if;
  end loop;

  for grove in
    select g.* from public.groves g
    where exists (
      select 1 from public.release_items ri
      where ri.release_id = p_release_id and ri.entity = 'grove' and ri.entity_id = g.id
    )
  loop
    select exists (
      select 1 from public.fragments f
      where f.grove_id = grove.id
        and not exists (
          select 1 from public.fragment_prereq_groups g where g.fragment_id = f.id
        )
    ) into has_start;
    if not has_start then
      failures := failures || jsonb_build_array(public.fn_check_issue(
        'NO_START', 'warning', 'no fragment open from the start', 'grove', grove.id));
    end if;

    if not public.fn_grove_has_opening_root_publish(p_release_id, grove.id) then
      failures := failures || jsonb_build_array(public.fn_check_issue(
        'NO_ROOT', 'error', 'grove needs a published root for Embark',
        'grove', grove.id,
        jsonb_build_object('grove_id', grove.id)));
    end if;
  end loop;

  select coalesce(array_agg(distinct x), '{}'::text[]) into audio_shas from unnest(audio_shas) x;
  select coalesce(array_agg(distinct x), '{}'::text[]) into image_shas from unnest(image_shas) x;

  result := jsonb_build_object(
    'ok', not exists (
      select 1 from jsonb_array_elements(failures) e where e->>'severity' = 'error'
    ),
    'failures', failures,
    'asset_shas_to_publish', to_jsonb(coalesce(audio_shas, '{}'::text[])),
    'image_shas_to_publish', to_jsonb(coalesce(image_shas, '{}'::text[]))
  );

  update public.releases set last_check = result where id = p_release_id;
  return result;
end;
$$;

revoke all on function public.fn_publish_check(uuid) from public, anon;
grant execute on function public.fn_publish_check(uuid) to authenticated, service_role;

drop index if exists public.groves_boundary_gix;

alter table public.groves
  drop column if exists boundary;
