# M3a plan — schema realignment (DATA_MODEL v3)

**Branch:** `m3a-schema-realign` from `origin/master` (`3b7f261`, merge of PR #5 / `m3-docs-realign`)  
**Brief:** `docs/briefs/M3-admin.md` § M3a  
**Wins on conflicts:** ADR 0004 → DATA_MODEL v3 → M3 brief → this plan; do not invent product behavior  
**Stop after this plan** for architect review. Do not write migrations or code until approved.

---

## 0. Preconditions

| Check | Result |
|---|---|
| `git fetch`; `origin/master` contains M2b merge `134c413` | **PASS** — `134c413` is an ancestor of `origin/master` |
| `origin/master` contains ADR 0004 / M3 docs realign | **PASS** — `3b7f261` Merge PR #5 (`m3-docs-realign`); commits `2735ba7`…`64d3882` on master |
| Working tree clean before branch | **PASS** |
| Docker Desktop running | **PASS** — Docker Engine 29.9.3, context `desktop-linux` |
| On `origin/master` content: `pnpm db:setup-local` | **PASS** — reset + Vault secrets + seed-media upload (22 files) |
| `pnpm exec supabase test db` | **PASS** — 23 files / 97 tests |
| `pnpm test:integration` with `supabase functions serve` | **PASS** — 10/10 (served without `--env-file`; `supabase/.env.local` is absent / gitignored, matching CI) |
| Branch cut | **PASS** — `git switch -c m3a-schema-realign origin/master` at `3b7f261` |

M3b hosting preconditions (hosted Supabase staging, Vercel, Google Maps keys, SMTP) are **not** required for M3a and were not checked.

---

## 1. Scope (from brief M3a)

Bring the merged M2 backend to DATA_MODEL v3 with **new migrations only**. Keep the M2 pipeline shape (two-phase publish, jobs outbox, `build-pack` canonical JSON / no-op, reconciler, Option C shared sync). Adapt publish/unpublish/pack builders to **releases + `published_snapshots` + atomic go-live**. Rewrite tests and seed. No admin UI, no mobile, no audio-engine work.

---

## 2. Migration file list (proposed order)

Timestamps continue after the last merged migration `20261120063146_…`. Exact names are proposals for review.

| # | File | Purpose |
|---|---|---|
| 1 | `20261121XXXXXX_m3a_enums.sql` | Add/alter enums to v3; drop unused enum types once nothing references them |
| 2 | `20261121XXXXXX_m3a_places_groves.sql` | Regions `sun_reference`; groves absorb sites; drop `sites` / `site_approvals` |
| 3 | `20261121XXXXXX_m3a_drop_rights_participation.sql` | Drop contributors, consents, asset_rights, revision_contributors, rings, crossroads*, seeds*, seed_*; drop ring/outcome/consent columns |
| 4 | `20261121XXXXXX_m3a_media.sql` | `audio_assets` columns; `image_assets`; storage bucket changes |
| 5 | `20261121XXXXXX_m3a_story.sql` | Story-wide threads/characters; fragments v3; prereq same-grove removal prep; revisions / versions |
| 6 | `20261121XXXXXX_m3a_ambience_music.sql` | Required `time_window` on layers and cues |
| 7 | `20261121XXXXXX_m3a_journal.sql` | Rename/trim Journal tables (`journal_terms`, `journal_entries`, `entry_links`) |
| 8 | `20261121XXXXXX_m3a_releases_ops.sql` | `releases`, `release_items`, `published_snapshots`; `pack_builds` / `jobs` / `staff` alters |
| 9 | `20261121XXXXXX_m3a_playability.sql` | Rewrite playability + contingency + publish check/commit signatures |
| 10 | `20261121XXXXXX_m3a_triggers_cron.sql` | Replace v2 triggers/cron; story-wide `fn_prereq_guard`; scheduled-release enqueue |
| 11 | `20261121XXXXXX_m3a_rls_storage.sql` | RLS per §13; staging-images; journal-voice; drop private-docs |
| 12 | `20261121XXXXXX_m3a_definer_grants.sql` | Follow-up #1: shrink authenticated execute; staff guards |

Grouping may be collapsed (e.g. 9–10) if review prefers fewer files; order of dependencies must stay.

### 2.1 Per-table: create / alter / rename / drop

#### Enums (`m3a_enums`)

| Type | Action |
|---|---|
| `fragment_visibility` | **Alter values:** drop `marked`/`unmarked`/`protected`; add `standard`/`physical` (map existing: `marked`→`standard`, `protected`→`physical`, `unmarked`→`standard` or drop rows — see ambiguities) |
| `time_window` | **Alter:** drop `dawn`/`dusk`; keep `day`/`night` |
| `asset_kind` | **Alter:** `writer_note` → `growth_cue` (or add + migrate + drop) |
| `change_kind` | **Create** `('contingency','correction')` |
| `character_prominence` | **Create** `('major','minor')` |
| `release_status` | **Create** |
| `entry_kind` | **Create** (replace `seed_kind` usage) |
| `entry_status` | **Create** (replace `seed_status` usage) |
| `rights_status`, `approval_status`, `asset_source`, `license_kind`, `ring_status`, `seed_kind`, `seed_status`, `crossroads_status` | **Drop** after dependents gone |

#### Places / media / story / sound / journal / ops

| Table | Action |
|---|---|
| `regions` | **Alter:** add `sun_reference geography(Point,4326) not null` (backfill required) |
| `sites` | **Drop** (after groves absorb) |
| `site_approvals` | **Drop** |
| `groves` | **Alter:** drop `site_id`; add `region_id` (not null, FK), `website_url`, `gatherings_url`, `allows_speaker_wildlife_sounds`; rename `narrator_growth_cue_id` → `growth_cue_id`; unique `(region_id, slug)` |
| `contributors`, `consents`, `asset_rights`, `revision_contributors` | **Drop** |
| `audio_assets` | **Alter:** add `bitrate_kbps int`, `true_peak_dbtp numeric(5,2)`; **drop** `source` |
| `image_assets` | **Create** (full §3) |
| `rings` | **Drop** |
| `threads` | **Alter:** drop `grove_id`; rename `bible` → `notes` |
| `characters` | **Alter:** drop `grove_id`; rename `bible` → `notes`, `public_bio` → `public_intro`; add `portrait_image_id`, `status` |
| `fragments` | **Alter:** rename `gap_hint` → `teaser`; visibility enum remapped; `trigger_radius_m` → `numeric(5,2)` default `10.67` check `4.57–10.67`; drop `introduced_in_ring_id`; add `indigeny_earth/world/body` |
| `fragment_prereq_groups` / `fragment_prereq_members` | **Keep**; guard rewritten (no same-grove) |
| `fragment_threads` | **Keep** |
| `fragment_characters` | **Alter:** add `prominence`, `card_line` |
| `fragment_revisions` | **Alter:** add `change_kind not null`, `release_id`; drop `ring_id`, `publish_at`, `requires_outcome_option_id`, `content_note`; `change_note` jsonb → `text`; drop `writer_notes` if not in v3 (see ambiguities) |
| `revision_versions` | **Alter:** add `time_window not null`; unique `(revision_id, language, time_window)` |
| `ambience_layers` | **Alter:** replace `time_windows time_window[]` with `time_window time_window not null` (split day+night rows) |
| `music_cues` | **Alter:** add `time_window time_window not null`; scrub conditions JSON of `ringIds`/`outcome`/`timeWindows` |
| `ambience_profiles`, `ambience_layer_assets`, `ambience_zones`, `landcover_*`, `ui_cues`, `music_zones`, `music_cue_stems` | **Keep** (no structural v3 change beyond cue/layer time window) |
| `seed_terms` | **Rename** → `journal_terms` |
| `seeds` | **Drop**; **create** `journal_entries` (§7) |
| `seed_links` | **Drop**; **create** `entry_links` (§7) |
| `questions` | **Alter:** drop ring columns if any; `requires_heard` → `requires_completed` (confirm column name in M2 — see ambiguities) |
| `devices` | **Alter:** drop `attested_at` / attestation columns if present |
| `crossroads`, `crossroads_options`, `crossroads_votes` | **Drop** |
| `gatherings`, `checkins`, `events`, `audit_log` | **Keep** (checkins/gatherings unchanged for M3a) |
| `releases`, `release_items`, `published_snapshots` | **Create** (§8) |
| `pack_builds` | **Alter:** add `release_id`, `live boolean not null default false` (backfill existing rows `live = true` so current packs remain visible) |
| `jobs` | **Alter:** extend `kind` check with `publish_release`; **ambiguity** on `id` type uuid vs bigint (§8) |
| `staff` | **Alter:** add `invited_by` |

#### Storage buckets

| Bucket | Action |
|---|---|
| `staging-images` | **Create** |
| `private-docs` | **Drop** (or empty + remove policies) |
| `seeds-voice` | **Rename** → `journal-voice` |
| `staging-audio`, `public-media` | **Keep**; public-media gains `i/{sha}.{ext}` |

---

## 3. Functions, triggers, cron, grants

### 3.1 Every public function: keep / rewrite / drop

| Function | Action |
|---|---|
| `set_updated_at` | **Keep** |
| `has_role` | **Keep** (still active-staff only; no 2FA) |
| `fn_fragment_guard` | **Rewrite** — physical ⇒ `marker_code not null`; ST_Covers unchanged |
| `fn_prereq_guard` | **Rewrite** — remove same-grove; story-wide cycle check under **one story-wide advisory lock** (brief decision 6; supersedes M2 follow-up #2) |
| `fn_region_today` | **Rewrite or drop** — Day/Night moves to shared `timeWindow.ts`; SQL may still need a helper for checklist `PREREQ_ONE_WINDOW` (ambiguity) |
| `fn_date_unexpired` | **Drop** (approvals/rights gone) |
| `fn_asset_is_playable` | **Drop** (§9) |
| `fn_site_ok` | **Drop** |
| `fn_revision_is_playable` | **Rewrite** — published revision + fragment snapshot published + grove snapshot published + ≥1 version |
| `fn_current_revision` | **Rewrite** — highest playable `revision_no` |
| `fn_contingency_revision_no` | **Create** — §4 definition |
| `fn_cue_is_playable` | **Rewrite** — cue snapshot published + zone/grove published |
| `fn_layer_assets_playable` | **Drop / replace** with `fn_layer_is_playable` (§9) |
| `fn_must_precede` | **Keep** (story-wide membership; used by `RADIUS_OVERLAP`) |
| `fn_publish_check(p_entity, p_ids[])` | **Drop signature**; **Create** `fn_publish_check(release_id)` — v3 checklist §11; returns `image_shas_to_publish[]` too; staff `has_role` guard for direct admin calls (follow-up #1) |
| `fn_publish_commit(p_entity, p_ids[])` | **Drop signature**; **Create** `fn_publish_commit(release_id)` — snapshots, statuses, audit, enqueue rebuilds tagged with `release_id` |
| `fn_unpublish_commit` | **Rewrite** — snapshot status `unpublished`; stranded-prerequisite **warning** (any grove); enqueue rebuilds |
| `fn_enqueue_rebuild_pack` | **Rewrite** — payload includes optional `release_id`; grant **service_role only** (follow-up #1) |
| `fn_enqueue_purge_asset` / `fn_enqueue_purge_reconcile` | **Keep shape**; grant **service_role only** |
| `get_pack_index` | **Rewrite** — latest **live** `pack_builds` only; grove listed when snapshot status `published` |
| `fn_pack_geog_geojson` | **Rewrite** — no protected-nulling; physical points included; still service_role only |
| `fn_require_editor_or_service` / `fn_is_editor_or_admin` | **Keep** (adjust if release-scoped) |
| `fn_rights_leave_active` | **Drop** |
| `fn_audit_fragment_change` | **Rewrite or keep** — still audit sensitive field changes; never log `marker_code` |
| `fn_publish_status_enqueue` | **Rewrite or drop** — rebuilds come from release commit / unpublish, not raw status flips (ambiguity: whether any status trigger remains) |
| `fn_enqueue_due_publish_at` | **Drop**; **Create** scheduled-release enqueuer (e.g. `fn_enqueue_due_releases`) inserting `jobs.kind = 'publish_release'` |
| `fn_close_due_crossroads` | **Drop** |
| `fn_daily_expiry_and_retention` | **Rewrite** — Journal voice retention only (§10); no consent/approval expiry |
| `fn_call_run_jobs` | **Keep** |

### 3.2 Triggers

| Trigger / event | Action |
|---|---|
| `fragments_guard` | Keep → rewritten function |
| `fragment_prereq_members_guard` | Keep → rewritten function |
| Rights / consent leave-active triggers | **Drop** |
| Publish-status → enqueue rebuild | **Replace** with release-commit enqueue (and unpublish) |
| `updated_at` triggers | Keep on all `…ts` tables; add for new tables |

### 3.3 Cron

| Job | Action |
|---|---|
| `run-jobs-every-minute` | **Keep** |
| `publish-at-and-crossroads-every-5m` | **Drop**; replace with **every-minute** (or keep 1-min via run-jobs path) enqueue of due `publish_release` jobs per §10 |
| `daily-expiry-hourly-check` | **Keep** calling rewritten retention function |

### 3.4 Grants (follow-up #1)

Target allowlist for `anon`/`authenticated` execute on security definer functions (proposal for review; each line needs a why-comment in `110_definer_grants.test.sql`):

- `get_pack_index()` — **anon** (devices)
- `has_role(roles[])` — authenticated (RLS helper)
- `fn_publish_check(release_id)` — authenticated **with** staff editor+ guard inside (checklist UI)
- Possibly `fn_must_precede` / playability helpers — **revoke from authenticated** unless admin calls them directly (prefer revoke)

Revoke from `authenticated`: `fn_enqueue_*`, old playability helpers that only builders use, `fn_publish_commit`, `fn_unpublish_commit` (edge/service only via `fn_require_editor_or_service`).

---

## 4. Snapshot model (how it works in practice)

### 4.1 What commit writes

`fn_publish_commit(release_id)` (single transaction, after edge copy succeeds):

1. Re-run `fn_publish_check`; abort if not ok.
2. For each `release_items` row, upsert `published_snapshots` `(entity, entity_id)` with `data` = publishable fields + links at commit time (§8 “What a snapshot holds”), `release_id`, `published_at`.
3. Set included revisions to `published` and `release_id`; set grove/fragment/character/zone/cue statuses as specified for those entities.
4. Mark matching `entry_links` `grown` when targets publish (no writers until M9; still implement).
5. Audit log; enqueue `rebuild_pack` jobs for every affected grove/region scope, payload including `release_id`.

**Revisions:** no snapshot row (§8). Pack builder reads the current playable revision row (immutable once published) plus `fn_contingency_revision_no`.

### 4.2 How `build-pack` reads

- **Grove pack:** load grove + fragment + character (+ image) snapshots for that grove; load music/ambience/ui from snapshots that intersect the grove; load **current** published revisions/versions from tables; emit GrovePack schema **2**; write `pack_builds` with `release_id` from the job, `live = false` when `release_id` is set.
- **Region pack:** region fields including `timezone` + `sunReference`; ambience profiles/layers with `timeWindow`; landcover; region-wide zones/cues; assets.
- Canonical JSON + `content_sha256` no-op behavior **unchanged**.
- Forbidden fields tests: no `markerCode` / Story Notes / internal notes.

### 4.3 Staged edits / “Unreleased changes”

Working tables remain editable under RLS while snapshots stay fixed. Detection (for M3c UI; schema must support it in M3a):

- For each publishable entity with a snapshot: deep-compare working publishable projection vs `published_snapshots.data` (including prereq groups, character links, etc.).
- Diff ⇒ “Unreleased changes” until a release containing that entity is published.
- **Integration test (M3a):** edit a published fragment field → rebuild/pack content unchanged until a release that includes it is published.

---

## 5. Atomic go-live

1. All `rebuild_pack` jobs from a release carry `release_id`.
2. `build-pack` inserts/updates `pack_builds` with `live = false` when tagged.
3. When **every** queued/successful build for that `release_id` has succeeded (no failed/pending rebuild for that release), flip **all** those rows to `live = true` in **one transaction** (in `run-jobs` after the last successful build, or a small SQL helper called from `run-jobs`).
4. `get_pack_index` reads only `live = true`.
5. Failed build ⇒ release stays non-live; phones keep previous live packs; release may be marked `failed` if the publish path failed earlier. Rebuild failure handling: see ambiguities.

**Tests:** release spanning both seed groves → neither grove’s new version appears in `get_pack_index` until both builds succeed; then both appear together.

---

## 6. Edge functions and shared code

| Area | Change |
|---|---|
| `publish` | Body: `{ releaseId }` (not entity/ids). Check → copy audio **and** images → commit. |
| `unpublish` | Still entity/ids; surface stranded-prereq warning from SQL. |
| `build-pack` | GrovePack schema 2 + RegionPack v3 from snapshots; set `live`/`release_id`. |
| `purge-assets` | Reconcile `public-media/a/` **and** `i/` to union of shas in **latest live** manifests. |
| `run-jobs` | Order: `publish_release` → `rebuild_pack` → `purge_asset`; after rebuilds, atomic go-live. |
| `packages/shared` | `packs.ts` schema 2; `music.ts` drop `ringIds`/`outcome`/`timeWindows`; add `contingency.ts`, `timeWindow.ts` (`suncalc`), `units.ts`; sync edge copies. |
| Types | Regenerate `packages/shared/src/db.ts` after migrations. |

`preview` / `invite-staff` are **M3d / M3b** — not built in M3a.

---

## 7. GrovePack schema 2 / RegionPack diffs vs v2 (schema 1)

### 7.1 GrovePack

| Field / area | v2 (shipped) | v3 (schema 2) |
|---|---|---|
| `schema` | `1` | `2` |
| Top-level | `groveId`, `packVersion`, `builtAt` | + `regionId` |
| `grove` | nested `site { name, accessInfo, websiteUrl, gatheringsUrl }` | flat `accessNotes`, `websiteUrl?`, `gatheringsUrl?`, `allowsSpeakerWildlifeSounds`; **no** `site` |
| `rings` | present | **removed** |
| `characters` | `publicBio`, `introducedByFragmentIds` | `publicIntro`, `portraitSha?`, `portraitAlt?`; introduced-by moves to per-fragment links |
| `fragments.visibility` | `marked`/`unmarked`/`protected` | `standard`/`physical` |
| `fragments.gapHint` | optional | **`teaser` required in publish**; pack field `teaser` |
| `fragments` coords | omitted when `protected` | **always** `lat`/`lng` for map; `radiusM?` omitted for physical |
| `fragments.characters` | `characterIds: uuid[]` | `[{ characterId, prominence, introduces, cardLine }]` |
| `revisions` | `ringId`, `publishAt`, `contentNote`, `changeNote`, `credits`, `grownFromSeedCount`; `currentRevisionByFragment` map | `changeKind`, `contingencyRevisionNo`; **current revision only**; no credits/ring/publishAt |
| `revisions.versions` | `lang`, asset fields | + **`timeWindow: 'day'\|'night'`** |
| `questions` | `ringId?`, `requiresHeard` | no ring; `requiresCompleted` |
| `crossroads`, `ledger` | present | **removed** |
| `music.cues` | no cue-level time window; conditions may include rings/outcome/timeWindows | **`timeWindow` required**; conditions without those keys |
| `assets.kind` | audio kinds | audio kinds **\| `'image'`** |
| Forbidden | no marker codes; no protected coords | no marker codes; no Story Notes; coords OK for physical |

### 7.2 RegionPack

| Field / area | v2 | v3 |
|---|---|---|
| `schema` | `1` | (confirm literal — ambiguity if still `1` or bump) |
| Time | absent | **`timezone`**, **`sunReference: {lat,lng}`** |
| Layers | no per-layer window in zod today | each layer **`timeWindow`** |
| Music cues | via conditions `timeWindows` | cue-level `timeWindow`; conditions cleaned |

---

## 8. Test plan (by file)

### 8.1 pgTAP — delete

| File | Why |
|---|---|
| `012_protected_marker.test.sql` | protected → physical; coords no longer secret |
| `040_playable_rights.test.sql` | rights removed |
| `050_jobs_revocation.test.sql` | consent revocation path gone |
| `051_jobs_publish_at.test.sql` | revision `publish_at` → release schedule |
| `062_rls_pii.test.sql` | contributor PII policies gone |
| `070_protected_coords_anon.test.sql` | protected coords rule removed |
| `090_asset_rights_checks.test.sql` | asset_rights dropped |

### 8.2 pgTAP — rewrite

| File | Focus |
|---|---|
| `010_prereq_graph.test.sql` | cross-grove edges allowed; story-wide cycles rejected; advisory lock behavior |
| `011_point_in_polygon.test.sql` | still valid |
| `015_seed_graph.test.sql` | v3 seed graph (physical Frag 9, contingency/correction, second grove) |
| `017_get_pack_index_anon.test.sql` | **live** builds only |
| `030_checklist_codes.test.sql` | every §11 code including `NO_TEASER`, `PHYSICAL_NO_CODE`, `NO_ALT_TEXT`, `PREREQ_ONE_WINDOW`; remove rights/approval/outcome codes |
| `041_current_revision.test.sql` | playability via snapshots |
| `060_rls_anon.test.sql` / `061_rls_role_matrix.test.sql` | writer/editor/admin + Story Notes; no contributor tables |
| `080_publish_check_commit.test.sql` | release-scoped check/commit + snapshots |
| `101_pack_geog_guards.test.sql` | physical points included; still no marker codes in geog helper output |
| `102_publish_unpublish_role_guards.test.sql` | release publish; stranded warning |
| `110_definer_grants.test.sql` | shrunk allowlist + per-line comments |
| `000_extensions_search_path.test.sql`, `020_updated_at.test.sql`, `100_vault_run_jobs_missing.test.sql` | keep with light updates |
| `016_seed_geometry_dropped.test.sql` | keep if still applicable |

### 8.3 pgTAP — add

| File (proposed) | Focus |
|---|---|
| `013_physical_marker.test.sql` | code required; pack hash only |
| `042_contingency_revision_no.test.sql` | contingency vs correction math |
| `052_scheduled_release.test.sql` | success + check-failure → `failed` + `last_check` |
| `053_atomic_golive.test.sql` | two-grove release live flip |
| `054_staged_edits.test.sql` | working edit does not change snapshot / pack until release |
| `063_rls_story_notes.test.sql` | Indigeny/thread/character notes staff-only |
| `091_image_assets_reconcile.test.sql` | image public flag / checklist `NO_ALT_TEXT` (SQL side) |

### 8.4 Integration (`tools/pack-integration`)

| Test | Action |
|---|---|
| Demo grove validates / assets resolve / region pack / get_pack_index / writer cannot publish / forged JWT / no-op rebuild | **Rewrite** for schema 2 + releases |
| Revoke storyteller consent | **Delete** |
| Decide crossroads | **Delete** |
| `publish_at` gate | **Replace** with scheduled `publish_release` |
| **Add:** staged edit does not leak; atomic go-live two groves; contingency bumps `contingencyRevisionNo` in pack; correction does not; image in public-media reconcile; cross-grove requires id present |

### 8.5 Shared Vitest

| Module | Action |
|---|---|
| `schemas/packs.test.ts` | Schema 2 forbidden fields (marker codes, Story Notes); physical may have lat/lng |
| `schemas/music.ts` tests | No ring/outcome/timeWindows |
| `story/contingency.ts` | **Add** with SQL parity cases |
| `time/timeWindow.ts` | **Add** (`suncalc`, polar fallback) |
| `units.ts` | **Add** (ft/m) — may land with M3c; include in M3a if pack/admin shared early |

Dependency: ask before adding `suncalc` only if not already treated as allowed — brief decision 16 lists `suncalc` as allowed without asking.

---

## 9. Seed and fixtures

Per DATA_MODEL §15 and brief M3a.5:

1. **Region** `wasatch-front` with `sun_reference` near Farmington Bay.
2. **Farmington test grove** from `supabase/fixtures/farmington-bird-refuge.json` (update fixture): Frag 9 **physical** code `DEMO-001`; Frag 10 rev2 **contingency**; Frag 4 rev2 **correction**; ≥1 Day-only and ≥1 Day+Night fragment; teasers on all; radii in metres (default 10.67); no rings/crossroads/consents.
3. **Second small test grove** nearby (new fixture block or sibling JSON): two fragments; one **cross-grove** prerequisite to a Farmington fragment; used for unlock + atomic release tests. Generate geometry from the same constants pattern as Farmington (offset polygon).
4. Ogden Nature Center + Pia Okwai remain **draft** groves (no sites).
5. 2 story-wide characters + placeholder **image_assets** portraits (alt text) + `fragment_characters` card lines; 1 thread; 1 question.
6. Ambience/music: Day and Night layers/cues (split former multi-window rows); regenerate tones / `seed-media.json` as needed.
7. **One published release** covering published content; **one draft release** for later preview tests.
8. `journal_terms` v1; landcover fixture retained.
9. Regenerate `apps/mobile/e2e/demo-route.gpx` from the fixture (include second grove only if the route should exercise the bridge — **ambiguity**).

---

## 10. Ambiguities and contradictions (list only — do not resolve)

### 10.1 DATA_MODEL v3 internal

| ID | Issue |
|---|---|
| A1 | §10 commit text says snapshots are written for **grove, fragment and character** only, but §8 `release_items` and “What a snapshot holds” also cover **image, ambience_profile, ambience_zone, music_zone, music_cue, ui_cue**. Which entities get snapshot rows at commit? |
| A2 | §8: “Revisions don't need snapshots” but `release_items` allows `entity = 'revision'`. What does including a revision in a release do beyond setting `fragment_revisions.status` / `release_id`? Must the parent fragment also be a release item? |
| A3 | `jobs.id`: §8 shows `bigint generated always as identity`; M2 shipped `uuid`. Migrate to bigint, or treat §8 as aspirational and keep uuid? |
| A4 | `fn_layer_is_playable` (§9) vs shipped `fn_layer_assets_playable` — confirm rename and whether asset-level playability checks remain at all without rights. |
| A5 | After dropping `fn_asset_is_playable`, what makes an audio/image sha eligible to copy to `public-media` — solely “referenced by this release’s check output”? |
| A6 | `PREREQ_UNPUBLISHED` (§11) says member must be **published** or in the same release. ADR 0003 previously allowed **retired**. Are retired prerequisites still valid? |
| A7 | `fn_revision_is_playable` requires fragment snapshot status `published`. Fragment comment: `retired` hides from map but keeps Chronicle. Are retired fragments’ revisions still playable / pack-included with `retired: true`? |
| A8 | Pack fragment field `retired` vs snapshot `status` — derivation rule when status is `unpublished` vs `retired` vs `published`? |
| A9 | `get_pack_index`: “Groves appear only when their snapshot status is `published` (including groves with zero playable revisions)”. Does unpublish remove the grove from the index immediately (snapshot status flip) even before rebuild? |
| A10 | Rebuilds from **unpublish** (no release): `pack_builds.release_id` null — is `live` set `true` immediately on insert, or is there another go-live rule? |
| A11 | Atomic go-live: who flips `live`, and what if one of N rebuilds **fails** after commit already wrote snapshots? Release status? Retry? Phones still on old live packs? |
| A12 | Scheduled release enqueue: §10 says pg_cron enqueues `publish_release`; also says run-jobs runs every minute. Is enqueue a separate SQL cron function, or does `run-jobs` / `fn_call_run_jobs` poll `releases`? |
| A13 | `fragment_revisions.change_note`: v3 is `text`; M2 is `jsonb`. Confirm scalar text. Is `writer_notes` dropped? |
| A14 | `questions`: M2 column naming (`requires_heard`?) vs v3 `requires_completed` — confirm rename only. |
| A15 | `gatherings.title` is `jsonb` in SQL but GrovePack sketch shows `title` like a string; v2 zod used `z.string()` with datetime URL. L10n or string in schema 2? |
| A16 | RegionPack: bump `schema` literal? §12.2 does not say `schema: 2`. |
| A17 | RegionPack layer/profile `name` types: SQL `text` vs older zod `L10n` — which wins in v3 zod? |
| A18 | `ambience_profiles` / zones: do they have `status` snapshots independently when only a grove release publishes? How does a grove pack include a zone that was never in a release? |
| A19 | First publish of a brand-new grove: must `release_items` list every fragment, revision, character, and intersecting sound entity explicitly, or does commit expand dependencies? |
| A20 | Marker hash in fragment snapshot: computed from working `marker_code` at commit. If code is rotated (staged) but not released, pack keeps old hash — confirm. |
| A21 | `threadIds` in packs while Story Notes “never in packs” — ids-only for music is intentional? Confirm threads table ids are non-sensitive. |
| A22 | Character appears in grove pack iff linked to that grove’s fragments — confirm; portraits via `image` snapshots / assets list. |
| A23 | `staff.invited_by` added in M3a schema but invites are M3b — nullable forever until first invite? |
| A24 | Enum migration strategy for in-place value renames on Postgres (`writer_note`→`growth_cue`, visibility remap) — preferred pattern not specified. |
| A25 | `unmarked` → `standard` data mapping may change product meaning (was hidden-until-adjacent). Seed has no unmarked left? Confirm fixture. |
| A26 | Daily retention still at “02:00 regional time” with multiple regions — same C8 open point as M2. |
| A27 | Cross-grove `requires` ids not present in the installed grove pack: device treats as never completed until the other grove’s pack is installed — confirm; any admin checklist warning for “prerequisite grove not published”? |
| A28 | Contingency vs unlocks (§14): unlocks never removed, but FR-5 says contingency makes a fragment not-completed until reheard. Confirm `contingency.ts` / pack field only gate **prereq satisfaction and Chronicle replay**, not map “unlocked” opacity, for the contingent fragment itself. |
| A29 | `NO_START` warning: “open from the start (prerequisites only elsewhere)” wording — does a grove whose only starts require **cross-grove** prereqs warn? |
| A30 | `pack_builds.live default false` vs backfill of existing M2 rows — migration must set current latest builds live or index goes empty after migrate; confirm. |
| A31 | Snapshot `data` JSON shape is described in prose only — is there a zod schema for snapshot payloads in M3a, or opaque jsonb until M3c? |
| A32 | `fn_publish_check` dependency set: “plus the live snapshots it depends on” — exact expansion rules for prereqs, stems, portraits, growth cues not formalized. |
| A33 | Image entity key in `release_items` is `'image'` but table is `image_assets` — confirm. |
| A34 | `entry_kind` includes `memory`; ADR removed memory seeds — is `memory` still a Journal kind? |
| A35 | Grove `access_notes` “L10n per key” vs prior free-form L10n object — required keys? validation? |

### 10.2 ADR 0004 vs DATA_MODEL / other docs

| ID | Issue |
|---|---|
| B1 | ADR 0003 body still states tier default radii **30/25/20 m** and same-grove guards in the decision prose; ADR 0004 / DATA_MODEL say **35 ft default for every tier** and cross-grove prereqs. Header “Amended by” notes it, but body text still contradicts. |
| B2 | ADR 0003 Context still says “Crossroads are unchanged”; ADR 0004 removes them. |
| B3 | ADR 0003 §3 “a later revision doesn't undo completion” vs ADR 0004 contingency math — amended note exists; device/SQL must follow 0004. |
| B4 | ADR 0004 open questions (character grove listing, changed-since marker, night hints, progress backup, children/Journal, center button) — **out of M3a code**, but Chronicle pack fields (`portrait`, `cardLine`) are still built in M3a; confirm no pack field depends on those open questions. |
| B5 | ADR 0004 decision 21–22 (releases / staged edits) vs residual TECH_SPEC/edge wording that might still describe entity publish — M3a should follow DATA_MODEL §10; flag any leftover TECH_SPEC §5 examples during implementation without silent doc edits unless asked. |
| B6 | M2 follow-ups.md still says ADR 0002 is Proposed and lists follow-up #2 as per-grove lock; M3 brief / ADR 0002 Accepted / story-wide lock supersede — follow-ups doc is stale (don't fix in M3a unless asked). |
| B7 | PRODUCT_SPEC FR-4: physical play “never by proximity” + ADR accessible trigger “standard only” — consistent; ensure seed/tests don't proximity-trigger physical. |
| B8 | ADR 0004: physical markers “appear on the map like other fragments” at 100%/35% opacity rules — pack must include lat/lng; confirm no remaining “omit coords for physical” test logic. |

### 10.3 Brief / pipeline edge cases

| ID | Issue |
|---|---|
| C1 | Exact `publish_release` job payload shape (`{ releaseId }` only?) unspecified. |
| C2 | Whether `fn_publish_status_enqueue` survives for non-release status transitions (e.g. retiring a fragment without a release) — staged-edit model suggests retirement also needs a release; confirm. |
| C3 | Second grove in demo GPX or test-only — §15 doesn't say the GPX visits the second grove. |
| C4 | Integration suite currently mutates demo consents/crossroads; after deletion, seed must expose release/schedule/contingency handles with stable UUIDs for tests (like today’s `DEMO` constants). |
| C5 | `supabase functions serve --env-file supabase/.env.local` fails locally (file absent); CI uses bare `functions serve`. Document as env note, not a precondition failure. |
| C6 | Loudness columns nullable on seed tones — checklist `LOUDNESS` warning when null? |
| C7 | Option C shared sync: new modules (`contingency`, `timeWindow`, `units`) — which are Deno-imported by edge in M3a vs admin-only later? |

---

## 11. Implementation sketch (after approval only)

1. Land migrations 1–12 in order; `supabase db reset` after each group if needed; regenerate types.
2. Rewrite SQL functions/triggers/cron; shrink definer grants.
3. Update edge functions + shared zod/packs; `pnpm db:sync-edge-shared`.
4. Rewrite seed + fixtures + seed-media + GPX.
5. Rewrite/delete/add tests per §8.
6. Green locally: `db reset`, `test db`, `test:integration`, root `lint && typecheck && test`.
7. Open M3a PR. **Do not** start M3b until merge + `M3b-plan.md` checkpoint.

**Out of scope:** admin UI, Playwright, hosted staging, `preview`, `invite-staff`, mobile, Listening Simulator, Journal inbox, audio engine (`AudioEngine` / mobile audio).

---

## 12. Acceptance mapping

| Criterion | Plan coverage |
|---|---|
| `db reset` + seed clean | §2, §9 |
| pgTAP + integration + root checks green | §8 |
| Demo grove pack schema 2; no marker codes / Story Notes | §6–7, forbidden-field tests |
| Staged edits don't leak | §4.3, §8.3 `054_…`, integration |
| Two-grove atomic go-live | §5, §8.3 `053_…` |
| Contingency vs correction in pack | §8.4–8.5 |
| DATA_MODEL match or quoted deviation | §10 list; report after ship |

---

## 13. Report back after implementation (not this checkpoint)

Per M3 brief: branch log; `db reset` / `test db` / `test:integration` / root checks; doc amendments quoted; deviations; open questions still unresolved from §10.
