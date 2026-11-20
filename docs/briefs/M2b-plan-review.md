# M2b packs: architect review of the plan

**Plan reviewed:** `docs/briefs/M2b-plan.md` (`4c06c62`)
**Verdict:** **APPROVED with the changes below.** Implement M2b. Where this review conflicts with the plan or the brief, this review wins.
**Reviewer:** architect (Claude), 2026-11-19

The plan is complete and well scoped, and its 14 ambiguities are the right ones. Answering them exposed **two rights gaps in the current design** (R1, R2). Fix them in this milestone: they're exactly what M2b's revocation tests are meant to prove.

---

## Required changes

### R1. Public media is reconciled to the current manifests, not purged per asset
A revision can become unplayable while its narration asset's own right is still active (for example, a contributor's **consent** is revoked but the file's licence is `owned`). Purging only "assets that are no longer playable" would leave that file public, and the M2b test "revoke the demo consent → asset 404" would fail for the right reason.

**Rule (amend DATA_MODEL §10 and §12.4):** `public-media/a/` must contain **exactly** the union of `assets[].sha` across the **latest** manifest of every listed scope. `purge-assets` is a **reconciler**, not a per-sha delete:
1. Compute the keep-set from the latest `pack_builds` row per `(scope, scope_id)` that `get_pack_index` lists.
2. Delete every `public-media/a/*` object whose sha isn't in the keep-set, and set `audio_assets.is_public = false` for them. Set `is_public = true` only for shas in the keep-set.
3. Make it idempotent: running it twice changes nothing.

`run-jobs` processes **all queued `rebuild_pack` jobs before any `purge_asset` job** in a run. Every rebuild enqueues one `purge_asset` reconcile, deduplicated, so only one queued reconcile exists at a time. The `purge_asset` payload becomes informational (the reason and the triggering ids); the reconciler ignores it for deciding what to delete.

### R2. Superseded manifests are deleted
Old manifests stay public at versioned paths, and they hold **transcripts and credits**. After a consent revocation, the revoked revision's transcript would stay readable in `packs/grove/{id}/{oldVersion}.json` indefinitely. That's a rights leak.

**Rule (amend DATA_MODEL §12.4):** "Manifests are versioned paths and are never **overwritten**; after a new version is written and indexed, the reconciler **deletes older versions** of that scope." The `pack_builds` rows stay (history). Only the storage objects go. Devices already hold their installed manifest locally.

Integration test addition: after the revocation case, **every** stored manifest for the demo grove is free of the revoked revision id and its transcript.

### R3. Cache headers bound how long revocation takes
"Assets are immutable, so CDN caching is safe" is true for correctness but not for revocation. Set `cache-control` on upload:
- audio `a/{sha}.{ext}`: `public, max-age=3600` (revocation reaches caches within an hour)
- manifests: `public, max-age=60`

Amend DATA_MODEL §12.4 to say so. (Long immutable caching can come back later behind a CDN purge API, as its own ADR.)

### R4. A no-op rebuild doesn't bump the version
pg_cron and job retries will request rebuilds whose inputs haven't changed. `build-pack` computes the canonical manifest **without** `packVersion` and `builtAt`, hashes it (`content_sha256`), and compares that with the latest `pack_builds.content_sha256` for the scope. **If they're equal, it writes nothing, bumps nothing, and finishes the job as a no-op.** Add `content_sha256 text` to `pack_builds` (a new migration; M2a is merged, so **don't edit merged migrations**).

### R5. The demo seed needs a revision-specific consent
With one demo consent covering every revision, "revoke the demo consent" would empty the whole pack and prove nothing about a single revision. Add a second contributor, **"Demo Storyteller"**, with its own consent, attached (`revision_contributors`, role `storyteller`) **only** to frag4's revision 1, whose narration asset isn't used anywhere else. The integration test revokes **that** consent. Expected result: frag4's revision is gone from the pack, its asset returns 404, and everything else is unchanged. (Frag6 stays in the pack; devices that haven't completed frag4 just can't reach it yet, as ADR 0003 §6 allows.) Do this in a new seed change, not a migration.

---

## Answers to §4 (ambiguities)

| # | Decision |
|---|---|
| 1 | Region packs are listed when a `pack_builds` row exists for the region (regions have no publish status). Groves are listed only when `status = 'published'` and a build exists |
| 2 | **`builtAt` is deterministic:** it's the latest `updated_at` among every row that fed the pack (the input watermark), not the wall clock. It's still excluded from `content_sha256` (R4) |
| 3 | **Canonical JSON:** deep sorted object keys, no insignificant whitespace, UTF-8. Every array has a defined order (fragments by `storyOrder` then `id`; revisions by `fragmentId` then `revisionNo`; `requires` groups and members by `sort_order` then id; assets by `sha`; everything else by `id`). Coordinates are rounded to **6 decimal places**. Put a single `canonicalJson()` in `packages/shared`, Deno-safe, used by both the builder and the tests. `manifest_sha256` is computed over those exact bytes |
| 4 | **`unpublish(entity, ids[])`** works for `grove`, `fragment`, `revision`, `music_cue`, `ambience_zone`, `music_zone` and `ui_cue`. A SQL `fn_unpublish_commit` sets `status = 'unpublished'`, writes the audit log and enqueues `rebuild_pack` for the affected scopes. There are **no storage operations inline**; the R1 reconciler removes files after the rebuild. Editor and admin only. Children aren't cascaded: an unpublished grove simply drops out of the index, and unpublished fragments drop out of their pack |
| 5 | `build-pack`, `purge-assets` and `run-jobs` accept **only** the service role. Verify the JWT `role` claim is `service_role`; anything else gets 403. No manual staff rebuild in M2b (the admin gets a "rebuild" button in M3 that enqueues a job) |
| 6 | `publish` and `unpublish` are called with the **staff user's JWT** (forwarded by admin server actions in M3). The function checks the role by calling `has_role` **as that user** (a client built from the caller's `Authorization` header), and then uses a separate service-role client for storage copies and the commit RPC. Integration tests create an editor and a writer through the Auth admin API and sign in: the editor's publish succeeds, and the writer's gets 403 |
| 7 | `packages/shared/src/schemas/music.ts` holds `MusicCondition` and `StemRule` exactly as AUDIO_SPEC §4.2. `packs.ts` imports them |
| 8 | A new package, `tools/pack-integration`, run by `pnpm test:integration`. It is **not** part of the default `pnpm test` (it needs Docker); the CI `db` job runs it |
| 9 | Verify it: with CLI 3.2.0, check whether `supabase start` serves `supabase/functions/*` through the edge runtime. If it does, don't run a separate `functions serve` in CI. Record what you found in the report |
| 10 | Determine it empirically on both Windows and CI. `db:setup-local` takes an optional `RUN_JOBS_URL` env override; CI sets whatever works (likely the in-network Kong container). The URL stays in Vault, so no migration depends on it. Integration tests call `run-jobs` **directly** with the service key and don't wait for cron; one separate test proves the cron → pg_net → `run-jobs` path end to end |
| 11 | Covered by R5 (consent). The crossroads and dependent revision (frag10 rev 2, anchored on frag2) and a schedulable revision already exist. For the `publish_at` case, set frag8 rev 1's `publish_at` to the future in the test, check the pack excludes it, set it to the past, run the jobs, and check it's included. Report any other gaps rather than reshaping the seed |
| 12 | **Build the region pack fully** in M2b: profiles, layers and assets filtered by playability, region-wide zones and cues, `uiCues`, and `landcover` **nullable** when the region has no `landcover_grids` row. Test that it validates against `RegionPack` and that its assets are in the keep-set |
| 13 | **Yes, list it.** A published grove with zero playable revisions stays in the index with its (empty) pack. That's how devices learn to delete revoked content. Removing it from the index would leave phones holding stale audio |
| 14 | **Both environments must pass.** Windows is the development machine and CI is the gate. If option A fails on either, use option C with the CI diff check |

---

## Unchanged from the plan (approved as written)
§1.1 (plus music.ts per #7), §1.2 (with R1/R4 behaviour and #4–#6 auth), §1.3, §1.4, §1.5, §1.6 cases 1–5 (plus the R2 assertion and the R5 consent), §1.7, §2, and the implementation order in §3. Migrations: **new** files only (`get_pack_index`, `pack_builds.content_sha256`, `fn_unpublish_commit`). Pass `supabase db reset` from scratch.

## Doc amendments (draft them, quote them in the report; I'll review in the PR)
- DATA_MODEL §8: `pack_builds.content_sha256`
- DATA_MODEL §10: the reconciler (R1), unpublish (#4), job ordering
- DATA_MODEL §12.1: deterministic `builtAt` (#2); canonical JSON (#3)
- DATA_MODEL §12.3: the index listing rules (#1, #13)
- DATA_MODEL §12.4: superseded manifests deleted (R2); cache headers (R3)

## Report back with (in addition to the brief's list)
- Import-map checks (a)/(b) on **both** Windows and CI; A or C shipped
- The working `RUN_JOBS_URL` for local and for CI
- Integration output for each case, including the R2 manifest scan
- `content_sha256` of the demo grove pack on two consecutive builds (they should be equal, with no second version)
