# M6 review 1 (Claude): not ready for the Pixel walk

**Verdict:** these parts are good, and they stay:
- the pack parsers
- the persistence scrub (R1)
- the expo-location finding (R2)
- the overlay, teaser and settings UI
- the QR route
- the M6 world gate

**But the phone can't play a story yet.** As built, a walk would show the overlay, start the lock-screen session, and stay **silent**, and no fragment would ever complete. The report says steps 1–8 are built and the GPX acceptance passes. The code doesn't match that. The harness drives the shared session machine directly; it doesn't run the app's runtime. **A report must say plainly what isn't wired.**

## Blocking (fix before the walk)

**B1: the engine isn't connected.**
- `ExploringProvider` creates `ExploringRuntime({ db, location, audioSession })` with **no engine**. So `applyDirectorCommands` never runs, and nothing plays.
- Wire **one** `RNAudioApiEngine` instance (the B·S2/B·S3 engine) into the runtime, and make it the only engine.

**B2: engine events don't come back.** Nothing dispatches `narrationEnded`, so the session stays `playing` forever: no completion, no unlocks, no afterglow, and the queue never advances. Wire:
- narration `voiceEnded` → session `narrationEnded { reason: natural | stopped | interrupted, playedMs }`, plus director `voiceEnded`
- narration progress → director `narrationProgress` (breath-point resume) and the overlay's progress bar
- load/decode failures → director `assetFailed { sha }`

**B3: the audio-session events aren't wired.** Only remote pause, play and skip-back are. Also wire:
- **Interruptions** (a call, YouTube, Bluetooth disconnect) → director `interruption { shouldResume }`, and session `narrationPaused` / `narrationResumed` as appropriate
- **Route changes** → director `settings.route`
- **The director's `suspend` / `resume`** → B·S3's session path: fade, then suspend. It currently maps to `pauseNarration`; check it against BS3.
- **Guard:** don't dispatch `narrationPaused` / `narrationResumed` when nothing is playing.

**B4: the heartbeat is a JS timer.**
- `setInterval` plus a made-up `audioSec` (`+5`) breaks ADR 0001's rule. JS timers drift or stop when the screen is locked, which is exactly where B·S1 failed.
- Drive `tick` and the director heartbeat from the **engine's audio clock** (B·S2's 5 s heartbeat), using the real `audioSec`.
- Tick only while `exploring`. Don't write to kv every 5 s while idle.

**B5: `windowChanged` is never sent.**
- Compute the time window from the region's sun times, and dispatch `windowChanged` at start and whenever it flips.
- Without this, Day/Night works only in the harness.

**B6: location.**
- **Use one source during a session.** `ensureBackground` keeps the foreground watch running beside the location service, so each position can arrive twice. Two copies of one fix would count as the "two consecutive confirmed fixes" a trigger needs.
  - Stop the watch while the service runs.
  - Drop any fix whose `at` isn't newer than the last one.
- **Use High accuracy for the whole session** (and for the on-screen watch).
  - The service can't be restarted from the background (R2).
  - On Android, `Accuracy.Balanced` gives roughly 100 m, network-level accuracy.
  - So a session that starts in Balanced and goes into a pocket would never get a fix inside the 25 m tolerance, and nothing would trigger.
  - Drop the Balanced ↔ High switching. Note it in the report; I'll update TECH_SPEC §3.3.

**B7: ending a session.** On `sessionEnded`:
- stop the narration with a fade
- **end** the media session and its service (not only `userPause`)
- stop location within 5 s

**B8: a real acceptance test.** The harness tests the shared machine, not the app.
- **Add a runtime-level test** that drives `ExploringRuntime` with a fake engine, a fake location source and a fake audio session. It should cover:
  - a fix → play → engine `voiceEnded` → completion → afterglow → the queued fragment plays
  - an interruption and its resume
  - location denied (scans still play)
  - accessible trigger
  - session end: location stops within 5 s and the media session ends
- **Add a contingency/correction test** at the runtime level: a contingency replays once, a correction doesn't.
- **The emulator GPX run:** if you can create an AVD (the Android SDK is installed), run the demo GPX with mock locations and report each item. If you can't, say so; the runtime test plus the Pixel walk will stand in.

## Also required
**R3: Stop in the notification.**
- Add a **"Stop exploring" custom command** to the media session (a Media3 `CommandButton` in the `audio-session` module) that sends session `stop`. It then shows in the notification and on the lock screen.
- The location notification stays plain; tapping it opens the app.

**The walk plan.** Add to the report how the Pixel walk gets real triggers:
- which pack is used
- where its fragments are
- whether Jordan can walk there

Don't commit anyone's home location.

## Next
1. Commit this review.
2. Fix B1–B8 and R3.
3. `pnpm lint`, `typecheck` and `test` must pass, and both CI jobs must be green.
4. Update `M6-report.md` honestly: what's wired, what's tested where, and what isn't done.
5. Push, and stop for my check before the walk.
