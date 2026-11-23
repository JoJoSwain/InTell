# Lane B · M5b

Map home with the first-pass review fixes and step 8 (A2 Part 1). Stopped before the device run.

## Debug signing (N4)

`npx expo prebuild --platform android --no-install`, then `keytool` on `apps/mobile/android/app/debug.keystore` (gitignored CNG folder):

**SHA-1:** `5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25`

This is the certificate `expo run:android` uses. It is **not** the keystore under `%USERPROFILE%\.android` (`AE:0E:CE:…`). Put this SHA-1 on the Android Maps key. There is still no `apps/mobile/.env` here.

## Versions

- Expo `~58.0.26`, React Native `0.88.1`
- `react-native-maps` `1.29.11`
- `expo-location` `58.0.22`
- `expo-font` `~58.0.12`
- Questrial Regular, SIL OFL, under `apps/mobile/assets/fonts/`

## Review fixes (R1–R4, N1–N3)

- **R1.** Pulse clock is a module store (`pulseClock` + `useSyncExternalStore`). Only on-screen pulsing `Pin`s and the halo layer subscribe. Grove fills, outlines, and trimmed web lines are memoized on the model and settled zoom. Marker selection uses one stable `useCallback`.
- **R2.** Marker states use `storyTimeWindow` (region sun clock, or `"day"` with no region). Theme only picks colors. Test: Follow my phone dark at noon still loads day-window states.
- **R3.** Live puck via `onUserLocationChange` (throttled) and `watchPositionAsync` while focused and active. Cleared when the screen blurs. Memory only; never SQLite or logs.
- **R4.** Accessibility label is tier and state from `strings`, then the card text.
- **N1.** `mapReady` state drives the first-camera effect.
- **N2.** `labels.text.stroke` is paper by day and ground by night.
- **N3.** Physical cards show the teaser, then "Scan the code here to listen."

## Step 8 (A2)

Merged `origin/master` (A2 Part 1). `pnpm install`; lockfile unchanged. Wired:

- Schema 4 MultiPolygon boundaries via `toMultiPolygon` / `pointInPolygon`
- `MarkerState.pulse` as `"tier" | "changed" | "none"` (stand-in adapter deleted)
- `storyWebLinks` for in-grove lines
- Pack `crossGroveLinks` for tips and open chevrons
- Halo: four `groveShape(…, { extraM })` bands at ¼–1× 14 pt when zoom settles; one band shown per beat at falling opacity; Reduce Motion hides it; `__DEV__` logs band compute time

Demo and stress fixtures now publish schema 4 shapes from `groveShape`. A2 already updated `sync.test.ts` / `install.test.ts` on master; this branch did not edit them further.

## Device spike

Still pending the device run. AVD `Medium_Phone_API_37.0` exists; earlier boot exited. Pixel 11 (`67090DLKY005KL`) was attached before; nothing installed. No frame times, no 12-frame trial, no screenshots, no on-device Root size check. Halo `groveShape` timing will be read from the device log on that run.

## Tests and export

`pnpm --filter @intell/mobile test` — 13 suites, 42 tests, passed.  
`pnpm --filter @intell/mobile typecheck` — passed.  
`pnpm --filter @intell/mobile lint` — passed.  
Clean export: `CI=1 expo export --platform android --clear` — 1591 modules, exit 0 (`%TEMP%\m5b-export`).

## iOS, still pending

Dashes in metres on iOS, points on Android. Styles and dashes not checked on an iOS device.

## `git log --oneline origin/master..HEAD`

Filled in after the review-fix commit.

## Deviations

- Night style “white at N%” colors stay flattened to 6-digit hex (Maps style has no alpha).
- Road bands remain color and weight only.
- Dev fixtures still install into local SQLite; a later sync drops packs not in the published index.
- Ready for the Pixel 11 device checks once the Maps key includes the prebuild SHA-1 above.
