# A2 brief (Lane A): the derived grove boundary, pulse kinds and pack schema 4

**Lane:** A (Platform) · **Branch:** `a/a2-grove-boundary` (in `C:\dev\intell-lanes\a`, cut from `ecefe74`, with this brief committed) · **Plan first:** write `docs/briefs/A2-plan.md`, push, open the PR, and stop for Claude's plan review before writing code.

**What A2 is:** the data and logic half of ADR 0006. **Sources:**
- `docs/adr/0006-map-home.md`
- `docs/design/MOBILE_HOME_STANDARDS.md` §4–§6
- DATA_MODEL §12 (packs) and §14
- the M4a shared code (`geo/polygon.ts`, `story/unlock.ts`, `audio/music.ts`)

**Two parts, two PRs** (like M4a):
- **Part 1** is what Lane B's map home (M5b) needs. It merges first.
- **Part 2** moves the database and the admin off hand-drawn grove polygons.

**Lane A never edits `apps/mobile`.**

## Part 1 (PR 1): CI export check, shared code, pack schema 4 and the builder

**0. The mobile export check (A1 review F1). Do this first,** since Lane B is about to add native map packages.
- Add `pnpm --filter @intell/mobile exec expo export --platform android --output-dir <a temp dir>` as a **step in the existing `check` job**, so the required check covers it.
- It must pass with no secrets set.

**1. The grove shape:** `packages/shared/src/geo/groveShape.ts`.
- `GROVE_BUFFER_M = { root: 76.2, branch: 45.72, leaf: 30.48 }`, which is 250, 150 and 100 ft.
- `groveShape(fragments: readonly { id; tier; lat; lng }[], opts?: { extraM?: number }): GeoJsonMultiPolygon | null`
  - It returns `null` for no fragments.
  - `extraM` grows every radius by that much. The union of the grown circles is exactly the outward offset of the shape. The phone uses this for the grove halo.
- **Exact arc union** (ADR 0006 §1):
  - circle intersections are exact vertices
  - arc vertices stay within **5 cm** of the true arc
  - holes are filled
  - outer rings run counterclockwise (RFC 7946)
  - coordinates are rounded to 7 decimals
- **Deterministic:**
  - sort the input by id
  - start each ring at a canonical vertex
  - sort pieces canonically
  - shuffled input must give identical JSON
- **Planar math** in a local projection centered on the fragments. State the projection, and its error across a 5 km grove, in the plan.
- **Add no new runtime dependency** unless the plan justifies it. The code must also run in Deno (the `from-shared` copy) and in React Native.
- **Tests:**
  - **Fixed cases:** one fragment; two overlapping; two tangent; one circle inside another; duplicate points; three circles through one point; a ring of fragments enclosing a gap (filled); islands.
  - **A property test over random layouts:**
    - every vertex lies on some circle (within 5 cm) and not inside any other
    - every fragment point is inside
    - a random point is inside exactly when it's within some circle or in a filled hole
  - **Other checks:** the determinism check above; `extraM` matches the offset; 300 fragments in under 50 ms in Node (report the number).

**2. MultiPolygon geometry:** `geo/polygon.ts`.
- Add a `GeoJsonMultiPolygon` type and `toMultiPolygon(Polygon | MultiPolygon)`.
- `pointInPolygon` and `distanceInsideMeters` accept either type:
  - a point is inside if it's inside any piece
  - the distance is to the nearest edge of the piece the point is in
  - it's 0 outside
- `audio/music.ts`: the grove-edge fade takes the grove's MultiPolygon. Update its tests.

**3. Pulse kinds:** `story/unlock.ts`.
- `MarkerState.pulse` becomes `"tier" | "changed" | "none"`, per ADR 0006 §2. Only a marker that's playable now pulses: `"changed"` when it has an unheard Story Contingency, otherwise `"tier"`.
- Add a table test covering every state:
  - unexplored
  - changed
  - completed
  - locked
  - out of window
  - retired
  - **changed while out of window:** `"none"` at 35%, because only markers that are playable now pulse.

**4. Story-web helpers:** `story/web.ts`.
- `storyWebLinks(fragments)` returns the in-grove links from `requires`:
  - deduplicated and sorted
  - each one `{ fromId, toId }`
  - retired fragments are left out at both ends
  - members in other groves are skipped, because they come from `crossGroveLinks`
- `crossLinkTip(boundary, from, toward, other?)` returns the point **30.48 m past where the segment from `from` to `toward` last leaves `boundary`**:
  - it stops at the first entry into `other` if that comes sooner
  - it never goes past `toward`
  - it returns `null` if the segment never leaves `boundary`
  - test each of these cases

**5. Grove pack schema 4:** `schemas/packs.ts`.
- `schema: z.literal(4)`.
- `grove.boundary` is a MultiPolygon.
- Add `crossGroveLinks: { fragmentId, otherFragmentId, otherGroveId, direction: "requires" | "unlocks", tip: { lat, lng } }[]`, sorted.
- `PreviewManifest` embeds schema 4.
- Re-sync `from-shared` with `pnpm db:sync-edge-shared`.

**6. The pack builder** (`_shared/buildGrovePack.ts`, and the preview path that uses it):
- **`boundary`** is `groveShape` of the grove's published, non-retired fragments. The builder no longer reads the drawn `groves.boundary`.
- **`crossGroveLinks`:**
  - `"requires"`: this grove's fragments' prerequisites that are in other groves
  - `"unlocks"`: other groves' published fragments whose `requires` include this grove's fragments
  - tips come from `crossLinkTip`, using both groves' derived shapes
- **Rebuild cascade:** when a grove republishes, every grove linked to it (in either direction) rebuilds too.
  - The plan reports whether today's queue already does this for `externalPrerequisites`.
  - If it doesn't, fix it here and say so.
- **Interim:** the pack index bbox still comes from the drawn polygon until Part 2.
- **Tests:**
  - update the builder's existing tests
  - a two-grove fixture with a link each way
  - build twice and get the same manifest sha

## Part 2 (PR 2, after PR 1 merges): the database and the admin

**7. Database** (forward-only migrations):
- Stop authoring `groves.boundary`. The plan proposes whether the column is dropped or kept as a derived cache.
- Remove `fn_set_grove_boundary` from the admin path.
- Drop the fragment-inside-boundary guard and the matching playability and publish checks.
- Groves can be created without a polygon.
- **The pack index bbox comes from the derived shape.** Prefer that the builder records it when it persists the pack, and `get_pack_index()` reads that, so the bbox and the pack always agree.
- Update the pgTAP tests that use boundaries (010, 011, 013, 015, 042, 068), add new ones, and update the seeds and `tools/demo-geometry`.

**8. Admin:**
- The grove editor loses its polygon tool.
- The grove map shows the derived shape, read-only, recomputed with `groveShape` in the browser as fragments are placed or moved.
- **The far-piece warning:** any piece more than 1 km from the rest of its grove gets a warning on the grove page and in the publish checks. It warns; it never blocks.
- Update the e2e specs that draw polygons (`m3c-grove-authoring`, `m3c-writer-refusal`, `m3d-publish-from-scratch`).

**9. Staging:** after the merge, Claude walks Jordan through pushing the migrations, redeploying the functions and republishing the test content, so staging serves schema 4.

## Accept when
- [ ] **Part 1:**
  - `check` runs the mobile export.
  - The shape, geometry, pulse, web and tip tests above pass, including the property and determinism tests.
  - A real build produces a schema 4 grove pack with a MultiPolygon boundary and cross-grove links, deterministically.
  - `pnpm lint`, `typecheck`, `test`, `db:check-edge-shared` and the `db` job pass.
- [ ] **Part 2:**
  - Staff can create a grove and publish it without drawing anything.
  - The admin map shows the derived shape live.
  - The far-piece warning appears.
  - The pgTAP, integration and e2e suites pass.
  - The pack index bbox matches the pack.

## Out of scope
- The Embark relay (A3, next)
- M4b
- Any phone UI (Lane B's M5b)

## Plan (stop after this)
`docs/briefs/A2-plan.md` should cover:
- the union algorithm in a short sketch, with the projection, its error and the edge cases
- the determinism strategy
- the exact signatures
- the cascade finding
- Part 2's choice for `groves.boundary` (drop or cache), and the migration list
- the admin changes
- the test list
- the order of work, and any spec gaps

Push with `git push -u origin a/a2-grove-boundary`, open a PR titled "A2: derived grove boundary (plan)", and **stop for plan review.**
