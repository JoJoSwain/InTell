# Lane B · B·S3

`audio-session` Expo Module (Media3 + JS focus machine) on `b/bs3-audio-session`. PR [#35](https://github.com/JoJoSwain/InTell/pull/35). Pixel 11 + Beats Studio Buds+, **Android 17**.

Review 3 (Option 2) implemented in `e34a66f`. **T6b / T5 ear re-check with Jordan still pending** (adb blocked by a stuck NotificationShade; Jordan must dismiss shade and confirm by ear).

## Commits

| Commit | What |
|---|---|
| `31e927b` | Media3 session module + JS focus machine |
| `03ed0ad` | Don’t pause on initial speaker route |
| `a92eb63` | DefaultMediaNotificationProvider |
| `5fe0906` | Review 2: intent-only play + focus retry (wrong under Android 17) |
| `ce968f4` | T6b fail investigation — AudioHardening reason 6 / no FGS |
| `fed05d4` | Review 3: Option 2 Media3 WIU FGS |
| `e34a66f` | **Review 3 fix:** `playWhenReady=true` inside play command; deny → `setPlayback(false)`; keep FGS through `suspendedTransient`; `Log.i` contextState after resume |

## Review 3 implementation

1. **`MixPlayer.handleSetPlayWhenReady(true)`** sets `playWhenReady = true` + `invalidateState()` immediately, then forwards play to JS (Media3 promotes FGS in the WIU window).
2. **JS** keeps focus retry (3×/~500 ms); on deny calls `update("paused")` / `setPlayback(false)` and shows “audio busy”.
3. **`shouldDemoteSessionOnSuspend`:** false for `suspendedTransient` (call / LOSS_TRANSIENT keeps FGS); true for hard LOSS / user pause / noisy (Media3 demotes; session + notification stay).
4. **`AudioSession.logContextState`** → native `Log.i("AudioSession", "contextState after resume: …")` after `ctx.resume()`.
5. Unit tests: remote play deny→paused; success→playing; demote helper for transient vs hard loss.

## Checks

- `pnpm lint` / `typecheck` / `test` green (75 mobile tests).
- Pushed `e34a66f` (includes `ce968f4` + `fed05d4`); CI subscribed.
- Release rebuild with `EXPO_PUBLIC_AUDIO_SPIKE=1` installed on Pixel 11 (~21:16 local).

## Device protocol — Android run 3

| # | Result | Notes |
|---|---|---|
| **T7** | **pass** | Media3 shade Pause/Play; metadata OK |
| **T4** | **pass** | BT disconnect pause; shade Play resumes |
| **T5** | **pass** (run 3) | Call → stop; hang-up → auto-resume. **Quick re-check after `e34a66f` pending Jordan** |
| **T6** | **pass*** | Duck then LOSS; see T6b |
| **T6b** | **fail → fix landed; ear re-check pending** | Was silent after shade Play (reason 6 / no FGS). Fix `e34a66f`. Retest: lock-screen Play then unlocked shade Play — **Jordan confirms by ear**. Adb cannot dismiss stuck NotificationShade. |
| **T1** (15 min) | **pass** | clockRate ~1; focus held |

### Local diagnosis note

`adb shell cmd audio set-enable-hardening throw` available for loud failures; real T6b/T5 use the default hardening setting.

## Proposed / done for Claude

Review 3 Option 2 is in `e34a66f`. Stopped for Claude after code + rebuild; **waiting on Jordan for T6b ear + quick T5** before calling those green.

## Open

1. Jordan: swipe shade closed → Start mix → YT LOSS → lock-screen Play (ear) → unlocked shade Play (ear) → quick call/hang-up (T5).
2. Mirror log still not writable on release; use `logcat -s AudioSession` for `contextState after resume`.
