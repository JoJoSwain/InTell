# Lane B · M6 report (review 4 F1–F6; engine-side A1/A6/A7/A8)

Branch `b/m6-narration-session` @ `cff8e0d` + follow-up ProGuard keeps. **Stopped for Jordan’s ear checks (A1–A8) and Claude’s verification.**

## Review 4 — root cause + fixes

Silent QR after relaunch was **RC1**: restored `director.lastEmitted` / `suspended` plus session `playing` on an empty engine → no `playNarration`, scan queued forever. Beats (RC2) explained the first pause; missing `FOREGROUND_SERVICE_LOCATION` in the stale native tree (RC3) would have broken the walk.

| Fix | Status |
|---|---|
| **F1** Clean start: reset `lastEmitted` + `suspended`; interrupt restored `playing`; clear overlay; test | Done |
| **F2** Focus-denied `start()` → paused overlay + busy hint; Resume retries `start()` then director play; test | Done |
| **F3** Filter director `resume` on interruption end (focus owns resume); test | Done |
| **F4** `expo prebuild --clean --platform android` with walk env; merged release manifest has `FOREGROUND_SERVICE_LOCATION`, `LocationTaskService` type `location`, both intent filters; contract test | Done |
| **F5** Data screen Audio diagnostics + “Reset session (keep packs)” + native `Log.i` tag `InTellAudio` | Done |
| **F6** `engine.onRemoteCommand` (incl. `stopExploring`); engine keeps skip-back | Done |

**Extra (post-prebuild):** release minify stripped WorkManager/Room → crash on launch. Added `plugins/withProguardKeeps.ts` (WorkManager/Room + audio-session keeps). Rebuilt + reinstalled.

## Engine-side pre-checks (no ear claims)

Pixel `67090DLKY005KL`, release APK after clean prebuild + ProGuard keeps, packs kept via `adb install -r`.

| Check | Engine evidence |
|---|---|
| **A1** QR cold start | MediaSession `intell-mix` **active**, `PLAYING`, metadata **Walk 2 QR / InTell**, position advancing; AAudio `state:started` for the app pid |
| **A6** Second session | Force-stop → QR again → same MediaSession PLAYING Walk 2 QR |
| **A7** Relaunch mid-story | Force-stop mid-play → relaunch QR → plays again (F1 path); no crash |
| **A8** Location FGS | `dumpsys activity services`: `LocationTaskService` **isForeground=true**, types location (`0x8`); exploring location notification channel present. Merged manifest declares the service with `foregroundServiceType="location"` |

Jordan still confirms **A1–A8 by ear** (Bluetooth buds connected first per review 4).

## Commands

- `pnpm lint && pnpm typecheck && pnpm test` — green (110 mobile tests)
- CI `check` + `db` — green on `cff8e0d` (PR #36)
- `pnpm exec expo prebuild --clean --platform android` (walk env)
- Release assemble + `adb install -r`

## Still open / next

1. Jordan: Data → **Reset session (keep packs)** if needed, then A1–A8 by ear (BT on for the suite).
2. Claude: verify F1–F6 + ProGuard keeps.
3. Then walk steps E–G as before.
