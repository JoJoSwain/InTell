-- M3a follow-up #1: shrink authenticated execute on security-definer functions.
-- Every GRANT has a why-comment (for 110_definer_grants.test.sql parity).

-- ---------------------------------------------------------------------------
-- Revoke broadly from anon / authenticated / public, then grant the allowlist.
-- ---------------------------------------------------------------------------

-- Internal helpers / builders — service_role only
revoke all on function public.fn_contingency_revision_no(uuid) from public, anon, authenticated;
revoke all on function public.fn_layer_is_playable(uuid) from public, anon, authenticated;
revoke all on function public.fn_revision_is_playable(uuid) from public, anon, authenticated;
revoke all on function public.fn_current_revision(uuid) from public, anon, authenticated;
revoke all on function public.fn_cue_is_playable(uuid) from public, anon, authenticated;
revoke all on function public.fn_snapshot_projection(text, uuid) from public, anon, authenticated;
revoke all on function public.fn_must_precede(uuid, uuid) from public, anon, authenticated;
revoke all on function public.fn_enqueue_rebuild_pack(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.fn_enqueue_purge_asset(text) from public, anon, authenticated;
revoke all on function public.fn_enqueue_purge_reconcile(text, jsonb) from public, anon, authenticated;
revoke all on function public.fn_enqueue_due_releases() from public, anon, authenticated;
revoke all on function public.fn_release_go_live(uuid) from public, anon, authenticated;
revoke all on function public.fn_daily_expiry_and_retention() from public, anon, authenticated;
revoke all on function public.fn_call_run_jobs() from public, anon, authenticated;
revoke all on function public.fn_pack_geog_geojson(text, uuid) from public, anon, authenticated;
revoke all on function public.fn_publish_commit(uuid) from public, anon, authenticated;
revoke all on function public.fn_unpublish_commit(text, uuid[]) from public, anon, authenticated;
revoke all on function public.fn_require_editor_or_service() from public, anon;
revoke all on function public.fn_region_today(text) from public, anon, authenticated;
revoke all on function public.fn_is_editor_or_admin() from public, anon;

-- service_role needs the builders and outbox helpers
grant execute on function public.fn_contingency_revision_no(uuid) to service_role;
grant execute on function public.fn_layer_is_playable(uuid) to service_role;
grant execute on function public.fn_revision_is_playable(uuid) to service_role;
grant execute on function public.fn_current_revision(uuid) to service_role;
grant execute on function public.fn_cue_is_playable(uuid) to service_role;
grant execute on function public.fn_snapshot_projection(text, uuid) to service_role;
grant execute on function public.fn_must_precede(uuid, uuid) to service_role;
grant execute on function public.fn_enqueue_rebuild_pack(uuid, uuid, uuid) to service_role;
grant execute on function public.fn_enqueue_purge_asset(text) to service_role;
grant execute on function public.fn_enqueue_purge_reconcile(text, jsonb) to service_role;
grant execute on function public.fn_enqueue_due_releases() to service_role;
grant execute on function public.fn_release_go_live(uuid) to service_role;
grant execute on function public.fn_daily_expiry_and_retention() to service_role;
grant execute on function public.fn_call_run_jobs() to service_role;
grant execute on function public.fn_pack_geog_geojson(text, uuid) to service_role;
-- Publish/unpublish commit: edge functions use service_role (or authenticated editor via guard)
grant execute on function public.fn_publish_commit(uuid) to service_role;
grant execute on function public.fn_unpublish_commit(text, uuid[]) to service_role;
grant execute on function public.fn_require_editor_or_service() to service_role, authenticated;
grant execute on function public.fn_region_today(text) to service_role;
grant execute on function public.fn_is_editor_or_admin() to service_role, authenticated;

-- ---------------------------------------------------------------------------
-- Allowlist for anon / authenticated (commented why)
-- ---------------------------------------------------------------------------

-- Devices call get_pack_index to discover live packs (DATA_MODEL §12.3).
revoke all on function public.get_pack_index() from public;
grant execute on function public.get_pack_index() to anon;
grant execute on function public.get_pack_index() to authenticated;
grant execute on function public.get_pack_index() to service_role;

-- RLS policies call has_role(); must stay executable by authenticated staff.
revoke all on function public.has_role(public.staff_role[]) from public, anon;
grant execute on function public.has_role(public.staff_role[]) to authenticated;
grant execute on function public.has_role(public.staff_role[]) to service_role;

-- Admin checklist UI calls fn_publish_check(release_id); function itself guards editor+.
revoke all on function public.fn_publish_check(uuid) from public, anon;
grant execute on function public.fn_publish_check(uuid) to authenticated;
grant execute on function public.fn_publish_check(uuid) to service_role;

-- Temporary: authenticated grants for publish/unpublish commit (guarded).
-- F2 (20261121100014) revokes these — commit must go through edge/service_role only.
grant execute on function public.fn_publish_commit(uuid) to authenticated;
grant execute on function public.fn_unpublish_commit(text, uuid[]) to authenticated;

-- Snapshot projection for "Unreleased changes" UI (R1): editor+ only (guarded wrapper).
-- Unguarded fn_snapshot_projection stays service_role-only (builders / commit).
revoke all on function public.fn_snapshot_projection(text, uuid) from authenticated;
revoke all on function public.fn_snapshot_projection_guarded(text, uuid) from public, anon;
grant execute on function public.fn_snapshot_projection_guarded(text, uuid) to authenticated;
grant execute on function public.fn_snapshot_projection_guarded(text, uuid) to service_role;

-- set_updated_at is trigger-only; no client execute
revoke all on function public.set_updated_at() from public, anon, authenticated;
