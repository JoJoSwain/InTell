-- M2a: places (DATA_MODEL §2) + regions.pack_version (B1)

create table public.regions (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  timezone text not null default 'America/Denver',
  bounds extensions.geography(Polygon,4326),
  pack_version int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger regions_set_updated_at
  before update on public.regions
  for each row execute function public.set_updated_at();

create table public.sites (
  id uuid primary key default gen_random_uuid(),
  region_id uuid not null references public.regions(id),
  slug text unique not null,
  name text not null,
  access_info jsonb not null default '{}',
  website_url text,
  gatherings_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger sites_set_updated_at
  before update on public.sites
  for each row execute function public.set_updated_at();

create table public.site_approvals (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites(id) on delete cascade,
  status public.approval_status not null default 'pending',
  approved_by text,
  scope text,
  allows_speaker_wildlife_sounds boolean not null default false,
  starts_on date,
  expires_on date,
  document_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger site_approvals_set_updated_at
  before update on public.site_approvals
  for each row execute function public.set_updated_at();
