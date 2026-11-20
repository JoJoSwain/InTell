-- N2: security definer functions executable by anon/authenticated must match allowlist
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
    'fn_asset_is_playable(p_asset_id uuid, p_timezone text)',
    'fn_cue_is_playable(p_cue_id uuid)',
    'fn_current_revision(p_fragment_id uuid)',
    'fn_date_unexpired(p_expires_on date, p_timezone text)',
    'fn_enqueue_purge_asset(p_asset_sha text)',
    'fn_enqueue_rebuild_pack(p_grove_id uuid, p_region_id uuid)',
    'fn_layer_assets_playable(p_layer_id uuid)',
    'fn_must_precede(p_earlier uuid, p_later uuid)',
    'fn_publish_check(p_entity text, p_ids uuid[])',
    'fn_publish_commit(p_entity text, p_ids uuid[])',
    'fn_region_today(p_timezone text)',
    'fn_require_editor_or_service()',
    'fn_revision_is_playable(p_revision_id uuid)',
    'fn_site_ok(p_site_id uuid)',
    'fn_unpublish_commit(p_entity text, p_ids uuid[])',
    'get_pack_index()',
    'has_role(roles staff_role[])'
  ]::text[],
  'security definer execute grants for anon/authenticated match reviewed allowlist'
);

select * from finish();
rollback;
