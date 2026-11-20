-- M3b: F1 allowlist writer guard, last-admin preserve (A1), audit RLS tighten,
-- staff change audit, fn_is_admin.

-- ---------------------------------------------------------------------------
-- F1 allowlist: only Indigeny + updated_at may differ for non-editor writers
-- ---------------------------------------------------------------------------
create or replace function public.fn_fragments_writer_column_guard()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_new jsonb;
  v_old jsonb;
begin
  if auth.role() = 'service_role'
     or public.has_role(array['editor','admin']::public.staff_role[]) then
    return new;
  end if;

  -- Allowlist: future columns are protected by default.
  v_new := to_jsonb(new) - 'indigeny_earth' - 'indigeny_world' - 'indigeny_body' - 'updated_at';
  v_old := to_jsonb(old) - 'indigeny_earth' - 'indigeny_world' - 'indigeny_body' - 'updated_at';

  if v_new is distinct from v_old then
    raise exception 'writer may only update Indigeny Story Notes on fragments'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke all on function public.fn_fragments_writer_column_guard() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- A1: never leave zero active admins
-- ---------------------------------------------------------------------------
create or replace function public.fn_staff_preserve_last_admin()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  other_admins int;
begin
  if tg_op = 'DELETE' then
    if old.role = 'admin'::public.staff_role and old.active then
      select count(*)::int into other_admins
      from public.staff s
      where s.role = 'admin'::public.staff_role
        and s.active
        and s.user_id is distinct from old.user_id;
      if other_admins = 0 then
        raise exception 'cannot remove the last active admin'
          using errcode = '42501';
      end if;
    end if;
    return old;
  end if;

  -- UPDATE: demote or deactivate an active admin
  if old.role = 'admin'::public.staff_role
     and old.active
     and (
       new.role is distinct from 'admin'::public.staff_role
       or new.active is distinct from true
     )
  then
    select count(*)::int into other_admins
    from public.staff s
    where s.role = 'admin'::public.staff_role
      and s.active
      and s.user_id is distinct from old.user_id;
    if other_admins = 0 then
      raise exception 'cannot remove the last active admin'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.fn_staff_preserve_last_admin() from public, anon, authenticated;

drop trigger if exists staff_preserve_last_admin on public.staff;
create trigger staff_preserve_last_admin
  before update or delete on public.staff
  for each row execute function public.fn_staff_preserve_last_admin();

-- ---------------------------------------------------------------------------
-- Audit staff.role / display_name / active changes (RLS path)
-- ---------------------------------------------------------------------------
create or replace function public.fn_staff_audit_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if new.role is distinct from old.role
       or new.display_name is distinct from old.display_name
       or new.active is distinct from old.active
    then
      insert into public.audit_log (actor, action, entity, entity_id, detail)
      values (
        auth.uid(),
        'staff.update',
        'staff',
        new.user_id,
        jsonb_build_object(
          'before', jsonb_build_object(
            'role', old.role,
            'display_name', old.display_name,
            'active', old.active
          ),
          'after', jsonb_build_object(
            'role', new.role,
            'display_name', new.display_name,
            'active', new.active
          )
        )
      );
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.fn_staff_audit_changes() from public, anon, authenticated;

drop trigger if exists staff_audit_changes on public.staff;
create trigger staff_audit_changes
  after update on public.staff
  for each row execute function public.fn_staff_audit_changes();

-- ---------------------------------------------------------------------------
-- Audit log: editor + admin select only (DATA_MODEL §13 / M3b review §10.2)
-- ---------------------------------------------------------------------------
drop policy if exists audit_log_staff_select on public.audit_log;
create policy audit_log_staff_select on public.audit_log for select to authenticated
  using (public.has_role(array['editor','admin']::public.staff_role[]));

-- ---------------------------------------------------------------------------
-- fn_is_admin for invite-staff edge (parity with fn_is_editor_or_admin)
-- ---------------------------------------------------------------------------
create or replace function public.fn_is_admin()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select public.has_role(array['admin']::public.staff_role[]);
$$;

revoke all on function public.fn_is_admin() from public, anon;
grant execute on function public.fn_is_admin() to authenticated, service_role;
