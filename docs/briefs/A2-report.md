# A2 report — Part 1

Lane A · A2 Part 1. Steps 1–8 of `docs/briefs/A2-plan.md`, with R1–R3 from the plan review.

## CI export

`.github/workflows/ci.yml` runs `expo export --platform android` in the existing `check` job, after `pnpm test`, into a temp directory. No secrets. This was not run on this machine. The first green run is the `check` job on this push.

## Tests

`pnpm lint`, `pnpm typecheck`, and `pnpm test` passed.

`@intell/shared`: 191 tests. New and changed coverage:

- `groveShape`: one disk, overlap, tangent, a disk inside another, duplicate centres, three circles meeting on the outline, a filled gap with the inner piece dropped (R1), islands, shuffle stability, `extraM`, 40 random layouts, 300 fragments.
- `farPieces`: a gap over 1 km warns; 900 m does not.
- `polygon`: a point in the second piece of a MultiPolygon is inside, and outside every piece is 0.
- `music`: the grove-edge fade applies in that second piece.
- `markerState`: unexplored `"tier"`, changed-and-playable `"changed"`, completed / locked / out of window / changed-while-out-of-window / retired `"none"`.
- `storyWebLinks` and `crossLinkTip`: 100 ft past the exit, stop at the other grove, stop at `toward`, return `toward` when the segment never leaves (R2), `null` only when the points coincide.
- `crossGroveLinks`: one link each way, retired ends dropped, two calls match.
- Pack fixtures parse as schema 4. Mobile `sync.test.ts` and `install.test.ts` do too (G1).

pgTAP `113_a2_linked_groves.test.sql`: 4 tests, pass. A fragment that requires another grove, a revision of an unlinked sibling, the grove that holds the prerequisite, and a link that exists only in the old snapshot.

**300 fragments.** A dedicated run: spread layout 15.7 ms (budget 50 ms), dense layout (5 m spacing, everything overlapping) 146.6 ms. Inside the full suite those were 22.5 ms and 375.3 ms. The dense case is reported, not asserted (N5). No grid.

## Cascade

`supabase/migrations/20261123090000_a2_linked_grove_rebuild.sql` adds `fn_release_linked_groves`. `fn_publish_commit` calls it **before** it replaces snapshots, then enqueues those groves.

For every grove with a fragment or revision in the release, the function takes that grove's non-retired fragments from the live rows and from the published snapshots. It enqueues every other grove linked to those fragments in either direction. A link that the release removes is still visible on the old snapshot, so the other grove rebuilds (R3).

## N3

`fn_publish_check` already adds a `NO_ROOT` error when `fn_grove_has_opening_root_publish` is false (`20261121180004_m3e_checklist_helpers.sql`). That is a published, non-retired root, including one this release is publishing. A passing publish cannot hand the builder a grove with no disk, so the `PACK_BUILD_FAILED` throw on a null shape is a backstop. Nothing to add in Part 2 for this.

## Sample from the local stack

The migration was applied in place and recorded. The database was **not** reset. The edge function process was not restarted, so the live `pack_builds` rows are still schema 3 until the next rebuild.

The figures below are what the builder will write. They come from the published fragment snapshots of the two demo groves, run through `groveShape` and `crossGroveLinks`.

Farmington (`…0010`) is a MultiPolygon of **5** pieces. The first ring has 180 vertices and starts at `[-111.9298638, 40.9612363]`. The pieces are separate clusters: the refuge spans more than a root buffer.

```json
"crossGroveLinks": [
  {
    "fragmentId": "aaaaaaaa-bbbb-4ccc-8ddd-000000000030",
    "otherFragmentId": "aaaaaaaa-bbbb-4ccc-8ddd-0000000000c1",
    "otherGroveId": "aaaaaaaa-bbbb-4ccc-8ddd-0000000000c0",
    "direction": "unlocks",
    "tip": { "lat": 40.9612169, "lng": -111.9275237 }
  }
]
```

The nearby grove (`…00c0`) is 2 pieces. Its link is the other direction: `…00c1` **requires** `…0030`, tip `{ "lat": 40.9612169, "lng": -111.9266566 }`.

## git log

`git log --oneline origin/master..HEAD` after the implementation commit:

```
b1dce9e feat: derive grove boundaries and publish them as schema 4
7038bae docs: A2 plan review (R1 nested pieces, R2 tip inside the grove, R3 grove-level cascade)
0d4f8ea docs: A2 plan for the derived grove boundary
8e25861 docs: ADR 0006 (map home), A2 and M5b briefs, roadmap
a84f986 docs: roadmap status at the end of 2026-11-22
8eff2c3 docs: mobile home-screen design standards from the 2026-11-22 session
```

## Deviations

- R1 drops a polygon whose interior point lies inside another polygon, after holes are discarded.
- R2: `crossLinkTip` returns `toward` when the segment never leaves. `null` is only the degenerate segment.
- The three-circle fixture puts the shared point on the outline (centres to the south). A point in the middle of three disks is inside the union, so it is not a vertex.
- Part 1 does not change `get_pack_index()`. The drawn polygon still supplies the bbox.
- G1: the two mobile fixtures are schema 4, one piece, `crossGroveLinks: []`. No other mobile files changed.
