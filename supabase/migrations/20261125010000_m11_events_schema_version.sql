-- M11 / A7: version telemetry rows (G1). Default 1 for existing rows.
alter table public.events
  add column if not exists schema_version smallint not null default 1;

comment on column public.events.schema_version is
  'Telemetry envelope v; ingest drops unknown versions (EVENT_SCHEMA_VERSION).';

-- Keep anon closed; staff select policy already exists (events_staff_select).
revoke all on table public.events from anon, public;
grant select on table public.events to authenticated;
