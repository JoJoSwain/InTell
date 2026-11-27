# M6 review 3 (Claude): one fix, then the walk

**Verdict:** C1–C3 are accepted.
- `startSessionClock()` / `stopSessionClock()` don't request focus.
- The tour loop is gated behind `spikeMode`.
- Fixes also drive `tick` and the afterglow check.
- The window is recomputed on every dispatch.
- The before-the-walk steps and the gitignored walk layout are in place.

One fix remains, because the walk checklist includes "Stop exploring, then start again."

## C4: a second session after Stop must work
- At session end, `stopAll` runs `fadeMasterAndSuspend`: the context is **suspended**, and the master gain is ramped to about 0.
- In the next session, `startSessionClock()` schedules heartbeats on a suspended context, so no ticks arrive.
- `playNarration()` doesn't resume the context or restore the master gain (only the spike's `prepareMixStart` did that). So **the second session is silent, and its clock is dead.**

The same applies after `pauseNarration()`: it suspends the whole context, so the session clock stops while paused. Location fixes keep `tick` alive, which is acceptable for a pause.

**Fix:**
- `startSessionClock()` resumes the context if it's suspended, **without** requesting focus.
- The narration start path:
  - requests focus first
  - resumes the context if needed
  - restores the master gain (the same steps as `prepareMixStart`, minus the spike parts)
- Make the fake engine model "suspended after `stopAll`": no ticks, and playback refused until resumed.
- **Test:** session 1 plays → Stop → session 2 starts its clock (ticks arrive) and plays narration audibly (master gain restored, context running).

## The walk layout
Draft groves "Walk test 1" and "Walk test 2" are on the local database. Don't publish them until Jordan approves the layout on the admin map.

## Next
1. Commit this review.
2. Fix C4.
3. `pnpm lint`, `typecheck` and `test` must pass, and both CI jobs must be green.
4. Push, and stop for my check.
5. **After my OK and Jordan's layout approval:** publish the walk release, build the packs, install them on the Pixel following "Before the walk", and confirm they work offline.
