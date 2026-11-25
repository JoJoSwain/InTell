# Lane B · B·S3

`audio-session` Expo Module (Media3 + JS focus machine) on `b/bs3-audio-session`. PR [#35](https://github.com/JoJoSwain/InTell/pull/35). Pixel 11 + Beats Studio Buds+, **Android 17**.

Review 3 (Option 2) in `e34a66f`. **T6b and T5 re-check pass by ear** (Jordan, ~21:45–22:00 local).

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
- Pushed `e34a66f`; CI subscribed.
- Release rebuild with `EXPO_PUBLIC_AUDIO_SPIKE=1` installed on Pixel 11.

## Device protocol — Android run 3 (post–review-3 fix)

| # | Result | Notes |
|---|---|---|
| **T7** | **pass** | Media3 shade Pause/Play; metadata OK |
| **T4** | **pass** | BT disconnect pause; shade Play resumes |
| **T5** | **pass** | Call → mix stops; hang-up → **auto-resume** (Jordan ear). FGS survived transient (`isForeground=true` after resume). |
| **T6** | **pass*** | Duck then LOSS; see T6b |
| **T6b** | **pass** | YT hard LOSS → lock-screen Play → audible on Beats within ~3 s; unlocked Play → audible. `MixPlaybackService isForeground=true` (MEDIA_SESSION_CALLBACK WIU); AAudio `started`, `mutedState:none`. |
| **T1** (15 min) | **pass** | clockRate ~1; focus held |

## Proposed for Claude

Review 3 Option 2 is verified on device. **T6b + T5 green.** Stopped for Claude’s check.

## Open

1. Mirror log still not writable on release; use `logcat -s AudioSession` for `contextState after resume`.
