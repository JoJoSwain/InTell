# A7 review (Claude): M11 steps 5–10

**Verdict:** close. Make the three fixes below; then it's ready to merge.

What's good:
- every view uses `security_invoker`
- grants are for `authenticated` only
- the Denver-month helper
- the fixture with hand-written numbers
- the dashboard with CSV and captions
- `delete-device-data` (it cascades through the `devices` row and also removes the rate-limit rows)
- `export-archive`: `editor+`, no audio, and the Indigeny notes included as the spec requires
- `deviceExists` now returns `"error"` / 500

**Visits:** accepted as `grove_entered` per grove, plus `v_dash_session_starts` overall. A session can span groves, and `session_started` has no grove. Update TECH_SPEC §9's Visits line to say so, in this PR.

## Fixes
1. **A return means another session on a later day.**
   - TECH_SPEC §9 says "another session **1–183 days** later". `v_dash_return_6mo` and `v_dash_contribution_return` count any later session, so a stop-and-restart on the same day counts as a return, which inflates the rate.
   - Use `occurred_at >= first_session_at + interval '1 day'` and `<= first_session_at + interval '183 days'` in both views.
   - Add a fixture device whose only second session is on the same day; it must **not** count as returned. Update the hand-written numbers.
2. **Never leave voice recordings behind.**
   - `delete-device-data` counts a failed voice-file removal and then deletes the rows anyway. That orphans the recording, with nothing left pointing to it.
   - Remove all of the device's voice files in **one** storage call. Treat "not found" as removed.
   - If any other removal fails, return `500` **before deleting any row**, so the phone can retry safely.
   - Unit test the failure path: the rows stay, and the phone gets a 500.
3. **Audit the archive export.** Per G10, write an `audit_log` row for each export, with the actor, action `export_archive` and the scope (`regionId` or `all`). Test it.

## Next
1. Commit this review.
2. Make fixes 1–3 and update TECH_SPEC §9 Visits.
3. `pnpm lint` (for the packages you touched), `typecheck` and `test` must pass, and both CI jobs must be green.
4. Update `A7-report.md`, push, and stop for my check.
5. **After it merges,** Jordan deploys to staging: `db push --remote` (two migrations) and `functions deploy`. List the exact steps in the report.
