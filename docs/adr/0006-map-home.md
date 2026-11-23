# ADR 0006: The map home: derived grove boundaries, marker pulses and the story web

## Status
**Accepted**, 2026-11-23. Decided by the product owner (Jordan "JoJo" Swain) and the Creative Director (Ashley Schaugaard), with the architect (Claude), in the 2026-11-22 design session; written up the next morning. Amends ADR 0004 (markers), ADR 0005 §3 (the changed-fragment pulse), PRODUCT_SPEC (FR-1, the Home: Map row, the session start), DATA_MODEL (groves, the fragment guard, the snapshot and the grove pack), TECH_SPEC (the map row) and DESIGN.md §1–§4. Where those docs still disagree, **this ADR wins** until they're updated.

Every visual value (colors, sizes, line weights, timing) lives in `docs/design/MOBILE_HOME_STANDARDS.md`. This ADR records only the decisions that change data, shared logic or the pack format.

## Context
The design session settled the look of the home map. Three of its decisions reach past pixels:
- groves take their shape from their fragments instead of a drawn polygon
- every unexplored marker pulses, not only changed ones
- the map draws the story's logic chain

## Decisions

### 1. A grove's boundary is derived from its fragments
- **The shape** is the union of a circle around each fragment: **Root 250 ft (76.2 m), Branch 150 ft (45.72 m), Leaf 100 ft (30.48 m).**
  - These are constants in `packages/shared`.
  - Changing them takes an amendment to this ADR and a republish.
- **Which fragments count:** every non-retired fragment in the grove's published content, standard and physical alike.
  - **Locked fragments count.** They're unexplored territory, so every listener sees the same grove.
  - **Retired fragments don't count.**
- **Islands are allowed.** A grove can be several separate pieces, so the boundary is a GeoJSON **MultiPolygon**. The pieces are still one grove: one name, one session and one soundtrack. Music cues that use the grove boundary cover every piece.
- **Holes are filled** (default; confirm). If the circles enclose a gap, the gap counts as inside the grove. Otherwise a listener walking through the middle of a ring of fragments would leave the grove and come back.
- **Geometry:**
  - True circular arcs meeting at sharp points, stored as rings whose vertices stay within **5 cm** of the true arc.
  - Arc intersections are exact vertices.
  - Coordinates are rounded to 7 decimals, and outer rings run counterclockwise (RFC 7946).
- **Deterministic:** the same fragments always give the same bytes, because pack bytes are hashed.
- **It's calculated when packs build,** from the published fragment snapshots. So a release that only adds or moves a fragment still moves the boundary.
- **One implementation.** A single pure function in `packages/shared` is used by the pack builder, the admin preview and the tests.
- **Staff no longer draw grove polygons.**
  - The admin grove map shows, read-only, the shape the next publish would produce, and it updates as fragments are placed or moved.
  - Terra Draw stays for ambience and music zones.
- **Database consequences:**
  - The admin no longer sets `groves.boundary`.
  - The "fragment must be inside its grove boundary" guard and publish check go away, because the rule is now true by construction.
  - The pack index bbox comes from the derived shape.
  - Lane A's plan proposes whether `groves.boundary` is dropped or kept as a derived cache.
- **Admin warnings:**
  - A piece of a grove that's more than **1 km (0.6 mi)** from the rest of the grove gets a warning, since it's probably a misplaced fragment (default; confirm).
  - Groves may still overlap each other, as before (DATA_MODEL principle 2).
- **A grove with no published fragments has no boundary** and isn't in the pack index. A publishable grove always has its opening root.
- **On the phone, the boundary decides:**
  - when a session starts: entering any piece
  - when the grove-name chip shows
  - the 60 m grove-edge music fade
  - Embark arrival is unchanged: it's the opening root.

### 2. Marker pulses: unexplored in the tier color, changed in green
- `markerState` gains a **pulse kind**:
  - **`"changed"`:** the fragment is playable now and has an unheard Story Contingency (ADR 0005 §3).
  - **`"tier"`:** the fragment is playable now, not completed at its current contingency, and not changed.
  - **`"none"`:** everything else.
- **Only markers that are playable now pulse.** A changed fragment outside its Day/Night window waits, faded and still, like any other. This narrows ADR 0005 §3, which didn't consider windows.
- **Completed:** a still ring.
- **Locked, or outside its Day/Night window:** 35% and still. A look that tells these two apart is still open (worksheet 3.3).
- **Reduce Motion:** a still ring in the pulse color, at the pulse's starting size.
- **This supersedes:**
  - ADR 0004 and DESIGN's "tier colors with glyphs": markers are now hollow ink rings, with the tier shown by size and pulse color.
  - ADR 0005 §3's "slow pulse": the changed pulse is now once a second, in the accent green.

### 3. The story web
- **Lines come from the data.** Each member of each `requires` group draws a line from the prerequisite to the fragment that needs it. There's no extra authoring.
- **Cross-grove links:**
  - Each grove draws its own end of the link: a line from its marker toward the other fragment.
  - The line ends in an arrow **100 ft (30.48 m) past the point where it last leaves this grove.** It stops sooner if it reaches the other grove's edge first.
  - Both directions are drawn: when this grove's fragment requires one elsewhere, and when a fragment elsewhere requires this one.
- **The pack carries what the phone needs.** For each cross-grove link it holds:
  - this grove's fragment id
  - the other fragment's id and grove id
  - the direction
  - the arrow tip, computed at pack build with the same shared code
- **Rebuilds:** a grove's pack must rebuild when a grove it links to republishes a change to its shape or to a linked fragment. Lane A's plan checks whether today's rebuild queue already covers this for `externalPrerequisites`. If it doesn't, that's an existing gap, fixed here.

### 4. The base map
- **Google base map, online** (ADR 0002 unchanged):
  - a plan drawing by day and a blueprint by night, switching with the story's Day/Night window
  - no business, POI, parking or gas-station icons
- **M5b's plan decides how the styles ship:** as JSON styles versioned in the repo, or as cloud styles behind Map IDs. The preference is versioned in the repo, and switching without reloading the map.

### 5. Grove pack schema 4
- `grove.boundary` becomes a GeoJSON MultiPolygon, derived as in decision 1.
- A new `crossGroveLinks` array, as in decision 3.
- The staff preview manifest embeds schema 4 grove packs.
- **No compatibility path.** Staging has no real content, so its packs are simply rebuilt. The phone moves to schema 4 in M5b, and no Polygon-to-MultiPolygon path is kept.

## Still open
- **Holes filled:** confirm.
- **The 1 km far-piece warning:** confirm.
- **A distinct look for out-of-window markers** (worksheet 3.3).

## Consequences
- **Lane A, A2:**
  - the shared shape function, MultiPolygon geometry, pulse kinds, the story-web helpers and pack schema 4
  - then the pack builder, the database and the admin
- **Lane B, M5b:** draws what the pack says.
- **Claude** updates PRODUCT_SPEC, DATA_MODEL, TECH_SPEC and DESIGN.md to match when A2 merges.
