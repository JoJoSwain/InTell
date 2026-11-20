# M3a schema realignment: architect review of the plan

**Plan reviewed:** `docs/briefs/M3a-plan.md` (`96c48fd`)
**Verdict:** **APPROVED with the changes below.** Implement M3a. Where this review conflicts with the plan or the brief, this review wins. DATA_MODEL v3 was amended in the same commit as this review to record the answers (quoted at the end).
**Reviewer:** architect (Claude), 2026-11-20

The plan is thorough and well ordered. The migration list, the per-table actions, the function inventory and the test plan are right. The 50 ambiguities are the right questions; answering them produced six required changes.

---

## Required changes

### R1. One projection function for snapshots and "Unreleased changes" (A31)
Don't deep-compare JSON in two places. Add `fn_snapshot_projection(entity text, entity_id uuid) returns jsonb` (security definer, `search_path = ''`, service role and editor+ only). `fn_publish_commit` stores its output in `published_snapshots.data`. "Unreleased changes" is `fn_snapshot_projection(e, id) is distinct from snapshot.data`. Add zod schemas per entity in `packages/shared/src/schemas/snapshots.ts` (synced to edge), and have `build-pack` parse snapshot payloads with them. Story Notes fields are never in a projection.

### R2. Explicit release contents and a dependency check (A2, A19, A32)
Commit never adds items on its own. Add the error code **`DEPENDENCY_UNPUBLISHED`**. It fires for:
- a revision whose fragment isn't published or in the release
- a fragment whose grove isn't
- a fragment linked to a character that isn't
- a character whose portrait image isn't
- a cue or layer whose zone or profile isn't

Each failure names the missing entity. Audio files need no release item: the copy step publishes every staged audio sha the release references. Write a pgTAP case for each dependency kind.

### R3. Cross-grove prerequisites carry their contingency number (A27)
A device may have grove B's pack without grove A's. GrovePack schema 2 gains **`externalPrerequisites: [{fragmentId, groveId, contingencyRevisionNo}]`** for every prerequisite member outside the grove. `fn_publish_commit` also enqueues a rebuild for every grove containing a fragment that requires a fragment whose revision or snapshot changed in the release. Add an integration test: a contingency on a Farmington fragment rebuilds the second test grove, and its `externalPrerequisites` entry shows the new number.

### R4. Go-live and failure handling, precisely (A10, A11, A12)
- **Status flow:** commit sets the release `publishing`. `fn_release_go_live(release_id)` runs after each successful tagged build, including no-ops. When no `rebuild_pack` job for the release is queued, running or failed, it flips every build of the release `live = true` in one transaction, then sets the release `published` and `published_at`.
- **Failures:** a build job that exhausts its retries sets the release `failed`, with the scope and error in `last_check`. Snapshots stay committed, and phones keep the previous live packs. A retry re-enqueues the rebuilds; M3d adds the button.
- **Builds with no release** (unpublish) are inserted `live = true`.
- **Scheduling:** a separate pg_cron SQL function, `fn_enqueue_due_releases()`, runs every minute. It sets due releases to `publishing` and inserts one `publish_release` job each, with payload `{"release_id": "…"}`.
- **Tests:** the two-grove release is invisible in the index until both builds succeed. A forced build failure leaves the release `failed` and the old packs live.

### R5. Retired fragments stay in packs (A6, A7, A8)
- A fragment snapshot with status `retired` is included in its pack with `retired: true`, along with its current revision, so the Chronicle can still replay it.
- It never triggers and isn't drawn on the map.
- `unpublished` fragments are omitted.
- `fn_revision_is_playable` accepts a fragment snapshot status of `published` or `retired`.
- Retired fragments still satisfy prerequisites (`PREREQ_UNPUBLISHED` allows published or retired).

### R6. No status-change trigger (C2)
Drop `fn_publish_status_enqueue`. Status changes reach phones only through a release, or through `fn_unpublish_commit`, which stays the immediate safety valve. Retiring a fragment means setting it to `retired` in its working row and publishing it in a release.

---

## Answers to §10

### 10.1 DATA_MODEL v3

| # | Decision |
|---|---|
| A1 | Every release item except revisions gets a snapshot: grove, fragment, character, image, ambience_profile (with its layers and their assets), ambience_zone, music_zone, music_cue (with its stems), ui_cue. DATA_MODEL §10 is amended. |
| A2 | Including a revision sets its status `published` and its `release_id`. Its fragment must be published or in the release (R2). |
| A3 | **Keep `jobs.id uuid`** as shipped. Existing tables keep their M2 id types; DATA_MODEL is amended. |
| A4 | Replace `fn_layer_assets_playable` with `fn_layer_is_playable(layer_id)`: the layer's profile snapshot is published. There are no asset-level checks. |
| A5 | Copy every staged audio sha referenced by the release's content (narration versions, growth cues, stems, layer assets, UI cues) plus the images in the release. The reconciler still decides final publicness from live manifests. |
| A6 | **Retired prerequisites are still valid** (R5). §11 is amended. |
| A7 | Yes, retired fragments and their current revision stay in packs (R5). |
| A8 | Snapshot `published` → `retired: false`; `retired` → `retired: true`; `unpublished` → omitted. |
| A9 | Yes. Unpublishing a grove flips its snapshot status, and the index stops listing it at once. Phones then drop its assets on sync. |
| A10 | Builds with `release_id` null are `live = true` on insert (R4). |
| A11 | See R4. |
| A12 | A separate SQL cron function, `fn_enqueue_due_releases()` (R4). `run-jobs` doesn't poll `releases`. |
| A13 | `change_note` becomes `text` (take `->>'en'` from existing jsonb). **Drop `writer_notes`**; Story Notes and the change note cover it. Seed only, no data to keep. |
| A14 | Rename `questions.requires_heard` → `requires_completed`. |
| A15 | `gatherings.title` is L10n (jsonb, zod `L10n`). §12.1 is amended. |
| A16 | `RegionPack` also gets `schema: 2`. §12.2 is amended. |
| A17 | Profile and layer names are plain strings (staff-facing), as in SQL. |
| A18 | Sound entities have their own snapshots. A grove pack includes only zones and cues with published snapshots. The seed's published release includes the demo sound entities. Until M4's UI exists, the seed is the only source. |
| A19 | Explicit items plus `DEPENDENCY_UNPUBLISHED` (R2). |
| A20 | Confirmed: a rotated code isn't live until released. The M3c print page must say "This code works once the fragment is released" when the working code differs from the snapshot hash. |
| A21 | Confirmed: thread **ids** in packs are intentional (music conditions). Titles and notes never are. |
| A22 | Confirmed: a character is in a grove pack if it's linked to one of that grove's included fragments **and** has a published snapshot. The portrait comes via its image snapshot and the `assets` list. |
| A23 | Nullable. Seed staff rows have null `invited_by`. |
| A24 | For each changed enum: create the new type, alter columns `using` a CASE mapping, drop the old type, then rename the new type to the old name. One migration per enum is fine. |
| A25 | `unmarked` → `standard`. Frag 8 becomes a standard fragment. Make Frag 8 the **Day-only** fixture fragment, so the seed still has a distinctive case there. |
| A26 | Keep the M2 pattern (hourly check, acting at 02:00 in each region's timezone). Keep `fn_region_today` if the retention job uses it; drop it otherwise. |
| A27 | See R3. A prerequisite id absent from every installed pack *and* from `externalPrerequisites` counts as not completed. The checklist already blocks unpublished cross-grove prerequisites (`PREREQ_UNPUBLISHED`). |
| A28 | **Correct.** Unlocks are sticky, so map opacity is never reduced by a contingency. A contingency affects only (a) whether that fragment counts as completed, so it re-triggers on approach and gates dependents that aren't unlocked yet, and (b) Chronicle replay. The contingent fragment itself stays unlocked at 100%. |
| A29 | Warn when **no** fragment in the grove is open from the start, including when the only starts depend on another grove. §11 is amended. |
| A30 | Yes: the migration sets every existing `pack_builds` row `live = true`. |
| A31 | See R1. |
| A32 | See R2. |
| A33 | Confirmed: `'image'` refers to `image_assets`. |
| A34 | **Keep `memory`** as a Journal kind. A listener can share a memory as an idea; what ADR 0004 removed is turning memory-sharers into storytellers. |
| A35 | `access_notes` is a partial record keyed by `parking`, `transit`, `restrooms`, `terrain`, `hours`, `accessibility`, each an L10n value, all optional. Add a zod `AccessNotes`. |

### 10.2 ADR 0004 vs other docs

| # | Decision |
|---|---|
| B1–B3 | ADR 0003's header now says the amendments win wherever the body conflicts. Follow ADR 0004 and DATA_MODEL v3. Don't edit ADR 0003's body. |
| B4 | Confirmed. No pack field depends on the open questions. In particular, there's no "all groves this character appears in" list; that waits for the decision. |
| B5 | TECH_SPEC §5 is already release-based. Report any leftover v2 wording you find; don't edit docs silently. |
| B6 | `M2-followups.md` now has a status note. |
| B7 | Confirmed. Physical fragments never proximity-trigger. Add a shared test for that in `trigger.ts` when it's built (M4); in M3a, the pack must omit `radiusM` for physical. |
| B8 | Confirmed. Delete every "omit coordinates" test. Physical fragments carry `lat`/`lng`. |

### 10.3 Pipeline edge cases

| # | Decision |
|---|---|
| C1 | `{"release_id": "<uuid>"}`, snake_case like the other job payloads. |
| C2 | See R6. |
| C3 | The demo GPX stays Farmington-only. The second grove is covered by pgTAP and integration tests; M6 can extend the route if useful. |
| C4 | Yes. Give seed handles stable UUIDs (the published release, the draft release, Frag 4, Frag 8, Frag 9, Frag 10, the second grove and its bridge fragment), documented in the seed header and exported from a single test-constants module. |
| C5 | Fine. Document it in the report as an environment note. |
| C6 | Null loudness raises a `LOUDNESS` warning ("not measured"). Warnings never block. Prefer measured loudness in `seed-media.json` so the seed is warning-free. |
| C7 | Sync to edge: `packs.ts`, `snapshots.ts`, `music.ts`, `l10n.ts`, `canonicalJson.ts`. `contingency.ts`, `timeWindow.ts` and `units.ts` aren't imported by edge in M3a (SQL computes `contingencyRevisionNo`). Build them in `packages/shared` with tests. |

---

## Unchanged from the plan (approved as written)
§0 (preconditions), §2 (migration order; collapsing 9–10 is fine), §2.1 (per-table actions, with A13, A14, A24 and A25 applied), §3 (functions, triggers, cron, grants; drop `fn_publish_status_enqueue` per R6), §4 (with R1), §5 (with R4), §6, §7 (with R3, A15 and A16), §8 (add the R2, R3 and R4 tests), §9 (with A25 and C4), §11 and §12.

## DATA_MODEL v3 amendments made with this review (quoted)
- §8: "`id uuid primary key default gen_random_uuid()` — as shipped in M2"; "Existing tables keep the id types they shipped with in M2"; the **release status flow** paragraph; the **snapshot projection** paragraph.
- §9: "its fragment's snapshot exists with status `published` **or `retired`**"; `fn_layer_is_playable` replaces `fn_layer_assets_playable`.
- §10: snapshots for "every release item except revisions"; enqueue rebuilds for groves that depend on changed fragments; "**What a release must contain**"; "There is no status-change trigger that rebuilds packs"; `fn_enqueue_due_releases()`; `fn_release_go_live(release_id)`, failure handling, `live = true` for builds without a release, and the M2 backfill.
- §11: `PREREQ_UNPUBLISHED` allows retired members; new `DEPENDENCY_UNPUBLISHED`; the `NO_START` definition; `LOUDNESS` covers unmeasured assets.
- §12.1: fragments with snapshot status published or retired are included; `retired` semantics; **`externalPrerequisites`**; gatherings `title` is L10n.
- §12.2: `RegionPack` `schema: 2`; profile and layer names are plain strings.
- §14: prerequisite satisfaction can use `externalPrerequisites`.

## Report back with (in addition to the brief's list)
- The final migration file list
- The `110_definer_grants` allowlist as shipped, with each line's reason
- Integration output for: staged edit not leaking, two-grove atomic go-live, forced build failure, contingency vs correction in the pack, the `externalPrerequisites` update, and the scheduled release success and failure
- `content_sha256` of the demo grove pack on two consecutive no-op builds (equal)
- Anything in DATA_MODEL v3 that didn't match what shipped, quoted
