# Lane B · B·S3

`audio-session` Expo Module (Media3 + JS focus machine) on `b/bs3-audio-session`. PR [#35](https://github.com/JoJoSwain/InTell/pull/35). **Full device protocol (T4–T7 + 15‑min T1) not finished** — phone left mid-run; resume when Jordan returns.

## Commits

| Commit | What |
|---|---|
| `31e927b` | Media3 `SimpleBasePlayer` session module, FGS, focus/noisy/route; JS focus machine + tests; library session disabled; spike wiring; M6 disconnect / MediaElement connect / curve cancel |
| `03ed0ad` | Don’t pause on the *initial* speaker route emit (was suspending the mix right after Start) |

## Implementation (review wins)

- **Media3** `MediaSession` + small `MixPlayer` (`SimpleBasePlayer`); Compat not needed.
- **JS focus machine** modes: `playing` / `ducked` / `suspendedTransient` / `suspendedLoss` / `userPaused` / `noisyPaused` — unit-tested transitions in `focusMachine.test.ts`.
- Module sole route owner; library `observeAudioInterruptions` / `PlaybackNotificationManager` / route listeners removed; `AudioManager.disableSessionManagement()` at init (`sessionOwner=audio-session`).
- App icon as notification small icon; skip-back with no narration = no-op; focus denied → no play + “audio busy”; session/notification kept while paused; FGS from Start (foreground); notification permission from Start.
- Spike: Start requests permission + `beginMixSession`; Play (resume) after pause without Stop→Start.

## Checks

- `pnpm lint` / `typecheck` / `test` green locally.
- CI on tip: **check** + **db** both green.
- One release rebuild (`EXPO_PUBLIC_AUDIO_SPIKE=1`, `--variant release`); second rebuild after `03ed0ad` so the route fix is in the APK.

## Smoke before phone left (not a full run 3)

On Pixel 11 release install, after the route fix:

| Check | Result |
|---|---|
| `sessionOwner=audio-session` | logged at init |
| Start → mix | `mixStarted`, `focusHeld: true`, `notificationVisible: true`; **no** immediate `noisyPaused` |
| `dumpsys media_session` | `androidx.media3.session.id.intell-mix` is media-button session; `PLAYING`; metadata `InTell audio spike, Test` |
| `dumpsys audio` focus | InTell on top: `GAIN`, `USAGE_MEDIA` / `CONTENT_TYPE_SPEECH` |
| `cmd media_session dispatch pause` / `play` | session → `PAUSED` → `PLAYING`; JS `fadeSuspend` / `resumeAfterFade` |

Artifacts: `docs/spikes/logs/bs3-dumpsys-media_session-after-start.txt`, `bs3-dumpsys-audio-after-start.txt`, `bs3-t1-*-0.txt` (T1 locked briefly then phone taken).

## Not done (needs phone + Jordan)

- **T4** unplug / reconnect / play from lock, earbuds, notification  
- **T5** call pause + auto-resume  
- **T6** other-app song / duck / regain focus  
- **T7** lock-screen controls by ear  
- **15‑min T1** locked clock/underrun check  
- Android **run 3** column in `M1-audio-test-results.md` (left blank / pending)  
- Dated ADR 0001 Findings bullet for the completed protocol (smoke-only note added)

## Open questions

1. Mirror log to `/sdcard/Android/data/.../files/` still fails writable on this release (`ERR_UNEXPECTED`); primary log + Share remain the path — same as B·S2.
2. YouTube (and other) MediaSessions were still visible in `dumpsys` during smoke; confirm they don’t steal media-button focus during T6/T7.
