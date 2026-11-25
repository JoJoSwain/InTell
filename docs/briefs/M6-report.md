# Lane B · M6 report (review-1 fixes; pre–Pixel walk)

Branch `b/m6-narration-session`. Review-1 (B1–B8, R3) applied. Merged `origin/master` (A7b / PR #38). Preview uses `PreviewManifestDevice`. **Stopped before the Pixel walk for Claude’s check.**

## What’s wired now

| Item | Status |
|---|---|
| **B1** One `RNAudioApiEngine` in `ExploringProvider` → `ExploringRuntime` | Done |
| **B2** `voiceEnded` → session `narrationEnded` + director; progress → overlay; load fail → `assetFailed` | Done |
| **B3** Interruptions + route → director; pause/resume only when playing; suspend filtered on focus path | Done |
| **B4** Tick + director heartbeat from engine audio clock; kv only while exploring / on effects | Done |
| **B5** `windowChanged` from region sun reference at start and on flip | Done |
| **B6** High accuracy whole session; one location source (watch stopped while FGS runs); drop stale `at` | Done |
| **B7** `sessionEnded` → `stopAll` fade, media session `stop`, location idle ≤ 5 s then foreground | Done |
| **B8** `ExploringRuntime` tests with fake engine/location (9 cases) | Done |
| **R3** Media3 custom “Stop exploring” `CommandButton` → `stopExploring` → session `stop` | Done (native; needs device confirm) |
| **A7b** `PreviewManifestDevice` on preview path | Done (via master merge) |

## Kept from review-1 “good” list

Pack parsers, R1 kv scrub, R2 expo-location finding, overlay/teaser/settings UI, QR route, M6 world gate.

## Tests / commands

- `pnpm --filter @intell/mobile typecheck` — green
- `pnpm --filter @intell/mobile lint` — green (pre-existing spike `require` warning; array-type warnings cleaned in new files)
- `pnpm --filter @intell/mobile test` — **99** tests green
  - Shell GPX harness (`gpxAcceptance.test.ts`) — shared-machine + effects path
  - **Runtime** (`ExploringRuntime.test.ts`) — fake engine: play → end → completion → afterglow → next; interruption; location-denied scan; accessible; session end; contingency/correction

## Emulator GPX / AVD

No AVD created this pass. Runtime tests + Pixel walk stand in for Maestro-on-AVD UI. Shell GPX acceptance still passes as a pure-logic walk of `demo-route.gpx`.

## Pixel walk pack (no home coords)

- **Pack:** seeded **Farmington Bird Refuge** demo grove (`supabase/fixtures/farmington-bird-refuge.json` → published demo pack). Trail + fragments are at the George S. and Dolores Doré Eccles Wildlife Education Center, Farmington, UT.
- **Where:** fragments sit on the demo trail loop around the refuge (Frags 1–10; Frag 9 physical `DEMO-001`; Frag 8 day-only; Frag 10 contingency; Frag 4 correction). GPX: `apps/mobile/e2e/demo-route.gpx`.
- **Can Jordan walk there?** Yes — public refuge / education-center trails. Walk the GPX-ish loop on site with the installed demo pack; ear-confirm narration, pocket/lock, call interruption, and notification **Stop exploring**.
- **Do not** log or commit anyone’s home location; Embark origin still must not be stored.

## Still open / not claimed

1. **PSS (G7)** — needs a release/dev build on emulator or Pixel; record on the walk.
2. **R3 on device** — Kotlin `CommandButton` + custom command is in `audio-session`; confirm it appears on lock screen / notification on the Pixel build (rebuild native module).
3. **R6 remote resume timing** — measure on Pixel before tightening retries.
4. **Accuracy (G1)** — still 25 m until the walk retunes.
5. **No home coords** in this report or logs.

## Next

Claude reviews this push. Then Pixel walk with Jordan. Then final report if needed.
