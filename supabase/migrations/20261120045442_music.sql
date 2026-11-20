-- M2a: soundtrack (DATA_MODEL §6); C6 exact-one zone/grove

create table public.music_zones (
  id uuid primary key default gen_random_uuid(),
  region_id uuid not null references public.regions(id),
  name text not null,
  boundary extensions.geography(Polygon,4326) not null,
  priority int not null default 100,
  edge_fade_m int not null default 60,
  status public.publish_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index music_zones_boundary_gix on public.music_zones using gist (boundary);
create trigger music_zones_set_updated_at
  before update on public.music_zones
  for each row execute function public.set_updated_at();

create table public.music_cues (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  music_zone_id uuid references public.music_zones(id) on delete cascade,
  grove_id uuid references public.groves(id) on delete cascade,
  priority int not null default 100,
  conditions jsonb not null default '{}',
  min_dwell_s int not null default 45,
  crossfade_ms int not null default 6000,
  status public.publish_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (num_nonnulls(music_zone_id, grove_id) = 1)
);
create trigger music_cues_set_updated_at
  before update on public.music_cues
  for each row execute function public.set_updated_at();

create table public.music_cue_stems (
  id uuid primary key default gen_random_uuid(),
  cue_id uuid not null references public.music_cues(id) on delete cascade,
  asset_id uuid not null references public.audio_assets(id),
  role text not null default 'base',
  gain_db numeric(4,1) not null default 0,
  state_gains jsonb not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger music_cue_stems_set_updated_at
  before update on public.music_cue_stems
  for each row execute function public.set_updated_at();
