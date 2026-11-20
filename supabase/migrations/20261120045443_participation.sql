-- M2a: participation (DATA_MODEL §7) + deferred FKs

create table public.seed_terms (
  version int primary key,
  body jsonb not null,
  effective_at timestamptz not null
);

create table public.questions (
  id uuid primary key default gen_random_uuid(),
  grove_id uuid not null references public.groves(id) on delete cascade,
  ring_id uuid references public.rings(id),
  text jsonb not null,
  anchor_fragment_id uuid references public.fragments(id),
  anchor_character_id uuid references public.characters(id),
  requires_heard boolean not null default true,
  opens_at timestamptz not null,
  closes_at timestamptz,
  status public.publish_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger questions_set_updated_at
  before update on public.questions
  for each row execute function public.set_updated_at();

create table public.devices (
  id uuid primary key,
  first_seen_at timestamptz not null default now(),
  platform text,
  app_version text,
  ui_language public.lang,
  attested_at timestamptz,
  attestation text check (attestation in ('app_attest','play_integrity')),
  age_gate text check (age_gate in ('under_13','13_17','18_plus','adult_for_family'))
);

create table public.seeds (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.devices(id) on delete cascade,
  client_seed_id uuid not null,
  grove_id uuid not null references public.groves(id),
  ring_id uuid references public.rings(id),
  anchor_fragment_id uuid references public.fragments(id),
  planted_on_site boolean not null,
  kind public.seed_kind not null,
  question_id uuid references public.questions(id),
  character_id uuid references public.characters(id),
  body text check (char_length(body) <= 1500),
  voice_path text,
  voice_duration_ms int,
  staff_transcript text,
  credit_name text check (char_length(credit_name) <= 60),
  credit_status text not null default 'pending' check (credit_status in ('pending','approved','rejected')),
  may_quote boolean not null default false,
  may_use_voice boolean not null default false,
  sound_grant boolean not null default false,
  -- TODO(M9): encrypt via Vault
  memory_contact text,
  terms_version int not null references public.seed_terms(version),
  status public.seed_status not null default 'planted',
  flags text[] not null default '{}',
  themes text[] not null default '{}',
  planted_at timestamptz not null,
  body_added_at timestamptz,
  status_changed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (device_id, client_seed_id),
  check (body is not null or voice_path is not null)
);
create trigger seeds_set_updated_at
  before update on public.seeds
  for each row execute function public.set_updated_at();

alter table public.asset_rights
  add constraint asset_rights_seed_fk
  foreign key (seed_id) references public.seeds(id);

create table public.seed_links (
  id uuid primary key default gen_random_uuid(),
  seed_id uuid not null references public.seeds(id) on delete cascade,
  revision_id uuid references public.fragment_revisions(id) on delete cascade,
  asset_id uuid references public.audio_assets(id) on delete cascade,
  crossroads_option_id uuid,
  question_id uuid references public.questions(id),
  note text,
  stage public.seed_status not null default 'sprouting',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (num_nonnulls(revision_id, asset_id, crossroads_option_id, question_id) = 1)
);
create trigger seed_links_set_updated_at
  before update on public.seed_links
  for each row execute function public.set_updated_at();

create table public.crossroads (
  id uuid primary key default gen_random_uuid(),
  grove_id uuid not null references public.groves(id) on delete cascade,
  ring_id uuid not null references public.rings(id),
  anchor_fragment_id uuid not null references public.fragments(id),
  prompt jsonb not null,
  teaser_asset_id uuid references public.audio_assets(id),
  vote_radius_m int not null default 75,
  opens_at timestamptz not null,
  closes_at timestamptz not null,
  status public.crossroads_status not null default 'draft',
  outcome_option_id uuid,
  outcome_note jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger crossroads_set_updated_at
  before update on public.crossroads
  for each row execute function public.set_updated_at();

create table public.crossroads_options (
  id uuid primary key default gen_random_uuid(),
  crossroads_id uuid not null references public.crossroads(id) on delete cascade,
  label jsonb not null,
  description jsonb not null default '{}',
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger crossroads_options_set_updated_at
  before update on public.crossroads_options
  for each row execute function public.set_updated_at();

alter table public.crossroads
  add constraint crossroads_outcome_fk
  foreign key (outcome_option_id) references public.crossroads_options(id);

alter table public.seed_links
  add constraint seed_links_option_fk
  foreign key (crossroads_option_id) references public.crossroads_options(id);

alter table public.fragment_revisions
  add constraint rev_outcome_fk
  foreign key (requires_outcome_option_id) references public.crossroads_options(id);

create table public.crossroads_votes (
  crossroads_id uuid references public.crossroads(id) on delete cascade,
  device_id uuid references public.devices(id) on delete cascade,
  option_id uuid not null references public.crossroads_options(id),
  voted_at timestamptz not null default now(),
  primary key (crossroads_id, device_id)
);

create table public.gatherings (
  id uuid primary key default gen_random_uuid(),
  grove_id uuid references public.groves(id),
  ring_id uuid references public.rings(id),
  title jsonb not null,
  starts_at timestamptz not null,
  url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger gatherings_set_updated_at
  before update on public.gatherings
  for each row execute function public.set_updated_at();

create table public.checkins (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.devices(id) on delete cascade,
  client_checkin_id uuid not null,
  session_id uuid not null,
  grove_id uuid not null references public.groves(id),
  place_before smallint check (place_before between 1 and 5),
  place_now smallint check (place_now between 1 and 5),
  people_before smallint check (people_before between 1 and 5),
  people_now smallint check (people_now between 1 and 5),
  first_visit boolean,
  submitted_at timestamptz not null,
  unique (device_id, client_checkin_id)
);
