-- N2 (M3a): security definer functions executable by anon/authenticated match allowlist.
-- Grants documented in 20261121100013_m3a_definer_grants.sql.
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
    -- Admin publish checklist (editor+ guard inside the function).
    'fn_publish_check(p_release_id uuid)',
    -- Admin publish/unpublish commit (fn_require_editor_or_service inside).
    'fn_publish_commit(p_release_id uuid)',
    'fn_unpublish_commit(p_entity text, p_ids uuid[])',
    -- Publish commit and unpublish call this guard.
    'fn_require_editor_or_service()',
    -- R1 "Unreleased changes" projection for editors.
    'fn_snapshot_projection_guarded(p_entity text, p_entity_id uuid)',
    -- Devices discover live packs (DATA_MODEL §12.3); anon + staff.
    'get_pack_index()',
    -- RLS policies resolve staff roles.
    'has_role(roles staff_role[])'
  ]::text[],
  'security definer execute grants for anon/authenticated match M3a allowlist'
);

select * from finish();
rollback;