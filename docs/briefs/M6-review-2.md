# M6 review 2 (Claude): one blocking gap before the Pixel walk

**Verdict:** big progress, but **not ready for the walk yet.**

What's now wired:
- the engine
- narration end, progress and asset failures
- interruptions and routes
- High accuracy from one location source, with strictly newer fixes
- session end
- the "Stop exploring" command
- the runtime tests

## Blocking
**C1: the session clock doesn't run in the real engine.**
- `RNAudioApiEngine` keeps its silent heartbeats scheduled only while `mixActive` (or `settledPending`) is true.
- `mixActive` is set only by `prepareMixStart()`, which only the spike screen calls. `ExploringRuntime` never calls it.
- So on the phone, ticks happen only when a narration starts or ends, or when the app state changes. There's no steady 5 s clock.
- **The result:** after a story ends, `afterglowElapsed` never fires, so a story queued during the afterglow never plays. The Day/Night, 15-minute and 3-hour checks stall too. On the walk, you'd hear one story and then nothing.
- The fake engine emits ticks on demand, which is why the tests didn't catch it.

**Fix:**
- **Engine:** add a production clock API, `startSessionClock()` / `stopSessionClock()`, that keeps the silent heartbeats scheduled.
  - It must **not request audio focus.** Entering a grove must not pause the listener's podcast before a story plays.
  - It must **not** run the B·S2 tour loop.
- **Runtime:**
  - Start the clock when the session becomes `exploring`, including on a resume while exploring.
  - Stop it on `sessionEnded`.
- **Make spike-only behaviour impossible in production.** Put the B·S2 tour loop (`maybeRunTourLoop`, `tourNarrationTemplate`) and any other spike-only paths behind a flag that only the spike screen sets. Production must never replay a narration by itself.
- **Backup clock:** also run the session `tick` and the afterglow check on every accepted location fix.
- **Fake engine:** emit ticks only after `startSessionClock()`.
- **Tests:**
  - A story ends → the afterglow elapses → the queued story plays, driven only by ticks from the clock the runtime started.
  - With the clock stopped, no ticks arrive.
  - The tour loop never runs outside the spike.

## Also required
**C2: the time window must always be current.**
- `windowChanged` is only checked on clock ticks while exploring. A session that starts hours after the app opened (say, after sunset) would use a stale window.
- Recompute the window at the start of every `dispatch`, before stepping the session.

**C3: how the walk pack gets onto the phone.** Staging has no content, and the phone's `.env` has no Supabase URL. Add a "Before the walk" section to the report, with Jordan's exact steps:
- which build to install
- how the Farmington demo pack is downloaded onto the Pixel before leaving: from the PC's local Supabase over Wi-Fi, or another way
- how to check that it's installed and works offline

Also say whether the phone needs the PC once it's out on the trail.

## Next
1. Commit this review.
2. Fix C1–C3.
3. `pnpm lint`, `typecheck` and `test` must pass, and both CI jobs must be green.
4. Update the report, push, and stop for my check.
