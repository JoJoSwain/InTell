-- M2b: get_pack_index (anon) + fn_unpublish_commit + purge reconcile enqueue
-- + geography → GeoJSON helper for pack builder (service_role / authenticated)

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
  else
    raise exception 'fn_pack_geog_geojson: unknown scope %', p_scope;
  end if;
  return g;
end;
$$;

revoke all on function public.fn_pack_geog_geojson(text, uuid) from public, anon;
grant execute on function public.fn_pack_geog_geojson(text, uuid) to authenticated, service_role;

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
    where
      (pb.scope = 'grove' and g.status = 'published')
      or (pb.scope = 'region' and r.id is not null)
    order by pb.scope, pb.scope_id, pb.id desc
  ) t;

  return result;
end;
$$;

revoke all on function public.get_pack_index() from public;
revoke all on function public.get_pack_index() from anon, authenticated;
grant execute on function public.get_pack_index() to anon;
grant execute on function public.get_pack_index() to authenticated;
grant execute on function public.get_pack_index() to service_role;

comment on function public.get_pack_index() is
  'M2b: anon-readable pack index; latest build per scope; published groves + any region with a build';

-- Unpublish: edge checks editor/admin with caller JWT; commit via this RPC (no storage ops)
create or replace function public.fn_unpublish_commit(p_entity text, p_ids uuid[])
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  ent text := lower(p_entity);
  id uuid;
  n int := 0;
  grove_ids uuid[] := '{}';
  region_ids uuid[] := '{}';
  gid uuid;
  rid uuid;
begin
  if p_ids is null or coalesce(array_length(p_ids, 1), 0) = 0 then
    raise exception 'fn_unpublish_commit: empty ids';
  end if;

  foreach id in array p_ids loop
    gid := null;
    rid := null;
    if ent = 'grove' then
      update public.groves set status = 'unpublished' where groves.id = id;
      grove_ids := array_append(grove_ids, id);
      n := n + 1;
    elsif ent = 'fragment' then
      update public.fragments set status = 'unpublished' where fragments.id = id;
      select grove_id into gid from public.fragments where fragments.id = id;
      if gid is not null then grove_ids := array_append(grove_ids, gid); end if;
      n := n + 1;
    elsif ent = 'revision' then
      update public.fragment_revisions set status = 'unpublished' where fragment_revisions.id = id;
      select f.grove_id into gid
        from public.fragment_revisions fr
        join public.fragments f on f.id = fr.fragment_id
       where fr.id = id;
      if gid is not null then grove_ids := array_append(grove_ids, gid); end if;
      n := n + 1;
    elsif ent = 'music_cue' then
      update public.music_cues set status = 'unpublished' where music_cues.id = id;
      select mc.grove_id, mz.region_id
        into gid, rid
        from public.music_cues mc
        left join public.music_zones mz on mz.id = mc.music_zone_id
       where mc.id = id;
      if gid is not null then grove_ids := array_append(grove_ids, gid); end if;
      if rid is not null then region_ids := array_append(region_ids, rid); end if;
      n := n + 1;
    elsif ent = 'ambience_zone' then
      update public.ambience_zones set status = 'unpublished' where ambience_zones.id = id;
      select region_id into rid from public.ambience_zones where ambience_zones.id = id;
      if rid is not null then region_ids := array_append(region_ids, rid); end if;
      n := n + 1;
    elsif ent = 'music_zone' then
      update public.music_zones set status = 'unpublished' where music_zones.id = id;
      select region_id into rid from public.music_zones where music_zones.id = id;
      if rid is not null then region_ids := array_append(region_ids, rid); end if;
      n := n + 1;
    elsif ent = 'ui_cue' then
      update public.ui_cues set status = 'unpublished' where ui_cues.id = id;
      select region_id into rid from public.ui_cues where ui_cues.id = id;
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
      id,
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

revoke all on function public.fn_unpublish_commit(text, uuid[]) from public, anon;
grant execute on function public.fn_unpublish_commit(text, uuid[]) to authenticated, service_role;

create or replace function public.fn_enqueue_purge_reconcile(
  p_reason text default 'reconcile',
  p_detail jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.jobs
    where kind = 'purge_asset' and status = 'queued'
  ) then
    return;
  end if;
  insert into public.jobs (kind, payload)
  values (
    'purge_asset',
    jsonb_build_object('reason', coalesce(p_reason, 'reconcile')) || coalesce(p_detail, '{}'::jsonb)
  );
end;
$$;

revoke all on function public.fn_enqueue_purge_reconcile(text, jsonb) from public, anon;
grant execute on function public.fn_enqueue_purge_reconcile(text, jsonb) to service_role, authenticated;

-- Staff gate helpers for edge functions (avoid PostgREST array-enum binding issues)
create or replace function public.fn_is_editor_or_admin()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select public.has_role(array['editor','admin']::public.staff_role[]);
$$;

revoke all on function public.fn_is_editor_or_admin() from public, anon;
grant execute on function public.fn_is_editor_or_admin() to authenticated, service_role;
