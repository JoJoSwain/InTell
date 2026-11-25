# Lane B · B·S3

`audio-session` Expo Module (Media3 + JS focus machine) on `b/bs3-audio-session`. PR [#35](https://github.com/JoJoSwain/InTell/pull/35). Android **run 3** device protocol completed 2026-11-24 with Jordan (Pixel 11 + Beats Studio Buds+). Review-2 remote-play landed (`5fe0906`). **T6b = fail** (Jordan: Beats silent after shade/lock Play; audible only after opening the spike and tapping resume). Investigation below — **no code change yet; stop for Claude**.

## Commits

| Commit | What |
|---|---|
| `31e927b` | Media3 `SimpleBasePlayer` session module, FGS, focus/noisy/route; JS focus machine; library session off; spike wiring; M6 rules |
| `03ed0ad` | Don’t pause on the *initial* speaker route emit |
| `a92eb63` | Claude review: `DefaultMediaNotificationProvider` (drop hand-built notification); `playWhenReady` before `addSession`; log FGS refusals |
| `5fe0906` | Review 2: remote play after hard LOSS — FGS promote → focus retry (3×/~1.5 s) → 1 s fade-in; MixPlayer intent-only until JS `setPlayback(true)`; denied → paused + “audio busy” + `[AudioHardening]` log; gain clears busy; unit tests |

## Implementation (review wins)

- Media3 `MediaSession` + `SimpleBasePlayer`; Compat not needed.
- JS focus machine modes unit-tested (`focusMachine.test.ts`).
- Module sole route owner; `AudioManager.disableSessionManagement()`; no library interruption/notification/route listeners.
- App icon artwork + small icon; skip-back with no narration = no-op; focus denied → “audio busy”; session kept while paused; FGS from Start; notification permission from Start.
- After Claude’s code review: Media3 default media notification (IMPORTANCE_LOW), not a plain `NotificationCompat`.
- After review 2: `MixPlayer.handleSetPlayWhenReady(true)` forwards intent only; `MixPlaybackService.ensureForegroundForRemotePlay()` before JS focus; `requestFocusWithRetry`; spike stays paused with Play enabled on deny.

## Checks

- `pnpm lint` / `typecheck` / `test` green; CI **check** + **db** green on tip.
- Release rebuild with `EXPO_PUBLIC_AUDIO_SPIKE=1`. Device: Pixel 11, **Android 17 / API 37**.

## Device protocol — Android run 3

| # | Result | Notes |
|---|---|---|
| **T7** | **pass** | Shade Pause/Play work; metadata “InTell audio spike”; MediaStyle + Pause action confirmed in `dumpsys notification` |
| **T4** | **pass** | BT disconnect → pause; reconnect stays paused; Play from shade resumes (B·S2 gap fixed) |
| **T5** | **pass** | Call → full mix stops; hang-up → auto-resume |
| **T6** | **pass*** | YT Music → pause; IG duck then LOSS; AudioHardening focus deny → “audio busy”. See T6b. |
| **T6b** | **fail** | After `5fe0906`: shade/lock Play after YT LOSS sets MediaSession **PLAYING** + focus held + AAudio `started`, but **Beats stay silent**. Sound returns only after reopening the spike and tapping in-app resume (app becomes TOP). Earlier “pass” was instrumentation-only — Jordan contradicted audible. |
| **T1** (15 min) | **pass** | Same pid `24251`; `clockRate` ~0.9998–1.0001; `audioHealth: ok`; focus held. |

---

## T6b silent-mix investigation (2026-11-24 ~21:00) — evidence only

Phone: Pixel 11, **Android 17**, Beats Studio Buds+. No code changes in this pass.

### (1) `dumpsys audio` — player / mute / hardening

From the silent shade-Play window (pid `14034`, AAudio `piid:15687`) and follow-up dumps:

| Observation | Evidence |
|---|---|
| InTell AAudio exists | `type:AAudio u/pid:10384/… state:started … deviceIds:[6858] mutedState:none` (BT device 6858) |
| On YT LOSS | `player piid:15687 event:paused` (~20:44:26) |
| On shade Play | `event:started` again (~20:50:19 / 20:50:50); `muted updated source:none` — **not** `opControlAudio` / call mute |
| Focus | `requestAudioFocus()` from InTell **succeeds** at shade Play; stack shows InTell `GAIN` |
| **AudioHardening** | Repeated: `AudioHardening background playback would be muted for org.replaceplace.intell (10384), level: partial, reason: 6, usage: USAGE_MEDIA` — and at 21:00:00 also `level: full, reason: 6` |
| Call/device mute lists | Empty for InTell (`muted player piids due to call/ring` / `awaiting device connection` empty) |

**Reason 6** (Android 17 background-audio hardening): app is **not** in a valid foreground lifecycle for `USAGE_MEDIA` (no qualifying FGS / not visible). Playback APIs then **fail silently** (no exception). Matches “session PLAYING + focus + AAudio started, but no sound.”

Docs: https://developer.android.com/about/versions/17/changes/bg-audio

### (2) AudioContext after resume

- Release strips `console.log`; spike log mirror under external files is empty (`ERR_UNEXPECTED` / unused) — **no direct `contextState` / `ctx.resume()` throw line from the silent window.**
- Infer: JS remote-play path ran (`requestAudioFocus` + MediaSession → PLAYING via `setPlayback(true)`). `resumeAfterFade` calls `await ctx.resume()` and only `console.warn`s on throw — if resume threw we’d likely still see AAudio not restart; AAudio **did** `started`.
- Opening the spike (TOP) + in-app resume restores audio → consistent with hardening clearing when the activity is visible, not with a stuck permanent suspend alone.

### (3) AAudio / Oboe stream on LOSS

- Same `piid` **paused** on LOSS, then **started** on shade Play — stream was **not** left permanently closed/disconnected.
- No Oboe/AAudio disconnect errors in the shade-Play logcat slice tied to silence.
- **Reopening the stream alone is unlikely the root fix**; the OS already shows `started` + `mutedState:none` while Jordan hears nothing (hardening silent mute).

### (4) clockRate / contextTime

- During the false “pass”, MediaSession `position` advanced while PLAYING (e.g. ~2939 → ~23961 over ~2 s) with focus held — JS/tick/`contextTime` likely advancing.
- That fits **graph running / session honest PLAYING while AudioHardening mutes the output** in the background.

### Process / FGS (why reason 6)

After YT took the activity away, InTell was observed as:

- `curProcState` cached (`CAC` / `cch-act`), **`isFrozen=true`**
- **Not** `BFGS` (bound/foreground service)
- `MixPlaybackService` not keeping the process in a mediaPlayback FGS while paused

Review-2 made `handleSetPlayWhenReady(true)` **intent-only** (`playWhenReady` stays false until JS confirms). Media3 demotes the media FGS when not playing. `ensureForegroundForRemotePlay()` calls `onUpdateNotification(session, true)`, but with `playWhenReady=false` Media3 can demote again before/while JS `ctx.resume()` runs in the background — exactly when Android 17 requires a WIU mediaPlayback FGS.

Merged release manifest **does** declare `expo.modules.audiosession.MixPlaybackService` with `foregroundServiceType="mediaPlayback"` (plus library `CentralizedForegroundService`). Declaration is fine; **lifecycle while paused / remote resume** is the gap.

---

## Proposed fix (for Claude — do not implement until approved)

**Preferred:** Keep the mediaPlayback FGS up for the whole mix session, including while paused (user pause, LOSS, noisy). Shade/lock Play then resumes into an already-valid FGS so AudioHardening allows background `USAGE_MEDIA`. Concretely, either:

1. Stop relying on Media3’s playWhenReady-driven demote for our case — e.g. own `startForeground` / don’t demote on pause while the exploring/spike session is active; or  
2. On remote play, set `playWhenReady=true` (or otherwise force lasting FGS) **before** JS `requestFocus` + `ctx.resume()`, and only then fade in — accepting a brief “playing” shade state, or using a dedicated “resuming” path that still satisfies Media3’s FGS promotion rules.

**Secondary (if still silent after FGS sticks):** verify `ctx.state === "running"` after background `resume()` (log via spike file / non-stripped warn), and if needed re-create/re-open the react-native-audio-api output after LOSS.

**Not sufficient alone:** focus retry + intent-only MixPlayer (already in `5fe0906`) — they get PLAYING + focus without audible output under Android 17 reason 6.

## Artifacts

Local (gitignored): `docs/spikes/logs/t6b-inv*.txt`, `t6b-retest-*.png`, prior `bs3-run3-*.txt`.

## Open questions / follow-ups for Claude

1. T6b fail root cause: Android 17 AudioHardening **reason 6** (no qualifying FGS) while remote resume runs in background — confirm preferred FGS-while-paused vs early `playWhenReady` approach.
2. Spike Start disabled-when-dead UX — already mitigated with `paused` on `audioBusy`.
3. Mirror log still not writable on release; need a reliable way to capture `contextState`/`clockRate` after background resume (Share, or logcat-backed native log).
