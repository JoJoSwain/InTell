-- M3a review F1/F2: writer column guards + publish/unpublish service_role only.

-- ---------------------------------------------------------------------------
-- F1: writers may update Story Notes only on fragments (not location/teaser/…)
-- ---------------------------------------------------------------------------
create or replace function public.fn_fragments_writer_column_guard()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  -- Editors, admins and the service role may change any column.
  if auth.role() = 'service_role'
     or public.has_role(array['editor','admin']::public.staff_role[]) then
    return new;
  end if;

  -- Writers (and anyone else who somehow passes RLS): only Indigeny + updated_at.
  -- Allowed for writers: indigeny_earth / indigeny_world / indigeny_body / updated_at.
  if new.grove_id is distinct from old.grove_id
     or new.tier is distinct from old.tier
     or new.is_ending is distinct from old.is_ending
     or new.title is distinct from old.title
     or new.location is distinct from old.location
     or new.visibility is distinct from old.visibility
     or new.trigger_radius_m is distinct from old.trigger_radius_m
     or new.marker_code is distinct from old.marker_code
     or new.story_order is distinct from old.story_order
     or new.teaser is distinct from old.teaser
     or new.status is distinct from old.status
     or new.created_at is distinct from old.created_at
     or new.id is distinct from old.id
  then
    raise exception 'writer may only update Indigeny Story Notes on fragments'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

-- Trigger-only; never callable by clients (same pattern as fn_fragment_guard).
revoke all on function public.fn_fragments_writer_column_guard() from public, anon, authenticated;

-- Name sorts before fragments_guard so column checks win over physical/marker rules.
drop trigger if exists fragments_writer_column_guard on public.fragments;
drop trigger if exists fragments_column_guard on public.fragments;
create trigger fragments_column_guard
  before update on public.fragments
  for each row execute function public.fn_fragments_writer_column_guard();

-- Character status flips only via editor+/service (releases), not writer writes.
create or replace function public.fn_characters_writer_column_guard()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if auth.role() = 'service_role'
     or public.has_role(array['editor','admin']::public.staff_role[]) then
    return new;
  end if;

  if new.status is distinct from old.status then
    raise exception 'writer may not change characters.status'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke all on function public.fn_characters_writer_column_guard() from public, anon, authenticated;

drop trigger if exists characters_writer_column_guard on public.characters;
create trigger characters_writer_column_guard
  before update on public.characters
  for each row execute function public.fn_characters_writer_column_guard();

-- Threads: writers keep notes/title edits; no status column to guard (F1 check).

-- ---------------------------------------------------------------------------
-- F2: publish/unpublish commit only via edge (service_role)
-- ---------------------------------------------------------------------------
revoke all on function public.fn_publish_commit(uuid) from public, anon, authenticated;
revoke all on function public.fn_unpublish_commit(text, uuid[]) from public, anon, authenticated;
grant execute on function public.fn_publish_commit(uuid) to service_role;
grant execute on function public.fn_unpublish_commit(text, uuid[]) to service_role;
