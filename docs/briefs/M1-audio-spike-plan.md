# M1 audio spike — implementation plan (architect review)

**Status:** awaiting architect approval — **no code edits yet**  
**Brief:** `docs/briefs/M1-audio-spike.md` (repo)  
**Repo tip preferred:** `origin/master` @ `db19f3a` (M0 merge)  
**Expo SDK:** 58 (`apps/mobile`)  
**Library under test:** `react-native-audio-api` (Software Mansion) — **not installed yet** in this workspace; docs below are from the published package **npm `1.0.1`** and https://docs.swmansion.com/react-native-audio-api/ (Latest). After `pnpm exec expo install`, re-check the installed version’s docs before coding.

---

## 1. Precondition checks

| # | Check | Result |
|---|---|---|
| 1 | M0 on `origin/master` contains `dd6a6f7` | **PASS** — `git merge-base --is-ancestor dd6a6f7 origin/master` → yes. Tip is `db19f3a Merge pull request #1 from JoJoSwain/cursor/intell-v2-m0-scaffold-8134`. |
| 2 | `remote.origin.fetch` tracks all branches | **PASS** — `+refs/heads/*:refs/remotes/origin/*` |
| 3 | Working tree clean apart from this brief | **PASS** — only untracked: `docs/briefs/M1-audio-spike.md` |
| 4 | `git switch -c m1-audio-spike origin/master` + commit brief | **DEFERRED** — this assignment forbids commits/code edits until after architect review of this plan. Ready to run as first implementation step once approved. |

**Verdict:** Preconditions 1–3 pass. Proceed with plan for review. Do **not** treat implementation as started.

---

## 2. Capability findings (Part B.1)

Sources: official docs the package homepage points to (`https://docs.swmansion.com/react-native-audio-api/`), not a local `node_modules` tree (package absent until install).

### 2.1 Background playback (screen locked)

**Supported by the library + its Expo config plugin — no extra module proposed.**

| Piece | Docs | What we use |
|---|---|---|
| Expo plugin | [Audio API Expo plugin](https://docs.swmansion.com/react-native-audio-api/docs/other/audio-api-plugin/) | `iosBackgroundMode: true` → `UIBackgroundModes: ["audio"]`; `androidForegroundService: true` + `androidFSTypes: ["mediaPlayback"]`; Android permissions `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_MEDIA_PLAYBACK`, plus **`POST_NOTIFICATIONS`** on Android 13+ (docs call this out for FGS notifications) and `MODIFY_AUDIO_SETTINGS` |
| Session category | [AudioManager](https://docs.swmansion.com/react-native-audio-api/docs/system/audio-manager/) | `AudioManager.setSystemOptions({ ios: { category: 'playback', mode: 'default', … } })` — matches `init({ mixWithOthers: false })` |
| Keep Android alive | Plugin note + [best practices](https://docs.swmansion.com/react-native-audio-api/docs/fundamentals/best-practices/) | Foreground service exists **while a library notification is shown**. Spike must call `PlaybackNotificationManager.show(...)` when the full mix starts so locked-screen Android playback is protected |
| Single context | [best practices](https://docs.swmansion.com/react-native-audio-api/docs/fundamentals/best-practices/) | One `AudioContext`; `resume()` before play; prefer `suspend`/`resume` over recreate for long sessions |

**Do not** add a separate `location` background mode (brief: audio only).

### 2.2 Lock-screen / now-playing controls

**Supported in-library via `PlaybackNotificationManager` — no extra module proposed.**

| Piece | Docs |
|---|---|
| API | [PlaybackNotificationManager](https://docs.swmansion.com/react-native-audio-api/docs/system/playback-notification-manager/) |
| Metadata | `show({ title, artist, artwork?, duration, state, elapsedTime, skipInterval })` → spike: title `"InTell audio spike"`, artist `"Test"` |
| Remote commands | Events: `playbackNotificationPlay` / `Pause` / `NextTrack` / `SkipForward` / `SkipBackward` / `SeekTo` / `Stop` / `Dismissed`. Map into brief’s `onRemoteCommand('play' \| 'pause' \| 'skipForward' \| 'skipBackward' \| 'next')` |
| iOS visibility | Controls appear only while `AudioContext` is **running**; pause UI needs `suspend()` (not only metadata `state: 'paused'`) — [best practices](https://docs.swmansion.com/react-native-audio-api/docs/fundamentals/best-practices/) |
| Android visibility | Driven by `show()` / `hide()`; required for FGS / background |

Also claimed in the comparison table: [Why React Native Audio API?](https://docs.swmansion.com/react-native-audio-api/docs/fundamentals/why-react-native-audio-api/) (lock screen + background ✅).

### 2.3 Route changes

**Events exist; clean `headphones | bluetooth | speaker` enum does not — mapping is our job. Gap on Android outputs.**

| Piece | Docs |
|---|---|
| Events | [AudioManager](https://docs.swmansion.com/react-native-audio-api/docs/system/audio-manager/) — `addSystemEventListener('routeChange', …)` with reasons: `NewDeviceAvailable`, `OldDeviceUnavailable`, `CategoryChange`, `ConfigurationChange`, etc. |
| Device inventory | `getDevicesInfo()` → `availableOutputs` / `currentOutputs` (iOS), inputs on both |
| **Android caveat** | Docs: **`currentOutputs` is always empty on Android.** Route classification for T4 on Pixel cannot rely on `currentOutputs`. Plan: on `routeChange`, re-query `getDevicesInfo()`, classify from `availableOutputs` / device `category` / name heuristics, and fall back to `'unknown'`. If that proves unreliable on device, **stop and ask** before adding another module (e.g. a tiny Expo Module or `expo-av` session probe) — do not add now. |

### 2.4 Interruptions (calls, other apps)

**Supported in-library — no extra module proposed.**

| Piece | Docs |
|---|---|
| Enable | `AudioManager.observeAudioInterruptions(true)` — on Android prefer focus type `'gain'` for long-form playback ([AudioManager](https://docs.swmansion.com/react-native-audio-api/docs/system/audio-manager/)) |
| Events | `addSystemEventListener('interruption', e => …)` with `e.type: 'began' \| 'ended'` and `e.shouldResume` |
| Policy | [best practices](https://docs.swmansion.com/react-native-audio-api/docs/fundamentals/best-practices/): pause on `began`; on `ended` resume only if `shouldResume`; short ~1 s delay before resume |
| Spike mapping | Map to `onInterruption('began' \| 'ended')`; log `shouldResume` in JSONL even if interface omits it |

### 2.5 Extra modules?

| Capability | Extra module needed? |
|---|---|
| Background playback | **No** — config plugin + notification |
| Lock-screen controls | **No** — `PlaybackNotificationManager` |
| Route changes | **No for v1 of spike** — map library events; escalate if Android classification fails on Pixel |
| Interruptions | **No** — `AudioManager` |

**Allowed install set (per brief):** `react-native-audio-api`, `expo-dev-client`, `expo-file-system` via `pnpm exec expo install`. Nothing else without approval.

---

## 3. Implementation plan (after approval)

### Phase 0 — branch hygiene
1. `git fetch origin`
2. `git switch -c m1-audio-spike origin/master`
3. Commit brief only: `docs: add M1 audio spike brief` (`docs/briefs/M1-audio-spike.md`)
4. Then implementation commits in logical chunks (interface → engine → fixtures → screen → ADR draft → build notes)

### Part A — shared interface & helpers (`packages/shared`)
- Add `packages/shared/src/audio/AudioEngine.ts` with the **brief’s** interface (supersedes the shorter sketch comment in AUDIO_SPEC §2.2 for location/shape).
- Export from `packages/shared/src/index.ts`.
- Pure helpers + Vitest:
  - `dbToGain`, `gainToDb`, `equalPowerCrossfade(t)` → `{ fromGain, toGain }`
  - `DuckingPolicy` per AUDIO_SPEC §2.3 (defaults, duck amounts, 800 ms attack / 2500 ms release, speaker surroundings −6 dB)
- No RN imports in shared.

### Part B — mobile engine (`apps/mobile/src/audio/engine/`)
1. Install deps; pin versions expo resolves; re-read installed README / docs version.
2. `app.json` plugin entry (see §4).
3. `RNAudioApiEngine`:
   - One `AudioContext`; bus `GainNode`s (`story` / `music` / `surroundings` / `ui`) → master → destination; try `DynamicsCompressorNode` at −1 dBFS if available, else conservative gains.
   - Narration + `PlaybackNotificationManager` metadata/progress.
   - One-shots: `StereoPannerNode` + playback rate.
   - Loop groups: shared `startTime` for stem alignment; expose `maxStemDriftMs` in diagnostics.
   - Bed crossfade via equal-power automation.
   - LRU decode cache by sha (64 MB).
   - Ducking via `DuckingPolicy` on narration start/stop (+ afterglow not required for spike UI, but policy should encode release timing).
4. ESLint `no-restricted-imports` blocking `react-native-audio-api` outside `src/audio/engine/`.

### Part C — fixtures (`tools/audio-fixtures/`)
- Node/TS script, **no new deps**, write 44.1 kHz WAV to `apps/mobile/assets/spike-audio/`.
- Library **decodes WAV natively** ([Decoding](https://docs.swmansion.com/react-native-audio-api/docs/utils/decoding/)) — **no AAC conversion** unless device decode fails.
- Files per brief table; README stating synthetic fixtures; total &lt; 25 MB.

### Part D — hidden test screen
- `apps/mobile/app/dev/audio-spike.tsx`, `__DEV__` only, deep link `intell://dev/audio-spike`, no chrome links.
- Controls + 1 Hz diagnostics readout per brief.

### Part E — JSONL logging
- Append to `FileSystem.documentDirectory + 'audio-spike-log.jsonl'`; Share sheet button; no memory SDK.

### Part F — builds
- **Android (required):** delete stale gitignored `android/` if present → short-path `subst R:` if needed → `pnpm exec expo prebuild --platform android --clean` → `pnpm exec expo run:android`. Document path strategy.
- **iOS:** ensure `eas.json` `development` profile is device-ready; document JoJo steps (`eas device:create`, `eas build --profile development --platform ios`). **Do not run credentialed EAS.**

### Part G — ADR + results template
- `docs/adr/0001-audio-engine.md` — **Proposed (awaiting device results)** with empty Appendix A table.
- Copy protocol to `docs/spikes/M1-audio-test-results.md`.

### Verification
- `pnpm lint && pnpm typecheck && pnpm test` green before calling code phase done.

---

## 4. Native config changes (planned)

In `apps/mobile/app.json` `expo.plugins`, add (exact strings subject to installed plugin schema):

```json
[
  "react-native-audio-api",
  {
    "iosBackgroundMode": true,
    "androidForegroundService": true,
    "androidFSTypes": ["mediaPlayback"],
    "androidPermissions": [
      "android.permission.MODIFY_AUDIO_SETTINGS",
      "android.permission.FOREGROUND_SERVICE",
      "android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK",
      "android.permission.POST_NOTIFICATIONS"
    ]
  }
]
```

- **Omit** `iosMicrophonePermission` (spike does not record).
- Do **not** hand-edit `ios/` / `android/`.
- Runtime: request notification permission on Android 13+ before `PlaybackNotificationManager.show` (via library `AudioManager.requestNotificationPermissions()`), gated to the spike screen / engine init — **not** a location permission.
- `eas.json`: keep `development.developmentClient: true`; confirm physical-device distribution settings when documenting iOS steps (may need `ios.simulator: false` explicit if defaults are ambiguous — verify at implement time).

---

## 5. Fixture approach

| Approach | Choice |
|---|---|
| Generator | Small TS/Node script under `tools/audio-fixtures/` writing PCM WAV headers + samples |
| Sample rate | 44.1 kHz |
| Format | WAV (library supports wav without FFmpeg) |
| Content | Brief Part C (tone+beeps narration; 32.000 s click-aligned stems; seamless noise beds; short chirps) |
| Output | `apps/mobile/assets/spike-audio/` + README |
| Load path | `require()` / `decodeAudioData` asset module id (wav supported for bundled assets) |

---

## 6. Spec ambiguities / decisions to confirm

1. **Interface home:** Brief (decisions already made) → `packages/shared`. AUDIO_SPEC §2.2 comment still shows `apps/mobile/src/audio/engine/AudioEngine.ts`. Plan follows **brief**; ADR/AUDIO_SPEC path comment should be updated when ADR is written.
2. **BUILD_PLAN vs brief on fallback:** BUILD_PLAN says build Expo Module fallback if checks fail; brief says **do not** build fallback in this brief — record Rejected in ADR and stop. Plan follows **brief**.
3. **Android route → `AudioRoute`:** No first-class API. Approve heuristic mapping + `'unknown'`, with escalate-if-fail?
4. **`POST_NOTIFICATIONS`:** Required for reliable Android FGS notification on API 33+. Approve adding to plugin permissions + runtime request on spike start?
5. **Pause semantics vs continuous mix:** Lock-screen pause likely needs `AudioContext.suspend()` (silences all buses). Confirm that is acceptable for T7 (vs suspending only narration).
6. **Unplug headphones:** AUDIO_SPEC / protocol: “playback continues (or pauses on unplug, per the spec)”. Spec §2.1 doesn’t define pause-on-unplug. Propose: **continue** on route change unless OS interruption fires; log route only.
7. **Afterglow (8 s):** AUDIO_SPEC §5 — out of scope for AudioDirector; should `DuckingPolicy` expose afterglow constants now or only attack/release?
8. **Underruns:** Expose only if library provides a signal; otherwise omit / always `undefined` in diagnostics.
9. **EAS `projectId`:** `app.json` still has `replace-with-eas-project-id`. iOS cloud build needs a real project — JoJo must supply/configure; document as blocker for Part F iOS only.
10. **Branch name:** Brief wants `m1-audio-spike`; cloud-agent default prefix differs. Prefer brief name `m1-audio-spike` from `origin/master` once approved.

---

## 7. Risks (for ADR / device protocol)

- 60‑minute locked Android depends on notification + FGS remaining up.
- Stem drift ≤ 5 ms is the hard library proof; schedule with one `AudioContext.currentTime` anchor.
- Memory &lt; 150 MB: keep LRU disciplined; fixtures modest; avoid retaining decoded copies twice.
- iOS lock-screen pause/play coupled to context suspend/resume — easy to get wrong; test early on device.

---

## 8. Stop point

**No code, installs, commits, or device builds until architect approves this plan** (and any answers to §6). Next message after approval should start at Phase 0.
