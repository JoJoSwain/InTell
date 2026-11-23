# M5b brief (Lane B): the map home

**Lane:** B (Mobile) · **Branch:** `b/m5b-map-home` (in `C:\dev\intell-lanes\b`, cut from `ecefe74`). The branch already carries the design standards, ADR 0006 and this brief. · **Plan first:** run `pnpm install`, write `docs/briefs/M5b-plan.md`, push, open the PR, and stop for Claude's plan review before writing code.

**What M5b is:** the home screen as Jordan and Ashley designed it on 2026-11-22. That covers:
- the design tokens and fonts
- the styled Google map by day and by night
- groves, and markers with their pulses
- the story web
- the screen's constant controls

**Sources:**
- `docs/design/MOBILE_HOME_STANDARDS.md` (**the standards**). It wins over DESIGN.md §1–§4.
- ADR 0006, ADR 0002 and ADR 0005
- TECH_SPEC's map row, and PRODUCT_SPEC's Home: Map row
- the S0B review (D1)
- your M5a data layer

**M5 is now split three ways:**
- **M5b**, the map home, now.
- **M5c, Embark**, after worksheet rows 4.2 and 4.4 and Lane A's relay.
- **M5d, first run:** the splash, animation, welcome, location explainer and app icon, after worksheet rows 6.x and 1.6.

## Depends on Lane A's A2 Part 1 (in progress in parallel)

These come from `packages/shared` when A2 Part 1 merges. **Lane B never edits `packages/shared` or `supabase/`.**
- `toMultiPolygon`, and `pointInPolygon` that works on MultiPolygons
- `groveShape(…, { extraM })`, for the halo
- `MarkerState.pulse`, which is `"tier" | "changed" | "none"`
- `storyWebLinks`
- grove pack schema 4, with a MultiPolygon `boundary` and `crossGroveLinks`

Build everything else first, behind small interfaces. When Claude says A2 Part 1 has merged, merge `origin/master` and wire these in. M5b can't finish before then.

## Scope

**1. Tokens and fonts** (standards §1)
- Put the palette (day and night) and the tier colors in `src/ui/tokens.ts`.
- Bundle **Questrial** with `expo-font`, with its OFL license file next to the font. Use it only for the brand voice listed in §1.3, and never fake a bold.
- Use the system font for reading text. It must respect the phone's text size and hold at 200%.

**2. Day and night** (standards §1.4)
- The theme follows `currentTimeWindow` for the installed region's sun reference and time zone. Check it again on foreground and at the next transition.
- **Settings → Appearance:** "Match the story's day and night" (the default) or "Follow my phone". Keep the choice in the device database.
- With no region installed, follow the phone.

**3. The map** (standards §3A, ADR 0006 §4)
- Use `react-native-maps` with `PROVIDER_GOOGLE` on **both** iOS and Android (ADR 0002). You may borrow patterns from `origin/preview/m5-google-map-home`, but don't merge it (S0B D1).
- **Keys:** read the Maps keys from env **names** at build time. List the names, never values, in `apps/mobile/.env.example`. Never commit or log a key.
- **Styles:** the plan-drawing day style and the blueprint night style, with the values in the standards §3A.
  - Hide every POI, business, parking lot and gas station. Hide transit stations for now; M5c may revisit them.
  - The plan picks JSON styles in the repo or cloud styles behind Map IDs, with evidence from the current Google and `react-native-maps` docs. Switching at sunset must not reload or remount the map.
- **Puck and controls:**
  - Use the SDK's own location dot (worksheet 2.4 is still open).
  - Turn off the map's own buttons and the Android toolbar.
  - **Recenter** appears only after the listener pans away.
- **First camera:** the listener's location if allowed, otherwise the nearest installed grove, otherwise the region.
- **Location:**
  - Ask for While Using permission only.
  - The location explainer (worksheet 6.4) isn't designed yet. Until it is, show a minimal interim card before the system prompt, with placeholder copy in the strings module, marked for replacement.
  - Without permission, the map still works, just without the puck.

**4. Groves** (standards §4, ADR 0006 §1)
- **Draw every piece** of each installed grove's boundary. Normalize a schema 3 Polygon to a MultiPolygon until A2 lands.
- **The outline and fill** follow §4.2.
- **Dashes:** the plan confirms dashed polygon strokes on each platform. If they aren't supported, draw the outline as dashed polylines over an unstroked fill.
- **The halo** (§4.3) grows outward, is drawn only outside the grove, and runs on the shared beat. The plan proposes the technique and its cost. One option is a band between the shape and `groveShape(…, { extraM })`, with animated offset and opacity.
- **The grove-name chip** (top center) shows only while the puck is inside a grove, in any piece.
  - Tapping it opens a simple grove sheet with the name and premise.
  - Stop exploring comes with sessions in M6.

**5. Markers** (standards §5, ADR 0006 §2)
- **Form and state:**
  - Hollow rings at the tier sizes.
  - Their state comes from the shared `markerState`, fed by the device database's completions and unlocks and by the current window.
  - Out-of-window markers look locked (35%, still) until worksheet 3.3 is decided.
- **Accessibility:**
  - 48 pt tap targets.
  - A screen-reader label for each marker, such as "Root, unexplored", kept in the strings module.
- **The pulse** (§5.3):
  - It runs on **one shared one-second clock** (§7), and only markers on screen animate.
  - **Reduce Motion** turns each pulse into a still ring in the pulse color at its starting size. It must follow live changes to the setting.
- **Tap:** a small teaser card shows the teaser only, or the change teaser for a changed fragment. It never shows the title. The final pop-up (3.7) and the marker sheet (5.1) come later.
  - A physical marker looks identical. Its card says "Scan the code here to listen." Scanning itself is M6.

**6. The story web** (standards §6, ADR 0006 §3)
- **In-grove lines** come from `storyWebLinks`.
- **Style:**
  - Weight: 1.5 pt if either end is a Root, otherwise 1 pt.
  - Dash: 4/3.
  - Strength by target: reachable 85% ink, locked 45% (at night, white at 80–85% and 45–50%).
  - Order: under the markers, above the grove fill.
- **Trims:** lines are geographic but the trims are in points. Convert the trims to metres at the current zoom, and recompute on zoom change, not every frame.
- **Cross-grove arrows** come from `crossGroveLinks`: a line from the marker to `tip`, ending in an open chevron about 8 pt wide. Wire these last, after A2.

**7. Controls** (standards §2)
- **The wordmark slot** is top left, from `assets/brand/`. Until Ashley's file arrives:
  - production shows nothing there
  - dev builds show a placeholder
  - never type "InTell" as the logo
- **Settings,** top right, is a 44 pt button with three lines. It opens a Settings screen with Appearance, and moves the existing staff and dev entries under it.
- **The bottom row** (Chronicle, Embark, Journal) uses the §2.2 sizes and the plan-drawing button styling.
  - Chronicle and Journal open simple placeholder screens (worksheet 5.5 is still open).
  - Embark opens a placeholder until M5c.
- **Remove the M0 leftovers:** the old bar (Journal · Grow · Settings) and the `grow` route.
- **Fit:** everything must fit a 360 pt-wide phone and respect the safe areas.

**8. Strings:** keep all user-facing text in one strings module, English for now and ready for i18n.

**9. Dev fixtures,** installable from the dev data screen:
- **A demo grove laid out like the design canvas,** with seeded completions so every state shows: R1, B1 changed, B2, L1, B3 completed, L2 completed, R2 locked, B4 locked, L3 locked.
  - Each locked fragment's links must include at least one unexplored prerequisite.
  - Its boundary comes from `groveShape` once A2 lands.
- **A 300-marker stress grove.**

## Accept when
- [ ] `typecheck`, `lint`, `test` and the clean `expo export --platform android` pass.
- [ ] **Unit tests:**
  - the theme switches at sunset, and "Follow my phone" overrides it
  - each marker state maps to the right ring, pulse color and Reduce Motion stand-in
  - the web lines get the right weight and strength, and the trim math is right
  - the grove chip reads inside and outside correctly, islands included
  - if the styles are JSON, they hide POIs, businesses, parking and gas stations
- [ ] **On a dev build** (an Android emulator, plus Jordan's phone):
  - the demo grove matches the canvas by day and by night
  - a simulated sunset switches the style without reloading the map
  - the Reduce Motion stand-ins show
  - the 300-marker grove pans smoothly on a mid-range Android, with pulses on screen. Name the device and give frame stats.
  - the report includes day and night screenshots
- [ ] No location is stored or logged, and no key is in the repo.

## Out of scope
- Embark (M5c) and the first run (M5d)
- Sessions, proximity, audio and QR (M6)
- Chronicle and Journal content
- The final layouts of the marker sheet, grove sheet and teaser pop-up

## Plan (stop after this)
`docs/briefs/M5b-plan.md` should cover:
- **Libraries and versions:** `react-native-maps` with React Native 0.88's New Architecture and Expo SDK 58's config plugin, `expo-location`, and the fonts.
- **The map-style approach,** with evidence.
- **Markers and pulses: the riskiest part.** Propose an approach, such as pre-rendered ring images with sprite-frame pulses for on-screen markers, animated views, or an overlay canvas. **Spike it** and give measured numbers before building the rest.
- **Dashed strokes** on each platform.
- **The halo technique.**
- **The web-line trims.**
- **The module layout,** and how state flows from the database to the markers.
- **The test strategy.**
- **The device-test plan,** including how Jordan installs a dev build on his phone.
- **The order of work,** and where A2 plugs in.
- **Spec gaps.**

Push with `git push -u origin b/m5b-map-home` (this also pushes the standards and ADR commits), open a PR titled "M5b: map home (plan)", and **stop for plan review.**
