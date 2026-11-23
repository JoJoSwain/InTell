Lane B · M5b

Plan only. No product code in this commit. Lane B will not edit `packages/shared` or `supabase/`.

The home screen follows `docs/design/MOBILE_HOME_STANDARDS.md` and ADR 0006. DESIGN.md §1–§4 and the older Home: Map row lose where those two disagree. Aerial styling (§3B) is not built. Embark is M5c. The splash, welcome, and app icon are M5d.

## Libraries and versions

Install from `apps/mobile` with `pnpm exec expo install` so the versions match Expo SDK 58 (`expo ~58.0.26`, React Native 0.88.1, New Architecture). The resolved versions go in the implementation report.

| Package | Version to install | Role |
|---|---|---|
| `react-native-maps` | `1.29.11` | Bundled for SDK 58 (`expo/bundledNativeModules.json`). `PROVIDER_GOOGLE` on iOS and Android. Config plugin supplies the native Maps keys. Fabric Google markers and polygons landed in 1.29.0. |
| `expo-location` | `~58.0.22` | While Using permission and the SDK location dot's coordinates. No background permission. |
| `expo-font` | `~58.0.12` | Already installed. Loads the vendored Questrial file. |

Questrial is the single Regular weight from Google Fonts, SIL OFL 1.1. The `.ttf` and the OFL text sit together under `apps/mobile/assets/fonts/`. It is used only for grove names, sheet titles, empty-state headlines, the bottom buttons, and the grove-name chip. Those styles do not set a bold weight. Reading text leaves `fontFamily` unset so the system font is used, with `allowFontScaling` and a multiplier that still holds at 200%.

Not added for M5b: `expo-maps` (Apple Maps on iOS, which ADR 0002 rules out), a cloud map style, Sentry, or a font package that would download at runtime.

## Map style

**JSON styles in the repo, not a Map ID.** ADR 0006 prefers styles versioned in the repo and a sunset switch that does not reload the map. `react-native-maps` 1.29 passes `customMapStyle` through as `customMapStyleString` on the existing native view (`MapView.tsx`). The React element keeps a stable key, so a day/night change is a prop update, not a remount. Expo's SDK 58 map-view page is the install and key-plugin source: https://docs.expo.dev/versions/v58.0.0/sdk/map-view/

A cloud Map ID is the wrong switch. The library's `googleMapId` prop exists to turn on cloud styling, and a map that has an ID ignores client JSON. TECH_SPEC still lists `GOOGLE_MAP_ID`. M5b leaves that name in `.env.example` with an empty value and does not pass it.

The style JSON lives in `src/map/styles/day.json` and `night.json`. It sets the fills, strokes, and label greys in standards §3A, and sets `visibility: off` for `poi`, `poi.business`, `transit`, and `transit.station`. That is how parking and gas-station icons leave the map. Transit stations stay off until M5c. A unit test reads the JSON and fails if any of those four stay visible.

What the style API cannot do, so M5b will not fake it: dashed trail hairlines, a custom label font, offshore contour hatching, or road bands at an exact 12 pt and 6.5 pt. Roads get a light fill and a darker stroke at the closest weights the style language allows. The standards already say hatching, canopies, and a custom label font are out.

Keys are read at prebuild from `GOOGLE_MAPS_API_KEY_ANDROID` and `GOOGLE_MAPS_API_KEY_IOS` inside `app.config.ts`, and passed only to the `react-native-maps` plugin (`androidGoogleMapsApiKey`, `iosGoogleMapsApiKey`). Those names, plus the empty `GOOGLE_MAP_ID`, go in `apps/mobile/.env.example`. No key is committed, logged, or put in `extra`.

`showsUserLocation` uses the SDK dot (worksheet 2.4 is still open). `showsMyLocationButton`, `toolbarEnabled`, zoom controls, and the compass are off. Recenter is our own button, shown only after the camera center has moved off the puck, and it is not shown when there is no puck.

First camera, in memory only: the listener's location if permission was granted, otherwise the centroid of the nearest installed grove, otherwise the installed region's sun reference. If none of those exist, the map opens zoomed out. That coordinate is not written to SQLite, logs, or telemetry.

Location permission is `requestForegroundPermissionsAsync` only, and only after a minimal interim card. The card's copy lives in the strings module and is marked for replacement when worksheet 6.4 is designed. Denying permission leaves the map up, without a puck.

## Markers and pulses

This is the risky part. Custom marker views with `tracksViewChanges` left on are what makes a few hundred markers stall. The plan is one `image` marker per fragment, `tracksViewChanges={false}` after the first draw.

Pre-rendered PNGs, committed as assets:

- ink ring, day and night, three diameters (22, 16, 12 pt) at full strength and at 35%
- eight pulse frames per tier color and for the accent green: a 2 pt ring from the start size (diameter + 6 pt) out to ×1.8 / ×1.48 / ×1.24, opacity 0.95 → 0, ease-out
- Reduce Motion uses the first pulse frame only, and only for unexplored and changed markers

One shared 1-second clock (`src/map/pulseClock.ts`) advances the frame. Only markers whose coordinates sit in the current region get a new image. The others keep the still ring. Reduce Motion, including a live settings change, pins every pulsing marker on frame 0 and draws no halo. Nothing else on the map animates.

**Spike, 2026-11-23, Node on this machine.** No emulator or phone was attached (`adb devices` was empty), so these are JavaScript costs, not frame times. Building the image-name props for one clock tick:

| Set | Time per tick |
|---|---|
| 40 markers (a full-enough screen) | 0.0008 ms |
| all 300 | 0.0051 ms |

The JS bookkeeping is cheap either way. The native cost is the part that can miss frames, and it scales with how many marker images change. Updating only the on-screen set is about eight times less prop work here, and it is the only set that should cross the bridge. The first implementation step, before groves, the web, or the controls, is the same 300-marker grove on an Android emulator: image markers with on-screen frames versus custom views. The report names the AVD and records jank or a Perfetto/GPU-rendering sample. If image swaps still miss frames, the fallback is fewer frames (4 instead of 8), not animated child views.

Tap target is a 48 pt transparent hit area. The screen-reader label comes from the strings module (`Root, unexplored`, and the other states). A tap opens a small card with the teaser only, or the change teaser when the pulse is `changed`. The card never shows the title. A physical marker uses the same ring and the string "Scan the code here to listen." Scanning is M6.

Until A2, `markerState` still returns `pulse: boolean` (true only for an unheard Story Contingency). The map adapter is:

- `hidden` → not drawn
- `opacity === 0.35` → locked ring, pulse `none` (this includes out-of-window, until worksheet 3.3)
- `pulse === true` → `changed`
- `playableNow` → `tier`
- otherwise → `none` (completed)

When A2 ships `pulse: "tier" | "changed" | "none"`, the adapter reads that field and the boolean branch goes away.

## Dashed strokes

`MapPolygon.lineDashPattern` is documented as Apple Maps on iOS and supported on Android (the Android polygon dash landed in react-native-maps 1.17). With `PROVIDER_GOOGLE` on both platforms, a polygon dash will show on Android and not on iOS.

So the grove fill is an unstroked polygon on both platforms, and the outline is one polyline per ring. Android polylines take the dash in points (`[8, 5]` for the grove, `[4, 3]` for the web). iOS Google Maps has accepted `lineDashPattern` on polylines since 2018, but those numbers are metres along the ground, not points (react-native-maps issue 4718). The iOS pattern is converted with the same metres-per-point value as the trims, at the current zoom, and refreshed on zoom end rather than every frame. The first emulator pass confirms the Android dash. The first Mac or EAS iOS build confirms the converted pattern. If iOS Google still drops the dash, the outline stays a solid polyline on iOS and the report says so.

Joins stay miter where the API allows. `lineJoin` on a polygon is Apple-only, so sharp buffer corners come from the geometry, not from a join prop.

## Halo

The halo is a filled ring, not a stroke. A stroke would paint inside the grove as well as outside. For each piece, a polygon uses the buffered ring as the outer path and the real boundary as a hole. Only the band between them is filled. Color is ink at 22% by day and white at 25% at night (plan/blueprint only).

The band is 14 pt on screen, so its width in metres changes with zoom. At latitude 40.7°, Web Mercator is 1.811 m per point at zoom 16, so 14 pt is 25.35 m. At zoom 18 it is 6.34 m. The buffer is recomputed in `onRegionChangeComplete`, not on the pulse frames. Four opacities (1, 0.5, 0.25, 0), swapped by the same one-second clock, stand in for a continuous ease-out. That is four polygon prop updates per piece per second, independent of marker count. Reduce Motion removes the halo. `groveShape(…, { extraM })` replaces the local buffer when A2 merges. Until then a local outward offset of each edge, in metres, is the stand-in and is not the published boundary.

## Web-line trims

Lines are geographic. Trims are points: Root 14, Branch 11, Leaf 9, measured from the marker center along the segment.

```
metersPerPoint(lat, zoom) = 156543.03392 * cos(lat) / 2^zoom
trimMetres = trimPoints * metersPerPoint(latitude, zoom)
```

At zoom 16 and latitude 40.7° the trims are 25.35 m, 19.92 m, and 16.30 m. At zoom 18 the Root trim is 6.34 m. Each end of the segment is shortened by its own trim. The metres are cached for the current zoom and recomputed in `onRegionChangeComplete`. Weight is 1.5 pt when either end is a Root, otherwise 1 pt. Strength is 85% ink when the target is reachable and 45% when it is locked. At night those become white at 85% and 45%. Lines render under the markers and above the fill.

In-grove links wait for `storyWebLinks`. Until that export exists, a local stand-in walks each fragment's `requires` groups and draws a segment to a prerequisite in the same grove. Cross-grove arrows are last, after A2's `crossGroveLinks`: a line from the marker to `tip`, then an open chevron about 8 pt wide in the line's color. The tip is used as published. M5b does not recompute the 100 ft extension.

## Module layout and state

```
src/ui/tokens.ts              day/night palette and tier colors
src/ui/fonts.ts               Questrial loader
src/ui/strings.ts             every user-facing string, English, marked for i18n
src/theme/appearance.ts       kv appearance + currentTimeWindow + phone scheme
src/map/styles/day.json
src/map/styles/night.json
src/map/HomeMap.tsx           one MapView, no remount on theme change
src/map/groves.ts             MultiPolygon normalize, chip test, halo band
src/map/markers.ts            markerState adapter, on-screen set, image name
src/map/pulseClock.ts         one 1 s clock
src/map/web.ts                weight, strength, trims
app/index.tsx                 the map home
app/settings/index.tsx        Appearance, then the existing staff and dev entries
app/chronicle/index.tsx       placeholder
app/journal/index.tsx         placeholder, already present
app/embark/index.tsx          placeholder until M5c
```

`app/grow/` is deleted, and the M0 bar (Journal · Grow · Settings) goes with it. Chronicle, Embark, and Journal are the bottom row: 48 pt side pills, 60 pt Embark, 16 pt from the sides, 34 pt from the bottom, at least 8 pt between them, safe area included, checked at 360 pt wide. Settings is a 44 pt button, top right. The wordmark slot is top left and empty in production. A dev build may show a non-logo placeholder from `assets/brand/` until Ashley's file exists. The word "InTell" is not drawn as the logo. The grove-name chip is top center, only while the puck is inside any piece of an installed grove. Its sheet shows the name and the premise. Stop exploring waits for sessions in M6.

State, and nothing else:

1. SQLite packs, completions, and unlocks (M5a) are read on focus and after sync.
2. Each installed grove manifest is parsed. A schema 3 Polygon is wrapped as a one-piece MultiPolygon. A schema 4 MultiPolygon is used as-is once A2 is merged.
3. `markerState` from `@intell/shared` runs per fragment, with the device completions, unlocks, and the current window. The adapter above turns that into a ring, a pulse kind, and a label.
4. The visible region from `onRegionChangeComplete` selects which pulses advance.
5. Appearance is a `kv` row: `story` (the default) or `phone`. `story` uses `currentTimeWindow` for the installed region's sun reference and time zone, checked on foreground and on a 15 s timer while active. `phone` uses the device color scheme. With no region installed, the phone scheme is used even when the choice is `story`.
6. The puck coordinate stays in React state. It is not inserted into SQLite and not logged.

## Test strategy

Jest, the same `node:sqlite` driver as M5a. No Testing Library until a later brief asks for component tests. Map views are not mounted in Jest.

- Theme: a fixed clock before and after sunset follows the story window; `phone` ignores that window; no region follows the phone.
- Marker adapter: unexplored, changed, completed, locked, and out-of-window each pick the ring opacity, pulse color, and Reduce Motion frame the standards name.
- Web: Root–Branch is 1.5 pt and Branch–Leaf is 1 pt; reachable is 85% and locked is 45%; trim metres at a fixed latitude and zoom match the formula, including a zoom change.
- Chip: a point in the outer piece is inside, a point in a hole between islands is outside, a point in the second piece is inside. The test uses a hand-built MultiPolygon. It switches to `pointInPolygon` on MultiPolygons when A2 exports it.
- Styles: `day.json` and `night.json` hide `poi`, `poi.business`, `transit`, and `transit.station`.

## Device test

After plan approval, and before the rest of the home UI is built on top of markers:

1. Android emulator via the existing dev client (`pnpm --filter @intell/mobile android`). Expo Go is not the check. The Maps key is a local `.env` value, never committed.
2. Jordan's phone: a USB `expo run:android --device` from `apps/mobile` once the key names are filled in on that machine, or the dev-client build he already installs. This plan does not run `expo prebuild` or a store build.
3. On that emulator, install the demo grove and the 300-marker grove from the dev data screen. Confirm day and night against the canvas, a sunset that swaps `customMapStyle` without remounting, and the Reduce Motion stand-ins.
4. Pan the 300-marker grove. Name the AVD or the phone, and record the frame sample.
5. Screenshots go in the implementation report. On Windows they are taken with `adb exec-out` from `cmd.exe`, not PowerShell `>` redirection.

The demo grove matches the canvas states: R1, B1 changed, B2, L1, B3 completed, L2 completed, R2 locked, B4 locked, L3 locked. Every locked fragment's `requires` includes at least one unexplored prerequisite. The 300-marker grove is a grid of fragments in one pack, for the pan check only.

## Order of work

1. Tokens, Questrial, strings, appearance, and the unit tests that do not need the map.
2. The on-device marker spike. Stop and record the numbers before building the rest of the screen on the losing approach.
3. Map shell: JSON styles, puck, permission card, first camera, recenter.
4. Grove pieces, outline, fill, halo, name chip, sheet with name and premise.
5. Markers, the shared clock, teaser card, Reduce Motion.
6. In-grove web lines and trims.
7. Bottom row, Settings → Appearance, remove `grow` and the M0 bar. Dev fixtures on the data screen.
8. When Claude says A2 Part 1 is on `master`: merge `origin/master`, `pnpm install`, and commit the lockfile if it changes. Wire `toMultiPolygon`, MultiPolygon `pointInPolygon`, `groveShape(…, { extraM })`, `MarkerState.pulse` as `"tier" | "changed" | "none"`, `storyWebLinks`, schema 4, and `crossGroveLinks`. Delete the schema 3 normalizer and the local buffer. Cross-grove chevrons are this step, not before.

## Spec gaps

1. **ADR 0006 §5 says the phone keeps no Polygon-to-MultiPolygon path.** The brief says to normalize a schema 3 Polygon until A2. This plan does the temporary wrap and deletes it in step 8. If review wants no normalizer at all, M5b cannot draw a grove until A2.
2. **`markerState.pulse` is still a boolean.** The `"tier" | "changed" | "none"` field is A2. The adapter above is the stand-in.
3. **`storyWebLinks`, `groveShape`, `toMultiPolygon`, and MultiPolygon `pointInPolygon` are not exported yet.** Local stand-ins cover the tests. They are replaced in step 8, not copied into shared by Lane B.
4. **The next sunrise or sunset instant is not exported.** `currentTimeWindow` only answers "now". Until shared exposes the next boundary, a foreground check plus a 15 s timer is the schedule. Say if that should wait for an A2 helper instead.
5. **Holes filled, and the 1 km far-piece warning, are still marked confirm in ADR 0006.** Both are pack-build rules. The phone draws the published rings and does not fill holes itself.
6. **Worksheet 3.3 (locked versus out of window) is open.** Both stay at 35% and still.
7. **Worksheet 2.4 (the location dot) is open.** The SDK dot is the stand-in.
8. **Base-map dashes, exact road widths, and a custom label font are outside Google's style JSON.** M5b styles color, weight, and visibility only.
9. **iOS Google polygon dashes are not in the library's supported set.** Polylines are the outline, and the iOS dash unit is metres. The device pass is what proves the 8/5 and 4/3 rhythm.
10. **No wordmark file yet.** The slot stays empty in production.
11. **No emulator was attached for this plan,** so the marker numbers above are JavaScript prop costs. Frame times are step 2, before the rest of the home is built.
12. **PRODUCT_SPEC still lists a session status chip.** ADR 0006 and the standards replace that with the grove-name chip. Stop exploring is not on the sheet until M6.
