-- M2b report review S1/S2: lock down security-definer pack helpers

-- ---------------------------------------------------------------------------
-- S1: fn_pack_geog_geojson — service_role only; protected fragments → null
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
  vis public.fragment_visibility;
begin
  if p_scope = 'grove_boundary' then
    select extensions.ST_AsGeoJSON(boundary)::jsonb into g from public.groves where id = p_id;
  elsif p_scope = 'fragment_point' then
    select visibility into vis from public.fragments where id = p_id;
    if vis is null then
      return null;
    end if;
    if vis = 'protected' then
      return null;
    end if;
    select extensions.ST_AsGeoJSON(location)::jsonb into g from public.fragments where id = p_id;
  elsif p_scope = 'ambience_zone' then
    select extensions.ST_AsGeoJSON(boundary)::jsonb into g from public.ambience_zones where id = p_id;
  elsif p_scope = 'music_zone' then
    select extensions.ST_AsGeoJSON(boundary)::jsonb into g from public.music_zones where id = p_id;
  elsif p_scope = 'region_bounds' then
    select extensions.ST_AsGeoJSON(bounds)::jsonb into g from public.regions where id = p_id;
  else
    raise exception 'fn_pack_geog_geojson: unknown scope %', p_scope;
  end if;
  return g;
end;
$$;

revoke all on function public.fn_pack_geog_geojson(text, uuid) from public, anon, authenticated;
grant execute on function public.fn_pack_geog_geojson(text, uuid) to service_role;

-- ---------------------------------------------------------------------------
-- S2: role guards on publish/unpublish commit; purge reconcile = service_role
-- ---------------------------------------------------------------------------
create or replace function public.fn_require_editor_or_service()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.role() = 'service_role' then
    return;
  end if;
  if public.has_role(array['editor','admin']::public.staff_role[]) then
    return;
  end if;
  raise exception 'editor or admin required'
    using errcode = '42501';
end;
$$;

revoke all on function public.fn_require_editor_or_service() from public, anon;
grant execute on function public.fn_require_editor_or_service() to authenticated, service_role;

-- Wrap unpublish with guard (recreate body from M2b migration + guard at top)
create or replace function public.fn_unpublish_commit(p_entity text, p_ids uuid[])
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  ent text := lower(p_entity);
  entity_id uuid;
  n int := 0;
  grove_ids uuid[] := '{}';
  region_ids uuid[] := '{}';
  gid uuid;
  rid uuid;
begin
  perform public.fn_require_editor_or_service();

  if p_ids is null or coalesce(array_length(p_ids, 1), 0) = 0 then
    raise exception 'fn_unpublish_commit: empty ids';
  end if;

  foreach entity_id in array p_ids loop
    gid := null;
    rid := null;
    if ent = 'grove' then
      update public.groves set status = 'unpublished' where groves.id = entity_id;
      grove_ids := array_append(grove_ids, entity_id);
      n := n + 1;
    elsif ent = 'fragment' then
      update public.fragments set status = 'unpublished' where fragments.id = entity_id;
      select grove_id into gid from public.fragments where fragments.id = entity_id;
      if gid is not null then grove_ids := array_append(grove_ids, gid); end if;
      n := n + 1;
    elsif ent = 'revision' then
      update public.fragment_revisions set status = 'unpublished' where fragment_revisions.id = entity_id;
      select f.grove_id into gid
        from public.fragment_revisions fr
        join public.fragments f on f.id = fr.fragment_id
       where fr.id = entity_id;
      if gid is not null then grove_ids := array_append(grove_ids, gid); end if;
      n := n + 1;
    elsif ent = 'music_cue' then
      update public.music_cues set status = 'unpublished' where music_cues.id = entity_id;
      select mc.grove_id, mz.region_id
        into gid, rid
        from public.music_cues mc
        left join public.music_zones mz on mz.id = mc.music_zone_id
       where mc.id = entity_id;
      if gid is not null then grove_ids := array_append(grove_ids, gid); end if;
      if rid is not null then region_ids := array_append(region_ids, rid); end if;
      n := n + 1;
    elsif ent = 'ambience_zone' then
      update public.ambience_zones set status = 'unpublished' where ambience_zones.id = entity_id;
      select region_id into rid from public.ambience_zones where ambience_zones.id = entity_id;
      if rid is not null then region_ids := array_append(region_ids, rid); end if;
      n := n + 1;
    elsif ent = 'music_zone' then
      update public.music_zones set status = 'unpublished' where music_zones.id = entity_id;
      select region_id into rid from public.music_zones where music_zones.id = entity_id;
      if rid is not null then region_ids := array_append(region_ids, rid); end if;
      n := n + 1;
    elsif ent = 'ui_cue' then
      update public.ui_cues set status = 'unpublished' where ui_cues.id = entity_id;
      select region_id into rid from public.ui_cues where ui_cues.id = entity_id;
      if rid is not null then region_ids := array_append(region_ids, rid); end if;
      n := n + 1;
    else
      raise exception 'fn_unpublish_commit: unknown entity %', p_entity;
    end if;

    insert into public.audit_log (actor, action, entity, entity_id, detail)
    values (
      auth.uid(),
      'unpublish',
      ent,
      entity_id,
      jsonb_build_object('entity', ent)
    );
  end loop;

  select coalesce(array_agg(distinct x), '{}') into grove_ids
  from unnest(grove_ids) x where x is not null;
  select coalesce(array_agg(distinct x), '{}') into region_ids
  from unnest(region_ids) x where x is not null;

  if coalesce(array_length(grove_ids, 1), 0) > 0 then
    foreach gid in array grove_ids loop
      perform public.fn_enqueue_rebuild_pack(gid, null);
    end loop;
  end if;
  if coalesce(array_length(region_ids, 1), 0) > 0 then
    foreach rid in array region_ids loop
      perform public.fn_enqueue_rebuild_pack(null, rid);
    end loop;
  end if;

  return jsonb_build_object('ok', true, 'unpublished', n);
end;
$$;

-- Guard at the top of fn_publish_commit (replace; keep M2a body)
create or replace function public.fn_publish_commit(p_entity text, p_ids uuid[])
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  checked jsonb;
  entity_id uuid;
  rev public.fragment_revisions%rowtype;
  grove_id uuid;
  region_id uuid;
begin
  perform public.fn_require_editor_or_service();

  checked := public.fn_publish_check(p_entity, p_ids);
  if not (checked->>'ok')::boolean then
    return checked;
  end if;

  if p_entity = 'revision' then
    foreach entity_id in array p_ids loop
      update public.fragment_revisions
         set status = 'published',
             publish_at = coalesce(publish_at, now())
       where fragment_revisions.id = entity_id
      returning * into rev;

      update public.fragments
         set status = case when status in ('draft','in_review','approved') then 'published' else status end
       where id = rev.fragment_id;

      select f.grove_id into grove_id from public.fragments f where f.id = rev.fragment_id;
      select s.region_id into region_id
      from public.groves g
      join public.sites s on s.id = g.site_id
      where g.id = grove_id;

      update public.groves
         set status = case when status in ('draft','in_review','approved') then 'published' else status end,
             published_at = coalesce(published_at, now())
       where id = grove_id;

      update public.audio_assets a
         set is_public = true
       where a.id in (
         select rv.narration_asset_id from public.revision_versions rv where rv.revision_id = rev.id
       );

      update public.seed_links sl
         set stage = 'grown'
       where sl.revision_id = rev.id;

      update public.seeds s
         set status = 'grown', status_changed_at = now()
       where s.id in (select sl.seed_id from public.seed_links sl where sl.revision_id = rev.id);

      insert into public.audit_log (actor, action, entity, entity_id, detail)
      values (
        auth.uid(),
        'publish_commit',
        'fragment_revision',
        rev.id,
        jsonb_build_object('fields', jsonb_build_array('status','publish_at'), 'grove_id', grove_id)
      );

      perform public.fn_enqueue_rebuild_pack(grove_id, region_id);
    end loop;

  elsif p_entity = 'music_cue' then
    foreach entity_id in array p_ids loop
      update public.music_cues set status = 'published' where music_cues.id = entity_id;
      update public.audio_assets a
         set is_public = true
       where a.id in (select s.asset_id from public.music_cue_stems s where s.cue_id = entity_id);

      select c.grove_id, z.region_id
        into grove_id, region_id
      from public.music_cues c
      left join public.music_zones z on z.id = c.music_zone_id
      where c.id = entity_id;

      insert into public.audit_log (actor, action, entity, entity_id, detail)
      values (
        auth.uid(),
        'publish_commit',
        'music_cue',
        entity_id,
        jsonb_build_object('fields', jsonb_build_array('status'))
      );

      perform public.fn_enqueue_rebuild_pack(grove_id, region_id);
    end loop;
  end if;

  return checked || jsonb_build_object('committed', true);
end;
$$;

revoke all on function public.fn_enqueue_purge_reconcile(text, jsonb) from public, anon, authenticated;
grant execute on function public.fn_enqueue_purge_reconcile(text, jsonb) to service_role;
