# Lane A · A7 — report (steps 5–10 complete)

**Branch:** `a/a7-analytics` · **PR:** #37

## Done this stop

1. Committed `docs/briefs/A7-step4-review.md` (`docs: A7 step-4 review (Claude)`).
2. Merged `origin/master` into `a/a7-analytics` (merge commit).
3. **Fix 1:** `deviceExists` returns `"error"` on query failure → ingest answers **500** (not 404); unit test in `ingestEvents.unit.test.ts`.
4. **Views** (`20261125120000_m11_dashboard_views.sql`): `security_invoker = true`, America/Denver months, grants to `authenticated` only; anon revoked. Views: visits, session_starts, fragments_completed, depth, return_6mo, participation (G19: omit %read / median grown), contribution_return (G7), checkins (G20).
5. **Fixture** `131_m11_dashboard_fixture.test.sql`: hand-written Jan 2025 expected numbers; anon / non-staff / staff checks. Local pgTAP **PASS** (no db reset; used `migration up`).
6. **Admin** `/dashboard` tables + CSS bars + CSV per view; sidebar link. Export archive button (editor+).
7. **`delete-device-data`:** publishable caller, rate 5/day, deletes rate_limits + voice files + devices row (cascade events/journal/checkins); counts returned; unit tests.
8. **`export-archive`:** editor+ JWT, optional `regionId`, zip of revisions/transcripts/story notes/metadata/manifest (**no audio bytes**, G10); audit_log row; unit tests.

## Commands

- `pnpm db:sync-edge-shared` / `pnpm db:check-edge-shared` — match
- `pnpm --filter @intell/shared lint|typecheck|test` — green (344 tests)
- `pnpm --filter @intell/admin lint|typecheck` — green
- `pnpm --filter @intell/pack-integration test` — green (37 tests)
- `pnpm exec supabase migration up` — applied pending migrations locally (**no reset**)
- `pnpm exec supabase test db supabase/tests/131_m11_dashboard_fixture.test.sql` — PASS

## Not done / open

- G19 journal measures still deferred to M9 (called out on the dashboard caption).
- Visits view uses `grove_entered` per grove (plus `v_dash_session_starts` for overall). TECH_SPEC names visits as `session_started`; flag if Claude wants visits redefined.
- No local db reset (per standing rule).
- Nothing aimed at staging.

## Stop

Waiting for Claude review of steps 5–10. Both CI jobs should be green on the push that follows this report.
