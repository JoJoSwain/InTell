-- M3b review nits N1 (last-admin row lock) and N2 (skip service_role audit dupes).

create or replace function public.fn_staff_preserve_last_admin()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  other_admins int;
begin
  -- Serialize demotions/deactivations so concurrent last-admin races can't both pass.
  perform 1
  from public.staff
  where role = 'admin'::public.staff_role
    and active
  for update;

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

create or replace function public.fn_staff_audit_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- N2: invite-staff (service role) writes its own audit row with the real actor.
  if auth.role() = 'service_role' then
    return new;
  end if;

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
