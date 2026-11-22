-- A1: reusable per-device rate limit, and the register-device write.
--
-- Rate limit: one fixed window per (device_id, endpoint). fn_device_rate_allow
-- increments the current window and returns whether this call is still inside
-- p_limit. register-device uses 30 calls per 3600 seconds. Old windows for
-- that endpoint are deleted on the way in so the table does not grow forever.
-- There is no foreign key to devices: the limit is checked before the upsert,
-- including for an id this function has not stored yet.
--
-- fn_register_device upserts by id. first_seen_at is the insert default and is
-- never updated. platform, app_version and ui_language update on every call.
-- age_gate is written only when p_set_age_gate is true.
--
-- anon and authenticated get no privileges. The edge function calls these as
-- service_role. device_id stays in the row; callers must not log it in full.

create table public.device_rate_limits (
  device_id uuid not null,
  endpoint text not null check (char_length(endpoint) between 1 and 64),
  window_start timestamptz not null,
  hits integer not null check (hits >= 0),
  primary key (device_id, endpoint, window_start)
);

alter table public.device_rate_limits enable row level security;

revoke all on table public.device_rate_limits from public, anon, authenticated;
grant select, insert, update, delete on table public.device_rate_limits to service_role;

create function public.fn_device_rate_allow(
  p_device_id uuid,
  p_endpoint text,
  p_limit integer,
  p_window_seconds integer
) returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_epoch double precision;
  v_window_start timestamptz;
  v_hits integer;
begin
  if p_limit is null or p_limit < 1 then
    raise exception 'p_limit must be positive';
  end if;
  if p_window_seconds is null or p_window_seconds < 1 then
    raise exception 'p_window_seconds must be positive';
  end if;
  if p_endpoint is null or char_length(p_endpoint) < 1 or char_length(p_endpoint) > 64 then
    raise exception 'p_endpoint length must be 1..64';
  end if;

  v_epoch := extract(epoch from clock_timestamp());
  v_window_start := to_timestamp(
    floor(v_epoch / p_window_seconds) * p_window_seconds
  );

  delete from public.device_rate_limits
  where endpoint = p_endpoint
    and window_start < v_window_start;

  insert into public.device_rate_limits as r (device_id, endpoint, window_start, hits)
  values (p_device_id, p_endpoint, v_window_start, 1)
  on conflict (device_id, endpoint, window_start)
  do update set hits = r.hits + 1
  returning hits into v_hits;

  return v_hits <= p_limit;
end;
$$;

revoke all on function public.fn_device_rate_allow(uuid, text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.fn_device_rate_allow(uuid, text, integer, integer)
  to service_role;

create function public.fn_register_device(
  p_id uuid,
  p_platform text,
  p_app_version text,
  p_ui_language public.lang,
  p_age_gate text,
  p_set_age_gate boolean
) returns timestamptz
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_first timestamptz;
begin
  if p_platform is null or p_platform not in ('ios', 'android') then
    raise exception 'platform must be ios or android';
  end if;
  if p_app_version is null or char_length(p_app_version) > 32 then
    raise exception 'app_version must be at most 32 characters';
  end if;
  if p_ui_language is null then
    raise exception 'ui_language required';
  end if;
  if p_set_age_gate and p_age_gate is not null
     and p_age_gate not in ('under_13', '13_17', '18_plus', 'adult_for_family') then
    raise exception 'invalid age_gate';
  end if;

  insert into public.devices (id, platform, app_version, ui_language, age_gate)
  values (
    p_id,
    p_platform,
    p_app_version,
    p_ui_language,
    case when p_set_age_gate then p_age_gate else null end
  )
  on conflict (id) do update set
    platform = excluded.platform,
    app_version = excluded.app_version,
    ui_language = excluded.ui_language,
    age_gate = case
      when p_set_age_gate then excluded.age_gate
      else public.devices.age_gate
    end
  returning first_seen_at into v_first;

  return v_first;
end;
$$;

revoke all on function public.fn_register_device(uuid, text, text, public.lang, text, boolean)
  from public, anon, authenticated;
grant execute on function public.fn_register_device(uuid, text, text, public.lang, text, boolean)
  to service_role;
