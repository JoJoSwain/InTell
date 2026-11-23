# M5b review (Lane B): first pass, before A2 and the device run

**Tip reviewed:** `2f79efe` · **Brief:** `docs/briefs/M5b-map-home.md` · **Plan review:** `docs/briefs/M5b-plan-review.md`

## Verdict

**A good first pass, but not finished.** Next comes:
1. the four fixes below
2. step 8, now that A2 Part 1 is merging
3. the device checks on Jordan's Pixel 11

**What's already right:**
- **R1 styles:** labels only, with park geometry kept and tested.
- **R2 markers:** generated marker art on one 48 pt canvas per tier.
- **R3 halo:** none yet, and no stand-in.
- **Clean work:** the token-driven generator, the tests, the clean export, and the two A2 test files left alone.

## Required changes

**R1. The pulse clock re-renders the whole map eight times a second.**
- **The cause:** `tick` is state in `HomeMap`, so every tick re-renders every `Polygon`, `Polyline` and `Pin`.
- **Why it hurts:** `closeRing(ring)` and `linkCoordinates(…)` build new arrays on each render, and each `Pin` gets a new `onPress`. So the map re-sends every line's coordinates to the native side eight times a second. That will cost frames by itself, and the device run would measure this instead of the markers.
- **The fix:**
  - Keep the clock in a small store (for example, a module with subscribe and `useSyncExternalStore`) that only pulsing, on-screen `Pin`s subscribe to.
  - Memoize the grove pieces, outline rings and trimmed web lines on the model and the settled zoom only.
  - Use stable callbacks: one `useCallback` that takes the marker id.
- **Result:** a still marker, a line or a grove never re-renders on a tick.

**R2. The story's day/night window comes from the theme.**
- **The bug:** `load(theme)` passes the theme into `markerState` as the time window. With "Follow my phone" in dark mode at noon, the markers use the night window, so Day-only fragments look out of window and Night ones look playable.
- **The fix:** the window is always `currentTimeWindow` for the installed region (and `"day"` with no region). The theme only picks colors.
- **Test:** "Follow my phone" in dark mode by day still gives day-window marker states.

**R3. The puck position is read only once.**
- **The bug:** the grove chip and Recenter both use the first fix forever.
- **The fix:**
  - Track the position while the map is on screen, using `MapView`'s `onUserLocationChange` (the SDK dot already provides it) or a foreground `watchPositionAsync`.
  - Throttle it, and keep it in memory only.
  - Stop when the screen loses focus or the app goes to the background.
  - Never write it to SQLite or logs.

**R4. The screen-reader label is the teaser text.**
- **The brief asks** for the tier and state from the strings module.
- **The fix:** the label is the tier and state, then the card text. For example: "Root, unexplored. Begin near the refuge entrance."
- **Add the state strings** (unexplored, changed, completed, locked) to `strings.ts`.

## Notes (do these too)
- **N1. Make map-ready real state.** The first-camera effect checks `mapRef.current`, which isn't state, so the effect can bail before the map is ready and never run again.
- **N2. Night labels.** Set `labels.text.stroke` to the ground color at night (and to paper by day), so Google's default white label halo doesn't glow on the blueprint. Judge it on the device.
- **N3. Physical cards.** Show the teaser, then "Scan the code here to listen."
- **N4. Confirm the signing fingerprint before Jordan uses it.**
  - **The concern:** `expo run:android` signs with the debug keystore inside the generated `android/app` folder (from Expo's template). That may not be the one in `%USERPROFILE%\.android`.
  - **The check:** run `npx expo prebuild --platform android --no-install` from `apps/mobile` (`android/` is gitignored, so don't commit it). Then run `gradlew signingReport` in `android/`, or `keytool` on `android/app/debug.keystore`. Report the **debug** variant's SHA-1.
- **N5. The emulator is optional now.** If you use it, cold-boot with `-no-snapshot-load`.

## Next
1. Push this review (docs only).
2. **Do N4 first, and put the SHA-1 at the top of your reply,** so Jordan can set up the Maps key while you work.
3. Fix R1–R4 and N1–N3.
4. **Step 8.** Jordan has merged A2 Part 1.
   - Merge `origin/master`, run `pnpm install`, and commit the lockfile if it changes.
   - Wire in the A2 exports, and delete the stand-ins.
   - Draw the halo as plan-review R3 describes. Measure `groveShape(…, { extraM })` for the four bands in a dev log on the device.
5. **Stop before the device run.** Update `M5b-report.md`, push, and say you're ready. Claude then walks Jordan through the key, and you run the device checks.
