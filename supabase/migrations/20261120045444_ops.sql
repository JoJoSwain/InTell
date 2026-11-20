-- M2a: ops tables (DATA_MODEL §8) + jobs outbox (decision 7)

create table public.staff (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  role public.staff_role not null default 'viewer',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger staff_set_updated_at
  before update on public.staff
  for each row execute function public.set_updated_at();

create table public.audit_log (
  id bigint generated always as identity primary key,
  actor uuid references auth.users(id),
  action text not null,
  entity text not null,
  entity_id uuid,
  detail jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table public.events (
  id bigint generated always as identity primary key,
  device_id uuid not null references public.devices(id) on delete cascade,
  client_event_id uuid not null,
  name text not null,
  occurred_at timestamptz not null,
  grove_id uuid,
  fragment_id uuid,
  revision_id uuid,
  session_id uuid,
  props jsonb not null default '{}',
  received_at timestamptz not null default now(),
  unique (device_id, client_event_id)
);
create index events_grove_occurred_idx on public.events (grove_id, occurred_at);

create table public.pack_builds (
  id bigint generated always as identity primary key,
  scope text not null check (scope in ('grove','region')),
  scope_id uuid not null,
  version int not null,
  manifest_path text not null,
  manifest_sha256 text not null,
  asset_hashes text[] not null,
  bytes_total bigint not null,
  built_at timestamptz not null default now(),
  reason text
);

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('rebuild_pack','purge_asset')),
  payload jsonb not null,
  status text not null default 'queued',
  attempts int not null default 0,
  last_error text,
  run_after timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint jobs_payload_ids_only check (
    -- R3: payload may only carry ids / asset sha strings, never coords or codes
    not (payload::text ~* '(location|marker_code|"lat"|"lng"|markerCode)')
  )
);
create trigger jobs_set_updated_at
  before update on public.jobs
  for each row execute function public.set_updated_at();
create index jobs_queued_idx on public.jobs (status, run_after) where status = 'queued';
