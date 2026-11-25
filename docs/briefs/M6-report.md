# Lane B · M6 report (pre–Pixel walk)

Branch `b/m6-narration-session`. Plan review applied (G1–G7, R1–R6). Overlay design approved by Jordan 2026-11-24. **Stopped before the Pixel walk.**

## What’s built (steps 1–8)

1. **Pack parsers** — `GrovePackDevice` / `RegionPackDevice` in install, sync, homeModel.
2. **Session shell** — `sessionShell`, `applySessionEffects`, `sessionWorld`, `persist` (R1 scrub), `SessionStore`, `ExploringRuntime` + `ExploringProvider`.
3. **Location** — `LocationService` + task; two FGS design; start only when app active (R2); notification title from TECH_SPEC (R3).
4. **Director** — `m6World` / `M6_LAYERS`, command filter, `applyDirectorCommands`, heartbeat + session effects.
5. **audio-session** — meta title, pause/play, skipBack via `BACK_SKIP_MS` (R5); remote resume unchanged pending measure (R6).
6. **QR** — `app/f/[code].tsx`, sha256 upper-case match, `intell://` + https intent filters; hosting deferred to M12 (G6).
7. **Overlay / teaser / afterglow** — per §6 approved design.
8. **Settings** — accessible trigger, location available, beacons kv (M7).

## Tests / CI

- `pnpm --filter @intell/mobile typecheck` — green
- `pnpm --filter @intell/mobile lint` — green (pre-existing spike require warning)
- `pnpm --filter @intell/mobile test` — **90** tests green, including GPX shell acceptance

## Emulator GPX acceptance (§8.2) — shell harness

| Item | Result |
|---|---|
| Unlocked fragments once, tier/route order | **pass** |
| Locked never play | **pass** (frag9 absent) |
| Contingency / correction | Covered in shared `sessionWalk`; shell mirrors play path |
| Day-only silent at night | **pass** |
| Locked marker scan → teaser | **pass** |
| No overlap | **pass** (shared assert + single play queue) |
| No tap to start | **pass** (fix/scan only) |
| Location denied → scans ok, proximity off | **pass** (proximity plays empty) |
| Accessible trigger @ 35 ft | **pass** |
| Location stop ≤ 5 s after session end | **pass** (idle mode on end) |

Full Maestro-on-AVD UI walk not run in this lane session (no AVD attached; Pixel was connected). Shell harness is the automated acceptance; Pixel walk with Jordan is next.

## PSS (G7)

Not captured yet — needs a release/dev build with map + pack on emulator or Pixel. Record on the walk.

## expo-location finding (R2)

**Confirmed in expo-location 58.0.22 Android source:**

- Manifest declares only `ACCESS_FINE` / `ACCESS_COARSE` — **no** `ACCESS_BACKGROUND_LOCATION`.
- `LocationTaskConsumer.maybeStartForegroundService` returns early when `!isForegrounded` (“cannot be started while the app is in the background”).
- `startForeground` failures (`SecurityException` / `IllegalStateException`) are caught and the service stops.
- FGS type is `location` only.

Safe to use While Using + FGS without background permission. **Known limit:** a session can only start while the app is on screen; after a background process restart while `exploring`, location FGS waits until active (ticks still end the session).

## New gaps

1. **R3 Stop action:** expo-location’s notification API has no custom actions — Stop is “open app → grove chip → Stop exploring”. Native patch or Claude decision if a shade Stop is required.
2. **A7b** not merged yet — preview still awaits `PreviewManifestDevice` after master merge.
3. **PSS** numbers pending device build.
4. **Remote resume timing (R6)** — measure on Pixel walk before tightening retries.

## Next

Pixel walk with Jordan (pocket, locked, call mid-story). Then final report + CI push if needed.
