-- M2a: story layer (DATA_MODEL §4)

create table public.groves (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites(id),
  slug text not null,
  name jsonb not null,
  premise jsonb not null default '{}',
  access_notes jsonb not null default '{}',
  boundary extensions.geography(Polygon,4326) not null,
  narrator_growth_cue_id uuid references public.audio_assets(id),
  status public.publish_status not null default 'draft',
  pack_version int not null default 0,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (site_id, slug)
);
create index groves_boundary_gix on public.groves using gist (boundary);
create trigger groves_set_updated_at
  before update on public.groves
  for each row execute function public.set_updated_at();

create table public.rings (
  id uuid primary key default gen_random_uuid(),
  grove_id uuid not null references public.groves(id) on delete cascade,
  ring_no int not null,
  name jsonb not null,
  theme_note jsonb not null default '{}',
  writer_note_asset_id uuid references public.audio_assets(id),
  status public.ring_status not null default 'planned',
  planting_opens_at timestamptz,
  planting_closes_at timestamptz,
  released_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (grove_id, ring_no)
);
create trigger rings_set_updated_at
  before update on public.rings
  for each row execute function public.set_updated_at();

create table public.threads (
  id uuid primary key default gen_random_uuid(),
  grove_id uuid not null references public.groves(id) on delete cascade,
  title text not null,
  bible text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger threads_set_updated_at
  before update on public.threads
  for each row execute function public.set_updated_at();

create table public.characters (
  id uuid primary key default gen_random_uuid(),
  grove_id uuid not null references public.groves(id) on delete cascade,
  name text not null,
  bible text,
  public_name jsonb not null default '{}',
  public_bio jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger characters_set_updated_at
  before update on public.characters
  for each row execute function public.set_updated_at();

create table public.fragments (
  id uuid primary key default gen_random_uuid(),
  grove_id uuid not null references public.groves(id) on delete cascade,
  tier public.tier not null,
  is_ending boolean not null default false,
  title jsonb not null,
  location extensions.geography(Point,4326) not null,
  visibility public.fragment_visibility not null default 'marked',
  trigger_radius_m int not null check (trigger_radius_m between 10 and 100),
  marker_code text unique,
  story_order numeric not null,
  gap_hint jsonb not null default '{}',
  introduced_in_ring_id uuid references public.rings(id),
  status public.publish_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ending_is_root check (not is_ending or tier = 'root'),
  constraint protected_requires_marker_code check (
    visibility <> 'protected' or marker_code is not null
  )
);
create index fragments_location_gix on public.fragments using gist (location);
create trigger fragments_set_updated_at
  before update on public.fragments
  for each row execute function public.set_updated_at();

-- ADR 0003: boundary + protected only (no parent/tier graph rules)
create or replace function public.fn_fragment_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  grove_boundary extensions.geography(Polygon,4326);
begin
  select g.boundary into grove_boundary
  from public.groves g
  where g.id = new.grove_id;

  if grove_boundary is null then
    raise exception 'fragment grove not found';
  end if;

  if not extensions.ST_Covers(grove_boundary, new.location) then
    raise exception 'fragment location must be inside grove boundary';
  end if;

  return new;
end;
$$;

revoke all on function public.fn_fragment_guard() from public, anon, authenticated;

create trigger fragments_guard
  before insert or update on public.fragments
  for each row execute function public.fn_fragment_guard();

-- Prerequisite groups (AND of ORs)
create table public.fragment_prereq_groups (
  id uuid primary key default gen_random_uuid(),
  fragment_id uuid not null references public.fragments(id) on delete cascade,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger fragment_prereq_groups_set_updated_at
  before update on public.fragment_prereq_groups
  for each row execute function public.set_updated_at();

create table public.fragment_prereq_members (
  group_id uuid not null references public.fragment_prereq_groups(id) on delete cascade,
  requires_fragment_id uuid not null references public.fragments(id) on delete restrict,
  sort_order int not null default 0,
  primary key (group_id, requires_fragment_id)
);

create or replace function public.fn_prereq_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner_frag public.fragments%rowtype;
  req_frag public.fragments%rowtype;
  cycle_hit boolean;
begin
  select f.* into owner_frag
  from public.fragment_prereq_groups g
  join public.fragments f on f.id = g.fragment_id
  where g.id = new.group_id;

  if not found then
    raise exception 'prerequisite group not found';
  end if;

  select * into req_frag from public.fragments where id = new.requires_fragment_id;
  if not found then
    raise exception 'required fragment not found';
  end if;

  if req_frag.grove_id <> owner_frag.grove_id then
    raise exception 'prerequisite must be in the same grove';
  end if;

  if new.requires_fragment_id = owner_frag.id then
    raise exception 'fragment cannot require itself';
  end if;

  -- Cycle: walking requires edges from the new required fragment must not reach the owner
  with recursive walk as (
    select new.requires_fragment_id as frag_id
    union
    select m.requires_fragment_id
    from walk w
    join public.fragment_prereq_groups g on g.fragment_id = w.frag_id
    join public.fragment_prereq_members m on m.group_id = g.id
  )
  select exists (select 1 from walk where frag_id = owner_frag.id) into cycle_hit;

  if coalesce(cycle_hit, false) then
    raise exception 'prerequisite edge would create a cycle';
  end if;

  return new;
end;
$$;

revoke all on function public.fn_prereq_guard() from public, anon, authenticated;

create trigger fragment_prereq_members_guard
  before insert or update on public.fragment_prereq_members
  for each row execute function public.fn_prereq_guard();

create table public.fragment_threads (
  fragment_id uuid references public.fragments(id) on delete cascade,
  thread_id uuid references public.threads(id) on delete cascade,
  primary key (fragment_id, thread_id)
);

create table public.fragment_characters (
  fragment_id uuid references public.fragments(id) on delete cascade,
  character_id uuid references public.characters(id) on delete cascade,
  introduces boolean not null default false,
  primary key (fragment_id, character_id)
);

create table public.fragment_revisions (
  id uuid primary key default gen_random_uuid(),
  fragment_id uuid not null references public.fragments(id) on delete cascade,
  revision_no int not null,
  ring_id uuid references public.rings(id),
  status public.publish_status not null default 'draft',
  publish_at timestamptz,
  requires_outcome_option_id uuid,
  content_note jsonb not null default '{}',
  change_note jsonb not null default '{}',
  writer_notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (fragment_id, revision_no)
);
create trigger fragment_revisions_set_updated_at
  before update on public.fragment_revisions
  for each row execute function public.set_updated_at();

create table public.revision_versions (
  id uuid primary key default gen_random_uuid(),
  revision_id uuid not null references public.fragment_revisions(id) on delete cascade,
  language public.lang not null,
  narration_asset_id uuid not null references public.audio_assets(id),
  transcript text not null,
  vtt text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (revision_id, language)
);
create trigger revision_versions_set_updated_at
  before update on public.revision_versions
  for each row execute function public.set_updated_at();

create table public.revision_contributors (
  revision_id uuid references public.fragment_revisions(id) on delete cascade,
  contributor_id uuid references public.contributors(id) on delete restrict,
  role text not null check (role in ('writer','narrator','storyteller','musician','translator','sound')),
  consent_id uuid not null references public.consents(id),
  primary key (revision_id, contributor_id, role)
);
