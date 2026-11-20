-- M2a: playability + two-phase publish (DATA_MODEL §9/§11 amended)
-- Owner: postgres (B4). search_path locked empty (decision 5).

create or replace function public.fn_region_today(p_timezone text)
returns date
language sql
stable
security definer
set search_path = ''
as $$
  select (timezone(coalesce(nullif(p_timezone, ''), 'America/Denver'), now()))::date;
$$;

create or replace function public.fn_date_unexpired(p_expires_on date, p_timezone text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  -- C9: null expires_on never expires
  select p_expires_on is null
      or p_expires_on >= public.fn_region_today(p_timezone);
$$;

create or replace function public.fn_asset_is_playable(p_asset_id uuid, p_timezone text default 'America/Denver')
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  ok boolean := false;
begin
  select exists (
    select 1
    from public.asset_rights ar
    left join public.consents c on c.id = ar.consent_id
    where ar.asset_id = p_asset_id
      and ar.status = 'active'
      and public.fn_date_unexpired(ar.expires_on, p_timezone)
      and (
        ar.license <> 'consent_form'
        or (
          c.status = 'active'
          and public.fn_date_unexpired(c.expires_on, p_timezone)
          and 'app' = any (c.channels)
        )
      )
  ) into ok;
  return coalesce(ok, false);
end;
$$;

create or replace function public.fn_site_ok(p_site_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  tz text;
  ok boolean;
begin
  select r.timezone into tz
  from public.sites s
  join public.regions r on r.id = s.region_id
  where s.id = p_site_id;

  select exists (
    select 1
    from public.site_approvals sa
    where sa.site_id = p_site_id
      and sa.status = 'active'
      and public.fn_date_unexpired(sa.expires_on, coalesce(tz, 'America/Denver'))
  ) into ok;
  return coalesce(ok, false);
end;
$$;

create or replace function public.fn_revision_is_playable(p_revision_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  rev public.fragment_revisions%rowtype;
  frag public.fragments%rowtype;
  grove public.groves%rowtype;
  tz text;
  consent_ok boolean;
  asset_ok boolean;
  outcome_ok boolean;
begin
  select * into rev from public.fragment_revisions where id = p_revision_id;
  if not found then return false; end if;

  select * into frag from public.fragments where id = rev.fragment_id;
  if not found then return false; end if;

  -- C1: only published/retired fragments are playable
  if frag.status not in ('published', 'retired') then
    return false;
  end if;

  if rev.status <> 'published' then
    return false;
  end if;
  if rev.publish_at is not null and rev.publish_at > now() then
    return false;
  end if;

  select * into grove from public.groves where id = frag.grove_id;
  if grove.status <> 'published' then
    return false;
  end if;
  if not public.fn_site_ok(grove.site_id) then
    return false;
  end if;

  select r.timezone into tz
  from public.sites s
  join public.regions r on r.id = s.region_id
  where s.id = grove.site_id;

  select not exists (
    select 1
    from public.revision_contributors rc
    join public.consents c on c.id = rc.consent_id
    where rc.revision_id = rev.id
      and (
        c.status <> 'active'
        or not public.fn_date_unexpired(c.expires_on, coalesce(tz, 'America/Denver'))
        or not ('app' = any (c.channels))
      )
  ) into consent_ok;
  if not consent_ok then return false; end if;

  -- every revision must have at least one version, and all assets playable
  if not exists (select 1 from public.revision_versions rv where rv.revision_id = rev.id) then
    return false;
  end if;

  select not exists (
    select 1
    from public.revision_versions rv
    where rv.revision_id = rev.id
      and not public.fn_asset_is_playable(rv.narration_asset_id, coalesce(tz, 'America/Denver'))
  ) into asset_ok;
  if not asset_ok then return false; end if;

  if rev.requires_outcome_option_id is not null then
    select exists (
      select 1
      from public.crossroads_options o
      join public.crossroads x on x.id = o.crossroads_id
      where o.id = rev.requires_outcome_option_id
        and x.status = 'decided'
        and x.outcome_option_id = o.id
    ) into outcome_ok;
    if not outcome_ok then return false; end if;
  end if;

  return true;
end;
$$;

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

create or replace function public.fn_cue_is_playable(p_cue_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  cue public.music_cues%rowtype;
  zone_ok boolean := false;
  stem_ok boolean;
  tz text := 'America/Denver';
begin
  select * into cue from public.music_cues where id = p_cue_id;
  if not found or cue.status <> 'published' then
    return false;
  end if;

  if cue.music_zone_id is not null then
    select z.status = 'published', r.timezone
      into zone_ok, tz
    from public.music_zones z
    join public.regions r on r.id = z.region_id
    where z.id = cue.music_zone_id;
  else
    select g.status = 'published', r.timezone
      into zone_ok, tz
    from public.groves g
    join public.sites s on s.id = g.site_id
    join public.regions r on r.id = s.region_id
    where g.id = cue.grove_id;
  end if;

  if not coalesce(zone_ok, false) then
    return false;
  end if;

  if not exists (select 1 from public.music_cue_stems s where s.cue_id = cue.id) then
    return false;
  end if;

  select not exists (
    select 1
    from public.music_cue_stems s
    where s.cue_id = cue.id
      and not public.fn_asset_is_playable(s.asset_id, coalesce(tz, 'America/Denver'))
  ) into stem_ok;

  return coalesce(stem_ok, false);
end;
$$;

create or replace function public.fn_layer_assets_playable(p_layer_id uuid)
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select a.asset_id
  from public.ambience_layer_assets a
  where a.layer_id = p_layer_id
    and public.fn_asset_is_playable(a.asset_id, 'America/Denver');
$$;

-- ADR 0003 §4: B must precede A if A has a single-member group {B}, or {X} where B must precede X
create or replace function public.fn_must_precede(p_earlier uuid, p_later uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  with recursive chain as (
    select p_later as frag_id
    union
    select m.requires_fragment_id
    from chain c
    join public.fragment_prereq_groups g on g.fragment_id = c.frag_id
    join public.fragment_prereq_members m on m.group_id = g.id
    where (
      select count(*) from public.fragment_prereq_members m2 where m2.group_id = g.id
    ) = 1
  )
  select exists (select 1 from chain where frag_id = p_earlier);
$$;

revoke all on function public.fn_must_precede(uuid, uuid) from public, anon;
grant execute on function public.fn_must_precede(uuid, uuid) to authenticated, service_role;

-- Publish check return helpers
create or replace function public.fn_publish_check(p_entity text, p_ids uuid[])
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  failures jsonb := '[]'::jsonb;
  shas text[] := '{}';
  entity_id uuid;
  frag public.fragments%rowtype;
  grove public.groves%rowtype;
  rev public.fragment_revisions%rowtype;
  cue public.music_cues%rowtype;
  prereq_ok boolean;
  has_start boolean;
  empty_group boolean;
  other public.fragments%rowtype;
  stem_rec record;
  base_dur int;
  base_loop_start int;
  base_loop_end int;
  asset_rec public.audio_assets%rowtype;
  target_lufs numeric;
  tz text;
  grp record;
begin
  if p_entity = 'revision' then
    foreach entity_id in array p_ids loop
      select * into rev from public.fragment_revisions where fragment_revisions.id = entity_id;
      if not found then
        failures := failures || jsonb_build_array(jsonb_build_object(
          'code','NO_TRANSCRIPT','severity','error','message','revision not found','entity_id',entity_id));
        continue;
      end if;

      select * into frag from public.fragments where id = rev.fragment_id;
      select * into grove from public.groves where id = frag.grove_id;
      select r.timezone into tz
      from public.sites s join public.regions r on r.id = s.region_id
      where s.id = grove.site_id;

      if not exists (
        select 1 from public.revision_versions rv
        where rv.revision_id = rev.id and coalesce(nullif(trim(rv.transcript), ''), '') <> ''
      ) or exists (
        select 1 from public.revision_versions rv
        where rv.revision_id = rev.id and coalesce(nullif(trim(rv.transcript), ''), '') = ''
      ) then
        failures := failures || jsonb_build_array(jsonb_build_object(
          'code','NO_TRANSCRIPT','severity','error','message','missing transcript','entity_id',rev.id));
      end if;

      if not exists (select 1 from public.revision_versions rv where rv.revision_id = rev.id) then
        failures := failures || jsonb_build_array(jsonb_build_object(
          'code','NARRATION_RIGHTS','severity','error','message','no versions','entity_id',rev.id));
      end if;

      for asset_rec in
        select a.* from public.revision_versions rv
        join public.audio_assets a on a.id = rv.narration_asset_id
        where rv.revision_id = rev.id
      loop
        if not public.fn_asset_is_playable(asset_rec.id, coalesce(tz, 'America/Denver')) then
          failures := failures || jsonb_build_array(jsonb_build_object(
            'code','NARRATION_RIGHTS','severity','error','message','narration not playable','entity_id',rev.id));
        else
          shas := array_append(shas, asset_rec.sha256);
        end if;
        target_lufs := -16;
        if asset_rec.loudness_lufs is not null
           and abs(asset_rec.loudness_lufs - target_lufs) > 2 then
          failures := failures || jsonb_build_array(jsonb_build_object(
            'code','LOUDNESS','severity','warning','message','loudness off target','entity_id',asset_rec.id));
        end if;
      end loop;

      if exists (
        select 1
        from public.revision_contributors rc
        join public.consents c on c.id = rc.consent_id
        where rc.revision_id = rev.id
          and (
            c.status <> 'active'
            or not public.fn_date_unexpired(c.expires_on, coalesce(tz, 'America/Denver'))
            or not ('app' = any (c.channels))
          )
      ) then
        failures := failures || jsonb_build_array(jsonb_build_object(
          'code','CONSENT_APP','severity','error','message','consent missing app channel or inactive','entity_id',rev.id));
      end if;

      if not public.fn_site_ok(grove.site_id) then
        failures := failures || jsonb_build_array(jsonb_build_object(
          'code','SITE_APPROVAL','severity','error','message','site not approved','entity_id',grove.site_id));
      end if;

      if not extensions.ST_Covers(grove.boundary, frag.location) then
        failures := failures || jsonb_build_array(jsonb_build_object(
          'code','OUTSIDE_GROVE','severity','error','message','fragment outside grove','entity_id',frag.id));
      end if;

      -- EMPTY_PREREQ_GROUP / PREREQ_UNPUBLISHED (ADR 0003)
      for grp in
        select g.id as group_id
        from public.fragment_prereq_groups g
        where g.fragment_id = frag.id
      loop
        select not exists (
          select 1 from public.fragment_prereq_members m where m.group_id = grp.group_id
        ) into empty_group;
        if empty_group then
          failures := failures || jsonb_build_array(jsonb_build_object(
            'code','EMPTY_PREREQ_GROUP','severity','error','message','prerequisite group has no members','entity_id',frag.id));
        else
          select exists (
            select 1
            from public.fragment_prereq_members m
            join public.fragments rf on rf.id = m.requires_fragment_id
            where m.group_id = grp.group_id
              and (
                rf.status in ('published','retired')
                or exists (
                  select 1 from public.fragment_revisions r
                  where r.fragment_id = rf.id and r.id = any(p_ids)
                )
              )
          ) into prereq_ok;
          if not coalesce(prereq_ok, false) then
            failures := failures || jsonb_build_array(jsonb_build_object(
              'code','PREREQ_UNPUBLISHED','severity','error','message','prerequisite group has no published member','entity_id',frag.id));
          end if;
        end if;
      end loop;

      -- NO_START: grove needs ≥1 published fragment with no prerequisite groups
      select exists (
        select 1 from public.fragments f
        where f.grove_id = grove.id
          and (f.status in ('published','retired') or exists (
            select 1 from public.fragment_revisions r
            where r.fragment_id = f.id and r.id = any(p_ids)
          ))
          and not exists (
            select 1 from public.fragment_prereq_groups g where g.fragment_id = f.id
          )
      ) into has_start;
      if not has_start then
        failures := failures || jsonb_build_array(jsonb_build_object(
          'code','NO_START','severity','error','message','grove needs a published start fragment','entity_id',grove.id));
      end if;

      if frag.visibility = 'protected' and frag.marker_code is null then
        failures := failures || jsonb_build_array(jsonb_build_object(
          'code','PROTECTED_NO_CODE','severity','error','message','protected needs marker_code','entity_id',frag.id));
      end if;

      -- RADIUS_OVERLAP skips must-precede pairs (ADR 0003 §4)
      if frag.visibility in ('marked','unmarked') then
        for other in
          select * from public.fragments o
          where o.grove_id = grove.id
            and o.id <> frag.id
            and o.visibility in ('marked','unmarked')
            and o.id > frag.id  -- emit once per unordered pair
        loop
          if extensions.ST_DWithin(frag.location, other.location, frag.trigger_radius_m + other.trigger_radius_m)
             and not public.fn_must_precede(frag.id, other.id)
             and not public.fn_must_precede(other.id, frag.id) then
            failures := failures || jsonb_build_array(jsonb_build_object(
              'code','RADIUS_OVERLAP','severity','warning','message','trigger radii overlap','entity_id',frag.id,
              'other_id', other.id));
          end if;
        end loop;
      end if;

      if rev.requires_outcome_option_id is not null then
        if not exists (
          select 1
          from public.crossroads_options o
          join public.crossroads x on x.id = o.crossroads_id
          where o.id = rev.requires_outcome_option_id
            and x.grove_id = grove.id
        ) then
          failures := failures || jsonb_build_array(jsonb_build_object(
            'code','OUTCOME_REF','severity','error','message','outcome option not in grove','entity_id',rev.id));
        end if;
      end if;
    end loop;

  elsif p_entity = 'music_cue' then
    foreach entity_id in array p_ids loop
      select * into cue from public.music_cues where music_cues.id = entity_id;
      if not found then continue; end if;

      if jsonb_typeof(cue.conditions) <> 'object' then
        failures := failures || jsonb_build_array(jsonb_build_object(
          'code','CONDITION_SCHEMA','severity','error','message','conditions must be object','entity_id',cue.id));
      end if;

      base_dur := null;
      for stem_rec in
        select s.*, a.duration_ms, a.loop_start_ms, a.loop_end_ms, a.sha256, a.loudness_lufs, a.id as asset_uuid
        from public.music_cue_stems s
        join public.audio_assets a on a.id = s.asset_id
        where s.cue_id = cue.id
      loop
        if jsonb_typeof(stem_rec.state_gains) <> 'array' then
          failures := failures || jsonb_build_array(jsonb_build_object(
            'code','CONDITION_SCHEMA','severity','error','message','state_gains must be array','entity_id',stem_rec.id));
        end if;
        if base_dur is null then
          base_dur := stem_rec.duration_ms;
          base_loop_start := stem_rec.loop_start_ms;
          base_loop_end := stem_rec.loop_end_ms;
        elsif stem_rec.duration_ms is distinct from base_dur
           or stem_rec.loop_start_ms is distinct from base_loop_start
           or stem_rec.loop_end_ms is distinct from base_loop_end then
          failures := failures || jsonb_build_array(jsonb_build_object(
            'code','STEM_MISMATCH','severity','error','message','stem duration/loop mismatch','entity_id',cue.id));
        end if;
        shas := array_append(shas, stem_rec.sha256);
        if stem_rec.loudness_lufs is not null and abs(stem_rec.loudness_lufs - (-23)) > 2 then
          failures := failures || jsonb_build_array(jsonb_build_object(
            'code','LOUDNESS','severity','warning','message','stem loudness off target','entity_id',stem_rec.asset_uuid));
        end if;
      end loop;
    end loop;

  elsif p_entity = 'ambience_layer' then
    foreach entity_id in array p_ids loop
      if exists (
        select 1 from public.ambience_layers l
        where l.id = entity_id and l.wildlife_call = true and l.speaker_safe = true
      ) then
        failures := failures || jsonb_build_array(jsonb_build_object(
          'code','WILDLIFE_SPEAKER','severity','error','message','wildlife_call cannot be speaker_safe','entity_id',entity_id));
      end if;
      for asset_rec in
        select a.* from public.ambience_layer_assets la
        join public.audio_assets a on a.id = la.asset_id
        where la.layer_id = entity_id
      loop
        shas := array_append(shas, asset_rec.sha256);
      end loop;
    end loop;
  end if;

  return jsonb_build_object(
    'ok', not exists (
      select 1 from jsonb_array_elements(failures) f
      where f->>'severity' = 'error'
    ),
    'failures', failures,
    'asset_shas_to_publish', to_jsonb(ARRAY(select distinct unnest(shas)))
  );
end;
$$;

create or replace function public.fn_enqueue_rebuild_pack(p_grove_id uuid default null, p_region_id uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- R3: ids only
  if p_grove_id is not null then
    insert into public.jobs (kind, payload)
    values ('rebuild_pack', jsonb_build_object('grove_id', p_grove_id));
  end if;
  if p_region_id is not null then
    insert into public.jobs (kind, payload)
    values ('rebuild_pack', jsonb_build_object('region_id', p_region_id));
  end if;
end;
$$;

create or replace function public.fn_enqueue_purge_asset(p_asset_sha text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.jobs (kind, payload)
  values ('purge_asset', jsonb_build_object('asset_sha', p_asset_sha));
end;
$$;

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

      -- mark assets public (storage copy is edge/M2b)
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
      values (auth.uid(), 'publish_commit', 'music_cue', entity_id, jsonb_build_object('fields', jsonb_build_array('status')));

      perform public.fn_enqueue_rebuild_pack(grove_id, region_id);
    end loop;
  end if;

  return checked || jsonb_build_object('committed', true);
end;
$$;

-- Revoke public execute; grant only to authenticated (staff policies gate actual use) and service_role
do $$
declare
  fn text;
begin
  foreach fn in array array[
    'fn_region_today(text)',
    'fn_date_unexpired(date,text)',
    'fn_asset_is_playable(uuid,text)',
    'fn_site_ok(uuid)',
    'fn_revision_is_playable(uuid)',
    'fn_current_revision(uuid)',
    'fn_cue_is_playable(uuid)',
    'fn_layer_assets_playable(uuid)',
    'fn_publish_check(text,uuid[])',
    'fn_publish_commit(text,uuid[])',
    'fn_enqueue_rebuild_pack(uuid,uuid)',
    'fn_enqueue_purge_asset(text)'
  ] loop
    execute format('revoke all on function public.%s from public, anon', fn);
    execute format('grant execute on function public.%s to authenticated, service_role', fn);
  end loop;
end $$;
