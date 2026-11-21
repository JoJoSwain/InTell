# M3e story fields: architect review of the plan

**Plan reviewed:** `docs/briefs/M3e-plan.md` (`70262a2`, branch `m3e-story-fields`)
**Verdict:** **APPROVED with the corrections and answers below.** Implement M3e on `m3e-story-fields`. Where this review conflicts with the plan or the brief, this review wins.
**Reviewer:** architect (Claude), 2026-11-21

A tight plan, and the ambiguity list is exactly what was needed. One correction (G1) and two small additions (G2, G3).

---

## Corrections and additions (required)

### G1. The opening excludes retired fragments
Plan §3.2 says the opening is the first root with status "published/retired". DATA_MODEL §4 says **published and not retired**: retired fragments are hidden from the map, so Embark can't route to one. Use `status = 'published'` only, ordered by `storyOrder`, then `id`, in `build-pack`. Apply the same definition in `NO_ROOT` (answers 7 and 8).

### G2. One blank-text rule, shared
Add a SQL helper, e.g. `fn_l10n_blank(jsonb)`, that is true for `{}`, a missing `en`, or an `en` that's blank after trimming. Add a matching TypeScript helper in `packages/shared`. Use them for `NO_TEASER` (refactored onto the helper), `NO_CHANGE_TEASER`, `NO_TIME_HINT`, and for leaving out blank journey passages and hints from snapshots and packs. One predicate everywhere (answer 6).

### G3. Deep links carry their context
Extend the shared issue builder with optional context: `grove_id` and `fragment_id` for fragment-, revision- and version-scoped codes, and `character_id` for character codes. Then `NO_CHANGE_TEASER` and `NO_TIME_HINT` link straight to the revision editor, the character codes to the character page, and `NO_ROOT` to the grove's fragments. Keep the issue shape backward compatible: new keys are optional (answer 5).

---

## Answers to §7

| # | Decision |
|---|---|
| A1 | **Two columns:** `opening_lat double precision`, `opening_lng double precision`, with a check that both are null or both are set. `get_pack_index` returns `opening: {lat, lng}` when they're set. |
| A2 | **The checklist prevents it, and the build refuses it.** `NO_ROOT` blocks publishing. If `build-pack` still finds no opening for a published grove, it **fails** (→ `PACK_BUILD_FAILED`). It never invents an opening or writes a live build without one. |
| A3 | **Delete `AccessNotes`** from zod and its tests. No deprecated export. |
| A4 | **Every grove except unpublished ones** (draft or published), across all regions, since the story is story-wide. At release, the home grove must be published or in the same release (`DEPENDENCY_UNPUBLISHED`). |
| A5 | See **G3**. |
| A6 | See **G2**. |
| A7 | **`fn_draft_check`:** count working root fragments that aren't retired or unpublished, so draft roots count while authoring. **`fn_publish_check`:** count roots that will be live after the release: published (by snapshot) or included as fragments in this release, and not retired. |
| A8 | **Scope by release items:** `NO_ROOT` for groves in the release; `NO_PORTRAIT` and `NO_HOME_GROVE` for characters in the release; `NO_CHANGE_TEASER` and `NO_TIME_HINT` for revisions in the release. Already-published characters were checked when they were released. The only `DEPENDENCY_UNPUBLISHED` change is the home grove. |
| A9 | **Fail hard.** A published character snapshot missing a portrait or home grove makes the build fail (→ `PACK_BUILD_FAILED`). Never drop a character silently. |
| A10 | **Confirmed:** the home grove can be any grove, with no same-grove constraint. The pack carries the id, and the phone resolves its name from the index. |
| A11 | **No compatibility layer.** No phones are in the field, and hosted staging has no published content yet. Local and CI rebuild from the seed. Schema 3 only. |
| A12 | **Clean up the old snapshots in the migration.** `update published_snapshots set data = data - 'accessNotes' where entity = 'grove'`. The snapshot zod stays strict. Old character snapshots exist only in the local seed, which is regenerated. |
| A13 | **Confirmed:** there's no new release-item type. Releasing the grove publishes its journeys through the grove snapshot. |
| A14 | **No noise:** `NO_CHANGE_TEASER` applies only to `change_kind = 'contingency'` with `revision_no > 1`. Corrections never show or require the field. The column stays and is simply unused. |
| A15 | **Confirmed:** both checks evaluate the revision's current versions. Adding the second window makes both hints required. Add a pgTAP case for that transition. |
| A16 | **Optional in zod** (region rows have no opening). M5's Embark treats a grove row without `opening` as not embarkable. After A2, every live grove build has one. |
| A17 | **Fix it, don't just document it.** Playwright's `webServer.env` should pass through only variables that are actually set, so it never overrides `.env.local` with empty values. Add a short note to the admin README too. |
| A18 | **Yes:** add a pgTAP contract test on `fn_snapshot_projection`. The grove includes `journeys` and has no `accessNotes`; the character includes `homeGroveId`. |

## Notes
- **The opening may be a physical root.** In that case Embark routes to its point and the story begins with a scan. Nothing to do in M3e; I'll record it in the M5 brief.
- **No AI generation, and no cars.** The help text uses the agreed wording. No `drive` anywhere, including test fixtures and placeholder copy.
- **Doc amendments** (quote them in the report): DATA_MODEL §11 for the G2 blank rule and the G3 context keys, and §12.3 for the opening columns.

## Report back with (in addition to the brief's list)
- Migration filenames in order; the pgTAP count, naming the new M3e tests (including the A15 transition and the A18 contract)
- The schema-3 zod diff as implemented
- Integration: schema-3 pack fields, `opening` in the index, contingency-then-correction `changeTeaser`, and a staged journey edit that doesn't reach the pack
- Playwright: a writer filling all new fields; a release failing with each code and a working deep link
- Screenshots: the grove editor's Journey passages, the character page (home grove, Back story, portrait required), and the revision editor with a change teaser and both hints

**Then stop for architect review of the report.**
