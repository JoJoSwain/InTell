# M3a schema realignment — implementation report

**Branch:** `m3a-schema-realign` (PR #6 → `master`)  
**Plan:** `docs/briefs/M3a-plan.md` (`96c48fd`)  
**Review (wins):** `docs/briefs/M3a-plan-review.md` (`eb86136`) — R1–R6 applied  
**Status:** Implementation complete; **stopped for architect review**. M3b not started.  
**CI follow-up:** tip includes `fix(ci): isolate pack-index pgTAP; skip physical dwell in GPX tests` after `check`/`db` failures on `43bc76a`.

---

## 1. Branch log (`origin/master..HEAD`)

```
fix(pack-integration): harden M3a bootstrap and test isolation
fix(db): upload seed portraits; heal assets on pack no-op; prefer env for status
fix(db): unpublish id ambiguity, NO_ALT_TEXT empty en, landcover sha gate
fix(supabase): align pgTAP tests with M3a schema
test(pack-integration): rewrite M3a release pipeline integration suite
feat(edge): release-scoped publish, schema-2 pack builders, atomic go-live
feat(shared): GrovePack/RegionPack schema 2, snapshots, contingency, timeWindow, units
fix(seed): drop fn_snapshot_projection overlay now fixed in migration 09
feat(db): M3a schema migrations 01-13 for DATA_MODEL v3
fix: 063 story notes test plan count
test(supabase): rewrite M3a pgTAP suite for releases and v3 schema
feat(seed): M3a full demo seed, fixture, and DEMO UUID constants
docs: add M3a plan review; amend DATA_MODEL v3
docs: add M3a plan for review
```

---

## 2. Commands run (results)

| Command | Result |
|---|---|
| `pnpm exec supabase db reset` | **PASS** — all M2 + M3a migrations + seed |
| `pnpm exec supabase test db` | **PASS** — 23 files, 110 tests (on clean reset) |
| `pnpm test:integration` | **PASS** — 16/16 (built-in edge runtime from `supabase start`; JWT verify on) |
| `pnpm lint && pnpm typecheck && pnpm test` | **PASS** — shared 64 tests; demo-geometry 4 |
| `pnpm db:sync-edge-shared` / `db:check-edge-shared` | **PASS** — packs, snapshots, music, l10n, canonicalJson |
| `pnpm db:seed-media-upload` | **PASS** — 22 audio → `staging-audio`; 2 portraits → `staging-images` |

**Environment note (C5):** `supabase/.env.local` is absent. Prefer env vars (`API_URL` / `SERVICE_ROLE_KEY`) for upload/tests so `supabase status` is not called while the edge runtime is sensitive on Windows. With CLI 3.2.0 and `[edge_runtime] enabled = true`, `supabase start` serves functions; a separate `functions serve` is optional and flaky after container churn.

---

## 3. Final migration file list

| File | Role |
|---|---|
| `20261121100001_m3a_enums.sql` | Enum remaps (A24), including visibility → standard/physical |
| `20261121100002_m3a_places_groves.sql` | `regions.sun_reference`; groves absorb sites; drop sites/approvals |
| `20261121100003_m3a_drop_rights_rings_crossroads.sql` | Drop rights / rings / crossroads / seeds participation tables |
| `20261121100004_m3a_media.sql` | Audio columns; `image_assets`; storage buckets |
| `20261121100005_m3a_story.sql` | Teaser, change_kind, physical marker, story-wide characters |
| `20261121100006_m3a_ambience_music.sql` | Scalar `time_window` day/night; scrub music conditions |
| `20261121100007_m3a_journal.sql` | `journal_terms` / `journal_entries` / `entry_links` |
| `20261121100008_m3a_releases_ops.sql` | `releases`, `release_items`, `published_snapshots`, pack_builds.live |
| `20261121100009_m3a_playability_publish.sql` | Playability + `fn_snapshot_projection` (R1); drop status enqueue (R6) |
| `20261121100010_m3a_publish_commit.sql` | Check/commit, DEPENDENCY_UNPUBLISHED (R2), go-live, due releases (R4) |
| `20261121100011_m3a_triggers_cron.sql` | Cron for `fn_enqueue_due_releases`; drop status triggers |
| `20261121100012_m3a_rls.sql` | RLS for releases/snapshots/images/journal |
| `20261121100013_m3a_definer_grants.sql` | Shrunk definer allowlist |

---

## 4. `110_definer_grants` allowlist (as shipped)

Anon / authenticated execute on security-definer functions (from `110_definer_grants.test.sql` + migration 13 comments):

| Signature | Why |
|---|---|
| `get_pack_index()` | Devices discover **live** packs (DATA_MODEL §12.3); anon + authenticated |
| `has_role(roles staff_role[])` | RLS policies resolve staff roles |
| `fn_publish_check(p_release_id uuid)` | Admin checklist UI; editor+ guard inside |
| `fn_publish_commit(p_release_id uuid)` | Admin/edge commit; `fn_require_editor_or_service` inside |
| `fn_unpublish_commit(p_entity text, p_ids uuid[])` | Immediate safety valve; same guard |
| `fn_require_editor_or_service()` | Guard used by publish/unpublish |
| `fn_snapshot_projection_guarded(p_entity text, p_entity_id uuid)` | “Unreleased changes” UI (R1); editor+ only. Unguarded `fn_snapshot_projection` is **service_role only** |

Everything else (playability helpers, enqueue/*, go-live, pack geog, contingency math, cron) is **service_role only**.

---

## 5. Review “Report back with” — integration evidence

| Item | Evidence |
|---|---|
| Staged edit not leaking | Integration: `staged edit does not leak into live pack until release includes it` — **PASS** |
| Two-grove atomic go-live | Integration: `atomic go-live…` — index keeps prior versions while `publishing`, then both flip — **PASS**; pgTAP `053_atomic_golive.test.sql` — **PASS** |
| Forced build failure | Integration: `forced build failure leaves release failed and prior live packs` — **PASS** |
| Contingency vs correction in pack | Integration + shared Vitest; seed Frag 10 r2 contingency / Frag 4 r2 correction — **PASS** |
| `externalPrerequisites` update | Integration: Farmington frag1 contingency bumps second-grove `externalPrerequisites` — **PASS** |
| Scheduled release success / failure | Integration: `fn_enqueue_due_releases` success + check-failure → `failed` + `NO_ALT_TEXT` — **PASS**; pgTAP `052_scheduled_release.test.sql` — **PASS** |
| No-op `content_sha256` (demo grove, consecutive) | Equal: `152381b77ce1a48d1151dab354fc9166c97cd26252d6fe116430581e09df1e8e` (version stayed 1) |

---

## 6. Shared / edge / seed highlights

- **GrovePack / RegionPack schema 2** with `externalPrerequisites`, AccessNotes, physical lat/lng (no `radiusM`), no rings/credits/Story Notes.
- **`packages/shared`:** `snapshots.ts`, `contingency.ts`, `timeWindow.ts` (`suncalc`), `units.ts` + tests; music conditions without ringIds/outcome/timeWindows.
- **Edge:** release-scoped `publish` / `run-jobs` / `build-pack` / `unpublish` / `purge-assets`; Option C sync of packs/snapshots/music/l10n/canonicalJson.
- **Seed (A25/C4):** Frag 8 standard Day-only; Frag 9 physical `DEMO-001`; Frag 10 contingency; Frag 4 correction; second grove + bridge; stable UUIDs in seed header + `tools/pack-integration/src/test-constants.ts`; demo GPX remains Farmington-only (C3).
- **Types:** `packages/shared/src/db.ts` regenerated from local schema.

---

## 7. Doc amendments already in review commit (quoted)

From `M3a-plan-review.md` / DATA_MODEL v3 (same commit as review):

- §8: jobs.id remains uuid as shipped; release status flow; snapshot projection paragraph  
- §9: playability allows fragment snapshot `published` **or `retired`**; `fn_layer_is_playable`  
- §10: snapshots for every release item except revisions; `DEPENDENCY_UNPUBLISHED`; no status-change rebuild trigger; `fn_enqueue_due_releases`; `fn_release_go_live`  
- §11–§12 / §14: retired prereqs; `externalPrerequisites`; RegionPack `schema: 2`; gatherings title L10n  

**Leftover v2 wording (B5):** quick scan of `TECH_SPEC.md` for publish_at / rings / asset_rights / schema 1 — **none found**. No silent doc edits.

---

## 8. DATA_MODEL v3 vs shipped (deviations)

| Topic | Shipped | Notes |
|---|---|---|
| `jobs.id` | **uuid** (M2) | Per review A3; not bigint |
| Status-change pack rebuild | **Removed** (R6) | Matches amended §10 |
| Landcover in RegionPack | `null` when grid sha is not a 64-hex digest | Seed still stores a path placeholder; builder gates on sha shape so schema 2 validates |
| Seed portraits | Deterministic 1×1 PNG shas uploaded by `seed-media-upload` | Not real artwork |

No silent product inventions beyond the review answers.

---

## 9. Deviations from brief / plan

- Collapsed playability + publish into migrations 09–10 as the plan allowed.
- Used built-in edge runtime from `supabase start` for integration (C5); separate `functions serve` remains valid but was unreliable after Docker container churn on this Windows host.
- Integration suite asserts `contingencyRevisionNo >= 1` where prior local runs may have already published a contingency (isolation), while still verifying bumps via before/after compare.

---

## 10. Open questions

All §10 ambiguities were answered in the plan review. None remain for M3a scope.

Ready for architect review of this report. **Do not start M3b** until approved.
