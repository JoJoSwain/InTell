-- M2a: audio assets and rights (DATA_MODEL §3); seed_id FK added in participation

create table public.contributors (
  id uuid primary key default gen_random_uuid(),
  display_credit text not null,
  legal_name text,
  contact_email text,
  contact_phone text,
  community_affiliation text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger contributors_set_updated_at
  before update on public.contributors
  for each row execute function public.set_updated_at();

create table public.consents (
  id uuid primary key default gen_random_uuid(),
  contributor_id uuid not null references public.contributors(id) on delete cascade,
  status public.rights_status not null default 'active',
  channels text[] not null,
  license_line text,
  signed_on date not null,
  expires_on date,
  document_path text,
  community_permission_notes text,
  revoked_on date,
  revoked_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger consents_set_updated_at
  before update on public.consents
  for each row execute function public.set_updated_at();

create table public.audio_assets (
  id uuid primary key default gen_random_uuid(),
  kind public.asset_kind not null,
  sha256 text unique not null,
  ext text not null check (ext in ('m4a','mp3','wav','caf','ogg')),
  bytes int not null,
  duration_ms int not null,
  channels smallint not null check (channels in (1,2)),
  sample_rate int not null,
  loudness_lufs numeric(5,2),
  loop_start_ms int,
  loop_end_ms int,
  title text not null,
  tags text[] not null default '{}',
  source public.asset_source not null,
  staging_path text not null,
  is_public boolean not null default false,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger audio_assets_set_updated_at
  before update on public.audio_assets
  for each row execute function public.set_updated_at();

create table public.asset_rights (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.audio_assets(id) on delete cascade,
  license public.license_kind not null,
  contributor_id uuid references public.contributors(id),
  consent_id uuid references public.consents(id),
  seed_id uuid,
  attribution text,
  license_doc_path text,
  expires_on date,
  status public.rights_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint asset_rights_consent_form_requires_consent
    check (license <> 'consent_form' or consent_id is not null),
  constraint asset_rights_cc_by_requires_attribution
    check (license <> 'cc_by' or attribution is not null),
  constraint asset_rights_community_sound_requires_seed
    check (license <> 'community_sound_grant' or seed_id is not null)
);
create trigger asset_rights_set_updated_at
  before update on public.asset_rights
  for each row execute function public.set_updated_at();
