-- M3a: releases, release_items, published_snapshots; pack_builds / jobs / staff

-- ---------------------------------------------------------------------------
-- releases + items + snapshots
-- ---------------------------------------------------------------------------
create table public.releases (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  notes text,
  status public.release_status not null default 'draft',
  publish_at timestamptz,
  published_at timestamptz,
  published_by uuid references auth.users(id),
  last_check jsonb,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger releases_set_updated_at
  before update on public.releases
  for each row execute function public.set_updated_at();

create table public.release_items (
  release_id uuid not null references public.releases(id) on delete cascade,
  entity text not null check (entity in (
    'grove', 'fragment', 'revision', 'character', 'image',
    'ambience_profile', 'ambience_zone', 'music_zone', 'music_cue', 'ui_cue'
  )),
  entity_id uuid not null,
  primary key (release_id, entity, entity_id)
);

create table public.published_snapshots (
  entity text not null,
  entity_id uuid not null,
  release_id uuid not null references public.releases(id),
  data jsonb not null,
  published_at timestamptz not null default now(),
  primary key (entity, entity_id)
);

-- fragment_revisions.release_id FK (column added in story mig)
alter table public.fragment_revisions
  drop constraint if exists fragment_revisions_release_id_fkey;

alter table public.fragment_revisions
  add constraint fragment_revisions_release_id_fkey
  foreign key (release_id) references public.releases(id);

-- ---------------------------------------------------------------------------
-- pack_builds: release_id + live (backfill live = true for existing M2 rows)
-- ---------------------------------------------------------------------------
alter table public.pack_builds
  add column if not exists release_id uuid references public.releases(id),
  add column if not exists live boolean not null default false;

update public.pack_builds set live = true where live = false;

-- ---------------------------------------------------------------------------
-- jobs.kind: add publish_release
-- ---------------------------------------------------------------------------
alter table public.jobs
  drop constraint if exists jobs_kind_check;

alter table public.jobs
  add constraint jobs_kind_check
  check (kind in ('publish_release', 'rebuild_pack', 'purge_asset'));

-- ---------------------------------------------------------------------------
-- staff.invited_by (nullable until M3b invites)
-- ---------------------------------------------------------------------------
alter table public.staff
  add column if not exists invited_by uuid references auth.users(id);
