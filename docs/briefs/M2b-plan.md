# M2b plan — packs, edge functions, jobs, CI

**Branch:** `m2b-packs` from `origin/master` (M2a merge `0e78938`)  
**Brief:** `docs/briefs/M2-database.md` § M2b  
**Wins on conflicts:** brief → review (`M2-database-plan-review.md`) → this plan; do not invent product behavior  
**Stop after this plan** for architect review. Do not implement until approved.

## 0. Preconditions

| Check | Result |
|---|---|
| M2a merged to `master` | Yes — PR #3 / `0e78938` |
| Branch | `m2b-packs` from `origin/master` |
| Working tree for plan | Clean aside from this plan file |
| Supabase CLI | `3.2.0` (root `package.json`) |
| Docker | Assumed available (same as M2a); CI `db` job uses ubuntu + Docker |
| Audio / ADR 0001 | Untouched (hard out of scope) |

M2a already shipped: migrations through cron, `jobs` outbox, `fn_publish_check` / `fn_publish_commit`, enqueue triggers, Vault wrapper `fn_call_run_jobs`, `pnpm db:setup-local`, Farmington seed + pgTAP. **Missing for M2b:** `supabase/functions/*`, zod packs, `get_pack_index`, staging upload script, Vitest integration, CI `db` job.

---

## 1. Scope (from brief M2b)

### 1.1 Pack schemas (`packages/shared/src/schemas/packs.ts`)

Single source of truth per decision 9 / DATA_MODEL §12 / ADR 0003:

- **`GrovePack` / `RegionPack`** zod schemas matching §12.1–12.2 exactly.
- Fragment shape (ADR 0003): `requires: string[][]` (AND of OR groups, ordered), `isEnding: boolean`; **no `parentId`**.
- Protected fragments: omit `lat`/`lng`/`radiusM`; include `markerHash` only (sha256 of code), never `markerCode`.
- Unit tests in `packages/shared`, including a **forbidden-fields** suite that rejects: `lat`/`lng` on protected fragments, any `markerCode`, unapproved seed credits in ledger shapes, seed text/voice, pre-decision vote counts.
- Keep the file Deno-safe (no Node builtins) so edge can import it.

Also add (or place next to packs) the **cue `conditions` / `state_gains` zod** used by the `publish` edge function before `fn_publish_check` (review **C4**). Report failures with code `CONDITION_SCHEMA`. No plv8; no duplicate JSON Schema in SQL.

Ledger builders follow review **B6**: distinct approved `credit_name`s ordered by earliest `planted_at`; `anonymousCount` = grown seeds without approved credit.

### 1.2 Edge functions (`supabase/functions/`)

| Function | Caller | Behavior |
|---|---|---|
| `publish` | Staff (editor+) | zod condition check → `fn_publish_check` → copy each `asset_shas_to_publish` from `staging-audio` → `public-media/a/{sha}.{ext}` → on any copy failure **stop with no commit** → `fn_publish_commit` (enqueues rebuild) |
| `unpublish` | Staff (editor+) | Per DATA_MODEL §10 unpublish path; enqueue rebuild/purge as specified |
| `build-pack` | Internal (`run-jobs` / service) | Deterministic grove/region JSON → `public-media/packs/{scope}/{id}/{version}.json`; insert `pack_builds` with sha256 + bytes; bump `pack_version`. Empty-playable packs still valid (**C22**); retired fragments stay in pack with `retired: true` (**C1**) |
| `purge-assets` | Internal | Delete public objects for shas no longer playable / job payload |
| `run-jobs` | pg_cron via `fn_call_run_jobs` + pg_net | Claim queued `jobs` (idempotent), process `rebuild_pack` → call `build-pack`, `purge_asset` → call `purge-assets`; retries/backoff, max 5 attempts; mark `last_error` |

Auth: service role for internal workers; staff JWT + `has_role` for publish/unpublish (exact claim wiring listed as ambiguity if unclear from TECH_SPEC). Never log protected coordinates, marker codes, or full secrets.

### 1.3 `get_pack_index()`

- Security definer RPC; **grant execute to `anon` only for this function** among public RPCs (C19: update M2a “anon executes nothing” test to “exactly one”).
- Return shape §12.3: `[{scope, id, version, manifestPath, manifestSha256, bytesTotal, name, bbox}]`.
- Per review **B5**: latest `pack_builds` per `(scope, scope_id)`; grove `name` = `groves.name` (L10n jsonb); region `name` = `{"en": regions.name}`; `bbox` = `[minLng,minLat,maxLng,maxLat]` from `ST_Envelope` of boundary/bounds; **only published groves** listed (confirm region listing — see ambiguities).

### 1.4 `run-jobs` local / CI wiring (decision 7 + review §10 #3)

Already in M2a:

- Cron every 1 min → `fn_call_run_jobs()` reads Vault `run_jobs_url` / `run_jobs_service_key`.
- `pnpm db:setup-local` writes those secrets from `supabase status -o env`.
- Default URL: `http://host.docker.internal:54321/functions/v1/run-jobs`.

**M2b must verify** pg_net can reach the function:

1. Local Windows Docker Desktop: confirm `host.docker.internal` works with `functions serve` (or started stack).
2. CI Linux: if host DNS fails, set `RUN_JOBS_URL` to the in-network Kong/functions URL when calling `db:setup-local` (Vault keeps migrations secret-free).
3. Integration tests may also invoke `run-jobs` directly with the service key to avoid waiting on cron.

### 1.5 Seed media upload (C23)

Add `pnpm` script (e.g. `db:seed-media-upload`) that uploads deterministic tones from `tools/audio-fixtures` / `seed-media.json` into local `staging-audio` (and any already-public shas needed for the demo after a first publish). Required before publish/copy integration tests. M2a did not upload files.

### 1.6 Vitest integration tests (local stack)

Proposed location: `packages/shared` **or** a small `tools/pack-integration` / `supabase/tests-js` package — pick the one that can import zod packs and call the local HTTP API without pulling Expo. Prefer a dedicated package under `tools/` if shared would need Node-only test helpers.

Cases (brief):

1. Publish demo revision → pack validates against `GrovePack`; asset URLs resolve (200).
2. Revoke demo consent → after `run-jobs`, pack omits that revision; public asset URL → **404**.
3. Decide demo crossroads → dependent revision appears in next pack.
4. Past `publish_at` → included after cron/job run.
5. Same inputs twice → **byte-identical** manifest (stable key order, fixed `builtAt` source or strip for compare — see ambiguities).

Also assert: no forbidden fields in produced pack; frag9 never has coordinates; `get_pack_index` returns the demo grove for `anon`.

### 1.7 CI `db` job

Extend `.github/workflows/ci.yml` with a **`db` job** (ubuntu; Docker available). Keep existing `check` job unchanged.

Proposed steps:

1. checkout, pnpm install (same Node 22 / frozen lockfile as `check`)
2. `pnpm exec supabase start`
3. `pnpm db:setup-local` (or equivalent: reset + Vault; set CI `RUN_JOBS_URL` if needed)
4. upload seed media
5. ensure edge functions are served (stack default or `functions serve` as required by CLI 3.2)
6. `pnpm exec supabase test db`
7. Vitest integration suite
8. Optionally assert import-map / shared schema sync check (see §2)

---

## 2. Import-map checks (review §10 #4)

**Approved approach: Option A**, with two mandatory M2b checks:

| Check | Action |
|---|---|
| **(a) CLI 3.2 preference** | Read Supabase CLI **3.2.0** docs for Deno 2 (`config.toml` already has `deno_version = 2`). Prefer whatever the pinned CLI documents: root `import_map.json` **or** per-function `deno.json` / `deno.jsonc`. Map `@intell/shared/` → monorepo `packages/shared/src/` and `zod` → `npm:zod@` matching workspace `^3.24.2` (pin exact resolved version in the map). |
| **(b) Outside-`functions/` resolve** | Prove `supabase functions serve` (or deploy bundler) can import `../../packages/shared/src/schemas/packs.ts`. Smoke: a tiny function or unit serve that imports `GrovePack` and returns ok. |

**Fallback if (b) fails:** Option **C** — copy/bundle into `supabase/functions/_shared/` **plus** a CI check that fails when the copy differs from `packages/shared` source. **Do not use Option B alone.**

Constraints: pack schemas stay free of Node/Expo APIs; edge code uses `@intell/shared/...` only through the chosen map.

---

## 3. Implementation sketch (after approval)

1. `packages/shared` zod packs + conditions + unit tests (forbidden fields).
2. Import map / `deno.json` per §2; scaffold five edge functions + shared Deno helpers (Supabase client, storage copy, job claim).
3. SQL migration(s): `get_pack_index()` + grants; update RLS/anon execute pgTAP (C19).
4. `db:seed-media-upload` + wire into `db:setup-local` or CI.
5. Verify Vault → `run-jobs` reachability; fix CI URL if needed.
6. Vitest integration suite against local stack.
7. CI `db` job.
8. Docs touch only if behavior needs a DATA_MODEL/TECH note (e.g. index region listing); otherwise no drive-by doc edits.
9. Green: `supabase test db`, integration Vitest, root `pnpm lint && pnpm typecheck && pnpm test`.

**Out of scope:** admin UI, mobile sync, device endpoints (`register-device`, `plant-seed`, `vote`, …), hosted Supabase, audio engine, M2a schema redesign.

---

## 4. Ambiguities (list only — do not resolve silently)

1. **`get_pack_index` and regions:** B5 says “only published groves are listed.” §12.3 return shape includes `scope`. Are published **region** packs listed, omitted until a later milestone, or listed only when `pack_builds` exists?
2. **Byte-identical manifests:** `builtAt` is in the GrovePack shape. For determinism tests, should `builtAt` be fixed from job/input time, omitted from the equality check, or normalized before sha?
3. **JSON serialization stability:** key order, GeoJSON coordinate precision, and number formatting for sha256 — any mandated canonicalization, or “stable `JSON.stringify` of a sorted-key deep build”?
4. **`unpublish` semantics:** DATA_MODEL §10 describes two-phase publish; exact status transitions and purge set for `unpublish` need confirmation if not fully spelled out for every entity type (revision vs grove vs cue).
5. **Who may call `build-pack` / `purge-assets`?** Service role only, or also staff for manual rebuild? Brief says internal via jobs.
6. **`publish` auth surface:** staff session via gateway JWT vs service role from admin server actions (TECH_SPEC §5 says Admin caller) — which local test identity?
7. **Conditions zod location:** new `packages/shared/src/schemas/conditions.ts` vs colocated in `packs.ts` / music schemas — not named in §12; C4 requires zod in the publish edge path.
8. **Integration test package home:** under `packages/shared` vs `tools/pack-integration` vs `supabase/functions` Vitest — brief only says “Vitest against the local stack.”
9. **CI functions runtime:** does `supabase start` on CLI 3.2.0 serve functions automatically for pg_net, or must CI run `functions serve` in parallel?
10. **`RUN_JOBS_URL` on GitHub Actions:** confirm working in-network URL (`http://kong:8000/...` vs `http://127.0.0.1:54321/...` vs `host.docker.internal`) before locking CI.
11. **Demo crossroads / consent fixtures:** confirm seed already has a revocable consent, a decidable crossroads, and a dependent revision suitable for the four integration cases without extra seed surgery (M2a Farmington seed — verify coverage).
12. **Region pack builder in M2b:** brief acceptance focuses on the **demo grove** pack. Build region-pack code paths fully now, or grove-first with a minimal region pack smoke?
13. **Empty pack after total revocation:** C22 allows valid empty-playable packs; does `get_pack_index` still list that grove (published with zero playable revisions)?
14. **Option A vs C timeline:** if (b) fails only on Windows but passes on Linux CI (or the reverse), which environment is decisive for choosing C?

---

## 5. Acceptance mapping

| Brief / BUILD_PLAN criterion | Plan coverage |
|---|---|
| RLS tests pass | Existing M2a pgTAP + C19 anon/`get_pack_index` update |
| Demo grove pack validates; no forbidden fields | zod unit + publish integration |
| Revoke consent → pack without revision; asset 404 | Integration + `run-jobs` / purge |
| Decide crossroads → dependent revision in pack | Integration |
| CI `db` job green; root lint/typecheck/test | §1.7 + shared unit tests |

---

## 6. Report back after implementation (not this checkpoint)

Per brief: branch log; `db reset` / `test db` / root checks; DATA_MODEL amendments quoted; deviations; open questions; import-map check (a)/(b) results and whether A or C shipped.
