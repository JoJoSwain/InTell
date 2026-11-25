# Lane B · B·S3

`audio-session` Expo Module (Media3 + JS focus machine) on `b/bs3-audio-session`. PR [#35](https://github.com/JoJoSwain/InTell/pull/35). Android **run 3** device protocol completed 2026-11-24 with Jordan (Pixel 11 + Beats Studio Buds+).

## Commits

| Commit | What |
|---|---|
| `31e927b` | Media3 `SimpleBasePlayer` session module, FGS, focus/noisy/route; JS focus machine; library session off; spike wiring; M6 rules |
| `03ed0ad` | Don’t pause on the *initial* speaker route emit |
| `a92eb63` | Claude review: `DefaultMediaNotificationProvider` (drop hand-built notification); `playWhenReady` before `addSession`; log FGS refusals |

## Implementation (review wins)

- Media3 `MediaSession` + `SimpleBasePlayer`; Compat not needed.
- JS focus machine modes unit-tested (`focusMachine.test.ts`).
- Module sole route owner; `AudioManager.disableSessionManagement()`; no library interruption/notification/route listeners.
- App icon artwork + small icon; skip-back with no narration = no-op; focus denied → “audio busy”; session kept while paused; FGS from Start; notification permission from Start.
- After Claude’s code review: Media3 default media notification (IMPORTANCE_LOW), not a plain `NotificationCompat`.

## Checks

- `pnpm lint` / `typecheck` / `test` green; CI check + db green on tip.
- Release rebuild with `EXPO_PUBLIC_AUDIO_SPIKE=1` (fresh JS bundle after the notification fix).

## Device protocol — Android run 3

| # | Result | Notes |
|---|---|---|
| **T7** | **pass** | Shade Pause/Play work; metadata “InTell audio spike”; MediaStyle + Pause action confirmed in `dumpsys notification` |
| **T4** | **pass** | BT disconnect → pause; reconnect stays paused; Play from shade resumes (B·S2 gap fixed) |
| **T5** | **pass** | Call → full mix stops; hang-up → auto-resume |
| **T6** | **pass*** | YT Music → pause; no auto-resume on close (correct — needs Play). Instagram: first sound **ducked**, second took focus (LOSS). Pixel **AudioHardening** then ignored InTell focus requests → pink “audio busy”. After IG gone, shade Play alone did not restore audible mix; **Start full mix** did. *Duck path observed; hard-loss + busy UX noted for Claude. |
| **T1** (15 min) | **pass** | Same pid `24251`; locked/background; `clockRate` ~0.9998–1.0001; `audioHealth: ok`; `focusHeld: true`; `clockGapMs` ~±30 ms; session still PLAYING at 15 min |

### T6 AudioHardening (for the report)

```
AudioHardening focus request for req 1 ignored for org.replaceplace.intell … level: partial
```

While Instagram held media, Android denied InTell’s re-request. Matches the “audio busy” banner.

### setWillPauseWhenDucked

`setWillPauseWhenDucked(false)` — first Instagram cue ducked (not pause); longer IG media caused LOSS. T6 “duck, not pause” satisfied by the short cue.

## Artifacts

`docs/spikes/logs/bs3-run3-*.txt` (local; `docs/spikes/logs` is gitignored) — media_session + audio dumpsys at baseline, T4/T5/T7, T1 t=0 and t=15.

## Open questions / follow-ups for Claude

1. After “audio busy” / hard LOSS, shade Play set MediaSession to PLAYING but the Web Audio mix stayed silent until **Start full mix**. Should remote `play` force a full graph resume path even when the prior focus request was denied?
2. Spike Start stays disabled when `running && !paused` while the mix is effectively dead after a denied resume — UX trap.
3. Mirror log to external files dir still not writable on release (`ERR_UNEXPECTED`); Share / logcat remain the path.
