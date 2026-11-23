# Lane B · M5b

Map home device run on Pixel 11 (`67090DLKY005KL`) after the Maps key SHA-1 and `apps/mobile/.env` (key never printed, logged, or committed).

## Debug signing (N4)

**SHA-1:** `5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25` (Expo prebuild `android/app/debug.keystore`, not `%USERPROFILE%\.android`).

## Versions

- Expo `~58.0.26`, React Native `0.88.1`
- `react-native-maps` `1.29.11`
- `expo-location` `58.0.22`
- Questrial Regular, SIL OFL, under `apps/mobile/assets/fonts/`

## Device checks (Pixel 11, 1080×2424, density 420)

Screenshots under `docs/briefs/M5b-screens/`:

| File | What it shows |
|---|---|
| `day.png` | Demo grove, day style, markers + halo |
| `night.png` | Same grove after Follow my phone + `cmd uimode night yes`; blueprint style, no remount (`MapView` `key="home-map"`) |
| `reduce-motion.png` | Animator scales at 0; still pulse-color rings; no halo (`AccessibilityInfo` → true; no `halo-bands` log after reload) |

**Simulated sunset:** Follow my phone, then `adb shell cmd uimode night yes`. Style swapped without reload. Confirmed.

**Reduce Motion:** `settings put global transition_animation_scale 0` (and animator/window). Live change after reload: still rings, halo suppressed. Scales restored to 1 afterward.

**300-marker pan (kept 8 frames):**
```
marker-spike device=Pixel_11 frames=8 tickAvgMs=167.8 tickMaxMs=269.0 expectedMs=125.0 onScreen=300
```
12-frame trial (regen PNGs, reload, same grove):
```
marker-spike device=Pixel_11 frames=12 tickAvgMs=181.6 tickMaxMs=7071.0 expectedMs=83.3 onScreen=300
```
12 was farther from budget (and the max sample coincided with a multi-second halo recompute). **Kept `PULSE_FRAMES = 8`.**

**Root ring size:** Spec / asset `RING.root.diameterPt = 22`. At density 420 (2.625 px/pt) that is **57.75 device px**. Screenshot outer-ink scan on `day.png` read about **25.9 pt** (stroke + AA / possible pulse overlay); mid-stroke earlier pass was about **19.8 pt**. Logical diameter remains 22 pt.

**Halo band timing (`groveShape` × 4 fractions, logged in `__DEV__`):**
- Demo grove alone: about **4–13 ms** (4 bands)
- Demo + Stress installed (8 bands, 300-fragment shape): about **2.2–3.5 s** on zoom settle — expensive; worth a later optimize, not changed in this run

Dev helpers used on device only: `__DEV__` Grove fly (prefers Stress), spike + halo logs. Mock GPS was blocked (`MOCK_LOCATION`); fly replaced it. Expo Tools FAB overlaps Settings; used `intell://settings` / `intell://dev/data`.

## Review fixes and step 8 (unchanged from prior stop)

R1–R4, N1–N3, A2 Part 1 wiring as in the previous report. Stand-ins deleted; schema 4 / `groveShape` / `storyWebLinks` / string `pulse` in use.

## Tests

`pnpm --filter @intell/mobile test` / `typecheck` / `lint` were green before the device run. Re-run after the small HomeMap/HomeScreen device-log and Grove-fly edits before push.

## iOS, still pending

Dashes in metres on iOS, points on Android. Styles not checked on an iOS device.

## Deviations

- Night style “white at N%” stays flattened to 6-digit hex.
- Road bands remain color and weight only.
- Stress halo recompute is multi-second with 300 fragments; demo stays in the low teens of ms.
- Kept 8 pulse frames after the 12-frame device trial.
