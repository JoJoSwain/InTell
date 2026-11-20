-- M3a: journal_terms / journal_entries / entry_links; drop seeds*; questions/devices

-- ---------------------------------------------------------------------------
-- Rename seed_terms → journal_terms
-- ---------------------------------------------------------------------------
alter table if exists public.seed_terms rename to journal_terms;

-- ---------------------------------------------------------------------------
-- Drop seeds / seed_links (crossroads already dropped)
-- ---------------------------------------------------------------------------
drop table if exists public.seed_links cascade;
drop table if exists public.seeds cascade;

drop type if exists public.seed_kind;
drop type if exists public.seed_status;

-- ---------------------------------------------------------------------------
-- questions: requires_heard → requires_completed; drop grove_id (v3 has no grove scope)
-- ---------------------------------------------------------------------------
alter table public.questions
  rename column requires_heard to requires_completed;

alter table public.questions
  drop constraint if exists questions_grove_id_fkey;
alter table public.questions
  drop column if exists grove_id;

-- ---------------------------------------------------------------------------
-- devices: drop attestation columns
-- ---------------------------------------------------------------------------
alter table public.devices
  drop column if exists attested_at;
alter table public.devices
  drop column if exists attestation;

-- ---------------------------------------------------------------------------
-- journal_entries + entry_links (§7)
-- ---------------------------------------------------------------------------
create table public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.devices(id) on delete cascade,
  client_entry_id uuid not null,
  grove_id uuid references public.groves(id),
  anchor_fragment_id uuid references public.fragments(id),
  written_on_site boolean not null,
  kind public.entry_kind not null,
  question_id uuid references public.questions(id),
  character_id uuid references public.characters(id),
  body text check (char_length(body) <= 1500),
  voice_path text,
  voice_duration_ms int,
  staff_transcript text,
  terms_version int not null references public.journal_terms(version),
  status public.entry_status not null default 'submitted',
  flags text[] not null default '{}',
  themes text[] not null default '{}',
  submitted_at timestamptz not null,
  status_changed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (device_id, client_entry_id),
  check (body is not null or voice_path is not null)
);

create trigger journal_entries_set_updated_at
  before update on public.journal_entries
  for each row execute function public.set_updated_at();

create table public.entry_links (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.journal_entries(id) on delete cascade,
  revision_id uuid references public.fragment_revisions(id) on delete cascade,
  question_id uuid references public.questions(id),
  note text,
  stage public.entry_status not null default 'sprouting',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (num_nonnulls(revision_id, question_id) = 1)
);

create trigger entry_links_set_updated_at
  before update on public.entry_links
  for each row execute function public.set_updated_at();
