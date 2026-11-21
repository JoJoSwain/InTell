-- M3d D1/D2: published (non-draft) revisions immutable under authenticated;
-- database assigns revision_no on insert.

-- ---------------------------------------------------------------------------
-- D2: assign revision_no under fragment lock
-- ---------------------------------------------------------------------------
create or replace function public.fn_fragment_revision_assign_no()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  next_no int;
begin
  perform 1 from public.fragments where id = new.fragment_id for update;
  select coalesce(max(r.revision_no), 0) + 1
    into next_no
  from public.fragment_revisions r
  where r.fragment_id = new.fragment_id;
  new.revision_no := next_no;
  return new;
end;
$$;

-- SECURITY DEFINER: writers insert revisions but cannot UPDATE fragments for the lock.
-- Granted to authenticated so the BEFORE INSERT trigger can fire (110 allowlist).
revoke all on function public.fn_fragment_revision_assign_no() from public, anon;
grant execute on function public.fn_fragment_revision_assign_no() to authenticated, service_role;

drop trigger if exists trg_fragment_revision_assign_no on public.fragment_revisions;
create trigger trg_fragment_revision_assign_no
  before insert on public.fragment_revisions
  for each row
  execute function public.fn_fragment_revision_assign_no();

-- ---------------------------------------------------------------------------
-- D1: refuse authenticated UPDATE/DELETE of non-draft revisions
-- ---------------------------------------------------------------------------
create or replace function public.fn_fragment_revision_immutable()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if auth.role() = 'authenticated' and old.status is distinct from 'draft' then
    raise exception 'published revisions are immutable'
      using errcode = '42501';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_fragment_revision_immutable on public.fragment_revisions;
create trigger trg_fragment_revision_immutable
  before update or delete on public.fragment_revisions
  for each row
  execute function public.fn_fragment_revision_immutable();

-- INVOKER trigger: authenticated needs EXECUTE for the trigger to fire; never anon.
revoke all on function public.fn_fragment_revision_immutable() from public, anon;
grant execute on function public.fn_fragment_revision_immutable() to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- D1: revision_versions follow parent revision status
-- ---------------------------------------------------------------------------
create or replace function public.fn_revision_version_immutable()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  parent_status public.publish_status;
  rev_id uuid;
begin
  if auth.role() is distinct from 'authenticated' then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  rev_id := case when tg_op = 'DELETE' then old.revision_id else new.revision_id end;
  select r.status into parent_status
  from public.fragment_revisions r
  where r.id = rev_id;

  if parent_status is distinct from 'draft' then
    raise exception 'versions of non-draft revisions are immutable'
      using errcode = '42501';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_revision_version_immutable on public.revision_versions;
create trigger trg_revision_version_immutable
  before insert or update or delete on public.revision_versions
  for each row
  execute function public.fn_revision_version_immutable();

revoke all on function public.fn_revision_version_immutable() from public, anon;
grant execute on function public.fn_revision_version_immutable() to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Scheduled enqueue order: publish_at, then created_at (plan-review §9 #22)
-- ---------------------------------------------------------------------------
create or replace function public.fn_enqueue_due_releases()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  rel record;
begin
  for rel in
    select id from public.releases
    where status = 'scheduled'
      and publish_at is not null
      and publish_at <= now()
    order by publish_at asc, created_at asc
  loop
    update public.releases set status = 'publishing', updated_at = now() where id = rel.id;
    insert into public.jobs (kind, payload)
    values ('publish_release', jsonb_build_object('release_id', rel.id));
  end loop;
end;
$$;

revoke all on function public.fn_enqueue_due_releases() from public, anon, authenticated;
grant execute on function public.fn_enqueue_due_releases() to service_role;
