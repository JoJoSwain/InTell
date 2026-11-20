-- M3a: drop rights, rings, crossroads and related columns/functions/views

-- Staff PII views that reference dropped tables
drop view if exists public.contributors_staff;
drop view if exists public.consents_staff;
drop view if exists public.seeds_staff;

-- Rights leave-active triggers (function dropped later or rewritten empty)
drop trigger if exists consents_leave_active on public.consents;
drop trigger if exists asset_rights_leave_active on public.asset_rights;

-- ---------------------------------------------------------------------------
-- Drop rights tables (FKs first)
-- ---------------------------------------------------------------------------
drop table if exists public.revision_contributors cascade;
drop table if exists public.asset_rights cascade;
drop table if exists public.consents cascade;
drop table if exists public.contributors cascade;

-- ---------------------------------------------------------------------------
-- Clear ring / outcome FKs and columns before dropping rings & crossroads
-- ---------------------------------------------------------------------------
alter table public.fragments
  drop constraint if exists fragments_introduced_in_ring_id_fkey;
alter table public.fragments
  drop column if exists introduced_in_ring_id;

alter table public.fragment_revisions
  drop constraint if exists fragment_revisions_ring_id_fkey;
alter table public.fragment_revisions
  drop constraint if exists rev_outcome_fk;
alter table public.fragment_revisions
  drop column if exists ring_id;
alter table public.fragment_revisions
  drop column if exists requires_outcome_option_id;
alter table public.fragment_revisions
  drop column if exists publish_at;
alter table public.fragment_revisions
  drop column if exists content_note;

alter table public.questions
  drop constraint if exists questions_ring_id_fkey;
alter table public.questions
  drop column if exists ring_id;

alter table public.gatherings
  drop constraint if exists gatherings_ring_id_fkey;
alter table public.gatherings
  drop column if exists ring_id;

-- seeds still exist until journal mig; clear ring FK so rings can drop
alter table public.seeds
  drop constraint if exists seeds_ring_id_fkey;
alter table public.seeds
  drop column if exists ring_id;

alter table public.seed_links
  drop constraint if exists seed_links_option_fk;
alter table public.seed_links
  drop column if exists crossroads_option_id;

alter table public.crossroads
  drop constraint if exists crossroads_outcome_fk;

drop table if exists public.crossroads_votes cascade;
drop table if exists public.crossroads_options cascade;
drop table if exists public.crossroads cascade;
drop table if exists public.rings cascade;

-- ---------------------------------------------------------------------------
-- Drop rights/crossroads helpers that break without those tables
-- ---------------------------------------------------------------------------
drop function if exists public.fn_rights_leave_active() cascade;
drop function if exists public.fn_close_due_crossroads() cascade;
drop function if exists public.fn_enqueue_due_publish_at() cascade;
drop function if exists public.fn_asset_is_playable(uuid, text) cascade;
drop function if exists public.fn_site_ok(uuid) cascade;
drop function if exists public.fn_date_unexpired(date, text) cascade;

-- Enums whose last dependents are gone (asset_source drops with audio_assets.source in media mig)
drop type if exists public.rights_status;
drop type if exists public.license_kind;
drop type if exists public.ring_status;
drop type if exists public.crossroads_status;
