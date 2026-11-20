-- M2a: extensions, enums, updated_at helper, default privilege lockdown (R1)

create extension if not exists postgis with schema extensions;
create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;
create extension if not exists pgcrypto with schema extensions;

-- Revoke default grants so new public objects are not auto-open to anon/authenticated (R1)
alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated, public;
alter default privileges for role postgres in schema public
  revoke all on sequences from anon, authenticated, public;
alter default privileges for role postgres in schema public
  revoke all on functions from anon, authenticated, public;

-- Note (R1): only revoke default privileges for the migration owner (postgres).
-- supabase_admin defaults cannot be altered from migrations on local Supabase (42501).

create type public.staff_role as enum ('admin','editor','writer','sound','moderator','viewer');
create type public.publish_status as enum ('draft','in_review','approved','published','retired','unpublished');
create type public.tier as enum ('root','branch','leaf');
create type public.fragment_visibility as enum ('marked','unmarked','protected');
create type public.lang as enum ('en','es');
create type public.rights_status as enum ('active','revoked','expired');
create type public.approval_status as enum ('pending','active','revoked','expired');
create type public.asset_kind as enum ('narration','sfx_oneshot','sfx_bed','music_stem','voice_cue','writer_note');
create type public.asset_source as enum ('original','commissioned','licensed','public_domain','community_sound');
create type public.license_kind as enum ('owned','work_for_hire','consent_form','cc0','cc_by','commercial','community_sound_grant');
create type public.time_window as enum ('dawn','day','dusk','night');
create type public.ring_status as enum ('planned','planting','writing','released','archived');
create type public.seed_kind as enum ('next','character','noticed','answer','memory','sound');
create type public.seed_status as enum ('planted','read','sprouting','grown','resting','hidden');
create type public.crossroads_status as enum ('draft','open','closed','decided','cancelled');

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.set_updated_at() from public, anon, authenticated;
