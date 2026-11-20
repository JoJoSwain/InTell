-- M3a: story-wide threads/characters; fragments/revisions/versions v3; guards

-- ---------------------------------------------------------------------------
-- threads: story-wide (drop grove_id); bible → notes
-- ---------------------------------------------------------------------------
alter table public.threads
  drop constraint if exists threads_grove_id_fkey;
alter table public.threads
  drop column if exists grove_id;

alter table public.threads
  rename column bible to notes;

-- ---------------------------------------------------------------------------
-- characters: story-wide; bible→notes; public_bio→public_intro; portrait + status
-- ---------------------------------------------------------------------------
alter table public.characters
  drop constraint if exists characters_grove_id_fkey;
alter table public.characters
  drop column if exists grove_id;

alter table public.characters
  rename column bible to notes;

alter table public.characters
  rename column public_bio to public_intro;

alter table public.characters
  add column if not exists portrait_image_id uuid references public.image_assets(id),
  add column if not exists status public.publish_status not null default 'draft';

-- ---------------------------------------------------------------------------
-- fragments: gap_hint→teaser; radius numeric 4.57–10.67; Indigeny notes
-- ---------------------------------------------------------------------------
alter table public.fragments
  rename column gap_hint to teaser;

-- Widen radius type and replace check/default
alter table public.fragments
  alter column trigger_radius_m type numeric(5, 2)
  using trigger_radius_m::numeric(5, 2);

alter table public.fragments
  drop constraint if exists fragments_trigger_radius_m_check;

-- Clamp existing values into the new range
update public.fragments
   set trigger_radius_m = least(greatest(trigger_radius_m, 4.57), 10.67);

alter table public.fragments
  alter column trigger_radius_m set default 10.67;

alter table public.fragments
  add constraint fragments_trigger_radius_m_check
  check (trigger_radius_m between 4.57 and 10.67);

alter table public.fragments
  add column if not exists indigeny_earth text,
  add column if not exists indigeny_world text,
  add column if not exists indigeny_body text;

-- ---------------------------------------------------------------------------
-- fragment_characters: prominence + card_line
-- ---------------------------------------------------------------------------
alter table public.fragment_characters
  add column if not exists prominence public.character_prominence not null default 'minor',
  add column if not exists card_line jsonb not null default '{}';

-- ---------------------------------------------------------------------------
-- fragment_revisions: change_kind, release_id, change_note text; drop writer_notes
-- ---------------------------------------------------------------------------
alter table public.fragment_revisions
  add column if not exists change_kind public.change_kind,
  add column if not exists release_id uuid;

-- Backfill: every existing revision is a contingency (first revision rule; seed-only data)
update public.fragment_revisions
   set change_kind = 'contingency'
 where change_kind is null;

alter table public.fragment_revisions
  alter column change_kind set not null;

-- change_note jsonb → text (take->>'en')
alter table public.fragment_revisions
  add column if not exists change_note_text text;

update public.fragment_revisions
   set change_note_text = nullif(change_note->>'en', '')
 where change_note is not null;

alter table public.fragment_revisions
  drop column if exists change_note;

alter table public.fragment_revisions
  rename column change_note_text to change_note;

alter table public.fragment_revisions
  drop column if exists writer_notes;

alter table public.fragment_revisions
  drop constraint if exists fragment_revisions_revision_no_check;

alter table public.fragment_revisions
  add constraint fragment_revisions_first_is_contingency
  check (revision_no > 1 or change_kind = 'contingency');

-- ---------------------------------------------------------------------------
-- revision_versions: time_window + unique(revision_id, language, time_window)
-- ---------------------------------------------------------------------------
alter table public.revision_versions
  add column if not exists time_window public.time_window;

update public.revision_versions
   set time_window = 'day'
 where time_window is null;

alter table public.revision_versions
  alter column time_window set not null;

alter table public.revision_versions
  alter column time_window set default 'day'::public.time_window;

alter table public.revision_versions
  drop constraint if exists revision_versions_revision_id_language_key;

alter table public.revision_versions
  add constraint revision_versions_revision_id_language_time_window_key
  unique (revision_id, language, time_window);

-- ---------------------------------------------------------------------------
-- fn_fragment_guard: physical ⇒ marker_code; ST_Covers unchanged
-- ---------------------------------------------------------------------------
create or replace function public.fn_fragment_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  grove_boundary extensions.geography(Polygon, 4326);
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

  if new.visibility = 'physical' and new.marker_code is null then
    raise exception 'physical fragment requires marker_code';
  end if;

  return new;
end;
$$;

revoke all on function public.fn_fragment_guard() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- fn_prereq_guard: no same-grove; story-wide cycle under advisory lock
-- ---------------------------------------------------------------------------
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
  -- One story-wide lock so concurrent edits can't create a cycle together (brief decision 6)
  perform pg_advisory_xact_lock(hashtext('story-prereq'));

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

  if new.requires_fragment_id = owner_frag.id then
    raise exception 'fragment cannot require itself';
  end if;

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
