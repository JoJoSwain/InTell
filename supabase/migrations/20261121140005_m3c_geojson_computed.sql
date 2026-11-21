-- M3c C1: PostgREST computed GeoJSON columns (security invoker; RLS on the row).
-- N2: fn_draft_check allows all active staff (same gate as fn_unreleased).

create or replace function public.boundary_geojson(g public.groves)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select case
    when g.boundary is null then null
    else extensions.ST_AsGeoJSON(g.boundary)::jsonb
  end;
$$;

create or replace function public.location_geojson(f public.fragments)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select case
    when f.location is null then null
    else extensions.ST_AsGeoJSON(f.location)::jsonb
  end;
$$;

revoke all on function public.boundary_geojson(public.groves) from public, anon;
revoke all on function public.location_geojson(public.fragments) from public, anon;
grant execute on function public.boundary_geojson(public.groves) to authenticated, service_role;
grant execute on function public.location_geojson(public.fragments) to authenticated, service_role;

-- N2: writers (and all active staff) may call draft check for badges
create or replace function public.fn_draft_check(p_grove_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  failures jsonb := '[]'::jsonb;
  frag public.fragments%rowtype;
  grove public.groves%rowtype;
  has_start boolean;
  img public.image_assets%rowtype;
begin
  if auth.role() = 'authenticated'
     and not public.has_role(
       array['viewer','moderator','writer','sound','editor','admin']::public.staff_role[]
     ) then
    raise exception 'staff required';
  end if;

  select * into grove from public.groves where id = p_grove_id;
  if not found then
    return jsonb_build_object(
      'ok', false,
      'failures', jsonb_build_array(public.fn_check_issue(
        'DEPENDENCY_UNPUBLISHED', 'error', 'grove not found', 'grove', p_grove_id))
    );
  end if;

  for frag in select * from public.fragments where grove_id = p_grove_id
  loop
    failures := failures || public.fn_check_fragment_local(frag);
  end loop;

  select exists (
    select 1 from public.fragments f
    where f.grove_id = p_grove_id
      and not exists (
        select 1 from public.fragment_prereq_groups g where g.fragment_id = f.id
      )
  ) into has_start;
  if not has_start then
    failures := failures || jsonb_build_array(public.fn_check_issue(
      'NO_START', 'warning', 'no fragment open from the start', 'grove', p_grove_id));
  end if;

  for img in
    select distinct i.*
    from public.fragment_characters fc
    join public.fragments f on f.id = fc.fragment_id
    join public.characters c on c.id = fc.character_id
    join public.image_assets i on i.id = c.portrait_image_id
    where f.grove_id = p_grove_id
  loop
    if coalesce(img.alt_text, '{}'::jsonb) = '{}'::jsonb
       or coalesce(nullif(btrim(img.alt_text->>'en'), ''), null) is null then
      failures := failures || jsonb_build_array(public.fn_check_issue(
        'NO_ALT_TEXT', 'error', 'alt text required', 'image', img.id));
    end if;
  end loop;

  return jsonb_build_object(
    'ok', not exists (
      select 1 from jsonb_array_elements(failures) e where e->>'severity' = 'error'
    ),
    'failures', failures
  );
end;
$$;
