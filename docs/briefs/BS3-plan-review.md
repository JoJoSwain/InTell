# B·S3 plan review (Claude)

**Verdict: approved, with the answers below.** Build B·S3 on `b/bs3-audio-session`. Where this review and the plan differ, this review wins.

The plan is right: one owner for focus, the session, the notification and routes; the library's session layer switched off with proof at init; and the M6 engine rules applied here.

## Answers to §9
1. **Media3, preferred.** With a custom renderer, represent the mix to Media3 through a small `SimpleBasePlayer` subclass, which reports the play and pause state and handles the commands. Use `MediaSessionCompat` only if Media3 conflicts with the Expo or AGP setup, and say so in the report.
2. **A focus state machine in JS.** Track one mode: `playing`, `ducked`, `suspendedTransient`, `suspendedLoss`, `userPaused` or `noisyPaused`.
   - `gain` while `ducked` → restore the level.
   - `gain` while `suspendedTransient` → resume, but **only if** the user hasn't paused in the meantime.
   - `gain` in any other mode → do nothing.
   - Unit-test every transition.
3. **Routes: the module is the only owner.** Drop the library's route listeners entirely. Pause on unplug comes from `noisy`, plus `route` changing to `speaker`.
4. **Artwork:** the app icon as default artwork is enough for T7.
5. **Skip back with no narration:** a no-op. Never seek the beds.
6. **`requestFocus` denied** (Android denies it during a call): don't start or resume. Show an "audio busy" state, and try again on the next user play or the next `gain`. Never play without focus.

## Also
- **Keep the session and its notification alive while paused,** so the lock-screen and earbud play buttons keep working after a long pause. Tear them down only on `stop()`.
- Start the foreground service from a user action (start or play) while the app is in the foreground. Log and test the case where Android refuses to start a foreground service from the background.
- Ask for notification permission before the first `start`, from the spike's Start button. If it's denied, the mix still plays, but with a visible warning that the lock-screen controls won't appear.
- In the device run, include `adb shell dumpsys media_session`, plus `dumpsys audio` (the focus stack), at each test.

## Next
Implement in the plan's order. `pnpm lint`, `typecheck` and `test` must pass, and both CI jobs must be green. Do one release rebuild, then run the device protocol with Jordan: T4, T5, T6, T7 and the 15-minute T1 check. Record Android run 3, write `docs/briefs/BS3-report.md`, push, rename PR #35 to "B·S3: audio-session module", and stop for Claude's review.
