# Lane B · B·S1

ADR 0001 Android protocol on Pixel 11. **Stopped before T1–T9:** the audio-spike screen cannot load fixtures. No product code was changed.

## Setup completed
- Headphones: Bluetooth earbuds (Jordan).
- Wireless debugging: paired and connected (`192.168.1.49:34111`); `adb` works unplugged.
- Phone prep: charge &gt; 80%, other apps closed, volume ~50%, DND with calls allowed.
- Fixtures: `pnpm --filter @intell/audio-fixtures generate` → 17.78 MB under `apps/mobile/assets/spike-audio/` (gitignored WAVs present on disk).
- Dev build: `expo run:android --device 192.168.1.49:34111` — BUILD SUCCESSFUL; APK installed (`org.replaceplace.intell`).
- Metro restarted without `CI` on port 8081; deep link `intell://dev/audio-spike` opened.

## Blocker (defect — not fixed)
Opening the spike crashes immediately:

```
TypeError: undefined is not a function
  at apps/mobile/src/audio/spike/assets.ts:6
  require("../../../assets/spike-audio/narration_90s.wav")
```

Also: `WARN Route "./dev/audio-spike.tsx" is missing the required default export` (cascade from the failed `assets` import).

**Notes for Claude:** WAVs exist on disk; Metro lists `wav` in `assetExts`. Suspect `apps/mobile/metro.config.js` custom `resolveRequest` when chaining to the default resolver for existing spike files (`context.resolveRequest` → TypeError). Smoke tests in ADR 0001 Findings were earlier; this branch could not re-enter the spike UI.

Per brief: record, stop, do not fix.

## Results
T1–T9 **not run** (blocked). See `docs/spikes/M1-audio-test-results.md` and ADR 0001 Results (Android column marked blocked).

| # | Test | Android |
|---|---|---|
| T1–T9 | (all) | **blocked** — spike asset `require` crash |

No JSONL log, no clock-health or memory tables (T1/T8 never started).

## Device
| Platform | Device | OS | Build |
|---|---|---|---|
| Android | Pixel 11 | 17 | CD1A.261005.003 |

## Surprises
- Fixture generate and APK install were fine; failure is purely Metro/`require` of existing WAVs at runtime.
- Expo `run:android` first brought up Metro in **CI mode** on 8082; restarted without CI — same crash.

## Failed?
Yes — protocol incomplete. No T-test pass/fail; setup defect blocked the suite.
