-- M3a: fn_publish_check / commit / go_live / enqueue_due_releases / unpublish (continues 09)

-- Rewrite enqueue helper with optional release_id (drop M2 2-arg overload)
drop function if exists public.fn_enqueue_rebuild_pack(uuid, uuid);

create or replace function public.fn_enqueue_rebuild_pack(
  p_grove_id uuid default null,
  p_region_id uuid default null,
  p_release_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  payload jsonb;
begin
  if p_grove_id is not null then
    payload := jsonb_build_object('grove_id', p_grove_id);
    if p_release_id is not null then
      payload := payload || jsonb_build_object('release_id', p_release_id);
    end if;
    insert into public.jobs (kind, payload) values ('rebuild_pack', payload);
  end if;
  if p_region_id is not null then
    payload := jsonb_build_object('region_id', p_region_id);
    if p_release_id is not null then
      payload := payload || jsonb_build_object('release_id', p_release_id);
    end if;
    insert into public.jobs (kind, payload) values ('rebuild_pack', payload);
  end if;
end;
$$;

revoke all on function public.fn_enqueue_rebuild_pack(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.fn_enqueue_rebuild_pack(uuid, uuid, uuid) to service_role;

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
  grp record;
  empty_group boolean;
  prereq_ok boolean;
  asset_rec public.audio_assets%rowtype;
  has_start boolean;
  base_dur int;
  base_ls int;
  base_le int;
  in_release boolean;
  result jsonb;
  sha text;
begin
  -- Staff guard for authenticated callers
  if auth.role() = 'authenticated'
     and not public.has_role(array['editor','admin']::public.staff_role[]) then
    raise exception 'editor required';
  end if;

  if not exists (select 1 from public.releases where id = p_release_id) then
    return jsonb_build_object(
      'ok', false,
      'failures', jsonb_build_array(jsonb_build_object(
        'code','DEPENDENCY_UNPUBLISHED','severity','error','message','release not found',
        'entity','release','entity_id', p_release_id
      )),
      'asset_shas_to_publish', '[]'::jsonb,
      'image_shas_to_publish', '[]'::jsonb
    );
  end if;

  for item in
    select * from public.release_items where release_id = p_release_id
  loop
    -- DEPENDENCY_UNPUBLISHED (R2)
    if item.entity = 'revision' then
      select * into rev from public.fragment_revisions where id = item.entity_id;
      if not found then
        failures := failures || jsonb_build_array(jsonb_build_object(
          'code','DEPENDENCY_UNPUBLISHED','severity','error','message','revision missing',
          'entity','revision','entity_id', item.entity_id));
        continue;
      end if;
      select * into frag from public.fragments where id = rev.fragment_id;
      select exists (
        select 1 from public.release_items ri
        where ri.release_id = p_release_id and ri.entity = 'fragment' and ri.entity_id = frag.id
      ) or exists (
        select 1 from public.published_snapshots ps
        where ps.entity = 'fragment' and ps.entity_id = frag.id
          and (ps.data->>'status') in ('published','retired')
      ) into in_release;
      if not in_release then
        failures := failures || jsonb_build_array(jsonb_build_object(
          'code','DEPENDENCY_UNPUBLISHED','severity','error',
          'message','revision fragment not published or in release',
          'entity','fragment','entity_id', frag.id));
      end if;

      if not exists (select 1 from public.revision_versions v where v.revision_id = rev.id) then
        failures := failures || jsonb_build_array(jsonb_build_object(
          'code','NO_VERSION','severity','error','message','no versions',
          'entity','revision','entity_id', rev.id));
      end if;
      if exists (
        select 1 from public.revision_versions v
        where v.revision_id = rev.id and coalesce(nullif(trim(v.transcript), ''), '') = ''
      ) or not exists (
        select 1 from public.revision_versions v
        where v.revision_id = rev.id and coalesce(nullif(trim(v.transcript), ''), '') <> ''
      ) then
        failures := failures || jsonb_build_array(jsonb_build_object(
          'code','NO_TRANSCRIPT','severity','error','message','missing transcript',
          'entity','revision','entity_id', rev.id));
      end if;

      for asset_rec in
        select a.* from public.revision_versions v
        join public.audio_assets a on a.id = v.narration_asset_id
        where v.revision_id = rev.id
      loop
        audio_shas := array_append(audio_shas, asset_rec.sha256);
        if asset_rec.loudness_lufs is null then
          failures := failures || jsonb_build_array(jsonb_build_object(
            'code','LOUDNESS','severity','warning','message','not measured',
            'entity','audio_asset','entity_id', asset_rec.id));
        elsif abs(asset_rec.loudness_lufs - (-16)) > 2 then
          failures := failures || jsonb_build_array(jsonb_build_object(
            'code','LOUDNESS','severity','warning','message','loudness off target',
            'entity','audio_asset','entity_id', asset_rec.id));
        end if;
      end loop;

      select * into grove from public.groves where id = frag.grove_id;
      if not extensions.ST_Covers(grove.boundary, frag.location) then
        failures := failures || jsonb_build_array(jsonb_build_object(
          'code','OUTSIDE_GROVE','severity','error','message','fragment outside grove',
          'entity','fragment','entity_id', frag.id));
      end if;

    elsif item.entity = 'fragment' then
      select * into frag from public.fragments where id = item.entity_id;
      if not found then continue; end if;
      select exists (
        select 1 from public.release_items ri
        where ri.release_id = p_release_id and ri.entity = 'grove' and ri.entity_id = frag.grove_id
      ) or exists (
        select 1 from public.published_snapshots ps
        where ps.entity = 'grove' and ps.entity_id = frag.grove_id
          and (ps.data->>'status') = 'published'
      ) into in_release;
      if not in_release then
        failures := failures || jsonb_build_array(jsonb_build_object(
          'code','DEPENDENCY_UNPUBLISHED','severity','error',
          'message','fragment grove not published or in release',
          'entity','grove','entity_id', frag.grove_id));
      end if;

      if coalesce(frag.teaser, '{}'::jsonb) = '{}'::jsonb
         or coalesce(nullif(trim(frag.teaser->>'en'), ''), '') = '' then
        failures := failures || jsonb_build_array(jsonb_build_object(
          'code','NO_TEASER','severity','error','message','teaser required',
          'entity','fragment','entity_id', frag.id));
      end if;

      if frag.visibility = 'physical' and frag.marker_code is null then
        failures := failures || jsonb_build_array(jsonb_build_object(
          'code','PHYSICAL_NO_CODE','severity','error','message','physical needs marker_code',
          'entity','fragment','entity_id', frag.id));
      end if;

      for grp in
        select g.id as group_id from public.fragment_prereq_groups g where g.fragment_id = frag.id
      loop
        select not exists (
          select 1 from public.fragment_prereq_members m where m.group_id = grp.group_id
        ) into empty_group;
        if empty_group then
          failures := failures || jsonb_build_array(jsonb_build_object(
            'code','EMPTY_PREREQ_GROUP','severity','error','message','empty prereq group',
            'entity','fragment','entity_id', frag.id));
        else
          select exists (
            select 1
            from public.fragment_prereq_members m
            join public.fragments rf on rf.id = m.requires_fragment_id
            where m.group_id = grp.group_id
              and (
                exists (
                  select 1 from public.release_items ri
                  where ri.release_id = p_release_id
                    and ri.entity = 'fragment' and ri.entity_id = rf.id
                )
                or exists (
                  select 1 from public.published_snapshots ps
                  where ps.entity = 'fragment' and ps.entity_id = rf.id
                    and (ps.data->>'status') in ('published','retired')
                )
              )
          ) into prereq_ok;
          if not prereq_ok then
            failures := failures || jsonb_build_array(jsonb_build_object(
              'code','PREREQ_UNPUBLISHED','severity','error','message','prereq group unpublished',
              'entity','fragment','entity_id', frag.id));
          end if;
        end if;
      end loop;

      if exists (
        select 1 from public.fragment_characters fc
        where fc.fragment_id = frag.id
          and not exists (
            select 1 from public.release_items ri
            where ri.release_id = p_release_id and ri.entity = 'character' and ri.entity_id = fc.character_id
          )
          and not exists (
            select 1 from public.published_snapshots ps
            where ps.entity = 'character' and ps.entity_id = fc.character_id
              and (ps.data->>'status') = 'published'
          )
      ) then
        failures := failures || jsonb_build_array(jsonb_build_object(
          'code','DEPENDENCY_UNPUBLISHED','severity','error',
          'message','linked character not published or in release',
          'entity','fragment','entity_id', frag.id));
      end if;

    elsif item.entity = 'character' then
      if exists (
        select 1 from public.characters c
        where c.id = item.entity_id
          and c.portrait_image_id is not null
          and not exists (
            select 1 from public.release_items ri
            where ri.release_id = p_release_id and ri.entity = 'image' and ri.entity_id = c.portrait_image_id
          )
          and not exists (
            select 1 from public.published_snapshots ps
            where ps.entity = 'image' and ps.entity_id = c.portrait_image_id
          )
      ) then
        failures := failures || jsonb_build_array(jsonb_build_object(
          'code','DEPENDENCY_UNPUBLISHED','severity','error',
          'message','character portrait not published or in release',
          'entity','character','entity_id', item.entity_id));
      end if;

    elsif item.entity = 'image' then
      if exists (
        select 1 from public.image_assets i
        where i.id = item.entity_id
          and (
            coalesce(i.alt_text, '{}'::jsonb) = '{}'::jsonb
            or coalesce(nullif(btrim(i.alt_text->>'en'), ''), null) is null
          )
      ) then
        failures := failures || jsonb_build_array(jsonb_build_object(
          'code','NO_ALT_TEXT','severity','error','message','alt text required',
          'entity','image','entity_id', item.entity_id));
      else
        select array_append(image_shas, i.sha256) into image_shas
        from public.image_assets i where i.id = item.entity_id;
      end if;

    elsif item.entity = 'music_cue' then
      -- STEM_MISMATCH + zone/grove dependency
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
        failures := failures || jsonb_build_array(jsonb_build_object(
          'code','STEM_MISMATCH','severity','error','message','stem duration/loop mismatch',
          'entity','music_cue','entity_id', item.entity_id));
      end if;

      for asset_rec in
        select a.* from public.music_cue_stems s
        join public.audio_assets a on a.id = s.asset_id
        where s.cue_id = item.entity_id
      loop
        audio_shas := array_append(audio_shas, asset_rec.sha256);
      end loop;

      if exists (
        select 1 from public.music_cues c
        where c.id = item.entity_id
          and c.music_zone_id is not null
          and not exists (
            select 1 from public.release_items ri
            where ri.release_id = p_release_id and ri.entity = 'music_zone' and ri.entity_id = c.music_zone_id
          )
          and not exists (
            select 1 from public.published_snapshots ps
            where ps.entity = 'music_zone' and ps.entity_id = c.music_zone_id
              and (ps.data->>'status') = 'published'
          )
      ) then
        failures := failures || jsonb_build_array(jsonb_build_object(
          'code','DEPENDENCY_UNPUBLISHED','severity','error','message','cue zone missing',
          'entity','music_cue','entity_id', item.entity_id));
      end if;

    elsif item.entity = 'ambience_profile' then
      if exists (
        select 1 from public.ambience_layers l
        where l.profile_id = item.entity_id
          and l.wildlife_call = true and l.speaker_safe = true
      ) then
        failures := failures || jsonb_build_array(jsonb_build_object(
          'code','WILDLIFE_SPEAKER','severity','error','message','wildlife_call cannot be speaker_safe',
          'entity','ambience_profile','entity_id', item.entity_id));
      end if;
      for asset_rec in
        select a.* from public.ambience_layers l
        join public.ambience_layer_assets la on la.layer_id = l.id
        join public.audio_assets a on a.id = la.asset_id
        where l.profile_id = item.entity_id
      loop
        audio_shas := array_append(audio_shas, asset_rec.sha256);
      end loop;

    elsif item.entity = 'ambience_zone' then
      if exists (
        select 1 from public.ambience_zones z
        where z.id = item.entity_id
          and not exists (
            select 1 from public.release_items ri
            where ri.release_id = p_release_id and ri.entity = 'ambience_profile' and ri.entity_id = z.profile_id
          )
          and not exists (
            select 1 from public.published_snapshots ps
            where ps.entity = 'ambience_profile' and ps.entity_id = z.profile_id
          )
      ) then
        failures := failures || jsonb_build_array(jsonb_build_object(
          'code','DEPENDENCY_UNPUBLISHED','severity','error','message','zone profile missing',
          'entity','ambience_zone','entity_id', item.entity_id));
      end if;

    elsif item.entity = 'ui_cue' then
      select array_append(audio_shas, a.sha256) into audio_shas
      from public.ui_cues u
      join public.audio_assets a on a.id = u.asset_id
      where u.id = item.entity_id;
    end if;
  end loop;

  -- NO_START warning per grove in release
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
      failures := failures || jsonb_build_array(jsonb_build_object(
        'code','NO_START','severity','warning',
        'message','no fragment open from the start',
        'entity','grove','entity_id', grove.id));
    end if;
  end loop;

  -- Deduplicate shas
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

-- ---------------------------------------------------------------------------
-- Commit
-- ---------------------------------------------------------------------------
create or replace function public.fn_publish_commit(p_release_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  checked jsonb;
  item record;
  proj jsonb;
  grove_ids uuid[] := '{}';
  region_ids uuid[] := '{}';
  frag_id uuid;
  dep_grove uuid;
  g uuid;
  r uuid;
begin
  perform public.fn_require_editor_or_service();

  checked := public.fn_publish_check(p_release_id);
  if not (checked->>'ok')::boolean then
    return checked;
  end if;

  for item in select * from public.release_items where release_id = p_release_id
  loop
    if item.entity = 'revision' then
      update public.fragment_revisions
         set status = 'published', release_id = p_release_id, updated_at = now()
       where id = item.entity_id;
      select fragment_id into frag_id from public.fragment_revisions where id = item.entity_id;
      select grove_id into dep_grove from public.fragments where id = frag_id;
      grove_ids := array_append(grove_ids, dep_grove);
    else
      proj := public.fn_snapshot_projection(item.entity, item.entity_id);
      -- Align working status to published for entities that have status
      if item.entity = 'grove' then
        update public.groves set status = 'published', published_at = coalesce(published_at, now()) where id = item.entity_id;
        grove_ids := array_append(grove_ids, item.entity_id);
        select region_id into r from public.groves where id = item.entity_id;
        region_ids := array_append(region_ids, r);
        proj := jsonb_set(proj, '{status}', '"published"');
      elsif item.entity = 'fragment' then
        update public.fragments set status = 'published' where id = item.entity_id and status <> 'retired';
        select grove_id into dep_grove from public.fragments where id = item.entity_id;
        grove_ids := array_append(grove_ids, dep_grove);
        proj := public.fn_snapshot_projection(item.entity, item.entity_id);
      elsif item.entity = 'character' then
        update public.characters set status = 'published' where id = item.entity_id;
        proj := public.fn_snapshot_projection(item.entity, item.entity_id);
      elsif item.entity = 'ambience_zone' then
        update public.ambience_zones set status = 'published' where id = item.entity_id;
        proj := public.fn_snapshot_projection(item.entity, item.entity_id);
        select p.region_id into r
          from public.ambience_zones z
          join public.ambience_profiles p on p.id = z.profile_id
         where z.id = item.entity_id;
        if r is not null then region_ids := array_append(region_ids, r); end if;
      elsif item.entity = 'music_zone' then
        update public.music_zones set status = 'published' where id = item.entity_id;
        proj := public.fn_snapshot_projection(item.entity, item.entity_id);
        select region_id into r from public.music_zones where id = item.entity_id;
        if r is not null then region_ids := array_append(region_ids, r); end if;
      elsif item.entity = 'music_cue' then
        update public.music_cues set status = 'published' where id = item.entity_id;
        proj := public.fn_snapshot_projection(item.entity, item.entity_id);
        select coalesce(mz.region_id, g.region_id) into r
          from public.music_cues c
          left join public.music_zones mz on mz.id = c.music_zone_id
          left join public.groves g on g.id = c.grove_id
         where c.id = item.entity_id;
        if r is not null then region_ids := array_append(region_ids, r); end if;
        select c.grove_id into dep_grove from public.music_cues c where c.id = item.entity_id;
        if dep_grove is not null then grove_ids := array_append(grove_ids, dep_grove); end if;
      elsif item.entity = 'ui_cue' then
        update public.ui_cues set status = 'published' where id = item.entity_id;
        proj := public.fn_snapshot_projection(item.entity, item.entity_id);
        select region_id into r from public.ui_cues where id = item.entity_id;
        if r is not null then region_ids := array_append(region_ids, r); end if;
      elsif item.entity = 'ambience_profile' then
        proj := public.fn_snapshot_projection(item.entity, item.entity_id);
        select region_id into r from public.ambience_profiles where id = item.entity_id;
        if r is not null then region_ids := array_append(region_ids, r); end if;
      elsif item.entity = 'image' then
        proj := public.fn_snapshot_projection(item.entity, item.entity_id);
      end if;

      insert into public.published_snapshots (entity, entity_id, release_id, data, published_at)
      values (item.entity, item.entity_id, p_release_id, proj, now())
      on conflict (entity, entity_id) do update
        set release_id = excluded.release_id,
            data = excluded.data,
            published_at = excluded.published_at;
    end if;
  end loop;

  -- Mark entry_links grown for published revision targets
  update public.entry_links el
     set stage = 'grown'
   where el.revision_id in (
     select ri.entity_id from public.release_items ri
     where ri.release_id = p_release_id and ri.entity = 'revision'
   );

  update public.releases
     set status = 'publishing', updated_at = now()
   where id = p_release_id;

  insert into public.audit_log (actor, action, entity, entity_id, detail)
  values (auth.uid(), 'publish_commit', 'release', p_release_id, checked);

  -- Dependent groves: fragments that require a changed fragment (R3)
  for frag_id in
    select distinct f.grove_id
    from public.fragment_prereq_members m
    join public.fragment_prereq_groups g on g.id = m.group_id
    join public.fragments f on f.id = g.fragment_id
    where m.requires_fragment_id in (
      select fr.fragment_id from public.release_items ri
      join public.fragment_revisions fr on fr.id = ri.entity_id
      where ri.release_id = p_release_id and ri.entity = 'revision'
      union
      select ri.entity_id from public.release_items ri
      where ri.release_id = p_release_id and ri.entity = 'fragment'
    )
  loop
    grove_ids := array_append(grove_ids, frag_id);
  end loop;

  select coalesce(array_agg(distinct x), '{}') into grove_ids from unnest(grove_ids) x;
  select coalesce(array_agg(distinct x), '{}') into region_ids from unnest(region_ids) x;

  foreach g in array grove_ids loop
    if g is null then continue; end if;
    insert into public.jobs (kind, payload)
    values ('rebuild_pack', jsonb_build_object('grove_id', g, 'release_id', p_release_id));
  end loop;

  foreach r in array region_ids loop
    if r is null then continue; end if;
    insert into public.jobs (kind, payload)
    values ('rebuild_pack', jsonb_build_object('region_id', r, 'release_id', p_release_id));
  end loop;

  return jsonb_build_object('ok', true, 'committed', true, 'release_id', p_release_id);
end;
$$;

revoke all on function public.fn_publish_commit(uuid) from public, anon, authenticated;
grant execute on function public.fn_publish_commit(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- Go-live (R4)
-- ---------------------------------------------------------------------------
create or replace function public.fn_release_go_live(p_release_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  pending int;
begin
  select count(*) into pending
  from public.jobs j
  where j.kind = 'rebuild_pack'
    and j.payload->>'release_id' = p_release_id::text
    and j.status in ('queued', 'running', 'failed');

  if pending > 0 then
    return jsonb_build_object('ok', true, 'live', false, 'pending', pending);
  end if;

  update public.pack_builds
     set live = true
   where release_id = p_release_id
     and live = false;

  update public.releases
     set status = 'published',
         published_at = coalesce(published_at, now()),
         updated_at = now()
   where id = p_release_id
     and status = 'publishing';

  return jsonb_build_object('ok', true, 'live', true);
end;
$$;

revoke all on function public.fn_release_go_live(uuid) from public, anon, authenticated;
grant execute on function public.fn_release_go_live(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- Scheduled releases (R4)
-- ---------------------------------------------------------------------------
create or replace function public.fn_enqueue_due_releases()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  rel record;
begin
  for rel in
    select id from public.releases
    where status = 'scheduled'
      and publish_at is not null
      and publish_at <= now()
  loop
    update public.releases set status = 'publishing', updated_at = now() where id = rel.id;
    insert into public.jobs (kind, payload)
    values ('publish_release', jsonb_build_object('release_id', rel.id));
  end loop;
end;
$$;

revoke all on function public.fn_enqueue_due_releases() from public, anon, authenticated;
grant execute on function public.fn_enqueue_due_releases() to service_role;

-- ---------------------------------------------------------------------------
-- Unpublish
-- ---------------------------------------------------------------------------
create or replace function public.fn_unpublish_commit(p_entity text, p_ids uuid[])
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  warnings jsonb := '[]'::jsonb;
  grove_id uuid;
  region_id uuid;
begin
  perform public.fn_require_editor_or_service();

  foreach v_id in array p_ids loop
    if p_entity = 'revision' then
      update public.fragment_revisions set status = 'unpublished' where fragment_revisions.id = v_id;
      select f.grove_id into grove_id
      from public.fragment_revisions r join public.fragments f on f.id = r.fragment_id
      where r.id = v_id;
    elsif p_entity = 'fragment' then
      update public.fragments set status = 'unpublished' where fragments.id = v_id;
      update public.published_snapshots
         set data = jsonb_set(data, '{status}', '"unpublished"')
       where entity = 'fragment' and entity_id = v_id;
      select fragments.grove_id into grove_id from public.fragments where fragments.id = v_id;
      -- stranded prereq warning
      warnings := warnings || coalesce((
        select jsonb_agg(jsonb_build_object(
          'code','STRANDED_PREREQ','severity','warning',
          'message','prerequisite would be stranded',
          'entity','fragment','entity_id', f.id
        ))
        from public.fragments f
        join public.fragment_prereq_groups g on g.fragment_id = f.id
        join public.fragment_prereq_members m on m.group_id = g.id
        where m.requires_fragment_id = v_id
      ), '[]'::jsonb);
    elsif p_entity = 'grove' then
      update public.groves set status = 'unpublished' where groves.id = v_id;
      update public.published_snapshots
         set data = jsonb_set(data, '{status}', '"unpublished"')
       where entity = 'grove' and entity_id = v_id;
      grove_id := v_id;
      select groves.region_id into region_id from public.groves where groves.id = v_id;
    else
      update public.published_snapshots
         set data = jsonb_set(data, '{status}', '"unpublished"')
       where entity = p_entity and entity_id = v_id;
    end if;

    insert into public.audit_log (actor, action, entity, entity_id, detail)
    values (auth.uid(), 'unpublish', p_entity, v_id, '{}'::jsonb);

    if grove_id is not null then
      insert into public.jobs (kind, payload)
      values ('rebuild_pack', jsonb_build_object('grove_id', grove_id));
    end if;
    if region_id is not null then
      insert into public.jobs (kind, payload)
      values ('rebuild_pack', jsonb_build_object('region_id', region_id));
    end if;
  end loop;

  return jsonb_build_object('ok', true, 'warnings', warnings);
end;
$$;

revoke all on function public.fn_unpublish_commit(text, uuid[]) from public, anon, authenticated;
grant execute on function public.fn_unpublish_commit(text, uuid[]) to service_role;

-- Retention: journal voice only
create or replace function public.fn_daily_expiry_and_retention()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Voice file paths cleared; actual storage delete is M9/edge. Mark paths null when due.
  update public.journal_entries
     set voice_path = null
   where voice_path is not null
     and (
       (status in ('resting','hidden') and status_changed_at < now() - interval '30 days')
       or (status = 'grown' and status_changed_at < now() - interval '180 days')
     );
end;
$$;

revoke all on function public.fn_daily_expiry_and_retention() from public, anon, authenticated;
grant execute on function public.fn_daily_expiry_and_retention() to service_role;

