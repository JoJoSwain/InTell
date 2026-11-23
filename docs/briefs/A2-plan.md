# A2 plan — derived grove boundary

Lane A · A2. Plan only. No module code in this commit.

Part 1 is the shared code, pack schema 4 and the builder. It merges first, because M5b reads it. Part 2 is the database and the admin, on a new branch after Part 1 merges. Lane A does not edit `apps/mobile` except the gap in G1.

Out of scope: the Embark relay (A3), M4b, and any phone UI.

---

## Union algorithm

`groveShape` unions one disk per fragment. The radius is `GROVE_BUFFER_M[tier]` plus `extraM` (0 when the builder calls it). Retired fragments are not passed in. Locked and physical fragments are.

**Projection.** Azimuthal equidistant, centred on the mean latitude and longitude of the input, Earth radius 6 371 000 m. Distance from that origin is exact. The error in the distance between two points a chord `L` apart is about `L³ / (24 R²)`. Across a 5 km grove (`L` = 5 km) that is about **0.2 mm**. A single buffer is at most 76.2 m across, where the same error is far under a millimetre. The 5 cm budget is the arc tessellation, not the projection.

Equirectangular is the wrong choice here. At 41° a point 2.5 km north of the centre has an east-west scale error of about 1.7 m on a 5 km line, which is larger than 5 cm.

**Sketch.**

1. Sort the fragments by `id`. Project every centre.
2. Drop a disk whose centre coincides with another and whose radius is smaller or equal. The larger disk remains.
3. For every pair, solve the two circle intersections in the plane. A pair closer than 0.1 mm to tangent (distance equal to the sum or the difference of the radii) is one vertex, not two and not none.
4. A disk with no intersection that lies inside another contributes no arc. Its centre is still inside the result.
5. Split each circle at its intersection vertices. Keep an arc only when its midpoint is not strictly inside another disk.
6. Stitch kept arcs into rings. An outer ring is counterclockwise (RFC 7946). A ring that bounds a gap is a hole and is **dropped**, so the gap counts as inside (ADR 0006 §1, still marked "confirm"; this plan fills holes).
7. Tessellate each kept arc so the sagitta is at most 5 cm: `θ = 2·acos(1 − 0.05 / R)`, step `θ`. Intersection vertices stay in the ring, unsmoothed.
8. Inverse-project, round to 7 decimal degrees (about 1 cm), drop a vertex that rounding made identical to its neighbour, and close the ring.

No new runtime dependency. A general polygon clipper does not keep circular arcs, and it would not run unchanged in Deno and React Native. The disk union is a few dozen lines of plain TypeScript.

**Edge cases the tests lock.**

| Input | Result |
|---|---|
| No fragments | `null` |
| One fragment | One ring, one polygon |
| Two overlapping | One ring through both intersection points |
| Two tangent | One ring, the contact point kept once |
| One circle inside another | The outer ring only |
| Two fragments on the same point | The larger radius only |
| Three circles through one point | That point is a vertex once on the ring |
| A ring of fragments around a gap | One outer ring; the gap tests inside |
| Two disks that do not meet | A MultiPolygon of two polygons |

`extraM` grows every radius before the union. For a union of disks that is the outward offset, so `groveShape(fragments, { extraM })` matches a call whose radii were increased by `extraM`. The phone passes `extraM` for the halo. The builder passes none.

---

## Determinism

Pack bytes are hashed, so the same fragments must produce the same JSON.

- Sort the input by `id` before any geometry.
- Visit circle pairs in id order.
- On each ring, start at the vertex with the smallest longitude, then the smallest latitude, after rounding.
- Sort the polygons of the MultiPolygon by that same first vertex.
- Do not emit holes.
- The builder runs the result through `canonicalJson` with the rest of the pack, as it does today.

A test shuffles the input and compares `JSON.stringify` of the shape.

---

## Signatures

```ts
export const GROVE_BUFFER_M = { root: 76.2, branch: 45.72, leaf: 30.48 } as const;
export const CROSS_LINK_TIP_M = 30.48; // 100 ft
export const FAR_PIECE_M = 1000;

export type GeoJsonMultiPolygon = {
  type: "MultiPolygon";
  coordinates: number[][][][];
};

export function toMultiPolygon(
  geometry: GeoJsonPolygon | GeoJsonMultiPolygon,
): GeoJsonMultiPolygon;

export function groveShape(
  fragments: readonly { id: string; tier: "root" | "branch" | "leaf"; lat: number; lng: number }[],
  opts?: { extraM?: number },
): GeoJsonMultiPolygon | null;

export function pointInPolygon(
  point: LatLng,
  geometry: GeoJsonPolygon | GeoJsonMultiPolygon,
): boolean;

export function distanceInsideMeters(
  point: LatLng,
  geometry: GeoJsonPolygon | GeoJsonMultiPolygon,
): number;

export type PulseKind = "tier" | "changed" | "none";

export function storyWebLinks(
  fragments: readonly {
    id: string;
    retired: boolean;
    requires: readonly (readonly string[])[];
  }[],
): { fromId: string; toId: string }[];

export function crossLinkTip(
  boundary: GeoJsonPolygon | GeoJsonMultiPolygon,
  from: LatLng,
  toward: LatLng,
  other?: GeoJsonPolygon | GeoJsonMultiPolygon | null,
): LatLng | null;

export function farPieces(
  shape: GeoJsonMultiPolygon,
): number[];
```

`pointInPolygon` is true when the point is inside any piece. `distanceInsideMeters` is the distance to the nearest edge of the piece that contains the point, and 0 when the point is outside every piece. Existing Polygon callers stay valid. `MusicCueInput.boundary` widens to `GeoJsonPolygon | GeoJsonMultiPolygon`. One music test puts the listener in a second piece and checks the edge fade. `GROVE_MUSIC_EDGE_FADE_M` stays 60.

`storyWebLinks` draws a line from the prerequisite (`fromId`) to the fragment that requires it (`toId`). Links are deduplicated and sorted by `fromId`, then `toId`. A retired fragment is dropped at either end. A member id that is not in the list is another grove, and is skipped.

`crossLinkTip` walks the segment from `from` to `toward`. It finds the last exit from `boundary`, then steps `CROSS_LINK_TIP_M` further along the segment. If `other` is entered before that step finishes, the tip is that entry point. The tip never passes `toward`. If the segment never leaves `boundary`, the result is `null`.

`farPieces` returns the indexes of pieces whose distance to the nearest other piece is greater than `FAR_PIECE_M`. It warns. It does not remove the piece.

### Pulse

`MarkerState.pulse` becomes `PulseKind`. Only a playable-now marker pulses.

| State | Opacity | `playableNow` | `pulse` |
|---|---|---|---|
| Unexplored (unlocked, in window, not completed for this contingency) | 1 | true | `"tier"` |
| Changed (playable now, an older completion, not the current contingency) | 1 | true | `"changed"` |
| Completed, in window | 1 | false | `"none"` |
| Locked | 0.35 | false | `"none"` |
| Out of window | 0.35 | false | `"none"` |
| Retired | 0, `hidden` | false | `"none"` |
| Changed and out of window | 0.35 | false | `"none"` |

This narrows ADR 0005 §3: a changed fragment outside its window does not pulse. The distinct out-of-window look (worksheet 3.3) stays open. This function does not invent one.

---

## Pack schema 4

`GrovePack.schema` becomes `z.literal(4)`. `grove.boundary` becomes a `GeoJsonMultiPolygon`. Add:

```ts
crossGroveLinks: {
  fragmentId: string;
  otherFragmentId: string;
  otherGroveId: string;
  direction: "requires" | "unlocks";
  tip: { lat: number; lng: number };
}[]
```

Sorted by `fragmentId`, `otherFragmentId`, `direction`.

- `"requires"`: a fragment in this grove lists the other fragment in `requires`.
- `"unlocks"`: a published fragment in another grove lists this grove's fragment in `requires`.

`tip` is `crossLinkTip` with this grove's derived shape, this fragment, the other fragment, and the other grove's derived shape. A `null` tip is omitted. The link is not emitted, because the phone would have nowhere to put the arrow.

`PreviewManifest` stays `schema: "preview/1"`. The grove packs inside it are schema 4. That is what "embeds schema 4" means. The wrapper's own literal does not change.

`packages/shared` tests that parse a grove pack (`packs.test.ts`, `syncDiff.test.ts`) move to schema 4 with a one-piece MultiPolygon and `crossGroveLinks: []`. `manifestShas` does not need a new sha walk: the new fields are not assets.

**Deno.** The builder runs in the edge function and cannot import the workspace package. `tools/sync-edge-shared.mjs` gains `src/geo/polygon.ts`, `src/geo/groveShape.ts` and `src/story/web.ts`, with the same `.ts` import rewrite as the other copies. `pnpm db:sync-edge-shared` then `pnpm db:check-edge-shared`.

### Builder

`buildGrovePack` stops reading `groves.boundary`. `boundary` is `groveShape` of the grove's published, non-retired fragments, standard and physical. The builder calls it with no `extraM`. If that returns `null`, the build throws `PACK_BUILD_FAILED`: a schema 4 pack requires a boundary, and a publishable grove has an opening root.

`crossGroveLinks` are computed from published snapshots of the other groves' fragments, so both shapes are the published ones. The builder does not trust the drawn polygon for either side.

The pack index bbox is unchanged in Part 1. `get_pack_index()` still reads `groves.boundary`. Between the two PRs the index bbox and the pack boundary can disagree. Part 2 is what makes them the same.

### Cascade

Today `fn_publish_commit` rebuilds a grove, and also every grove that has a fragment **requiring** a fragment whose revision or snapshot is in the release (DATA_MODEL §10, the `externalPrerequisites` sentence). That keeps the other grove's contingency numbers current.

It does not rebuild:

- the grove that **owns** a fragment required by something in this release (the `"unlocks"` link appears on that grove)
- a linked grove when this grove's shape changes because of a fragment the other grove does not require (the tip stops on this grove's edge)

Part 1 adds one forward migration that replaces `fn_publish_commit`'s enqueue, and only that. For every fragment in the release it also enqueues:

- the grove of each prerequisite member (the other end of a `"requires"` link)
- the grove of each fragment that requires it (the other end of an `"unlocks"` link)

A shape change is a fragment snapshot in the release, so both ends of every link to that grove rebuild. Groves with no link to the release are not rebuilt. Job payloads stay ids only. Tips live in the pack, never in `jobs.payload`.

A pgTAP test publishes a fragment move in grove A and expects a `rebuild_pack` job for grove B when B requires A, and when A requires B.

---

## Part 2 — `groves.boundary`

**Drop the column.** Do not keep it as a cache.

The shape is derived. A cache can drift from the pack, and the admin preview already recomputes it in the browser. The bbox the index serves should be the bbox of the pack that was built, written by the builder, not a second copy of a polygon.

### Migrations (forward only, one PR)

1. `pack_builds.bbox double precision[4]` (west, south, east, north), nullable. Backfill live grove builds from `ST_XMin` / `ST_YMin` / `ST_XMax` / `ST_YMax` of `groves.boundary`, so the index still has a box before the republish.
2. The builder writes `bbox` from the derived MultiPolygon when it persists the pack. `get_pack_index()` reads `pack_builds.bbox` for grove rows and no longer joins `groves.boundary`. A grove with no live build is absent, which matches "no published fragments, no index row".
3. Replace `fn_fragment_guard` so it no longer calls `ST_Covers`. Drop the same check on fragment insert and update. Drop `fn_set_grove_boundary`.
4. Remove `boundary` from the grove snapshot projection (`fn_snapshot_projection` and `GroveSnapshot` in shared). Working groves no longer carry a polygon.
5. Drop the gist index and `groves.boundary`.
6. Update `seed.sql` and `tools/demo-geometry` so a grove is created without a polygon. Fragment locations stay.

Region bounds are untouched. Ambience and music zones stay hand-drawn polygons. Terra Draw stays for those.

### Admin

- `grove-boundary-map.tsx` loses the polygon tool and the `fn_set_grove_boundary` calls in `story/groves/actions.ts`.
- The grove map draws `groveShape` of the grove's current non-retired fragments, including drafts, read-only. Moving or placing a fragment recomputes it in the browser. That is the next publish, not the last published pack.
- `farPieces` feeds a warning on the grove page and on the publish screen. `fn_publish_check` stays SQL and does not reimplement the union. The admin merges a non-blocking `GROVE_FAR_PIECE` warning into the check list it shows. Go-live still blocks only on SQL errors.
- Playwright: `m3c-grove-authoring`, `m3c-writer-refusal` and `m3d-publish-from-scratch` place fragments and expect the derived outline. They stop drawing a grove polygon.

### pgTAP

Update the tests that still require a fragment inside a drawn boundary: `010`, `011`, `013`, `015`, `042`, `068`. Add a test that a grove inserts with no boundary, a test that a fragment insert does not check a polygon, and a test that `get_pack_index()` returns the bbox stored on the live build.

---

## CI export (Part 1, first)

In `.github/workflows/ci.yml`, after `pnpm test` in the existing `check` job:

```bash
OUT=$(mktemp -d)
pnpm --filter @intell/mobile exec expo export --platform android --output-dir "$OUT"
```

No secrets. The job stays named `check`. The `db` job is unchanged.

---

## Tests

**Shape.** The fixed cases in the table above. A property loop of 40 layouts from `createSeededRng` (no new dependency): every vertex is within 5 cm of some circle and not inside another; every fragment centre is inside; a point inside any circle is inside the shape; a point in a constructed gap is inside; a point outside the expanded bounding box is outside. Determinism under shuffle. `extraM` matches the grown radii. 300 fragments finish in under 50 ms in Node. The implementation report records the measured time.

**Geometry and music.** A point in the second piece of a MultiPolygon is inside, and its inside-distance is to that piece. A point outside every piece is 0. The grove-edge music fade uses the MultiPolygon.

**Pulse.** The table above, one row each.

**Web.** Deduped sorted links. Retired ends dropped. A foreign member skipped. `crossLinkTip`: past the exit by 30.48 m; stops at the other grove when that is sooner; stops at `toward`; `null` when the segment never leaves.

**Builder.** Existing pack fixtures move to schema 4. A two-grove fixture with one link each way. Two builds of the same snapshots produce the same manifest sha. The cascade pgTAP above.

**Part 2.** The pgTAP list, the admin warning (a piece 1.1 km away warns, a piece 0.9 km away does not), and the three Playwright specs.

---

## Order of work

**Part 1, this branch**

1. The `expo export` step in `check`.
2. `groveShape` and its tests.
3. MultiPolygon support in `polygon.ts`, then the music test.
4. Pulse kinds in `unlock.ts`, and the table test. Update the existing boolean assertions.
5. `story/web.ts`.
6. Schema 4, the sync-edge-shared list, and `pnpm db:sync-edge-shared`.
7. The builder, the cascade migration, and the two-grove fixture.
8. `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm db:check-edge-shared`. The `db` job runs in CI. Say in the report if the local database was reset.

**Part 2, a new branch after Part 1 merges**

9. The migrations, seeds, demo geometry, and pgTAP.
10. The admin map, the warning, and the three e2e specs.
11. Staging republish is Claude walking Jordan through it. Not part of the coding.

---

## Spec gaps

**G1. Mobile fixtures.** `apps/mobile/src/packs/sync.test.ts` and `install.test.ts` call `GrovePack.parse` with `schema: 3` and a Polygon. Schema 4 makes `pnpm test` fail, and Lane A does not edit `apps/mobile`. Proposed: this PR updates only those two fixtures to schema 4, a one-piece MultiPolygon, and `crossGroveLinks: []`. No schema 3 parser remains (ADR 0006 §5). The phone UI is still M5b.

**G2. Holes.** ADR 0006 leaves "holes are filled" as confirm. Proposed: fill them. A listener walking through a ring of fragments stays in the grove.

**G3. The 1 km warning.** ADR 0006 leaves the distance as confirm. Proposed: `FAR_PIECE_M = 1000`, warning only, never a publish error.

**G4. Admin preview versus the pack.** The pack is built from published snapshots. The admin map uses the working fragment rows, so a draft move shows before publish. Proposed: that split is what "the shape the next publish would produce" means.

**G5. Index bbox between the PRs.** Part 1 does not change `get_pack_index()`. The drawn polygon still supplies the bbox until Part 2 writes `pack_builds.bbox` from the derived shape.
