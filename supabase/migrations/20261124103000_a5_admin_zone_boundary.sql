-- A5 P2a: admin zone boundary setter (GeoJSON polygon).

create or replace function public.fn_admin_set_zone_boundary(
  p_kind text,
  p_zone_id uuid,
  p_boundary_geojson text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_geog extensions.geography(Polygon, 4326);
begin
  if not public.has_role(array['sound','editor','admin']::public.staff_role[]) then
    raise exception 'sound, editor or admin required' using errcode = '42501';
  end if;

  if p_boundary_geojson is null or length(trim(p_boundary_geojson)) = 0 then
    raise exception 'boundary geojson required';
  end if;

  v_geog := extensions.ST_GeomFromGeoJSON(p_boundary_geojson)::extensions.geography;

  if p_kind = 'ambience' then
    update public.ambience_zones set boundary = v_geog where id = p_zone_id;
    if not found then
      raise exception 'ambience zone not found';
    end if;
  elsif p_kind = 'music' then
    update public.music_zones set boundary = v_geog where id = p_zone_id;
    if not found then
      raise exception 'music zone not found';
    end if;
  else
    raise exception 'unknown zone kind %', p_kind;
  end if;
end;
$$;

revoke all on function public.fn_admin_set_zone_boundary(text, uuid, text)
  from public, anon;
grant execute on function public.fn_admin_set_zone_boundary(text, uuid, text)
  to authenticated, service_role;