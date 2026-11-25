# Lane A · A7 — report (review fixes)

**Branch:** `a/a7-analytics` · **PR:** #37

## This stop

Committed `docs/briefs/A7-review.md` (`docs: A7 review (Claude)`).

1. **Return window.** Both `v_dash_return_6mo` and `v_dash_contribution_return` count a later `session_started` only when `occurred_at` is ≥ 1 day and ≤ 183 days after the first. Fixture device D restarts the same day and is not returned. Hand numbers for Jan 2025: return cohort 4 / returned 2 / rate 0.5000; contribution 1/1/1.0000 and 3/1/0.3333.
2. **Voice files.** `delete-device-data` removes every voice object in one storage call. Not-found counts as removed. Any other storage failure returns 500 and does not delete rows. Unit test covers that path.
3. **Export audit.** Each export inserts `audit_log` with the actor, action `export_archive`, and scope (`regionId` or `all`). Unit test covers the row.
4. **TECH_SPEC §9 Visits** now says `grove_entered` per grove, plus overall `session_started`. A session can span groves, and `session_started` has no grove.

Local views were reapplied with the edited migration SQL. No database reset.

## Commands

- `pnpm --filter @intell/pack-integration test` — green (41 tests)
- `pnpm exec supabase test db supabase/tests/131_m11_dashboard_fixture.test.sql` — PASS

## After merge — staging deploy (Jordan)

From the merged `master` checkout, linked to **staging** (not production):

1. Dry-run, then push the two M11 migrations:
   - `20261125010000_m11_events_schema_version.sql`
   - `20261125120000_m11_dashboard_views.sql`
   ```
   supabase db push --remote --dry-run
   supabase db push --remote
   ```
2. Deploy the functions this branch adds or changes (linked staging project, or `--remote=<staging-ref>`). JWT settings come from `config.toml`; do not pass `--no-verify-jwt`.
   ```
   supabase functions deploy ingest-events delete-device-data export-archive --remote=<staging-ref>
   ```
   `delete-device-data` is `verify_jwt = false` (publishable key, checked in-function). `export-archive` keeps platform JWT verification on (`editor+`).

Nothing in this stop was aimed at staging.

## Still open

- G19 journal measures ("% read within 14 days", median days to grown) stay out until M9.
- Stopped for Claude's check.
