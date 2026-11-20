-- M2a: triggers enqueue jobs only (decision 7); no HTTP in triggers. R3: no coords/codes in audit.

create or replace function public.fn_rights_leave_active()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected_asset uuid;
  affected_sha text;
  grove_ids uuid[];
  region_ids uuid[];
  still_playable boolean;
begin
  if tg_op = 'UPDATE'
     and old.status = 'active'
     and new.status is distinct from 'active' then

    if tg_table_name = 'consents' then
      for affected_asset, affected_sha in
        select distinct a.id, a.sha256
        from public.revision_contributors rc
        join public.revision_versions rv on rv.revision_id = rc.revision_id
        join public.audio_assets a on a.id = rv.narration_asset_id
        where rc.consent_id = new.id
        union
        select distinct a.id, a.sha256
        from public.asset_rights ar
        join public.audio_assets a on a.id = ar.asset_id
        where ar.consent_id = new.id
      loop
        still_playable := public.fn_asset_is_playable(affected_asset);
        if not still_playable then
          update public.audio_assets set is_public = false where id = affected_asset and is_public;
          perform public.fn_enqueue_purge_asset(affected_sha);
        end if;
      end loop;

      select array_agg(distinct g.id), array_agg(distinct s.region_id)
        into grove_ids, region_ids
      from public.revision_contributors rc
      join public.fragment_revisions fr on fr.id = rc.revision_id
      join public.fragments f on f.id = fr.fragment_id
      join public.groves g on g.id = f.grove_id
      join public.sites s on s.id = g.site_id
      where rc.consent_id = new.id;

      if grove_ids is not null then
        for i in 1 .. coalesce(array_length(grove_ids, 1), 0) loop
          perform public.fn_enqueue_rebuild_pack(grove_ids[i], region_ids[i]);
        end loop;
      end if;

      insert into public.audit_log (actor, action, entity, entity_id, detail)
      values (auth.uid(), 'rights_leave_active', 'consents', new.id,
              jsonb_build_object('fields', jsonb_build_array('status'), 'from', old.status, 'to', new.status));

    elsif tg_table_name = 'asset_rights' then
      select a.sha256 into affected_sha from public.audio_assets a where a.id = new.asset_id;
      still_playable := public.fn_asset_is_playable(new.asset_id);
      if not still_playable then
        update public.audio_assets set is_public = false where id = new.asset_id and is_public;
        perform public.fn_enqueue_purge_asset(affected_sha);
      end if;

      select array_agg(distinct g.id), array_agg(distinct s.region_id)
        into grove_ids, region_ids
      from public.revision_versions rv
      join public.fragment_revisions fr on fr.id = rv.revision_id
      join public.fragments f on f.id = fr.fragment_id
      join public.groves g on g.id = f.grove_id
      join public.sites s on s.id = g.site_id
      where rv.narration_asset_id = new.asset_id;

      if grove_ids is not null then
        for i in 1 .. coalesce(array_length(grove_ids, 1), 0) loop
          perform public.fn_enqueue_rebuild_pack(grove_ids[i], region_ids[i]);
        end loop;
      end if;

      -- also region packs for ambience/music using the asset
      insert into public.jobs (kind, payload)
      select 'rebuild_pack', jsonb_build_object('region_id', z.region_id)
      from public.ambience_layer_assets la
      join public.ambience_layers l on l.id = la.layer_id
      join public.ambience_zones z on z.profile_id = l.profile_id
      where la.asset_id = new.asset_id
      union
      select 'rebuild_pack', jsonb_build_object('region_id', mz.region_id)
      from public.music_cue_stems ms
      join public.music_cues mc on mc.id = ms.cue_id
      join public.music_zones mz on mz.id = mc.music_zone_id
      where ms.asset_id = new.asset_id;

      insert into public.audit_log (actor, action, entity, entity_id, detail)
      values (auth.uid(), 'rights_leave_active', 'asset_rights', new.id,
              jsonb_build_object('fields', jsonb_build_array('status'), 'asset_id', new.asset_id));

    elsif tg_table_name = 'site_approvals' then
      select array_agg(distinct g.id), array_agg(distinct s.region_id)
        into grove_ids, region_ids
      from public.sites s
      join public.groves g on g.site_id = s.id
      where s.id = new.site_id;

      if grove_ids is not null then
        for i in 1 .. coalesce(array_length(grove_ids, 1), 0) loop
          perform public.fn_enqueue_rebuild_pack(grove_ids[i], region_ids[i]);
        end loop;
      end if;

      insert into public.audit_log (actor, action, entity, entity_id, detail)
      values (auth.uid(), 'rights_leave_active', 'site_approvals', new.id,
              jsonb_build_object('fields', jsonb_build_array('status'), 'site_id', new.site_id));
    end if;
  end if;
  return new;
end;
$$;

create trigger consents_leave_active
  after update on public.consents
  for each row execute function public.fn_rights_leave_active();
create trigger asset_rights_leave_active
  after update on public.asset_rights
  for each row execute function public.fn_rights_leave_active();
create trigger site_approvals_leave_active
  after update on public.site_approvals
  for each row execute function public.fn_rights_leave_active();

-- Fragment change audit: never log location or marker_code (R3)
create or replace function public.fn_audit_fragment_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  changed text[] := '{}';
begin
  if tg_op = 'INSERT' then
    insert into public.audit_log (actor, action, entity, entity_id, detail)
    values (auth.uid(), 'insert', 'fragments', new.id,
            jsonb_build_object('fields', jsonb_build_array('grove_id','tier','visibility','status')));
  elsif tg_op = 'UPDATE' then
    if old.title is distinct from new.title then changed := array_append(changed, 'title'); end if;
    if old.visibility is distinct from new.visibility then changed := array_append(changed, 'visibility'); end if;
    if old.status is distinct from new.status then changed := array_append(changed, 'status'); end if;
    if old.parent_id is distinct from new.parent_id then changed := array_append(changed, 'parent_id'); end if;
    if old.trigger_radius_m is distinct from new.trigger_radius_m then changed := array_append(changed, 'trigger_radius_m'); end if;
    if old.story_order is distinct from new.story_order then changed := array_append(changed, 'story_order'); end if;
    if old.location is distinct from new.location then changed := array_append(changed, 'location'); end if;
    if old.marker_code is distinct from new.marker_code then changed := array_append(changed, 'marker_code'); end if;
    -- R3: log field *names* only, never values for location/marker_code
    if array_length(changed, 1) is not null then
      insert into public.audit_log (actor, action, entity, entity_id, detail)
      values (auth.uid(), 'update', 'fragments', new.id, jsonb_build_object('fields', to_jsonb(changed)));
    end if;
  end if;
  return new;
end;
$$;

create trigger fragments_audit
  after insert or update on public.fragments
  for each row execute function public.fn_audit_fragment_change();

-- When a revision or cue becomes published outside fn_publish_commit, enqueue rebuild
create or replace function public.fn_publish_status_enqueue()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  gid uuid;
  rid uuid;
begin
  if tg_op = 'UPDATE'
     and new.status = 'published'
     and old.status is distinct from 'published' then
    if tg_table_name = 'fragment_revisions' then
      select f.grove_id, s.region_id into gid, rid
      from public.fragments f
      join public.groves g on g.id = f.grove_id
      join public.sites s on s.id = g.site_id
      where f.id = new.fragment_id;
      perform public.fn_enqueue_rebuild_pack(gid, rid);
    elsif tg_table_name = 'music_cues' then
      select c.grove_id, coalesce(z.region_id, s.region_id) into gid, rid
      from public.music_cues c
      left join public.music_zones z on z.id = c.music_zone_id
      left join public.groves g on g.id = c.grove_id
      left join public.sites s on s.id = g.site_id
      where c.id = new.id;
      perform public.fn_enqueue_rebuild_pack(gid, rid);
    end if;
  end if;
  return new;
end;
$$;

create trigger fragment_revisions_publish_enqueue
  after update on public.fragment_revisions
  for each row execute function public.fn_publish_status_enqueue();
create trigger music_cues_publish_enqueue
  after update on public.music_cues
  for each row execute function public.fn_publish_status_enqueue();

-- Cron helpers (invoked by pg_cron schedules in cron migration)
create or replace function public.fn_enqueue_due_publish_at()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
begin
  for r in
    select distinct f.grove_id, s.region_id
    from public.fragment_revisions fr
    join public.fragments f on f.id = fr.fragment_id
    join public.groves g on g.id = f.grove_id
    join public.sites s on s.id = g.site_id
    where fr.status = 'published'
      and fr.publish_at is not null
      and fr.publish_at <= now()
      and fr.publish_at > now() - interval '10 minutes'
  loop
    perform public.fn_enqueue_rebuild_pack(r.grove_id, r.region_id);
  end loop;
end;
$$;

create or replace function public.fn_close_due_crossroads()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
begin
  for r in
    select x.id, x.grove_id, s.region_id
    from public.crossroads x
    join public.groves g on g.id = x.grove_id
    join public.sites s on s.id = g.site_id
    where x.status = 'open'
      and x.closes_at <= now()
  loop
    update public.crossroads set status = 'closed' where id = r.id;
    -- C7: closing enqueues rebuild so packs show closed status
    perform public.fn_enqueue_rebuild_pack(r.grove_id, r.region_id);
    insert into public.audit_log (actor, action, entity, entity_id, detail)
    values (null, 'crossroads_closed', 'crossroads', r.id, jsonb_build_object('fields', jsonb_build_array('status')));
  end loop;
end;
$$;

create or replace function public.fn_daily_expiry_and_retention()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
  local_hour int;
begin
  -- C8: run hourly; act only for regions whose local hour is 2
  for r in select id, timezone from public.regions loop
    local_hour := extract(hour from timezone(r.timezone, now()))::int;
    if local_hour <> 2 then
      continue;
    end if;

    update public.consents c
       set status = 'expired'
     where c.status = 'active'
       and c.expires_on is not null
       and c.expires_on < public.fn_region_today(r.timezone);

    update public.asset_rights ar
       set status = 'expired'
     where ar.status = 'active'
       and ar.expires_on is not null
       and ar.expires_on < public.fn_region_today(r.timezone);

    update public.site_approvals sa
       set status = 'expired'
      from public.sites s
     where sa.site_id = s.id
       and s.region_id = r.id
       and sa.status = 'active'
       and sa.expires_on is not null
       and sa.expires_on < public.fn_region_today(r.timezone);

    -- purge memory_contact older than 90 days
    update public.seeds
       set memory_contact = null
     where memory_contact is not null
       and planted_at < now() - interval '90 days'
       and grove_id in (select g.id from public.groves g join public.sites s on s.id = g.site_id where s.region_id = r.id);

    -- voice retention: resting/hidden > 30d, or grown > 180d without may_quote
    update public.seeds
       set voice_path = null
     where voice_path is not null
       and grove_id in (select g.id from public.groves g join public.sites s on s.id = g.site_id where s.region_id = r.id)
       and (
         (status in ('resting','hidden') and coalesce(status_changed_at, updated_at) < now() - interval '30 days')
         or (status = 'grown' and not may_quote and coalesce(status_changed_at, updated_at) < now() - interval '180 days')
       );
  end loop;
end;
$$;

create or replace function public.fn_call_run_jobs()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  url text;
  key text;
begin
  select decrypted_secret into url
  from vault.decrypted_secrets
  where name = 'run_jobs_url'
  limit 1;

  select decrypted_secret into key
  from vault.decrypted_secrets
  where name = 'run_jobs_service_key'
  limit 1;

  if url is null or key is null then
    raise exception 'run_jobs Vault secrets missing (run pnpm db:setup-local)';
  end if;

  perform net.http_post(
    url := url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || key
    ),
    body := '{}'::jsonb
  );
end;
$$;

revoke all on function public.fn_rights_leave_active() from public, anon;
revoke all on function public.fn_audit_fragment_change() from public, anon;
revoke all on function public.fn_publish_status_enqueue() from public, anon;
revoke all on function public.fn_enqueue_due_publish_at() from public, anon;
revoke all on function public.fn_close_due_crossroads() from public, anon;
revoke all on function public.fn_daily_expiry_and_retention() from public, anon;
revoke all on function public.fn_call_run_jobs() from public, anon;
grant execute on function public.fn_enqueue_due_publish_at() to service_role;
grant execute on function public.fn_close_due_crossroads() to service_role;
grant execute on function public.fn_daily_expiry_and_retention() to service_role;
grant execute on function public.fn_call_run_jobs() to service_role;
