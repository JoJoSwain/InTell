-- N2 (M3a + F2 + M3b): security definer execute grants for anon/authenticated.
begin;
select plan(1);

select is(
  (
    select coalesce(array_agg(sig order by sig), '{}'::text[])
    from (
      select format(
        '%s(%s)',
        p.proname,
        pg_get_function_identity_arguments(p.oid)
      ) as sig
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.prosecdef
        and p.prokind = 'f'
        and (
          has_function_privilege('anon', p.oid, 'EXECUTE')
          or has_function_privilege('authenticated', p.oid, 'EXECUTE')
        )
    ) s
  ),
  array[
    'fn_admin_upsert_region(p_id uuid, p_name text, p_slug text, p_timezone text, p_sun_wkt text, p_bounds_geojson text)',
    'fn_draft_check(p_grove_id uuid)',
    'fn_publish_check(p_release_id uuid)',
    'fn_require_editor_or_service()',
    'fn_snapshot_projection_guarded(p_entity text, p_entity_id uuid)',
    'fn_unreleased(p_grove_id uuid)',
    'get_pack_index()',
    'has_role(roles staff_role[])'
  ]::text[],
  'security definer execute grants for anon/authenticated match M3c allowlist'
);

select * from finish();
rollback;
