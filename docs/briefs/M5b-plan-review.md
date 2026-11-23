# M5b plan review (Lane B): the map home

**Tip reviewed:** `57a6ff6` · **Brief:** `docs/briefs/M5b-map-home.md` · **Standards:** `docs/design/MOBILE_HOME_STANDARDS.md` · **ADR:** 0006

## Verdict

**Approved. Build it as planned, with R1–R3 below.**

The plan makes the right calls:
- **JSON styles in the repo,** switched by a prop with no remount.
- **Image markers with pre-rendered pulse frames,** where only markers on screen advance.
- **Outlines as polylines,** because polygon dashes don't work with Google on iOS. The iOS dash is converted from metres, which is a good catch.
- **Trims in metres per point,** recomputed when the zoom settles, not every frame.
- **The spike runs on a device first,** before the rest of the screen.

## Required changes

**R1. Hide POI labels and icons, not POI geometry.**
- **The problem:** `visibility: off` on all of `poi` also removes park and green-space shapes (`poi.park` geometry). The day map's natural-area wash and the blueprint's natural areas depend on those shapes.
- **The fix:** hide `labels` (both icons and text) for `poi`, `poi.business` and `transit.station`, and hide transit lines. Keep `poi.park` and `landscape.natural` geometry, styled with the §3A washes.
- **The test** checks that those labels are hidden and that the park geometry is still visible.

**R2. Draw every marker image on a transparent canvas at least 48 pt square, anchored at its center.**
- **Why:** Google Maps hit-tests a marker by its image bounds. A Leaf's ring (or its pulse frame) is far smaller than the 48 pt tap target, and a separate hit view isn't possible with image markers.
- **Use one canvas size per tier** for the still ring and every pulse frame, so a frame swap never moves the anchor.
- **Check the point size on a real Android density,** because react-native-maps' `image` can come out the wrong size. Say in the report how you made a 22 pt Root measure 22 pt.
- **Generate the PNGs with a committed script** that reads `src/ui/tokens.ts`. Don't draw them by hand, so a color or size change is one rerun.

**R3. Build the halo after A2, as growing bands.**
- **Skip the local edge-offset stand-in.** Offsetting a polygon correctly isn't trivial, and `groveShape(…, { extraM })` arrives with A2 Part 1. Until then, there's no halo.
- **When A2 lands, precompute four bands when the zoom settles,** at widths of ¼, ½, ¾ and the full 14 pt, each an outer ring with the grove as its hole. On each beat, show them in order at falling opacity. The halo then grows outward and fades, as the standards describe, and still makes only four prop updates per piece per second.

## Notes (no answer needed)
- **N1. Hands off two test files for now.** Lane A's A2 Part 1 updates `apps/mobile/src/packs/sync.test.ts` and `install.test.ts` to schema 4 (A2 plan G1, approved). Don't edit those two files until A2 Part 1 merges.
- **N2. Frame count.** Start at 8 frames, as planned. If the device numbers have room, try 12 and keep whichever looks smooth without dropping frames. Report both.
- **N3. Ring closure.** Outline polylines must repeat the first vertex, so the last edge is drawn.
- **N4. Before the first device run, Jordan has to set up the Maps key** (Claude walks him through it):
  - The Android key is restricted to the app's package **and** its signing certificates. A debug build needs the debug keystore's SHA-1 added to the key, or the map shows blank tiles.
  - When you're ready for the device step, tell him the exact SHA-1, from `keytool` against the debug keystore the build uses.
  - The key goes in `apps/mobile/.env`, never in a commit or a chat.
- **N5. iOS.** iOS device builds need a Mac or EAS plus an Apple Developer account, which doesn't exist yet. M5b can be accepted on Android. Record the iOS checks (dashes, styles) as pending in the report, and Claude carries them forward.
- **N6. The emulator isn't the performance check.** First run `emulator -list-avds`. If there's no AVD, stop and say so, and Claude walks Jordan through creating one. The emulator is for correctness. Smoothness for the acceptance needs a real mid-range Android phone, and Claude is confirming with Jordan which phone that will be.

## Answers to the spec gaps
- **Gap 1, the temporary Polygon wrap: approved.** ADR 0006 §5 is about the shipped app. A dev-time wrap that step 8 deletes is fine.
- **Gaps 2–3, the local stand-ins** for `markerState.pulse`, `storyWebLinks` and the shapes: **approved,** except the halo (R3). Delete them all in step 8.
- **Gap 4, the 15 s theme timer: approved.** It's cheap, and a next-transition helper isn't worth waiting for.
- **Gaps 5–8 and 10: accepted** as stated.
- **Gap 9, iOS dashes:** see N5.
- **Gap 11, the device spike:** see N6.
- **Gap 12, the session chip:** correct. ADR 0006 and the standards replace it, and Claude updates PRODUCT_SPEC when A2 merges.

## Next
1. Push this review (docs only) to the branch.
2. Follow the plan's order.
   - **Step 2, the device spike,** needs an emulator: see N6. If none is available, do steps 1 and 3 onward without device checks, and come back to step 2 when Claude says the emulator or phone is ready.
   - **Stop before step 8** if A2 Part 1 isn't on `master` yet. Open the PR for implementation review and say so.
3. Write `docs/briefs/M5b-report.md`, starting with `Lane B · M5b`. Cover:
   - the resolved versions
   - the spike numbers, with the device named
   - R1–R3
   - the test list with results
   - the clean-export result
   - day and night screenshots
   - the iOS items left pending
   - `git log --oneline origin/master..HEAD`
   - any deviations
4. Retitle the PR "M5b: map home", and stop for implementation review.
