# M5b design update (Lane B): after the first look on the Pixel

**Decided:** 2026-11-23, by Jordan, after watching the map home on his phone. The standards (`docs/design/MOBILE_HOME_STANDARDS.md` §1.2, §4.3, §5.1–§5.3, §7) and ADR 0006 §2 are updated in this commit. This is the to-do list.

## Changes

**1. The grove outline breathes; the halo goes** (standards §4.3)
- **Remove** the halo bands and their `groveShape(…, { extraM })` calls. The phone no longer needs `extraM`.
- **The fade:** the dashed outline's opacity eases from **100% to 60% and back** once per beat, on a smooth ease-in-out curve. It's brightest at the start of each beat, on the shared clock.
- **The fill doesn't change.** Only the outline polylines' stroke color changes per frame.
- **Reduce Motion:** a steady outline at 100%.
- **Measure** the per-frame cost, which should be tiny, and keep 60% in one constant so it's easy to tune.

**2. Solid marker centers** (standards §5.1–§5.2)
- **Day:** a white `#FFFFFF` center. **Night:** a `#163447` center.
- **Locked markers are drawn opaque, in faded colors.** Don't apply image opacity, or the map would show through again.
  - The ring is `#B0B4B8` by day and `#687B87` at night, with the same solid center.
  - Out-of-window markers look the same as locked.

**3. One pulse color** (standards §5.3)
- **Every unexplored pulse uses the Root brick:** `#763329` by day and `#B9574A` at night.
- **Each tier keeps its own size and growth:** ×1.8, ×1.48, ×1.24.
- **Changed fragments** still pulse forest green.
- **Reduce Motion:** a still brick ring (green for changed).

**4. Every ring is 2.5 pt.** The Leaf was 2 pt.

## How
- Update `markerArt.ts` and the tokens, then **regenerate the PNGs with the script.** Don't hand-edit them.
- **Update the tests:**
  - solid centers by day and night
  - opaque locked colors, with no image opacity
  - one pulse color for every tier
  - 2.5 pt rings
  - the outline's fade values across the beat, and its Reduce Motion value
  - no halo
- **On the Pixel,** take fresh day and night screenshots for `docs/briefs/M5b-screens/`, and add a **"Design update"** section to `M5b-report.md`.

## Also from the device run (Claude's review of `b2c3d64`)
The device run was thorough. The ring size is right: about 19.8 pt measured mid-stroke, where 19.5 is expected. Keeping 8 frames is fine, and the halo's multi-second recompute goes away with change 1. Three follow-ups:

**D1. Cap the pulses.**
- **What the run showed:** with all 300 stress markers on screen and pulsing, the clock ticks averaged 168 ms against 125 ms. The JS thread can't keep up.
- **The fix:** when **more than 40** pulsing markers are on screen, show every pulsing marker as its still ring (the Reduce Motion look) until the count drops back to 40 or fewer.
  - It's all or nothing, so the map never looks half-animated.
  - At that zoom, the pulses are too small to read anyway.
- Keep 40 in one constant.

**D2. Measure real frame stats.**
- Tick lateness is a JS-thread number, not frame smoothness.
- For a 10-second pan, run `adb shell dumpsys gfxinfo org.replaceplace.intell reset` before it and `adb shell dumpsys gfxinfo org.replaceplace.intell` after it.
- Report the janky-frame percentage and the 90th/95th-percentile frame times for:
  - the demo grove
  - the stress grove, zoomed out with the cap on
  - the stress grove, zoomed in to about 30 markers

**D3. Confirm the checks.** Say that `test`, `typecheck`, `lint` and the clean export pass after these changes and the device-run edits.
