# A4 review (Claude)

**Verdict: ready to merge after three small fixes (about 15 minutes).** The reducer follows the plan and the plan review closely:
- It's pure, its state is versioned and JSON-safe, and no coordinates appear in effects.
- Pause and resume, and the reducer-computed `playedMs`, are right.
- The effect order is documented and tested.
- The hooks for the sound features are in place.

## Fix before merge
1. **A scan in another grove is missing from the visit record.** On `scan` while exploring, add `f.groveId` to `groveIds`. Otherwise `completionsByGrove` counts the completion, but `writeVisit` (which maps over `groveIds`) drops it. Add a test: start in grove A, scan a physical fragment in grove B, then complete it; `writeVisit.groves` should include B with 1.
2. **Location mode without location access.** `locationModeFor` returns `balanced` when `locationAvailable` is false. It should return `idle`, because there's nothing to track and only scans work. Add or adjust a test.
3. **`settingsChanged` ignores its own values.** For that step, merge the event's `accessibleTrigger` and `locationAvailable` into `world.settings` before computing anything. That way the step is correct even if the shell's `world` lags by one event. Document in the module header that the shell passes the updated `world` from then on. `windowChanged` already uses `event.timeWindow` for the queue; keep that.

## Notes (no change needed)
- Scans play physical fragments only. That matches `scanDecision` and TECH_SPEC §3.2.
- If `fragmentMeta` has no entry, `revisionNo` falls back to 1. That's acceptable, since packs always supply it; M6 should log a missing entry.

## Next
Commit the three fixes along with this review file. `pnpm lint`, `typecheck` and `test` must pass. Then push and stop. Jordan renames PR #29 to "A4: session state machine" in GitHub and merges once Claude says "ready to merge".
