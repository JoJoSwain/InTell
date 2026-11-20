# M2 follow-ups (carry into the M3 brief)

**Author:** architect (Claude), 2026-11-19, at the M2b PR approval

M2b was approved with these items deferred. None of them exposes protected coordinates, PII or unpublished content. Public signups are off.

1. **Tighten the definer allowlist** (`supabase/tests/110_definer_grants.test.sql`). These are executable by **any** `authenticated` user, including non-staff:
   - `fn_enqueue_rebuild_pack`, `fn_enqueue_purge_asset`: grant to `service_role` only. Triggers call them as the owner, so they don't need the grant.
   - `fn_publish_check`, `fn_must_precede`, the playability helpers (`fn_asset_is_playable`, `fn_cue_is_playable`, `fn_current_revision`, `fn_revision_is_playable`, `fn_layer_assets_playable`, `fn_site_ok`, `fn_date_unexpired`, `fn_region_today`): either revoke them from `authenticated` (if only definer code and the builder use them), or add a staff `has_role` guard (where the M3 admin calls them directly, e.g. `fn_publish_check` for the checklist UI).
   - Shrink the allowlist to match, with a comment on each line saying why it's allowed.
2. **Concurrent prerequisite edits:** take an advisory lock per grove in `fn_prereq_guard` so two simultaneous edits can't create a cycle together (M2a review note).
3. **CI `RUN_JOBS_URL`:** confirm the value that works on GitHub runners once the `db` job has run, and record it in TECH_SPEC.
4. **R1 `supabase_admin` default privileges** (M2a deviation): re-check when we create the hosted staging project.

Still open from product (not code):
- The Farmington trail shape (stem + loop?) and whether P1 is by the center building
- B7: the two other real sites besides Ogden Nature Center
- ADR 0001 (audio engine) is still Proposed, pending the 60-minute device test and the iPhone test
- ADR 0002 (map provider) is Proposed and must be decided before M5
