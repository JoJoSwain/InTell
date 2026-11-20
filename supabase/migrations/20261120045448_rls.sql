-- M2a: RLS, has_role, staff views for PII/protected cols (C12/C13). R1 revoke anon.

create or replace function public.has_role(roles public.staff_role[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.staff s
    where s.user_id = auth.uid()
      and s.active = true
      and s.role = any (roles)
  );
$$;

revoke all on function public.has_role(public.staff_role[]) from public, anon;
grant execute on function public.has_role(public.staff_role[]) to authenticated, service_role;

-- R1: revoke all table/function privileges from anon (and public)
revoke all on all tables in schema public from anon, public;
revoke all on all sequences in schema public from anon, public;
revoke execute on all functions in schema public from anon, public;

-- Enable RLS on every table
do $$
declare
  t text;
begin
  for t in
    select tablename from pg_tables where schemaname = 'public'
  loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- Helper: staff reader roles
-- Policy pattern: service_role bypasses via supabase; we still add policies for authenticated.

-- staff table: admin only manage; self can read own row
create policy staff_select_admin on public.staff for select to authenticated
  using (public.has_role(array['admin']::public.staff_role[]) or user_id = auth.uid());
create policy staff_write_admin on public.staff for all to authenticated
  using (public.has_role(array['admin']::public.staff_role[]))
  with check (public.has_role(array['admin']::public.staff_role[]));

-- Generic content tables: all active staff can select (except PII/protected base tables)
create policy regions_staff_select on public.regions for select to authenticated
  using (public.has_role(array['viewer','moderator','writer','sound','editor','admin']::public.staff_role[]));
create policy regions_editor_write on public.regions for all to authenticated
  using (public.has_role(array['editor','admin']::public.staff_role[]))
  with check (public.has_role(array['editor','admin']::public.staff_role[]));

create policy sites_staff_select on public.sites for select to authenticated
  using (public.has_role(array['viewer','moderator','writer','sound','editor','admin']::public.staff_role[]));
create policy sites_editor_write on public.sites for all to authenticated
  using (public.has_role(array['editor','admin']::public.staff_role[]))
  with check (public.has_role(array['editor','admin']::public.staff_role[]));

create policy site_approvals_staff_select on public.site_approvals for select to authenticated
  using (public.has_role(array['viewer','moderator','writer','sound','editor','admin']::public.staff_role[]));
create policy site_approvals_editor_write on public.site_approvals for all to authenticated
  using (public.has_role(array['editor','admin']::public.staff_role[]))
  with check (public.has_role(array['editor','admin']::public.staff_role[]));

-- C13: contributors / consents / seeds / fragments — SELECT only editor+admin on base tables
create policy contributors_editor_select on public.contributors for select to authenticated
  using (public.has_role(array['editor','admin']::public.staff_role[]));
create policy contributors_editor_write on public.contributors for all to authenticated
  using (public.has_role(array['editor','admin']::public.staff_role[]))
  with check (public.has_role(array['editor','admin']::public.staff_role[]));

create policy consents_editor_select on public.consents for select to authenticated
  using (public.has_role(array['editor','admin']::public.staff_role[]));
create policy consents_editor_write on public.consents for all to authenticated
  using (public.has_role(array['editor','admin']::public.staff_role[]))
  with check (public.has_role(array['editor','admin']::public.staff_role[]));

create policy seeds_editor_select on public.seeds for select to authenticated
  using (public.has_role(array['editor','admin']::public.staff_role[]));
create policy seeds_mod_write on public.seeds for update to authenticated
  using (public.has_role(array['moderator','writer','editor','admin']::public.staff_role[]))
  with check (public.has_role(array['moderator','writer','editor','admin']::public.staff_role[]));
create policy seeds_editor_insert on public.seeds for insert to authenticated
  with check (public.has_role(array['editor','admin']::public.staff_role[]));
create policy seeds_editor_delete on public.seeds for delete to authenticated
  using (public.has_role(array['editor','admin']::public.staff_role[]));

create policy fragments_editor_select on public.fragments for select to authenticated
  using (public.has_role(array['editor','admin']::public.staff_role[]));
create policy fragments_editor_write on public.fragments for all to authenticated
  using (public.has_role(array['editor','admin']::public.staff_role[]))
  with check (public.has_role(array['editor','admin']::public.staff_role[]));

-- Staff-facing views (C13). Intentional security_barrier views — Supabase linter may flag; keep.
create or replace view public.contributors_staff
with (security_barrier = true) as
select
  id,
  display_credit,
  case when public.has_role(array['editor','admin']::public.staff_role[]) then legal_name else null end as legal_name,
  case when public.has_role(array['editor','admin']::public.staff_role[]) then contact_email else null end as contact_email,
  case when public.has_role(array['editor','admin']::public.staff_role[]) then contact_phone else null end as contact_phone,
  community_affiliation,
  notes,
  created_at,
  updated_at
from public.contributors
where public.has_role(array['viewer','moderator','writer','sound','editor','admin']::public.staff_role[]);

create or replace view public.consents_staff
with (security_barrier = true) as
select
  id,
  contributor_id,
  status,
  channels,
  license_line,
  signed_on,
  expires_on,
  case when public.has_role(array['editor','admin']::public.staff_role[]) then document_path else null end as document_path,
  community_permission_notes,
  revoked_on,
  revoked_reason,
  created_at,
  updated_at
from public.consents
where public.has_role(array['viewer','moderator','writer','sound','editor','admin']::public.staff_role[]);

create or replace view public.seeds_staff
with (security_barrier = true) as
select
  id, device_id, client_seed_id, grove_id, ring_id, anchor_fragment_id, planted_on_site,
  kind, question_id, character_id, body, voice_path, voice_duration_ms, staff_transcript,
  credit_name, credit_status, may_quote, may_use_voice, sound_grant,
  case when public.has_role(array['editor','admin']::public.staff_role[]) then memory_contact else null end as memory_contact,
  terms_version, status, flags, themes, planted_at, body_added_at, status_changed_at,
  created_at, updated_at
from public.seeds
where public.has_role(array['viewer','moderator','writer','sound','editor','admin']::public.staff_role[]);

create or replace view public.fragments_staff
with (security_barrier = true) as
select
  id, grove_id, tier, is_ending, title,
  case
    when visibility <> 'protected' then location
    when public.has_role(array['editor','admin']::public.staff_role[]) then location
    else null
  end as location,
  visibility,
  trigger_radius_m,
  case
    when visibility <> 'protected' then marker_code
    when public.has_role(array['editor','admin']::public.staff_role[]) then marker_code
    else null
  end as marker_code,
  story_order, gap_hint, introduced_in_ring_id, status, created_at, updated_at
from public.fragments
where public.has_role(array['viewer','moderator','writer','sound','editor','admin']::public.staff_role[]);

revoke all on public.contributors_staff from anon, public;
revoke all on public.consents_staff from anon, public;
revoke all on public.seeds_staff from anon, public;
revoke all on public.fragments_staff from anon, public;
grant select on public.contributors_staff to authenticated;
grant select on public.consents_staff to authenticated;
grant select on public.seeds_staff to authenticated;
grant select on public.fragments_staff to authenticated;

-- audio assets: sound + editor + admin write; all staff read
create policy audio_assets_staff_select on public.audio_assets for select to authenticated
  using (public.has_role(array['viewer','moderator','writer','sound','editor','admin']::public.staff_role[]));
create policy audio_assets_sound_write on public.audio_assets for all to authenticated
  using (public.has_role(array['sound','editor','admin']::public.staff_role[]))
  with check (public.has_role(array['sound','editor','admin']::public.staff_role[]));

create policy asset_rights_staff_select on public.asset_rights for select to authenticated
  using (public.has_role(array['viewer','moderator','writer','sound','editor','admin']::public.staff_role[]));
create policy asset_rights_editor_write on public.asset_rights for all to authenticated
  using (public.has_role(array['editor','admin']::public.staff_role[]))
  with check (public.has_role(array['editor','admin']::public.staff_role[]));

-- Story content
create policy groves_staff_select on public.groves for select to authenticated
  using (public.has_role(array['viewer','moderator','writer','sound','editor','admin']::public.staff_role[]));
create policy groves_editor_write on public.groves for all to authenticated
  using (public.has_role(array['editor','admin']::public.staff_role[]))
  with check (public.has_role(array['editor','admin']::public.staff_role[]));

create policy rings_staff_select on public.rings for select to authenticated
  using (public.has_role(array['viewer','moderator','writer','sound','editor','admin']::public.staff_role[]));
create policy rings_editor_write on public.rings for all to authenticated
  using (public.has_role(array['editor','admin']::public.staff_role[]))
  with check (public.has_role(array['editor','admin']::public.staff_role[]));

create policy threads_staff_select on public.threads for select to authenticated
  using (public.has_role(array['viewer','moderator','writer','sound','editor','admin']::public.staff_role[]));
create policy threads_writer_write on public.threads for all to authenticated
  using (public.has_role(array['writer','editor','admin']::public.staff_role[]))
  with check (public.has_role(array['writer','editor','admin']::public.staff_role[]));

create policy characters_staff_select on public.characters for select to authenticated
  using (public.has_role(array['viewer','moderator','writer','sound','editor','admin']::public.staff_role[]));
create policy characters_writer_write on public.characters for all to authenticated
  using (public.has_role(array['writer','editor','admin']::public.staff_role[]))
  with check (public.has_role(array['writer','editor','admin']::public.staff_role[]));

create policy fragment_revisions_staff_select on public.fragment_revisions for select to authenticated
  using (public.has_role(array['viewer','moderator','writer','sound','editor','admin']::public.staff_role[]));
create policy fragment_revisions_writer_write on public.fragment_revisions for insert to authenticated
  with check (public.has_role(array['writer','editor','admin']::public.staff_role[]));
create policy fragment_revisions_writer_update on public.fragment_revisions for update to authenticated
  using (
    public.has_role(array['editor','admin']::public.staff_role[])
    or (
      public.has_role(array['writer']::public.staff_role[])
      and status in ('draft','in_review')
    )
  )
  with check (
    public.has_role(array['editor','admin']::public.staff_role[])
    or (
      public.has_role(array['writer']::public.staff_role[])
      and status in ('draft','in_review')
    )
  );
-- writer cannot publish
create policy fragment_revisions_editor_delete on public.fragment_revisions for delete to authenticated
  using (public.has_role(array['editor','admin']::public.staff_role[]));

create policy revision_versions_staff_select on public.revision_versions for select to authenticated
  using (public.has_role(array['viewer','moderator','writer','sound','editor','admin']::public.staff_role[]));
create policy revision_versions_writer_write on public.revision_versions for all to authenticated
  using (public.has_role(array['writer','editor','admin']::public.staff_role[]))
  with check (public.has_role(array['writer','editor','admin']::public.staff_role[]));

create policy revision_contributors_staff_select on public.revision_contributors for select to authenticated
  using (public.has_role(array['viewer','moderator','writer','sound','editor','admin']::public.staff_role[]));
create policy revision_contributors_writer_write on public.revision_contributors for all to authenticated
  using (public.has_role(array['writer','editor','admin']::public.staff_role[]))
  with check (public.has_role(array['writer','editor','admin']::public.staff_role[]));

create policy fragment_threads_staff on public.fragment_threads for all to authenticated
  using (public.has_role(array['viewer','moderator','writer','sound','editor','admin']::public.staff_role[]))
  with check (public.has_role(array['writer','editor','admin']::public.staff_role[]));
create policy fragment_characters_staff on public.fragment_characters for all to authenticated
  using (public.has_role(array['viewer','moderator','writer','sound','editor','admin']::public.staff_role[]))
  with check (public.has_role(array['writer','editor','admin']::public.staff_role[]));

-- ADR 0003: prereq structure is editor/admin write; all staff read (ids only — no protected coords)
create policy fragment_prereq_groups_staff_select on public.fragment_prereq_groups for select to authenticated
  using (public.has_role(array['viewer','moderator','writer','sound','editor','admin']::public.staff_role[]));
create policy fragment_prereq_groups_editor_write on public.fragment_prereq_groups for all to authenticated
  using (public.has_role(array['editor','admin']::public.staff_role[]))
  with check (public.has_role(array['editor','admin']::public.staff_role[]));

create policy fragment_prereq_members_staff_select on public.fragment_prereq_members for select to authenticated
  using (public.has_role(array['viewer','moderator','writer','sound','editor','admin']::public.staff_role[]));
create policy fragment_prereq_members_editor_write on public.fragment_prereq_members for all to authenticated
  using (public.has_role(array['editor','admin']::public.staff_role[]))
  with check (public.has_role(array['editor','admin']::public.staff_role[]));

-- Ambience / music: sound write
create policy ambience_profiles_staff_select on public.ambience_profiles for select to authenticated
  using (public.has_role(array['viewer','moderator','writer','sound','editor','admin']::public.staff_role[]));
create policy ambience_profiles_sound_write on public.ambience_profiles for all to authenticated
  using (public.has_role(array['sound','editor','admin']::public.staff_role[]))
  with check (public.has_role(array['sound','editor','admin']::public.staff_role[]));

create policy ambience_layers_staff_select on public.ambience_layers for select to authenticated
  using (public.has_role(array['viewer','moderator','writer','sound','editor','admin']::public.staff_role[]));
create policy ambience_layers_sound_write on public.ambience_layers for all to authenticated
  using (public.has_role(array['sound','editor','admin']::public.staff_role[]))
  with check (public.has_role(array['sound','editor','admin']::public.staff_role[]));

create policy ambience_layer_assets_staff_select on public.ambience_layer_assets for select to authenticated
  using (public.has_role(array['viewer','moderator','writer','sound','editor','admin']::public.staff_role[]));
create policy ambience_layer_assets_sound_write on public.ambience_layer_assets for all to authenticated
  using (public.has_role(array['sound','editor','admin']::public.staff_role[]))
  with check (public.has_role(array['sound','editor','admin']::public.staff_role[]));

create policy ambience_zones_staff_select on public.ambience_zones for select to authenticated
  using (public.has_role(array['viewer','moderator','writer','sound','editor','admin']::public.staff_role[]));
create policy ambience_zones_sound_write on public.ambience_zones for all to authenticated
  using (public.has_role(array['sound','editor','admin']::public.staff_role[]))
  with check (public.has_role(array['sound','editor','admin']::public.staff_role[]));

create policy landcover_classes_staff on public.landcover_classes for all to authenticated
  using (public.has_role(array['viewer','moderator','writer','sound','editor','admin']::public.staff_role[]))
  with check (public.has_role(array['sound','editor','admin']::public.staff_role[]));
create policy landcover_grids_staff on public.landcover_grids for all to authenticated
  using (public.has_role(array['viewer','moderator','writer','sound','editor','admin']::public.staff_role[]))
  with check (public.has_role(array['sound','editor','admin']::public.staff_role[]));

create policy ui_cues_staff_select on public.ui_cues for select to authenticated
  using (public.has_role(array['viewer','moderator','writer','sound','editor','admin']::public.staff_role[]));
create policy ui_cues_sound_write on public.ui_cues for all to authenticated
  using (public.has_role(array['sound','editor','admin']::public.staff_role[]))
  with check (public.has_role(array['sound','editor','admin']::public.staff_role[]));

create policy music_zones_staff_select on public.music_zones for select to authenticated
  using (public.has_role(array['viewer','moderator','writer','sound','editor','admin']::public.staff_role[]));
create policy music_zones_sound_write on public.music_zones for all to authenticated
  using (public.has_role(array['sound','editor','admin']::public.staff_role[]))
  with check (public.has_role(array['sound','editor','admin']::public.staff_role[]));

create policy music_cues_staff_select on public.music_cues for select to authenticated
  using (public.has_role(array['viewer','moderator','writer','sound','editor','admin']::public.staff_role[]));
create policy music_cues_sound_write on public.music_cues for all to authenticated
  using (public.has_role(array['sound','editor','admin']::public.staff_role[]))
  with check (public.has_role(array['sound','editor','admin']::public.staff_role[]));

create policy music_cue_stems_staff_select on public.music_cue_stems for select to authenticated
  using (public.has_role(array['viewer','moderator','writer','sound','editor','admin']::public.staff_role[]));
create policy music_cue_stems_sound_write on public.music_cue_stems for all to authenticated
  using (public.has_role(array['sound','editor','admin']::public.staff_role[]))
  with check (public.has_role(array['sound','editor','admin']::public.staff_role[]));

-- Participation extras
create policy seed_terms_staff on public.seed_terms for all to authenticated
  using (public.has_role(array['viewer','moderator','writer','sound','editor','admin']::public.staff_role[]))
  with check (public.has_role(array['editor','admin']::public.staff_role[]));

create policy questions_staff_select on public.questions for select to authenticated
  using (public.has_role(array['viewer','moderator','writer','sound','editor','admin']::public.staff_role[]));
create policy questions_writer_write on public.questions for all to authenticated
  using (public.has_role(array['writer','editor','admin']::public.staff_role[]))
  with check (public.has_role(array['writer','editor','admin']::public.staff_role[]));

create policy devices_staff_select on public.devices for select to authenticated
  using (public.has_role(array['viewer','moderator','writer','sound','editor','admin']::public.staff_role[]));
create policy devices_admin_write on public.devices for all to authenticated
  using (public.has_role(array['admin']::public.staff_role[]))
  with check (public.has_role(array['admin']::public.staff_role[]));

create policy seed_links_staff_select on public.seed_links for select to authenticated
  using (public.has_role(array['viewer','moderator','writer','sound','editor','admin']::public.staff_role[]));
create policy seed_links_writer_write on public.seed_links for all to authenticated
  using (public.has_role(array['writer','editor','admin']::public.staff_role[]))
  with check (public.has_role(array['writer','editor','admin']::public.staff_role[]));
-- writer cannot set grown: enforce via check on stage
create policy seed_links_grown_editor on public.seed_links for update to authenticated
  using (true)
  with check (
    stage <> 'grown'
    or public.has_role(array['editor','admin']::public.staff_role[])
  );

create policy crossroads_staff_select on public.crossroads for select to authenticated
  using (public.has_role(array['viewer','moderator','writer','sound','editor','admin']::public.staff_role[]));
create policy crossroads_editor_write on public.crossroads for all to authenticated
  using (public.has_role(array['editor','admin']::public.staff_role[]))
  with check (public.has_role(array['editor','admin']::public.staff_role[]));
create policy crossroads_mod_decide on public.crossroads for update to authenticated
  using (public.has_role(array['moderator','editor','admin']::public.staff_role[]))
  with check (public.has_role(array['moderator','editor','admin']::public.staff_role[]));

create policy crossroads_options_staff on public.crossroads_options for all to authenticated
  using (public.has_role(array['viewer','moderator','writer','sound','editor','admin']::public.staff_role[]))
  with check (public.has_role(array['editor','admin']::public.staff_role[]));

create policy crossroads_votes_staff_select on public.crossroads_votes for select to authenticated
  using (public.has_role(array['viewer','moderator','writer','sound','editor','admin']::public.staff_role[]));

create policy gatherings_staff on public.gatherings for all to authenticated
  using (public.has_role(array['viewer','moderator','writer','sound','editor','admin']::public.staff_role[]))
  with check (public.has_role(array['editor','admin']::public.staff_role[]));

create policy checkins_staff_select on public.checkins for select to authenticated
  using (public.has_role(array['viewer','moderator','writer','sound','editor','admin']::public.staff_role[]));

create policy audit_log_staff_select on public.audit_log for select to authenticated
  using (public.has_role(array['viewer','moderator','writer','sound','editor','admin']::public.staff_role[]));
create policy audit_log_admin_export on public.audit_log for all to authenticated
  using (public.has_role(array['admin']::public.staff_role[]))
  with check (public.has_role(array['admin']::public.staff_role[]));

create policy events_staff_select on public.events for select to authenticated
  using (public.has_role(array['viewer','moderator','writer','sound','editor','admin']::public.staff_role[]));

create policy pack_builds_staff_select on public.pack_builds for select to authenticated
  using (public.has_role(array['viewer','moderator','writer','sound','editor','admin']::public.staff_role[]));

create policy jobs_staff_select on public.jobs for select to authenticated
  using (public.has_role(array['editor','admin']::public.staff_role[]));

-- Grant authenticated table privileges needed by policies (R1: explicit grants)
grant select on all tables in schema public to authenticated;
grant insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- Ensure anon still has nothing
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke execute on all functions in schema public from anon, public;
