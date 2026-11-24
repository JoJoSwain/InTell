# A5 Part 1 review (Claude)

**Verdict: ready to merge after three small fixes in `beacon.ts`.**

Part 1 matches the plan and the plan review:
- The spec text landed.
- The migrations are additive.
- `grove_sound_cues` has RLS and explicit grants.
- `fn_publish_check` is wrapped cleanly, with the old function kept for `service_role` only.
- The device strip parsers are in place, and the builders omit keys that have no value.
- Every decision is a named constant. CI is green.

## Fix before merge
1. **Beacon level.** `beaconMix` runs from −6 dB at 100 m up to **+6 dB** close in. A beacon is meant to be faint and always well under the narrator.
   - Make it `BEACON_GAIN_FAR_DB = −24` at the range edge, rising to `BEACON_GAIN_NEAR_DB = −6` at 0 m. Interpolate linearly in dB; both are named constants.
   - Test the edge, the near end and the midpoint.
2. **Beacon choice: non-transitive sort.**
   - The comparator applies the tier preference only to pairs within 10 m of each other. That isn't transitive, so the result can depend on input order.
   - Replace it: find the nearest distance `d0`, keep the candidates within `d0 + BEACON_TIER_NEAR_M`, then pick by tier (Root, Branch, Leaf), then by distance, then by id.
   - Keep the switch hysteresis as it is. Add a test with three candidates that the old comparator ordered inconsistently.
3. **A source directly behind flips left and right.**
   - With `|relative| > 90`, pan saturates at ±1, and it flips sides as the bearing crosses 180°.
   - Mirror the back half instead: `pan = sign(relative) × (180 − |relative|) / 90`, so a source directly behind is centered. The lowpass still marks it as behind.
   - Test 0°, ±45°, ±90°, ±135° and 180°.

## Process note
The report says the local database was reset. The standing rule is to ask Jordan before any `db reset`, even a local one. No harm done this time, but please ask first in future.

## Next
Commit the three fixes, their tests and this review file. `pnpm lint`, `typecheck` and `test` must pass. Push to `a/a5-sound-features` and stop for Claude's check. Jordan merges PR #30 once Claude says "ready to merge".
