# M2b report — packs, edge functions, jobs, CI

**Branch:** `m2b-packs`  
**Status:** acceptance green; **no PR** (awaiting JoJo review of this report)  
**Review:** `docs/briefs/M2b-plan-review.md` (wins on conflicts)

## Commands

| Command | Result |
|---|---|
| `pnpm db:setup-local` | PASS (reset + Vault + seed-media upload + edge sync) |
| `pnpm exec supabase test db` | PASS — **20 files / 82 tests** |
| `pnpm test:integration` | PASS — **9/9** (with `supabase functions serve --no-verify-jwt`) |
| `pnpm lint && pnpm typecheck && pnpm test` | PASS |

## Import-map checks (review §10 #4 / plan §2)

| Check | Result |
|---|---|
| **(a) CLI 3.2 preference** | Docs for CLI 3.x / Deno 2 recommend **per-function `deno.json`** (not legacy `import_map.json`). Shipped that. |
| **(b) Outside-`functions/` resolve** | **Failed** under `supabase functions serve` (Docker edge runtime only mounts `supabase/functions`). |
| **Shipped** | **Option C**: `tools/sync-edge-shared.mjs` copies Deno-safe modules into `supabase/functions/_shared/from-shared/`; `pnpm db:check-edge-shared` fails on drift (wired in CI `db` job). |

Verified on **Windows** (this machine). CI runs the same check + serve path.

## `RUN_JOBS_URL`

| Env | Value |
|---|---|
| Local (Windows Docker Desktop) | `http://host.docker.internal:54321/functions/v1/run-jobs` (Vault via `pnpm db:setup-local`) |
| CI | Same default; override with `RUN_JOBS_URL` env on `db:setup-local` if needed (e.g. Kong). Integration tests call `run-jobs` **directly** with the service key (review #10). |

## Functions serve discovery (review #9)

`supabase start` alone does **not** serve `supabase/functions/*` on CLI 3.2.0 here. CI and local integration use a parallel `pnpm exec supabase functions serve --no-verify-jwt`.

## Integration cases

1. **Publish / build demo grove** → `GrovePack` validates; asset URLs resolve; frag9 has no coords / no `markerCode`.
2. **Revoke Demo Storyteller consent (R5)** → frag4 revision gone; frag4 asset public URL 400/404; **R2:** every stored grove manifest free of frag4 id / transcript.
3. **Decide crossroads** → frag10 rev2 present.
4. **`publish_at`** → future excluded; past included after rebuild.
5. **No-op rebuild (R4)** → `content_sha256` equal; version unchanged.
6. **Auth** → writer publish 403; editor not 403.
7. **Region pack** → validates; `landcover: null`; assets in keep-set path.

### Consecutive demo grove `content_sha256`

Both consecutive builds reported the same content hash (second was noop, no version bump):

`288e43fa1f3bac6e810754c6cd451d777fcae3dc48aafd65605831b5d197b816`

## DATA_MODEL amendments (quoted)

- **§8 `pack_builds`:** added `content_sha256 text` (canonical JSON sans `packVersion`/`builtAt`; equal ⇒ rebuild no-op).
- **§10:** reconciler (R1); unpublish via `fn_unpublish_commit`; job ordering (all `rebuild_pack` before `purge_asset`); rebuild enqueues deduped purge; no-op rebuild; public-media keep-set rule.
- **§12.1:** deterministic `builtAt` (input watermark); canonical JSON rules.
- **§12.3:** index listing — published groves with builds (incl. empty-playable); regions when a build exists.
- **§12.4:** superseded manifests deleted after new version indexed; cache headers (`a/*` max-age=3600; manifests max-age=60).

## New migrations (M2a untouched)

- `20261120060845_m2b_pack_index_unpublish.sql` — `get_pack_index`, `fn_unpublish_commit`, `fn_enqueue_purge_reconcile`, `fn_pack_geog_geojson`, `fn_is_editor_or_admin`
- `20261120060846_m2b_pack_builds_content_sha.sql` — `pack_builds.content_sha256`

## Seed (R5)

Second contributor **Demo Storyteller** + consent attached only to frag4 revision 1 / its narration right.

## Deviations

- Option **C** instead of A (Docker mount limitation).
- `functions serve` required alongside `supabase start` (documented above).
- Pack builder copies staging→public for pack asset shas on non-noop rebuild so already-published seed content gets public objects without a separate publish call.

## Open questions

1. Confirm CI `RUN_JOBS_URL` once the `db` job runs on GitHub (host.docker.internal vs Kong).
2. Whether `fn_is_editor_or_admin` should stay long-term or admin M3 should call `has_role` with a typed RPC client.
