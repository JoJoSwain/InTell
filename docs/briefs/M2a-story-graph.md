# Brief: M2a amendment: story graph (ADR 0003) and the Farmington test grove

**Milestone:** M2a, same branch (`m2a-schema`), before the PR
**Author:** architect (Claude), 2026-11-19
**Read first:** `docs/adr/0003-story-graph.md` (Accepted), then the updated DATA_MODEL §4, §11, §12.1, §14 and §15, PRODUCT_SPEC §1 and FR-1/FR-2, and `supabase/fixtures/farmington-bird-refuge.json`

## Why
JoJo has replaced the strict fragment tree with prerequisite groups (AND of ORs), Root Ends, and "heard = completed". The architect has already updated the docs. This brief brings the M2a code in line. It also wires up the real test grove, which your report still lists as a placeholder: **B8 in `M2-database-plan-review.md` was revised to the Farmington Bird Refuge, and the fixture file is now the single source for all test geometry.**

## Decisions already made (don't revisit)
1. **Edit the existing migrations in place.** Nothing is merged and no shared database has applied them. Squashing keeps the history readable. Rewrite the branch history only if it's simple; otherwise a normal follow-up commit is fine.
2. **Story migration:** drop `parent_id` and `tier_parent`. Add `is_ending` with its check, `fragment_prereq_groups` and `fragment_prereq_members` exactly as in DATA_MODEL §4 (with `…ts` and the `updated_at` trigger on groups). `fn_fragment_guard` keeps only the boundary and protected checks.
3. **New `fn_prereq_guard`** (a trigger on members, insert and update; security definer, `search_path = ''`): the required fragment is in the same grove as the group's fragment; it isn't the fragment itself; and the edge **doesn't create a cycle** (a recursive CTE over members ⇄ groups). Raise clear errors.
4. **Checklist** (`fn_publish_check`): remove `PARENT_UNPUBLISHED` and `NO_ROOT`; add `PREREQ_UNPUBLISHED`, `EMPTY_PREREQ_GROUP` and `NO_START`. `RADIUS_OVERLAP` skips pairs where one fragment **must precede** the other, per ADR 0003 §4 (single-member groups, transitively).
5. **RLS:** the two new tables follow `fragments`. Editor and admin write; writer **can't** (structure is an editor's job); all staff read through the same rules. `anon` gets nothing. Fragment ids aren't protected data, but the members table must not leak anything through a join that `fragments_staff` hides.
6. **Seed:** rebuild the test grove from `supabase/fixtures/farmington-bird-refuge.json`, as review B8 describes: the site slug `farmington-bird-refuge`, the FIXTURE approval comment, and the `tools/demo-geometry` generator writing `supabase/seed-geometry.sql` and `apps/mobile/e2e/demo-route.gpx`. Frags 1–7 must match JoJo's table **exactly** (names, tiers, points, prerequisites). Frags 8–10, the crossroads anchor on frag2, and frag10's two revisions come from the fixture. **Remove** the `c_park_*` placeholder constants. B7 (the other two sites) stays a placeholder.
7. **GPX dwell:** the generator reads narration durations from `supabase/seed-media.json` and dwells at each fragment for the duration + 5 s.
8. **Generated types:** regenerate `packages/shared/src/db.ts`.

## pgTAP changes
- Replace `010_tier_parent.test.sql` with **`010_prereq_graph.test.sql`**: a self-reference is rejected; a cross-grove prerequisite is rejected; a 2-cycle and a 3-cycle are rejected; `is_ending` on a non-root is rejected; a leaf requiring a leaf is **allowed**; a root with prerequisites is **allowed**.
- In `030_checklist_codes`: crafted cases for `PREREQ_UNPUBLISHED` (including "one member of an OR group published ⇒ passes"), `EMPTY_PREREQ_GROUP` and `NO_START`; `RADIUS_OVERLAP` exempt for a must-precede pair and still fired for an independent pair.
- **New `015_seed_graph.test.sql`:** the seeded grove's prerequisite graph matches the fixture (frag5 = `{2},{3}`; frag6 = five single groups; frag7 = `{6}`; frag10 = one group `{8, 9}`). `fn_publish_check` on the seeded grove returns `ok = true` with **exactly one** `RADIUS_OVERLAP` warning (frag3/frag4). Every seeded fragment is inside the boundary.
- `070_protected_coords_anon`: unchanged, but make sure it covers frag9.

## Out of scope
The device-side unlock logic (`unlock.ts`, M4), completion tracking (M6), the Journal (M8), the admin editor (M3) and the zod pack schema (M2b). Don't edit the specs: the architect has already updated them. If you find a contradiction, list it.

## Report back with
1. The commits added on `m2a-schema`
2. `supabase db reset` / `supabase test db` / root checks output
3. The `fn_publish_check` result for the seeded grove (JSON)
4. The first 10 and last 10 `<trkpt>` lines of the GPX, plus its total point count and duration
5. Deviations and open questions
