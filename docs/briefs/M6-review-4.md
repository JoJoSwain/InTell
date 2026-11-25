# M6 review 4 (Claude): why the QR check is silent, and one walk blocker

**Verdict:** fix F1–F6, pass the at-home checks (A1–A8), then walk. I traced the code against your logcat findings. One cause is certain and explains the later silent runs. A second issue would have broken the walk even with sound working.

## Root causes
**RC1 (certain): stale state after the app restarts.** This explains every run after the first.
- After the first scan, `session.state.v1` was saved as `exploring`, with `playing` set (paused after the Bluetooth handoff). `director.state.v1` was saved with `lastEmitted` saying the narration voice was already emitted.
- Each relaunch then restores both, but the engine is a **new, empty** engine.
- **The director** diffs against `lastEmitted`, believes the narration is already playing, and never emits `playNarration` again. If `suspended` was also saved, it won't play or load anything at all.
- **The session** still holds `playing`. So A4 queues the new scan behind a narration that will never end, and `handlePlay` never runs.
- **Resume** goes through `userPlay`, but there's no narration voice in this process to resume.
- **This matches your evidence:**
  - The MediaSession is inactive, because `audioSession.start()` never ran in that process.
  - AAudio is `started` but silent, with speaker energy every **5 s**. That's the session clock's silent heartbeats, restarted because the restored phase was `exploring`.
  - Bluetooth is off and the volume is at maximum, which rules out routing and volume.

**RC2 (likely): the first run.** The Beats were reconnecting while the narration was playing. The B·S3 noisy/route path paused it, which is why the overlay showed **Resume**. After that, every relaunch hit RC1. The Resume path also has a double-resume race:
- On `resumeFadeIn`, the engine runs `resumeAfterFade`.
- `onInterruption("ended")` then also applies the director's `resume` command, which calls `resumeNarration` and runs `resumeAfterFade` again.
- (The `began` side already filters `suspend`. The `ended` side doesn't filter `resume`.)

**RC3 (certain, a walk blocker): the location service can't start.** The merged release manifest (`android/app/build/intermediates/merged_manifests/release/.../AndroidManifest.xml`) has **no `FOREGROUND_SERVICE_LOCATION` permission**, while `LocationTaskService` is declared with `foregroundServiceType="location"`. On Android 14+ that start fails, which is your "location fgs start failed". With the phone locked, no fixes would arrive, so **nothing would trigger on the walk.**
- The generated `android/app/src/main/AndroidManifest.xml` also lacks **both** `intentFilters` from `app.config.ts`: the https `/f` filter and the `intell://f/` filter.
- So the native project **isn't in sync with `app.config.ts`**, even though `app.config.ts` lists the permission.

**RC4 (a gap): a focus-denied `start()` is ignored.** `AudioSessionController.start()` returns `false` when focus is denied. When it does, it doesn't start the native session or register any listeners. `handlePlay` ignores the result and carries on.

**RC5 (fragility): the runtime overwrites the engine's remote handler.** `setRemoteHandler` holds only one handler. `ExploringRuntime.wireAudioSessionRemotes` replaces the engine's own handler, which forwards to `remoteSubs` and does the engine-side skip-back.

## Fixes
**F1: start clean after a restart.** On `ExploringRuntime.start()`:
- Restore the director with its emitted-mix memory **reset to empty** and `suspended = false`, because the engine is empty. The next step then re-emits whatever should be playing.
- If the restored session has `playing`, dispatch `narrationEnded { reason: "interrupted", playedMs: <the last saved position> }`. A4 then records progress, and a later trigger resumes near a breath point.
- Clear the overlay.
- **Test:** save state mid-narration, then start a new runtime with an empty fake engine.
  - The overlay is cleared.
  - `interrupted` is recorded.
  - No stale "already playing" is left.
  - A new scan calls `playNarration`.

**F2: handle audio focus being denied.**
- If `audioSession.start()` returns `false`, dispatch `narrationPaused`, show the overlay paused with an "Audio busy — tap to try again" line, and don't hand the director a playing narration.
- **Resume** with the session not started calls `start()` again, then continues.
- **Test:** focus denied, then a retry succeeds and plays.

**F3: one resume, not two.**
- In `onInterruption("ended")`, filter out the director's `resume` command too. The focus path owns resuming the context.
- Keep the director's `playNarration` remount.
- **Test:** an interruption ends → exactly one resume.

**F4: sync the native project and prove the manifest.**
- Find out why the generated manifest lacks the `app.config.ts` permissions and `intentFilters`. Use `pnpm exec expo config --type introspect` to compare.
- Regenerate with `pnpm exec expo prebuild --clean --platform android`, using the walk env.
- Rebuild the release app.
- Confirm that the **merged** release manifest has:
  - `FOREGROUND_SERVICE_LOCATION`
  - `LocationTaskService` with type `location`
  - both intent filters
- **Add a test** that fails if `FOREGROUND_SERVICE_LOCATION` or the `intell://f` filter is missing from the introspected config.

**F5: diagnostics you can see in a release build.**
- On the dev Data screen, add a live **Audio diagnostics** block:
  - the context state and the master gain
  - the focus mode, the busy state, and whether the session has started
  - the narration voice: id, paused, position
  - the director's `suspended` flag
  - the session phase and `playing`
  - the last 30 breadcrumbs: focus effects, commands applied, interruptions, scans, plays and ends
- Mirror each breadcrumb to native `Log.i` with the tag `InTellAudio`. **No coordinates or marker codes.**
- Add a **"Reset session (keep packs)"** dev button. It stops the audio and location, then clears `session.state.v1` and `director.state.v1`, so a test can restart without `pm clear` and reinstalling the packs.

**F6: stop overwriting the remote handler.**
- Subscribe through `engine.onRemoteCommand` instead of `setRemoteHandler`.
- Forward `stopExploring` through the engine.
- Keep the engine's skip-back.

## The at-home checks before the walk
Run these on the Pixel **with Bluetooth earbuds connected first**. Jordan confirms each one by ear. You can check the engine side first, using the diagnostics and `InTellAudio` logs, while he's away.
- **A1:** Reset session, then scan the QR. Narration is audible within about 2 s, and the diagnostics show the context running, master gain 1, the session started and the narration not paused.
- **A2:** Pause, then Resume, from the overlay. It resumes audibly.
- **A3:** Back 10 s. The count jumps back about 10 s.
- **A4:** Lock the screen. The lock-screen controls pause and play.
- **A5:** Tap **Stop exploring** in the notification. The narration fades and the overlay closes.
- **A6:** Scan again (a second session). It's audible.
- **A7:** Swipe the app away mid-story, then relaunch. There's no stale overlay, and a scan plays again.
- **A8:** During a session, lock the phone for 2 minutes. The location notification is there, and `dumpsys activity services` shows `LocationTaskService` running in the foreground with type `location`.

## Next
1. Commit this review.
2. Fix F1–F6.
3. `pnpm lint`, `typecheck` and `test` must pass, and both CI jobs must be green.
4. Rebuild the release app from a clean prebuild, and reinstall it on the Pixel. The walk packs can stay if the app isn't uninstalled; otherwise, install them again.
5. Do the engine-side pre-checks on your own, then stop and report. Jordan does A1–A8 by ear when he's back.
