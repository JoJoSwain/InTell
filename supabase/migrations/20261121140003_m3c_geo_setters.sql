-- M3c answer 2: security invoker geometry setters (RLS enforces editor+).

create or replace function public.fn_set_grove_boundary(
  p_grove_id uuid,
  p_geojson text
)
returns void
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_boundary extensions.geography(Polygon, 4326);
begin
  if p_geojson is null or length(trim(p_geojson)) = 0 then
    raise exception 'geojson required' using errcode = '22023';
  end if;

  begin
    v_boundary := extensions.ST_GeomFromGeoJSON(p_geojson)::extensions.geography;
  exception when others then
    raise exception 'invalid GeoJSON polygon' using errcode = '22P02';
  end;

  update public.groves
     set boundary = v_boundary
   where id = p_grove_id;

  if not found then
    raise exception 'grove not found or not permitted' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.fn_set_grove_boundary(uuid, text) from public, anon;
grant execute on function public.fn_set_grove_boundary(uuid, text) to authenticated, service_role;

create or replace function public.fn_set_fragment_location(
  p_fragment_id uuid,
  p_lat float8,
  p_lng float8
)
returns void
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_loc extensions.geography(Point, 4326);
  v_grove_id uuid;
  v_boundary extensions.geography;
begin
  if p_lat is null or p_lng is null then
    raise exception 'lat and lng required' using errcode = '22023';
  end if;

  v_loc := extensions.ST_GeogFromText(
    'SRID=4326;POINT(' || p_lng::text || ' ' || p_lat::text || ')'
  );

  select grove_id into v_grove_id from public.fragments where id = p_fragment_id;
  if v_grove_id is null then
    raise exception 'fragment not found or not permitted' using errcode = 'P0002';
  end if;

  select boundary into v_boundary from public.groves where id = v_grove_id;
  if v_boundary is null or not extensions.ST_Covers(v_boundary, v_loc) then
    raise exception 'fragment location outside grove boundary' using errcode = '23514';
  end if;

  update public.fragments
     set location = v_loc
   where id = p_fragment_id;

  if not found then
    raise exception 'fragment not found or not permitted' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.fn_set_fragment_location(uuid, float8, float8) from public, anon;
grant execute on function public.fn_set_fragment_location(uuid, float8, float8) to authenticated, service_role;
