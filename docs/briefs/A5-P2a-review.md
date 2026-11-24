# A5 Part 2a review (Claude)

**Verdict: changes required before merge.**

The carried fixes are clean:
- F2 types the pack-build error.
- N3 moves loudness into a worker and adds the crest factor.
- K1–K3 keep the plural key maps, with the singular names as a fallback.
- V1 and V2 are done.

The screens cover the brief's list. But the required `db` CI job fails, and the new sound actions have no tests.

## Required
1. **Fix the failing `db` job** (run 45429496797; `check` passed). Read the log with `gh run view 45429496797 --log-failed`, find the cause and fix it. The likely suspects are the two new migrations (`20261124103000_a5_admin_zone_boundary`, `20261124120000_a5p2a_run_jobs_apikey_only`), or the pack-integration changes for apikey-only auth. Add the root cause to the report.
2. **Tests for the sound actions.** `sound/actions.ts` (about 400 lines) has none. Add server-action tests that cover:
   - **Who may write:** staff only; anon and non-staff are refused.
   - **Validation:**
     - zone GeoJSON
     - the condition builder: `heardAll` ids must exist, at most 4 growth steps per grove and window, and `minDepthM` ≥ 0
     - stems ≤ 4
     - resolve, motif and beacon assets must have the right `asset_kind` (`music_moment`, `beacon`)
     - a mono bed is refused, or flagged as `BED_MONO`
   - **The breath and swell editor:** sorted, unique, and within the narration's duration.
   - **Save twice:** add the new forms to the M3h save-twice e2e spec, if it runs in CI. Otherwise cover the double-submit guard in unit tests.
3. **Report accuracy.** The report says lint, typecheck and test are green. Also confirm both CI jobs are green on the final commit.

## Moved to P2b (accepted, not required here)
- **The landcover grid upload UI and the H3 overlay.** BUILD_PLAN M4 requires them; build them with the Simulator map in P2b.
- **Breath and swell markers on the waveform** (draggable). Build them in P2b alongside the Simulator's narration bar. The editable millisecond lists are fine for now.

## For Jordan, after merge (deployment order, staging)
1. Deploy the edge functions (K1–K3 change them): `pnpm exec supabase functions deploy`.
2. Push the migrations, which include A5 Part 1's: `pnpm exec supabase db push --remote`. The cron then sends `apikey` only, which the deployed functions already accept.
3. Check that `run-jobs` still returns 200, using the smoke query in the runbook.
4. Only then, disable the legacy API keys in the staging dashboard.

## Next
Fix items 1–3. `pnpm lint`, `typecheck` and `test` must pass, and both CI jobs must be green. Update `A5-P2a-report.md` with a "Review fixes" section, push, and stop for Claude's check.
