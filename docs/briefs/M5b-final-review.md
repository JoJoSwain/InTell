# M5b final review (Lane B): the map home

**Tip reviewed:** `4ab312b` · **Brief:** `docs/briefs/M5b-map-home.md`, plus `M5b-review.md` and `M5b-design-update.md`

## Verdict

**Accepted, with two small fixes (R1–R2).** It's ready to merge once they're pushed, the branch is up to date with `master` (A2 Part 2 has merged since), and `check` and `db` are green.

**The frame stats are excellent.** Under 1% janky frames in all three pans, with the 95th percentile at 8–12 ms. The 40-pulse cap works, and the design update matches the standards: solid centers, brick pulses, 2.5 pt rings, and an outline that breathes with no halo.

## Required changes

**R1. A live day-to-night switch leaves the grove fill in the day color.**
- **What the screenshots show:** `night.png` was taken after a live switch (Follow my phone, then night mode). Its grove fill is white at 50%, the day token. `reduce-motion.png` was taken after a reload, and there the fill is the correct `#2B5D7B` at 50%.
- **The diagnosis:** the markers and the outline switch correctly, but the `Polygon`'s `fillColor` change isn't applied to the native view.
- **The fix:** recreate the fill polygons when the theme changes (for example, put the theme name in their `key`). That only happens at sunrise and sunset, so it's cheap.
- **Check:** retake `night.png` after a **live** switch, without a reload, and confirm the fill.

**R2. Turn off 3D buildings.** `day.png` shows Google's extruded, shaded buildings. The standards draw buildings as flat fills with a hairline (§3A). Set `showsBuildings={false}`.

## Notes (no change needed now)
- **One-way arrows on roads.** If `road` → `labels.icon` → `visibility: off` hides them, add it to both styles. If not, they stay. Report which.
- **Night street labels** show the road's double line through the gaps between words ("S·Main·St"). That's a polish item for Ashley's review, not a blocker.
- **Zoomed out, markers overlap** (see `night.png`). What the map shows far out is worksheet row 2.6 ("Zoomed-out and far away"), which hasn't been decided. Claude raises it with Jordan.
- **Dev-only elements:** the "Grove" fly button, the "dev" wordmark placeholder, and the Expo tools button over Settings are all dev-only. Confirm the first two are behind `__DEV__`; the plan says they are.
- **iOS stays pending:** dashes and styles on an iOS device. Claude carries these forward to when an Apple Developer account exists.

## Next
1. Push this review.
2. Merge `origin/master` (A2 Part 2), run `pnpm install`, and commit the lockfile if it changes.
3. Fix R1 and R2, try the road-arrow note, and retake `night.png` after a live switch.
4. Run `test`, `typecheck`, `lint` and the clean export. Add a short "Final fixes" section to `M5b-report.md`, push, and stop.
