-- A2 Part 1 (R3): rebuild every grove linked to a grove that has a fragment
-- in the release, in either direction, from the live graph and from the
-- snapshots this commit is about to replace.

create or replace function public.fn_release_linked_groves(p_release_id uuid)
returns uuid[]
language sql
stable
set search_path = ''
as $$
  with touched as (
    select distinct f.grove_id
    from (
      select fr.fragment_id as fragment_id
      from public.release_items ri
      join public.fragment_revisions fr on fr.id = ri.entity_id
      where ri.release_id = p_release_id
        and ri.entity = 'revision'
      union
      select ri.entity_id as fragment_id
      from public.release_items ri
      where ri.release_id = p_release_id
        and ri.entity = 'fragment'
    ) ids
    join public.fragments f on f.id = ids.fragment_id
  ),
  anchors as (
    select f.id
    from public.fragments f
    join touched t on t.grove_id = f.grove_id
    where f.status <> 'retired'
    union
    select ps.entity_id
    from public.published_snapshots ps
    join touched t on t.grove_id = (ps.data->>'groveId')::uuid
    where ps.entity = 'fragment'
      and coalesce(ps.data->>'status', '') <> 'retired'
  ),
  linked as (
    select mf.grove_id as grove_id
    from public.fragment_prereq_groups g
    join public.fragment_prereq_members m on m.group_id = g.id
    join anchors a on a.id = g.fragment_id
    join public.fragments mf on mf.id = m.requires_fragment_id
    where mf.status <> 'retired'
    union
    select src.grove_id
    from public.fragment_prereq_members m
    join public.fragment_prereq_groups g on g.id = m.group_id
    join anchors a on a.id = m.requires_fragment_id
    join public.fragments src on src.id = g.fragment_id
    where src.status <> 'retired'
    union
    select coalesce((other.data->>'groveId')::uuid, mf.grove_id) as grove_id
    from public.published_snapshots ps
    join anchors a on a.id = ps.entity_id
    cross join lateral jsonb_array_elements(coalesce(ps.data->'requires', '[]'::jsonb)) req
    cross join lateral jsonb_array_elements(coalesce(req->'members', '[]'::jsonb)) mem
    left join public.published_snapshots other
      on other.entity = 'fragment'
     and other.entity_id = (mem->>'fragmentId')::uuid
    left join public.fragments mf on mf.id = (mem->>'fragmentId')::uuid
    where ps.entity = 'fragment'
      and coalesce(other.data->>'status', mf.status::text, '') <> 'retired'
    union
    select coalesce((ps.data->>'groveId')::uuid, src.grove_id) as grove_id
    from public.published_snapshots ps
    cross join lateral jsonb_array_elements(coalesce(ps.data->'requires', '[]'::jsonb)) req
    cross join lateral jsonb_array_elements(coalesce(req->'members', '[]'::jsonb)) mem
    join anchors a on a.id = (mem->>'fragmentId')::uuid
    left join public.fragments src on src.id = ps.entity_id
    where ps.entity = 'fragment'
      and coalesce(ps.data->>'status', src.status::text, '') <> 'retired'
  )
  select coalesce(array_agg(distinct l.grove_id), '{}'::uuid[])
  from linked l
  where l.grove_id is not null
    and not exists (select 1 from touched t where t.grove_id = l.grove_id);
$$;

revoke all on function public.fn_release_linked_groves(uuid) from public, anon, authenticated;
grant execute on function public.fn_release_linked_groves(uuid) to service_role;

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
  linked_groves uuid[];
begin
  perform public.fn_require_editor_or_service();

  checked := public.fn_publish_check(p_release_id);
  if not (checked->>'ok')::boolean then
    return checked;
  end if;

  -- Before snapshots are replaced: old published links and the live graph.
  linked_groves := public.fn_release_linked_groves(p_release_id);

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
        select coalesce(mz.region_id, gr.region_id) into r
          from public.music_cues c
          left join public.music_zones mz on mz.id = c.music_zone_id
          left join public.groves gr on gr.id = c.grove_id
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

  if linked_groves is not null then
    foreach dep_grove in array linked_groves loop
      grove_ids := array_append(grove_ids, dep_grove);
    end loop;
  end if;

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
