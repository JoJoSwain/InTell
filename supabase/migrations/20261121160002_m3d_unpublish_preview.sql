-- M3d D4: shared stranded-prereq helper + read-only fn_unpublish_preview

create or replace function public.fn_stranded_prereqs(p_entity text, p_ids uuid[])
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  warnings jsonb := '[]'::jsonb;
  frag_warnings jsonb;
begin
  if p_entity is distinct from 'fragment' then
    return '[]'::jsonb;
  end if;

  foreach v_id in array p_ids loop
    select coalesce(jsonb_agg(public.fn_check_issue(
      'STRANDED_PREREQ',
      'warning',
      'prerequisite would be stranded',
      'fragment',
      f.id
    ) order by f.id), '[]'::jsonb)
    into frag_warnings
    from public.fragments f
    join public.fragment_prereq_groups g on g.fragment_id = f.id
    join public.fragment_prereq_members m on m.group_id = g.id
    where m.requires_fragment_id = v_id;

    warnings := warnings || frag_warnings;
  end loop;

  return warnings;
end;
$$;

revoke all on function public.fn_stranded_prereqs(text, uuid[]) from public, anon, authenticated;
grant execute on function public.fn_stranded_prereqs(text, uuid[]) to service_role;

create or replace function public.fn_unpublish_preview(p_entity text, p_ids uuid[])
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.role() = 'authenticated'
     and not public.has_role(array['editor','admin']::public.staff_role[]) then
    raise exception 'editor required';
  end if;

  return jsonb_build_object(
    'ok', true,
    'warnings', public.fn_stranded_prereqs(p_entity, p_ids)
  );
end;
$$;

revoke all on function public.fn_unpublish_preview(text, uuid[]) from public, anon;
grant execute on function public.fn_unpublish_preview(text, uuid[]) to authenticated, service_role;

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

  warnings := public.fn_stranded_prereqs(p_entity, p_ids);

  foreach v_id in array p_ids loop
    grove_id := null;
    region_id := null;

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
