-- M3d: fn_check_revision_local shared by publish_check and draft_check

create or replace function public.fn_check_revision_local(p_rev public.fragment_revisions)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  failures jsonb := '[]'::jsonb;
  asset_rec public.audio_assets%rowtype;
begin
  if not exists (select 1 from public.revision_versions v where v.revision_id = p_rev.id) then
    failures := failures || jsonb_build_array(public.fn_check_issue(
      'NO_VERSION', 'error', 'no versions', 'revision', p_rev.id));
  end if;

  if exists (
    select 1 from public.revision_versions v
    where v.revision_id = p_rev.id and coalesce(nullif(trim(v.transcript), ''), '') = ''
  ) or (
    exists (select 1 from public.revision_versions v where v.revision_id = p_rev.id)
    and not exists (
      select 1 from public.revision_versions v
      where v.revision_id = p_rev.id and coalesce(nullif(trim(v.transcript), ''), '') <> ''
    )
  ) then
    failures := failures || jsonb_build_array(public.fn_check_issue(
      'NO_TRANSCRIPT', 'error', 'missing transcript', 'revision', p_rev.id));
  end if;

  for asset_rec in
    select a.* from public.revision_versions v
    join public.audio_assets a on a.id = v.narration_asset_id
    where v.revision_id = p_rev.id
  loop
    failures := failures || public.fn_check_audio_asset(asset_rec);
  end loop;

  return failures;
end;
$$;

revoke all on function public.fn_check_revision_local(public.fragment_revisions)
  from public, anon, authenticated;
grant execute on function public.fn_check_revision_local(public.fragment_revisions)
  to service_role;

-- ---------------------------------------------------------------------------
-- fn_publish_check — revision rules via shared helper
-- ---------------------------------------------------------------------------
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
          'fragment', frag.id));
      end if;

            failures := failures || public.fn_check_revision_local(rev);

      for asset_rec in
        select a.* from public.revision_versions v
        join public.audio_assets a on a.id = v.narration_asset_id
        where v.revision_id = rev.id
      loop
        audio_shas := array_append(audio_shas, asset_rec.sha256);
      end loop;

-- OUTSIDE_GROVE on the revision path (matches pre-M3c behaviour; fragment
      -- items run the full local helper separately).
      select * into grove from public.groves where id = frag.grove_id;
      if found and not extensions.ST_Covers(grove.boundary, frag.location) then
        failures := failures || jsonb_build_array(public.fn_check_issue(
          'OUTSIDE_GROVE', 'error', 'fragment outside grove', 'fragment', frag.id));
      end if;

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
              'PREREQ_UNPUBLISHED', 'error', 'prereq group unpublished', 'fragment', frag.id));
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
          'fragment', frag.id));
      end if;

    elsif item.entity = 'character' then
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
          'character', item.entity_id));
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

-- ---------------------------------------------------------------------------
-- fn_draft_check — fragment local + draft revision/audio rules
-- ---------------------------------------------------------------------------
create or replace function public.fn_draft_check(p_grove_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  failures jsonb := '[]'::jsonb;
  frag public.fragments%rowtype;
  grove public.groves%rowtype;
  rev public.fragment_revisions%rowtype;
  has_start boolean;
  img public.image_assets%rowtype;
begin
  if auth.role() = 'authenticated'
     and not public.has_role(
       array['viewer','moderator','writer','sound','editor','admin']::public.staff_role[]
     ) then
    raise exception 'staff required';
  end if;

  select * into grove from public.groves where id = p_grove_id;
  if not found then
    return jsonb_build_object(
      'ok', false,
      'failures', jsonb_build_array(public.fn_check_issue(
        'DEPENDENCY_UNPUBLISHED', 'error', 'grove not found', 'grove', p_grove_id))
    );
  end if;

  for frag in select * from public.fragments where grove_id = p_grove_id
  loop
    failures := failures || public.fn_check_fragment_local(frag);

    for rev in
      select * from public.fragment_revisions
      where fragment_id = frag.id and status = 'draft'
    loop
      failures := failures || public.fn_check_revision_local(rev);
    end loop;
  end loop;

  select exists (
    select 1 from public.fragments f
    where f.grove_id = p_grove_id
      and not exists (
        select 1 from public.fragment_prereq_groups g where g.fragment_id = f.id
      )
  ) into has_start;
  if not has_start then
    failures := failures || jsonb_build_array(public.fn_check_issue(
      'NO_START', 'warning', 'no fragment open from the start', 'grove', p_grove_id));
  end if;

  for img in
    select distinct i.*
    from public.fragment_characters fc
    join public.fragments f on f.id = fc.fragment_id
    join public.characters c on c.id = fc.character_id
    join public.image_assets i on i.id = c.portrait_image_id
    where f.grove_id = p_grove_id
  loop
    if coalesce(img.alt_text, '{}'::jsonb) = '{}'::jsonb
       or coalesce(nullif(btrim(img.alt_text->>'en'), ''), null) is null then
      failures := failures || jsonb_build_array(public.fn_check_issue(
        'NO_ALT_TEXT', 'error', 'alt text required', 'image', img.id));
    end if;
  end loop;

  return jsonb_build_object(
    'ok', not exists (
      select 1 from jsonb_array_elements(failures) e where e->>'severity' = 'error'
    ),
    'failures', failures
  );
end;
$$;

revoke all on function public.fn_draft_check(uuid) from public, anon;
grant execute on function public.fn_draft_check(uuid) to authenticated, service_role;
