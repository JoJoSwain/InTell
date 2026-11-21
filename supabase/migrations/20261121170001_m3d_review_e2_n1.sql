-- M3d review E2: authenticated callers cannot set revision status/release_id.
-- M3d review N1: trigger functions need no EXECUTE grant to authenticated.

-- ---------------------------------------------------------------------------
-- E2: status / release_id only via service role (publish / unpublish commits)
-- ---------------------------------------------------------------------------
create or replace function public.fn_fragment_revision_release_guard()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if auth.role() is distinct from 'authenticated' then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.status is distinct from 'draft' then
      raise exception 'authenticated inserts must use status = draft'
        using errcode = '42501';
    end if;
    if new.release_id is not null then
      raise exception 'authenticated inserts must leave release_id null'
        using errcode = '42501';
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if new.status is distinct from old.status then
      raise exception 'authenticated cannot change revision status'
        using errcode = '42501';
    end if;
    if new.release_id is distinct from old.release_id then
      raise exception 'authenticated cannot change revision release_id'
        using errcode = '42501';
    end if;
    return new;
  end if;

  return old;
end;
$$;

drop trigger if exists trg_fragment_revision_release_guard on public.fragment_revisions;
create trigger trg_fragment_revision_release_guard
  before insert or update on public.fragment_revisions
  for each row
  execute function public.fn_fragment_revision_release_guard();

revoke all on function public.fn_fragment_revision_release_guard()
  from public, anon, authenticated;
grant execute on function public.fn_fragment_revision_release_guard() to service_role;

-- ---------------------------------------------------------------------------
-- N1: revoke unnecessary EXECUTE on trigger functions from authenticated
-- ---------------------------------------------------------------------------
revoke all on function public.fn_fragment_revision_assign_no()
  from public, anon, authenticated;
grant execute on function public.fn_fragment_revision_assign_no() to service_role;

revoke all on function public.fn_fragment_revision_immutable()
  from public, anon, authenticated;
grant execute on function public.fn_fragment_revision_immutable() to service_role;

revoke all on function public.fn_revision_version_immutable()
  from public, anon, authenticated;
grant execute on function public.fn_revision_version_immutable() to service_role;

comment on function public.fn_fragment_revision_assign_no() is
  'BEFORE INSERT trigger: assigns revision_no under fragment lock. No EXECUTE grant needed for the triggering role.';

comment on function public.fn_fragment_revision_immutable() is
  'BEFORE UPDATE/DELETE trigger: non-draft revisions immutable for authenticated.';

comment on function public.fn_revision_version_immutable() is
  'BEFORE INSERT/UPDATE/DELETE trigger: versions follow parent revision draft status.';
