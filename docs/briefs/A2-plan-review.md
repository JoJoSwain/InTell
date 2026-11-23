# A2 plan review (Lane A): the derived grove boundary

**Tip reviewed:** `0d4f8ea` · **Brief:** `docs/briefs/A2-grove-boundary.md` · **ADR:** 0006

## Verdict

**Approved. Build Part 1 as planned, with R1–R3 below.**

The plan gets the hard parts right:
- an azimuthal-equidistant projection (the equirectangular point is correct, and the error budget is in the right place)
- an exact disk union in plain TypeScript, with no clipping library
- a determinism scheme that sorts by id
- a precise cascade finding
- `pack_builds.bbox`, so the index and the pack can't disagree

## Required changes

**R1. Drop a piece that sits inside another piece.** Filling holes creates a case the plan doesn't handle: a fragment whose circle sits alone inside an enclosed gap.
- **Today's result:** its ring survives as a second polygon inside the filled outer one. That's a MultiPolygon with overlapping pieces (not valid RFC 7946), a dashed outline drawn in the middle of the grove, and an ambiguous `distanceInsideMeters`.
- **The fix:** after dropping holes, drop every polygon that lies inside another polygon.
- **Test:** a ring of fragments with one lone fragment in the middle of the gap gives a single polygon.

**R2. `crossLinkTip` returns `toward`, not `null`, when the segment never leaves `boundary`.**
- **When it happens:** groves may overlap (DATA_MODEL principle 2), so the other fragment can sit inside this grove's shape.
- **Why it matters:** returning `null` and dropping the link would hide a real plot bridge. Ending the arrow at the other fragment keeps it visible.
- **`null` remains** only for a degenerate segment (`from` equals `toward`).
- Update the test list and the schema note ("a `null` tip is omitted") to match.

**R3. Make the rebuild cascade grove-level, and count links before and after the release.** The per-fragment rule misses two cases:
- **A move elsewhere in the grove changes its shape.** Moving fragment X in grove A can change A's shape even when X has no links. Every tip that ends on A's edge then moves, including tips in grove B's pack for links to A's other fragments. The plan's own sentence ("both ends of every link to that grove rebuild") needs a grove-level rule. **The rule:** for each grove with a fragment in the release, enqueue every grove linked to **any** of that grove's non-retired fragments, in either direction.
- **A link is removed.** If B's fragment drops its prerequisite in A, A's pack still holds the old `"unlocks"` link until A rebuilds. **The rule:** count links from the live (pre-release) snapshots **and** from the release's new ones.
- **Tests:** keep the pgTAP for both directions, and add one where the moved fragment has no link of its own, and one where a link is removed.

## Notes (no answer needed)
- **N1. Tessellation:** use `n = ceil(span / θ)` equal steps per arc, so the last step isn't a sliver.
- **N2. Retired ends:** cross-grove links skip retired fragments at both ends, the same as `storyWebLinks`.
- **N3. The builder's `null` throw:** confirm in the report that the publish checks already block a grove with no non-retired opening root, so this throw can't be reached from a passing publish. If they don't, add that publish error in Part 2.
- **N4. Old snapshots (Part 2):** stored grove snapshots still carry `boundary`. When you remove it from `GroveSnapshot`, make sure older rows still parse (an optional, ignored key) until staging republishes.
- **N5. Performance:** besides the 300-fragment layout, report (don't assert) a dense worst case, such as 300 fragments within 100 m. If it's slow, a uniform grid over the disks is the fix.
- **N6. Determinism:** builds must match each other in the builder's runtime (Deno). The Node shuffle test is the right proxy. Don't compare bytes across engines, since `Math` functions can differ in the last bit.

## Answers to the spec gaps
- **G1. Mobile fixtures: approved.** Update only `apps/mobile/src/packs/sync.test.ts` and `install.test.ts` to schema 4, as proposed. Claude has told Lane B not to touch those two files until Part 1 merges.
- **G2. Holes filled: approved,** as ADR 0006's default. Jordan may still change it, and if he does, it's a one-line change.
- **G3. `FAR_PIECE_M = 1000`, warning only: approved,** on the same terms.
- **G4. The admin preview uses the working rows: approved.** That's what "the shape the next publish would produce" means.
- **G5. The index bbox between the PRs: accepted.**
- **Part 2: dropping `groves.boundary` is approved,** with `pack_builds.bbox` backfilled as planned.

## Next
1. Push this review (docs only) to the branch.
2. Build **Part 1**, steps 1–8 of the plan, with R1–R3.
3. Write `docs/briefs/A2-report.md`, starting with `Lane A · A2 Part 1`. Cover:
   - the CI step and its first green run
   - the test list with results
   - the 300-fragment time and the dense-case time
   - the cascade migration
   - N3
   - a sample schema 4 grove pack from the local stack (boundary and `crossGroveLinks`)
   - `git log --oneline origin/master..HEAD`
   - any deviations
4. Retitle the PR "A2 Part 1: grove shape, pack schema 4, builder", and stop for implementation review.
