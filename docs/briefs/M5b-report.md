# Lane B · M5b

Implementation of the map home, stopped before step 8. A2 Part 1 is not on `master`, so grove shape, story-web links, the string `pulse`, schema 4, and cross-grove arrows are not wired. The local stand-ins stay until that step.

## Versions

- Expo `~58.0.26`, React Native `0.88.1`
- `react-native-maps` `1.29.11` (SDK 58 bundled)
- `expo-location` `58.0.22`
- `expo-font` `~58.0.12` (already installed)
- Questrial Regular from Google Fonts, SIL OFL, vendored at `apps/mobile/assets/fonts/`

## Device spike

`emulator` is not on PATH. The SDK emulator lists one AVD: `Medium_Phone_API_37.0` (1080×2400, 420 dpi). It started, then exited during boot (`default_boot` snapshot failed to load, then the process shut down). There was no stable emulator session.

No frame times, no 12-frame trial, no day or night screenshots, and no on-device measurement of the 22 pt Root ring. A Pixel 11 was attached over adb (`67090DLKY005KL`). Nothing was installed on it.

The marker images are generated, not drawn. Each tier uses one canvas: 48×48 px at 1x and 144×144 px at 3x, ring centered, anchor `{0.5, 0.5}`. On a 420 dpi screen the `@3x` asset is 48 pt, so a 22 pt Root ring is 66 px inside that canvas. That size was not measured on a device. Eight pulse frames. Twelve was not tried, because there were no device numbers to compare (N2, N6).

Before the next device run, the Android Maps key has to allow this debug certificate. SHA-1 from `%USERPROFILE%\.android\debug.keystore`, alias `androiddebugkey`:

`AE:0E:CE:52:90:2D:F8:80:05:78:B9:F0:10:B0:99:E4:32:5E:BD:54`

There is no `apps/mobile/.env` in this workspace, so no Maps key was present. The key goes in that file and is not committed.

## R1–R3

- **R1.** Day and night JSON hide `labels` for `poi`, `poi.business`, and `transit.station`, and hide transit geometry. `poi.park` geometry stays visible (`#E6EBDD` day, `#224D69` night). The style test checks both.
- **R2.** `scripts/generate-marker-pngs.ts` reads `src/ui/tokens.ts` and `src/map/markerArt.ts`. Still rings and pulse frames for a tier share one canvas.
- **R3.** No halo. No local edge offset.

## Tests and export

`pnpm --filter @intell/mobile test` — 13 suites, 40 tests, passed. New cases: theme across sunset, Follow my phone, no region; marker adapter including Reduce Motion; 48 pt canvas; web weight, strength, and trim at two zooms; grove chip on two islands and the gap; style JSON labels and park geometry; demo grove states (R1/B2/L1 tier, B1 changed, B3/L2 still, R2/B4/L3 locked).

`pnpm --filter @intell/mobile typecheck` — passed. `pnpm --filter @intell/mobile lint` — passed.

Clean export: `CI=1 expo export --platform android --clear` — bundled `entry.js` (1587 modules), exit 0. Output: `%TEMP%\m5b-export`.

`apps/mobile/src/packs/sync.test.ts` and `install.test.ts` were not edited.

## iOS, still pending

Dashes are converted to metres on iOS (`metersPerPoint` at the settled zoom) and left in points on Android. JSON styles and those dashes have not been checked on an iOS device. No Mac, EAS, or Apple Developer account in this lane.

## `git log --oneline origin/master..HEAD`

Recorded after the implementation commit. The report commit is the tip after this list.

## Deviations

- Stopped before step 8, as asked.
- Schema 3 boundaries are drawn as a one-piece multi-polygon. `markerState.pulse` is still a boolean; a local adapter maps it to tier, changed, or none. In-grove web lines walk `requires`. All three stand-ins are deleted in step 8.
- Night style colors that the standards give as “white at N%” are flattened to 6-digit hex, because a Maps style color has no alpha: water edge `#BAC4CB`, road casing `#A5B5BF`, buildings `#BCC7CF`, labels `#9AABB7`. Road bands are color and weight only. Style JSON cannot do dashed trails, Questrial labels, or the exact 12 pt / 6.5 pt road widths.
- The demo grove and the 300-marker grove are installed from the dev data screen into local SQLite. A later sync removes any pack that is not in the published index.
- `userInterfaceStyle` is `automatic` so Follow my phone can see the phone’s dark mode.
