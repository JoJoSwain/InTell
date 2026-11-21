-- Editor+ helper to upsert regions with geography (admin UI).
create or replace function public.fn_admin_upsert_region(
  p_id uuid,
  p_name text,
  p_slug text,
  p_timezone text,
  p_sun_wkt text,
  p_bounds_geojson text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_sun extensions.geography(Point, 4326);
  v_bounds extensions.geography(Polygon, 4326);
begin
  if not public.has_role(array['editor','admin']::public.staff_role[]) then
    raise exception 'editor or admin required' using errcode = '42501';
  end if;

  v_sun := extensions.ST_GeogFromText('SRID=4326;' || p_sun_wkt);

  if p_bounds_geojson is not null and length(trim(p_bounds_geojson)) > 0 then
    v_bounds := extensions.ST_GeomFromGeoJSON(p_bounds_geojson)::extensions.geography;
  else
    v_bounds := null;
  end if;

  if p_id is null then
    insert into public.regions (name, slug, timezone, sun_reference, bounds)
    values (p_name, p_slug, p_timezone, v_sun, v_bounds)
    returning id into v_id;
  else
    update public.regions
       set name = p_name,
           slug = p_slug,
           timezone = p_timezone,
           sun_reference = v_sun,
           bounds = v_bounds
     where id = p_id
    returning id into v_id;
    if v_id is null then
      raise exception 'region not found' using errcode = 'P0002';
    end if;
  end if;

  return v_id;
end;
$$;

revoke all on function public.fn_admin_upsert_region(uuid, text, text, text, text, text)
  from public, anon;
grant execute on function public.fn_admin_upsert_region(uuid, text, text, text, text, text)
  to authenticated, service_role;
