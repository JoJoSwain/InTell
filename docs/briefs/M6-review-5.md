# M6 review 5 (Claude): the silence after any resume (root cause), and a faster path to the walk

**Verdict:** one deterministic bug explains Jordan's silence in the runs where a narration actually started. The 14:31 attempt is a different problem: the camera never opened the app. Fix RC6 below, then run the at-home sequence with Jordan right away. You don't need to wait for my code review to test on the phone. I review the diff in parallel.

## RC6 (certain): a replaced narration voice ends the session's narration
`ExploringRuntime.onVoiceEnded` treats **any** narration voice that ends as the session's narration ending. It dispatches `narrationEnded` (`natural` when the engine says `"ended"`, otherwise `interrupted`) without checking that it's the **current** voice.

But the engine replaces the narration voice in normal use:
- **After every interruption ends,** the director deliberately remounts the narration at `resumePointMs` and emits a new `playNarration`. The engine's `playNarration` calls `stopNarrationInternal`, which stops the old voice, and the old voice's `onended` calls `releaseVoice(id, "ended")`.
- **Back 10 s** (`seekNarration`) also starts a new narration voice and stops the old one.

**So:** a pause and resume, an earbuds connect or disconnect (a transient focus loss), a call, or Back 10 s →
- the old voice ends
- the runtime dispatches `narrationEnded`
- the session clears `playing` and emits `stopNarration`
- the director stops the **new** voice

The result is **silence**, while AAudio stays `started` on the heartbeats.

**This matches the 14:28 timeline exactly:**
- 14:28:26: playback started on the speaker.
- 14:28:36–39: the Beats connected (the SCO/A2DP flap).
- 14:28:47: paused.
- 14:28:49: resumed. Focus was re-requested twice, and the player started on BT device 9717, unmuted.
- Then silence for 48 s.

It also explains why your engine-only check looked fine: with no interruption, there's no remount. And the existing fake engine doesn't emit `voiceEnded` for a voice it replaces, so the tests couldn't catch it.

**The fix:**
1. **Only the current narration voice can end the session's narration.**
   - The runtime keeps the **engine voice id** of the current narration. Today `narrationVoiceId` stores the director's command id, which never equals the engine's voice id.
   - Update it on every `playNarration`, remount and seek.
   - In `onVoiceEnded`, ignore any narration voice that isn't current. Still forward it to the director, as now.
2. **The engine labels explicit stops.** A voice stopped by `stop` / `stopNarrationInternal` / a replacement is released with reason `"cancelled"`, never `"ended"`. Only a voice that reaches its natural end reports `"ended"`.
3. **Tests:** the fake engine must mimic the real one, emitting `voiceEnded` for a voice it replaces.
   - play → interruption began → ended (director remount) → the session is still `playing`, and the new voice is live
   - play → Back 10 s → the session is still `playing`
   - play → pause → resume (user and remote) → still `playing`
   - natural end → exactly one `narrationEnded(natural)` → completion → afterglow

## Also do these now
- **The `InTellAudio` logcat tag is empty in release.** The release build very likely strips `Log.i` (R8 or `-assumenosideeffects` rules). Log breadcrumbs with **`Log.w`**, check `proguard-rules.pro` for any `android.util.Log` stripping, and confirm `adb logcat -s InTellAudio` shows lines.
- **Add an output level reading** to Audio diagnostics. Put an `AnalyserNode` on master and show the RMS in dBFS, refreshed on each tick, plus a breadcrumb `out=-NN dB` every 5 s while a narration is live. Then "the engine is rendering sound" is proven without anyone's ear. Narration should read roughly −35 to −15 dB; silence is about −90 dB or lower.

## The camera never opened the app at 14:31
Between the reset (14:31:25) and the capture (14:33:42) there's no `intell://f/` START. The camera was active from 14:31:43 to 14:32:52, but the link was never opened. That's the camera step, not our code. **For the at-home checks, trigger scans with adb** (`adb shell am start -a android.intent.action.VIEW -d "intell://f/WTQR0001" org.replaceplace.intell`). Test the camera QR once at the end. On the trail, Jordan taps the link chip the camera shows; if it doesn't show one, Google Lens does.

## The at-home sequence
Do this with Jordan immediately after the fix: release build on the Pixel, earbuds **connected before** starting, and HBO Max casting stopped. You drive with adb and read the diagnostics and output level; Jordan listens. One line per step in the report:
- **A1:** Reset session → adb scan → audible, out > −40 dB.
- **A2:** Overlay Pause → Resume → audible again within about 1 s, and the same story continues.
- **A3:** Back 10 s → the count jumps back about 10 s and keeps playing.
- **A4:** Lock the screen → lock-screen pause and play work.
- **A5:** Earbuds out of the case and back in, or BT off and on, mid-story → it pauses, then Resume plays.
- **A6:** Stop exploring (notification) → fades and ends. adb scan again → audible.
- **A7:** Swipe the app away mid-story → relaunch → no stale overlay → adb scan → audible.
- **A8:** During a session, lock the phone for 2 min → the location notification is present, and `LocationTaskService` is in the foreground with type `location`.
- **A9 (last):** Camera QR from the PC screen → the app opens and plays.

## Next
1. Commit this review.
2. Fix RC6, the `Log.w` change and the output meter.
3. `pnpm lint`, `typecheck` and `test` must pass. Push. CI can finish while you test.
4. Rebuild the release app and install it (keep the walk packs).
5. Run A1–A9 with Jordan now.
6. Report the results, one line each, and STOP. If A1–A8 pass, Jordan can walk.
