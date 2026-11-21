-- M3e: journey_mode enum + grove_journeys (ADR 0005 §5 / DATA_MODEL §4)
-- Split RLS so the B1 for-all guard stays green. No `drive` value.

create type public.journey_mode as enum ('walk', 'bike', 'transit');

create table public.grove_journeys (
  grove_id uuid not null references public.groves(id) on delete cascade,
  mode public.journey_mode not null,
  passage jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (grove_id, mode)
);

comment on table public.grove_journeys is
  'Embark journey passages (ADR 0005): optional L10n per grove per mode; staged with grove snapshot.';
comment on column public.grove_journeys.passage is
  'L10n; blank/empty en is omitted from snapshots and packs.';

create trigger grove_journeys_set_updated_at
  before update on public.grove_journeys
  for each row execute function public.set_updated_at();

alter table public.grove_journeys enable row level security;

create policy grove_journeys_staff_select on public.grove_journeys
  for select to authenticated
  using (public.has_role(
    array['viewer','moderator','writer','sound','editor','admin']::public.staff_role[]
  ));

create policy grove_journeys_writer_insert on public.grove_journeys
  for insert to authenticated
  with check (public.has_role(
    array['writer','editor','admin']::public.staff_role[]
  ));

create policy grove_journeys_writer_update on public.grove_journeys
  for update to authenticated
  using (public.has_role(
    array['writer','editor','admin']::public.staff_role[]
  ))
  with check (public.has_role(
    array['writer','editor','admin']::public.staff_role[]
  ));

create policy grove_journeys_writer_delete on public.grove_journeys
  for delete to authenticated
  using (public.has_role(
    array['writer','editor','admin']::public.staff_role[]
  ));

grant select, insert, update, delete on public.grove_journeys to authenticated;
grant all on public.grove_journeys to service_role;
