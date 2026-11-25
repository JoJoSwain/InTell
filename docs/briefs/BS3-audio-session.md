# B·S3 brief (Lane B): the `audio-session` module (Android), then re-run T4–T7 and T5

**Lane:** B (Mobile) · **Branch:** `b/bs3-audio-session`, cut from `master` after PR #34 (B·S1 + B·S2) merges. This brief is its first commit. · **Plan first:** write `docs/briefs/BS3-plan.md`, push, open the PR, and stop for Claude's plan review.

**Why:** ADR 0001 is now **accepted for Android as the renderer, with a native session module**. B·S2 proved the mixing graph: a clean, locked hour. What failed was the platform session:
- no resume after a phone call, another app's audio, or reconnecting earbuds
- lock-screen and earbud controls that do nothing
- `react-native-audio-api`'s focus handling drops `duck`, reports `shouldResume: false` on transient losses, and sends no `ended` after a call

B·S3 builds a small Expo Module that owns the Android audio session properly, wires the spike to it, and re-runs the session tests.

**Sources:**
- ADR 0001: the decision after Android run 2, the architecture and the M6 rules
- `docs/briefs/BS2-report.md`, `BS2-review.md`, and the run 2 logs
- AUDIO_SPEC v4 §2.1 (interruptions, lock-screen controls, route detection)
- A6's AudioDirector: the `interruption { phase, shouldResume }`, `settings.route` and `assetFailed` inputs; the `suspend` and `resume` commands
- Android's audio focus, `MediaSession` (Media3 `MediaSession` or `MediaSessionCompat`), media-style notification, `ACTION_AUDIO_BECOMING_NOISY`, and foreground service type `mediaPlayback`

## The module: `apps/mobile/modules/audio-session` (Expo Module, Kotlin)
**1. Audio focus.**
- `requestFocus()` and `abandonFocus()`, using `AudioFocusRequest` with usage `MEDIA` and content type `SPEECH`.
- Emit `focusChange { kind, shouldResume }` with the full mapping:

  | Android focus change | `kind` | `shouldResume` |
  |---|---|---|
  | `LOSS` | `"loss"` | `false` |
  | `LOSS_TRANSIENT` | `"lossTransient"` | `true` |
  | `LOSS_TRANSIENT_CAN_DUCK` | `"duck"` | — |
  | `GAIN` | `"gain"` | — |

- Re-request focus on every resume.

**2. `MediaSession`, the notification and the foreground service.**
- One session for the whole mix.
- Controls: play, pause, and skip back 10 s. Skip forward stays off for now.
- Metadata: title, artist and artwork.
- The playback state must match reality.
- The media-style notification shows a working **pause/play** control, on the lock screen as well.
- Earbud and Bluetooth media buttons route through the session.
- Run a foreground service of type `mediaPlayback` while a session is active, and stop it when the session ends.
- Emit `remote { command }`.

**3. Becoming noisy.** Emit `noisy` on `ACTION_AUDIO_BECOMING_NOISY`. Also emit route events (headphones, Bluetooth or speaker), carrying the device type.

**4. A JS API:**
- `start(meta)`, `update(meta, state)`, `stop()`
- `requestFocus()`, `abandonFocus()`
- event subscriptions
- typed in TypeScript

UI code never imports it directly. It goes through `apps/mobile/src/audio/`, the same rule as the engine.

**5. Turn off the library's session layer:** `AudioManager.disableSessionManagement()`, stop using `PlaybackNotificationManager`, and stop calling `observeAudioInterruptions`. There should be exactly one owner of focus and the notification.

## Wire the spike to it
- **Focus:**
  - `lossTransient` → fade and suspend; the following `gain` → resume, 1 s fade-in, from the narration's breath point.
  - `loss` → fade and suspend; resume only on a user command, then re-request focus.
  - `duck` → lower the master by 10 dB; `gain` → restore it.
- **`remote` play and pause:**
  - Play must work after any pause: a route change, an interruption or the user. Fix the B·S2 gap where Start stayed disabled until Stop→Start.
  - Back skips 10 s.
- **`noisy`:** pause and never auto-resume (wildlife safety). Pressing play after reconnecting resumes.
- **The M6 engine rules from B·S2**, applied in `RNAudioApiEngine`:
  - Delay `disconnect` until after `onEnded`, or at least one quantum after `stop`.
  - Never connect a source into the live graph as a side effect of preloading.
  - Cancel an overlapping automation curve before scheduling a new one.

## Tests
- **Unit tests** for the JS layer: the event mapping, and resume and pause in the spike's state logic.
- **Device re-run, with Jordan** (release build, same setup as B·S2):
  - **T4:** unplug → pause; reconnect → stays paused; play from the lock screen, then the earbuds, then the notification → each resumes within about 1 s.
  - **T5:** a call pauses; hanging up resumes automatically from the breath point.
  - **T6:**
    - A song in another app → pause.
    - A brief notification sound → a duck, not a pause.
    - Stop the other app's audio and return → press play → it resumes and regains focus.
  - **T7:** the lock screen shows the title and working pause and play controls; the audio is clean.
  - **A 15-minute locked T1 check,** to confirm no regression in clock rate or underruns.
- Record an **"Android run 3"** column in `M1-audio-test-results.md` and a dated ADR 0001 bullet. Don't change the Status.

## Out of scope
- The real AudioDirector wiring (that's M6)
- iOS (Swift, once there's an Apple Developer account)
- Bed streaming (M7)

## Plan (stop after this)
`docs/briefs/BS3-plan.md` covers:
- the module's API and events
- the Kotlin structure (focus listener, the session, the service, the noisy receiver)
- the manifest and config-plugin changes
- how the library's session layer is turned off
- the spike wiring
- the test plan
- risks (Android 14+ foreground service rules, notification permission)

Push with `git push -u origin b/bs3-audio-session`, open a PR titled "B·S3: audio-session module (plan)", and **stop for plan review.**
