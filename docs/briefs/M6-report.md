# Lane B · M6 report (review 5 RC6 + ear suite)

Branch `b/m6-narration-session` @ `5957fec` (RC6 + Log.w + out meter + analyser side-tap). **Stopped after A1/A2 engine fail on out level.**

## Review 5

| Item | Status |
|---|---|
| Commit `docs: M6 review 5 (Claude)` | `6564539` |
| **RC6** current engine voice id; ignore replaced `cancelled`; engine narration `onended` uses `pendingReleaseReason`; fake emits `voiceEnded` on replace; tests | `b4b6aa9` |
| **InTellAudio** → `Log.w` + proguard keep; confirmed `adb logcat -s InTellAudio` shows crumbs | Done |
| **out=** AnalyserNode RMS on master + Data `out=` + breadcrumb every 5 s | Done (side-tap so analyser is not on the critical path: `5957fec`) |
| lint / typecheck / test | Green (115 mobile tests) |
| Push | `5957fec` on origin |
| Release rebuild + `adb install -r` (packs kept) | Done |

## Ear suite (Pixel `67090DLKY005KL`, Beats A2DP, adb scans)

| Step | Result |
|---|---|
| **A1** | **FAIL (engine).** Reset → `adb` `intell://f/WTQR0001` → MediaSession `intell-mix` **PLAYING** “Walk 2 QR”, AAudio **started**, route **bt_a2dp**, InTellAudio: `scan` + `handlePlay:start ok=true`. But **`out=-100 dB` every 5 s**, Data often **`narration: none`** / **`master=0.000`** while overlay still shows Pause / Walk 2 QR. Not meeting out > −40 dB. Jordan ear: treat as not proven. HBO Max Cast session still listed PLAYING (could not fully clear). |
| **A2** | **FAIL.** Overlay Pause → Resume: master returned to **1.000**, MediaSession still PLAYING, but **`narration: none`** and **`out=-100 dB`** — no audible restore. |
| **A3–A9** | **Not run** (stopped after A1/A2 fail). |

## Open for Claude

1. Why `handlePlay` succeeds and MediaSession advances while `getNarrationDiag()` is `none` and master/out stay silent.
2. Whether Cast/HBO Max / AudioHardening is still stealing the mix despite bt_a2dp + InTell PLAYING.
3. Analyser RMS always −100 even with `master=1` — confirm tap vs real render.
4. Zombie `playing=true` with no narration voice after RC6 `cancelled` ignores.

## Commands

- `pnpm lint && pnpm typecheck && pnpm test` — green  
- `gradlew :app:assembleRelease` (walk env `EXPO_PUBLIC_ALLOW_LOCAL_CLEARTEXT=1`) — success  
- `adb install -r` — success  
