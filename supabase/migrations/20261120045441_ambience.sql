-- M2a: surroundings / ambience (DATA_MODEL §5) + ui_cues (B2)

create table public.ambience_profiles (
  id uuid primary key default gen_random_uuid(),
  region_id uuid references public.regions(id),
  slug text unique not null,
  name text not null,
  description text,
  density numeric(3,2) not null default 1.0 check (density between 0.1 and 3.0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger ambience_profiles_set_updated_at
  before update on public.ambience_profiles
  for each row execute function public.set_updated_at();

create table public.ambience_layers (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.ambience_profiles(id) on delete cascade,
  name text not null,
  kind text not null check (kind in ('bed','oneshot')),
  gain_db_min numeric(4,1) not null default -18,
  gain_db_max numeric(4,1) not null default -10,
  pan_min numeric(3,2) not null default -0.8,
  pan_max numeric(3,2) not null default 0.8,
  pitch_cents_min int not null default -100,
  pitch_cents_max int not null default 100,
  mean_interval_s int,
  min_interval_s int,
  max_concurrent smallint not null default 2,
  no_repeat_last smallint not null default 2,
  crossfade_ms int not null default 4000,
  time_windows public.time_window[] not null default '{dawn,day,dusk,night}',
  months smallint[] not null default '{1,2,3,4,5,6,7,8,9,10,11,12}',
  speaker_safe boolean not null default true,
  wildlife_call boolean not null default false,
  nesting_mute_months smallint[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((kind = 'oneshot') = (mean_interval_s is not null))
);
create trigger ambience_layers_set_updated_at
  before update on public.ambience_layers
  for each row execute function public.set_updated_at();

create table public.ambience_layer_assets (
  layer_id uuid references public.ambience_layers(id) on delete cascade,
  asset_id uuid references public.audio_assets(id) on delete restrict,
  weight numeric(4,2) not null default 1.0,
  primary key (layer_id, asset_id)
);

create table public.ambience_zones (
  id uuid primary key default gen_random_uuid(),
  region_id uuid not null references public.regions(id),
  name text not null,
  boundary extensions.geography(Polygon,4326) not null,
  profile_id uuid not null references public.ambience_profiles(id),
  priority int not null default 100,
  edge_fade_m int not null default 40,
  status public.publish_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index ambience_zones_boundary_gix on public.ambience_zones using gist (boundary);
create trigger ambience_zones_set_updated_at
  before update on public.ambience_zones
  for each row execute function public.set_updated_at();

create table public.landcover_classes (
  code smallint primary key,
  name text not null,
  profile_id uuid references public.ambience_profiles(id)
);

create table public.landcover_grids (
  region_id uuid primary key references public.regions(id),
  h3_resolution smallint not null default 9,
  source text not null,
  file_path text not null,
  version int not null,
  generated_at timestamptz not null
);

-- B2: ui cues (new keys require a migration that extends the check)
create table public.ui_cues (
  id uuid primary key default gen_random_uuid(),
  region_id uuid references public.regions(id),
  key text not null check (key in ('hush_listen')),
  language public.lang not null,
  asset_id uuid not null references public.audio_assets(id),
  status public.publish_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique nulls not distinct (region_id, key, language)
);
create trigger ui_cues_set_updated_at
  before update on public.ui_cues
  for each row execute function public.set_updated_at();
