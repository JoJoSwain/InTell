# Lane B · B·S3

`audio-session` Expo Module (Media3 + JS focus machine) on `b/bs3-audio-session`. PR [#35](https://github.com/JoJoSwain/InTell/pull/35). Android **run 3** device protocol completed 2026-11-24 with Jordan (Pixel 11 + Beats Studio Buds+). Review-2 remote-play fix landed; **T6b** setup verified, physical shade Play with Jordan still required for the audible pass (adb cannot inject lock-screen media controls).

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

- `pnpm lint` / `typecheck` / `test` green; CI **check** + **db** green on `5fe0906`.
- Release rebuild with `EXPO_PUBLIC_AUDIO_SPIKE=1` (fresh JS bundle; `requestFocusWithRetry` present in release bundle). Installed on Pixel 11 at 20:08 local.

## Device protocol — Android run 3

| # | Result | Notes |
|---|---|---|
| **T7** | **pass** | Shade Pause/Play work; metadata “InTell audio spike”; MediaStyle + Pause action confirmed in `dumpsys notification` |
| **T4** | **pass** | BT disconnect → pause; reconnect stays paused; Play from shade resumes (B·S2 gap fixed) |
| **T5** | **pass** | Call → full mix stops; hang-up → auto-resume |
| **T6** | **pass*** | YT Music → pause; no auto-resume on close (correct — needs Play). Instagram: first sound **ducked**, second took focus (LOSS). Pixel **AudioHardening** then ignored InTell focus requests → pink “audio busy”. After IG gone, shade Play alone did not restore audible mix; **Start full mix** did. *Duck path observed; fixed in `5fe0906` — see T6b. |
| **T6b** | **setup / pending Jordan** | After `5fe0906` release: Start full mix → YouTube video hard `LOSS` → `intell-mix` **PAUSED**, lock-screen card shows Play (honest paused). Media button session null after YT; adb taps / `media_session dispatch play` do not reach lock-screen Media3 controls. **Jordan:** press Play on the lock-screen card (phone locked), then again unlocked — pass = audio within ~2 s and shade matches what you hear. |
| **T1** (15 min) | **pass** | Same pid `24251`; locked/background; `clockRate` ~0.9998–1.0001; `audioHealth: ok`; `focusHeld: true`; `clockGapMs` ~±30 ms; session still PLAYING at 15 min |

### T6 AudioHardening (for the report)

```
AudioHardening focus request for req 1 ignored for org.replaceplace.intell … level: partial
```

While Instagram held media, Android denied InTell’s re-request. Matches the “audio busy” banner. Review-2 retries after FGS promote are meant to clear this once the other app is gone.

### setWillPauseWhenDucked

`setWillPauseWhenDucked(false)` — first Instagram cue ducked (not pause); longer IG media caused LOSS. T6 “duck, not pause” satisfied by the short cue.

## Artifacts

`docs/spikes/logs/bs3-run3-*.txt` and `bs3-t6b-*.png` (local; `docs/spikes/logs` is gitignored) — media_session + audio dumpsys; T6b screenshots of lock-screen Play after YT LOSS.

## Open questions / follow-ups for Claude

1. ~~After “audio busy” / hard LOSS, shade Play set MediaSession to PLAYING but the mix stayed silent.~~ Addressed in `5fe0906` (intent-only + FGS + focus retry). **T6b audible confirm still needs Jordan’s finger on shade Play.**
2. ~~Spike Start stays disabled when mix is dead after denied resume.~~ Spike now forces `paused` on `audioBusy` so Play stays enabled.
3. Mirror log to external files dir still not writable on release (`ERR_UNEXPECTED`); Share / logcat remain the path. (Not required per review 2.)
