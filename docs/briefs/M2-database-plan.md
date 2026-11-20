# M2 database — plan checkpoint (before M2a)

**Status:** awaiting architect review — **no migrations or implementation code yet**  
**Brief:** `docs/briefs/M2-database.md`  
**Branch:** `m2a-schema` from `origin/master` @ `96979f8` (Merge pull request #2 from JoJoSwain/m1-audio-spike)  
**Scope of this document:** plan only. Stop here until the architect approves.

---

## 1. Precondition results

| # | Check | Result | Evidence |
|---|---|---|---|
| 1 | `docker --version` works and Docker Desktop is running | **PASS** | `Docker version 29.9.3, build 5457199`; `docker info` → ServerVersion `29.9.3`; `docker run --rm hello-world` printed the success banner |
| 2 | M1 is merged on `origin/master` | **PASS** | After `git fetch origin`, tip is `96979f8 Merge pull request #2 from JoJoSwain/m1-audio-spike` (contains M1 commits) |
| 3 | `git status` clean apart from this brief | **PASS** | Only untracked: `docs/briefs/M2-database.md` (before this plan was added) |
| 4 | `git switch -c m2a-schema origin/master`, then commit brief | **PASS (this commit)** | Branch created from `origin/master`; this commit adds the brief + this plan |

**Also noted (not a brief precondition, but relevant):** `supabase` is **not** yet a root `devDependency`. `pnpm exec supabase` fails until M2a installs it (decision 2). `npx supabase@3.2.0` resolves today; pin via `package.json` in M2a, not now.

**Verdict:** All four preconditions pass. Proceed with this plan for architect review. Do **not** treat migrations as started.

---

## 2. Migration file list and order of application

Per brief decision 2: one migration per DATA_MODEL area, created with `pnpm exec supabase migration new <name>` (timestamped). Proposed **logical** names and contents (timestamps assigned at creation time):

| # | Migration name (suffix) | DATA_MODEL / brief area | Creates |
|---|---|---|---|
| 01 | `extensions_and_enums` | §1 + decision 4 | `create extension` for postgis / pg_cron / pg_net / pgcrypto in `extensions` schema; all enums |
| 02 | `places` | §2 | `regions`, `sites`, `site_approvals` + GiST as needed |
| 03 | `assets_and_rights` | §3 | `contributors`, `consents`, `audio_assets`, `asset_rights` (without `seed_id` FK yet) |
| 04 | `story` | §4 | `groves`, `rings`, `threads`, `characters`, `fragments` (+ `fn_fragment_guard` trigger), junction tables, `fragment_revisions`, `revision_versions`, `revision_contributors` |
| 05 | `ambience` | §5 | `ambience_profiles`, `ambience_layers`, `ambience_layer_assets`, `ambience_zones`, `landcover_classes`, `landcover_grids` |
| 06 | `music` | §6 | `music_zones`, `music_cues`, `music_cue_stems` |
| 07 | `participation` | §7 | `seed_terms`, `questions`, `devices`, `seeds`, `seed_links`, `crossroads`, `crossroads_options`, `crossroads_votes`, `gatherings`, `checkins`; then FKs: `asset_rights.seed_id`, `fragment_revisions.requires_outcome_option_id`, `crossroads.outcome_option_id`, `seed_links.crossroads_option_id` |
| 08 | `ops` | §8 + decision 7 | `staff`, `audit_log`, `events`, `pack_builds`, **`jobs`** |
| 09 | `playability_functions` | §9 + decision 6 | `fn_asset_is_playable`, `fn_site_ok`, `fn_revision_is_playable`, `fn_current_revision`, `fn_cue_is_playable`, `fn_layer_assets_playable`, `fn_publish_check`, `fn_publish_commit`; shared `set_updated_at()` trigger function applied to all `…ts` tables |
| 10 | `triggers` | §10 (amended by decisions 6–7) | Revocation → enqueue jobs; publish_at / crossroads close cron helpers; daily expiry/retention enqueue; **no HTTP inside triggers** |
| 11 | `rls` | §13 | `has_role()`, RLS on every table, column-privacy views, grants (anon: none on tables) |
| 12 | `storage` | §13 buckets | Buckets `public-media`, `staging-audio`, `seeds-voice`, `private-docs` + storage policies |
| 13 | `cron` | §10 + decision 7 | pg_cron: every 1 min → `run-jobs` via pg_net; every 5 min → scheduled publish_at / crossroads close enqueue; daily 02:00 America/Denver → expiry + retention (see ambiguities) |

**Also in M2a (not a migration):**
- `supabase/seed.sql` rewrite per §15 + decision 11
- `packages/shared/src/db.ts` via `supabase gen types typescript --local`
- pgTAP under `supabase/tests/`
- DATA_MODEL.md amendments for decisions 6 and 7 (quoted in the M2a PR report, not invented here)

**Explicitly deferred to M2b:** edge function bodies (`publish`, `unpublish`, `build-pack`, `purge-assets`, `run-jobs`), zod pack schemas, `get_pack_index()` grant surface completion if it depends on pack_builds rows from the builder, Vitest integration suite, CI `db` job.

**Note:** M2a still creates the SQL for playability + publish check/commit and the job-enqueue triggers so tests can assert outbox rows without calling HTTP. The edge functions that *consume* those jobs land in M2b.

---

## 3. PostGIS across schemas (decision 4)

**Approach:**
1. Enable extensions in the `extensions` schema (Supabase default), e.g. `create extension if not exists postgis with schema extensions;`, same for `pg_cron`, `pg_net`, `pgcrypto`.
2. Keep `config.toml` `[api].extra_search_path = ["public", "extensions"]` (already present) so PostgREST roles resolve `geography` / `ST_*` without schema prefixes in ad-hoc SQL.
3. In **security definer** functions (decision 5): set `search_path = ''` (or an explicit list) and use **fully qualified** names: `extensions.geography`, `extensions.ST_Covers(...)`, `extensions.ST_Intersects(...)`, etc.
4. Table columns stay typed as `extensions.geography(Polygon,4326)` / `Point` in migrations (or `public` aliases if Supabase installs typmod wrappers — verify on first `db reset` and adjust to whatever the local image actually exposes; do not invent a second PostGIS install in `public`).
5. **Verification (pgTAP):** as `anon`, `authenticated`, and `service_role`, `select extensions.ST_AsText(extensions.ST_GeomFromText('POINT(0 0)', 4326));` (or the project’s resolved equivalent) succeeds; fragment insert with point-in-polygon guard works under `authenticated` staff JWT.

---

## 4. Edge functions importing shared zod schemas (decision 9)

**Chosen option for M2b (proposed now so M2a doesn’t paint us into a corner): Deno import map + relative path into `packages/shared`.**

| Option | How | Pros | Cons |
|---|---|---|---|
| **A. Import map (chosen)** | `supabase/functions/import_map.json` maps `@intell/shared/` → `../../packages/shared/src/` and `zod` → `npm:zod@…` matching the workspace pin; functions `import { GrovePack } from '@intell/shared/schemas/packs.ts'` | Single source of truth; no copy step; matches monorepo | Deno must typecheck/emit the shared TS graph; shared code used by edge must stay Deno-friendly (no Node-only APIs in pack schemas) |
| B. Relative imports only | `import … from '../../../packages/shared/src/schemas/packs.ts'` | Simple | Brittle paths; every function repeats them; worse when nesting `_shared` |
| C. Build/copy into `functions/_shared` | `pnpm` script copies or bundles schemas before serve/deploy | Isolates Deno from packages/ | Easy to drift; violates “one source of truth” unless CI fails on diff |
| D. Publish `@intell/shared` to a registry | npm/JSR | Clean Deno `npm:` imports | Overkill for private app; version lag |

**Trade-offs accepted with A:** pack schemas and pure zod helpers must not import Node/Expo-only modules. Keep `packages/shared/src/schemas/packs.ts` free of Node builtins. If Deno cannot resolve a workspace path on Windows, fall back to **B** with a thin `supabase/functions/_shared/packs.ts` that re-exports from the relative monorepo path (still no duplicated schema body).

**M2a implication:** no pack zod file required yet; when M2b adds it, place it only under `packages/shared/src/schemas/packs.ts`.

---

## 5. How `run-jobs` gets its URL and key locally (decision 7)

**Proposed local wiring (no secrets in migrations):**

1. After `supabase start`, seed (or a small `supabase/seed.sql` block) writes Vault secrets via `vault.create_secret`:
   - `run_jobs_url` → `http://host.docker.internal:54321/functions/v1/run-jobs` (or the in-stack Kong URL that pg_net can reach from the DB container — **verify on first local bring-up**; common alternatives: `http://kong:8000/functions/v1/run-jobs`)
   - `run_jobs_service_key` → local `service_role` JWT from `supabase status` (injected at seed time from env / `supabase status -o env`, not committed)
2. pg_cron job (migration 13) calls a SQL wrapper that reads `vault.decrypted_secrets` and `net.http_post(...)` with `Authorization: Bearer <service_key>`.
3. Migrations only create the cron *schedule* and the wrapper function; they never hard-code URL or key.
4. Document in README / brief follow-up: developers re-run seed or a `pnpm` helper after `supabase start` if Vault secrets were wiped by `db reset`.

**Open:** exact in-Docker hostname for Functions from Postgres on Windows Docker Desktop — confirm during M2a cron migration bring-up; if ambiguous, ask before merging M2a.

---

## 6. Test approach and pgTAP file list

**Runner:** `pnpm exec supabase test db` (pgTAP).  
**Pattern:** each test file sets role / JWT claims (`set local role authenticated; select set_config('request.jwt.claim.sub', …, true);` plus staff row), exercises one concern, resets.

### Proposed `supabase/tests/` files (M2a)

| File | Covers |
|---|---|
| `000_extensions_search_path.test.sql` | PostGIS resolvable for anon / authenticated / service_role |
| `010_tier_parent.test.sql` | `tier_parent` check + `fn_fragment_guard` parent-tier rules |
| `011_point_in_polygon.test.sql` | Fragment outside grove boundary rejected |
| `012_protected_marker.test.sql` | `protected` without `marker_code` rejected |
| `020_updated_at.test.sql` | Shared `set_updated_at` trigger bumps on update |
| `030_checklist_codes.test.sql` | Each §11 code fires on a crafted bad case (including warnings if architect confirms they don’t fail `ok`) |
| `040_playable_rights.test.sql` | `fn_revision_is_playable` false for: consent revoked; consent expired; missing `app` channel; asset right revoked; site approval expired; outcome not decided |
| `041_current_revision.test.sql` | Highest playable `revision_no`; fallback when newest revoked / unplayable |
| `050_jobs_revocation.test.sql` | Leaving `active` on consent/right/approval enqueues `rebuild_pack` and `purge_asset` |
| `051_jobs_publish_at.test.sql` | Scheduled `publish_at` path enqueues rebuild (invoke the SQL helper the cron would call) |
| `060_rls_anon.test.sql` | `anon` cannot `select` any public table; only intended execute grants |
| `061_rls_role_matrix.test.sql` | viewer read/no write; writer can’t publish or set `grown`; sound can’t edit groves; editor can’t manage `staff`; admin can |
| `062_rls_pii.test.sql` | `viewer` / `writer` / `anon` cannot read `contributors.legal_name/contact_*`, `consents.document_path`, `seeds.memory_contact`; editor/admin can |
| `070_protected_coords_anon.test.sql` | No function granted to `anon` returns protected coordinates or raw `marker_code` |
| `080_publish_check_commit.test.sql` | Happy-path check → commit sets statuses / `is_public` / seed grown / audit / job enqueue without requiring Storage copy (Storage copy is edge, M2b) |

**M2b (not this PR):** Vitest against local stack for pack bytes, 404 after purge, determinism, CI `db` job.

---

## 7. DATA_MODEL ambiguities and contradictions

Listed for architect resolution — **do not resolve silently in M2a**.

### 7.1 Amended by the brief (doc still outdated)

| ID | Issue | Pointers |
|---|---|---|
| A1 | §10 still describes monolithic `fn_publish` that copies Storage and rebuilds packs inside DB write path; brief decision 6 splits into `fn_publish_check` + storage copy in edge + `fn_publish_commit` | DATA_MODEL §10–11 vs brief decisions 6–7 |
| A2 | §10/§8 imply triggers call pg_net / purge / rebuild directly; brief requires **jobs outbox** only | DATA_MODEL §8, §10 vs decision 7 |
| A3 | §11 title still says `fn_publish`; checklist return shape should match `fn_publish_check` (`asset_shas_to_publish[]` added by decision 6) | DATA_MODEL §11 vs decision 6 |
| A4 | TECH_SPEC §5 still says publish runs `fn_publish` | TECH_SPEC §5 vs brief |
| A5 | BUILD_PLAN M2 still lists one lump (migrations §1–10 + edge functions together); brief splits M2a/M2b | BUILD_PLAN vs brief |

### 7.2 Missing schema for stated behavior

| ID | Issue | Pointers |
|---|---|---|
| B1 | Region packs bump “the region version”, but `regions` has **no** `pack_version` (or similar) column; only `groves.pack_version` exists | §8 `pack_builds`, §10 last paragraph, §12.2 |
| B2 | Region pack includes `uiCues` (e.g. Hush “Listen.”) but **no table** defines them | §12.2 |
| B3 | `jobs` table is brief-only; not yet in DATA_MODEL §8 (must be added when amending) | decision 7 |
| B4 | Playability functions “owned by a dedicated role” — role **name**, creation, and grants never specified | §9 |
| B5 | `get_pack_index` returns `bbox` / `name` — source columns for region vs grove not specified (grove boundary? region `bounds`? L10n name?) | §12.3 |
| B6 | Ledger `growers: string[]` — which credit names, moderation filter, ordering, cap? | §12.1 `ledger` |
| B7 | Three real sites in seed: only “e.g. Ogden Nature Center” named; other two sites and **placeholder coordinates** unspecified | §15, decision 11 |
| B8 | Demo Park geometry / fragment coordinates / zone polygons unspecified (needed for point-in-polygon and GPX) | §15; `apps/mobile/e2e/demo-route.gpx` referenced but may not exist yet |

### 7.3 Rule edge cases and contradictions

| ID | Issue | Pointers |
|---|---|---|
| C1 | `fn_revision_is_playable`: fragment must be neither `unpublished` nor `draft`. Are `retired`, `in_review`, `approved` playable? Comment on fragments says `retired` hides from map but keeps Journal — implies revisions may still be playable | §4 fragments comment vs §9 |
| C2 | `NO_ROOT` / `PARENT_UNPUBLISHED` say “published” — fragment `status` or existence of a playable revision? | §11 vs §9 |
| C3 | `RADIUS_OVERLAP` and `LOUDNESS` marked **(warning)** — does `ok=false`, or `ok=true` with warnings in `failures[]`? | §11 |
| C4 | `CONDITION_SCHEMA`: validating zod inside Postgres is undefined (plv8? edge-only pre-check? duplicate JSON Schema?) | §11 |
| C5 | Equal stem duration / loop points: §6 says enforced at publish; brief says not by trigger — confirm **only** checklist `STEM_MISMATCH`, no DB constraint | §6, brief M2a.1 |
| C6 | Music cue check allows **both** `music_zone_id` and `grove_id` non-null; pack shape has `zone?` and `useGroveBoundary` — which wins if both set? | §6, §12.1 |
| C7 | Crossroads auto-`closed` via cron, but `decided` requires moderator — should closing enqueue a pack rebuild or only `decided`? | §10 |
| C8 | Daily job at “02:00 regional time” with multiple regions / timezones — one cron in `America/Denver`, or per-region? | §10, `regions.timezone` |
| C9 | Consent / right / approval “unexpired”: treat `expires_on is null` as never expires? | §9 |
| C10 | `fn_asset_is_playable`: “at least one active unexpired right”; for non-`consent_form` licenses, is `contributor_id` / `consent_id` required? | §3, §9 |
| C11 | `asset_rights.consent_id` “required when license = consent_form” — DB check constraint or publish-only? | §3 |
| C12 | Protected coordinates “staff only” on `fragments.location`, but RLS role matrix gives **viewer** read of content — do viewers see protected lat/lng in admin? | §4 comment vs §13 |
| C13 | Column privacy via “security-definer view” vs direct table select — are base tables revoked for non-editor roles, or columns masked another way? | §13 |
| C14 | `seeds.memory_contact` “encrypted” in DATA_MODEL; brief defers encryption to M9 — confirm plaintext column + RLS only for M2 | §7 vs decision 8 |
| C15 | `devices` / `checkins` / `events` / `audit_log` / `pack_builds` omit `…ts` or `updated_at` inconsistently — intentional? | §7–8 |
| C16 | `num_nonnulls(...)` in `seed_links` check — confirm PostGIS/Postgres version provides it (PG 15+ yes; image is PG 17) | §7, config `major_version = 17` |
| C17 | Geography `ST_Covers(grove.boundary, fragment.location)` — confirm geography overload and SRID 4326 semantics (planar vs spheroidal) are what authors expect for small groves | §4 trigger comment |
| C18 | Pack `credits`: from `revision_contributors` + `contributors.display_credit`, but §12.4 also says credit names not yet `approved` are excluded — seeds have `credit_status`; **revision** credits have no approval flag. Which rule applies to revision credits? | §12.1, §12.4, `seeds.credit_status` |
| C19 | `get_pack_index` granted to `anon` in M2b; M2a RLS says anon executes nothing else — should the empty function stub exist in M2a or wait for M2b? | §12.3, brief M2a vs M2b |
| C20 | Storage policies reference staff roles — storage RLS uses `auth.uid()`; confirm `has_role()` is usable from storage policies the same way as table RLS | §13 |
| C21 | Revocation must delete public objects — M2a only enqueues `purge_asset`; actual delete is M2b. Accept that M2a tests assert **job rows**, not 404s? (Brief M2a tests say enqueue; M2b tests say 404 — aligned, confirm) | brief M2a.7 vs M2b.4 |
| C22 | `publish_status` on groves/fragments/zones vs playability — can a grove be `published` with zero playable revisions? Checklist `NO_ROOT` suggests publish blocked, but data can drift after revocation | §9, §11 |
| C23 | Seed §15 “2 ambience profiles… CC0 test sounds” vs decision 11 “tools/audio-fixtures or tiny generated tones” — use fixtures SHA files inserted into Storage during seed? | §15 vs decision 11 |
| C24 | Brief migration order lists “playability → triggers → RLS → storage → cron”; `set_updated_at` must exist before tables that need triggers — proposed as part of migration 09 **or** a tiny helper in 01. Prefer creating the trigger function early (01 or 02) so each table migration can attach it | decision 2 order vs ergonomics |

### 7.4 Spec typos / small inconsistencies (flag only)

| ID | Issue |
|---|---|
| D1 | TECH_SPEC §8 path `packages/shared/schemas/events.ts` vs actual `packages/shared/src/schemas/events.ts` |
| D2 | AUDIO_SPEC loudness path `packages/shared/audio/loudness.ts` vs package layout under `src/` |
| D3 | `fragment_revisions.requires_outcome_option_id` FK added in §7 after table create in §4 — migration order must match (handled in §2 above) |

---

## 8. M2a implementation sketch (after approval only)

1. Add root `devDependency` `supabase` (ask if version pin differs from current CLI 3.x).
2. Create migrations 01–13 in order; `pnpm exec supabase db reset`.
3. Rewrite `supabase/seed.sql`; reset again.
4. Author pgTAP files; `pnpm exec supabase test db`.
5. Generate `packages/shared/src/db.ts`; ensure root `pnpm lint && pnpm typecheck && pnpm test` green.
6. Amend DATA_MODEL §8/§10/§11 (and brief-required notes) for two-phase publish + `jobs` — **only with architect-approved wording**.
7. Open M2a PR. **Do not** start M2b until M2a merges; then write `docs/briefs/M2b-plan.md` and stop again.

---

## 9. Out of scope (confirm)

- No hosted Supabase project / no keys in repo  
- No changes under `apps/mobile/src/audio/` or `packages/shared/src/audio/`  
- No admin UI, no mobile pack sync, no device participation edge functions  
- No Windows system changes; no phone install  

---

## 10. Blockers / decisions needed from JoJo or architect before M2a coding

1. Resolve or explicitly defer each ambiguity in §7 (especially **B1–B2**, **C1–C4**, **C12–C13**, **C18**, **C19**).  
2. Confirm migration order tweak: create `set_updated_at()` in migration 01 vs 09 (**C24**).  
3. Confirm local Vault + pg_net URL strategy in §5 (hostname).  
4. Confirm import-map approach (§4) for M2b so M2a doesn’t add a conflicting stub.  
5. Name the dedicated owner role for security definer playability functions (**B4**).  

Until those are answered (or explicitly “defer with default X”), M2a should not invent product behavior.
