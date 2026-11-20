# M2a report — schema, playability, RLS, seed, pgTAP

**Branch:** `m2a-schema`  
**Tip:** `fc4856e`  
**Status:** acceptance criteria green; **no PR opened**; M2b not started  
**Date:** 2026-11-20

---

## 1. `git log --oneline` (branch vs `origin/master`)

```
fc4856e feat(db): M2a schema, playability, RLS, seed, and pgTAP
2b7a653 docs: add M2 plan review
de1aa69 docs: add M2 database brief and plan checkpoint
```

Pushed to `origin/m2a-schema`.

---

## 2. Commands and results

| Command | Result |
|---|---|
| `pnpm exec supabase db reset` | **PASS** — all 13 migrations + `seed.sql` applied |
| `pnpm exec supabase test db` | **PASS** — Files=17, Tests=63 |
| `pnpm lint && pnpm typecheck && pnpm test` | **PASS** — turbo green; shared Vitest 30/30 |

Pinned Supabase CLI: **`supabase@3.2.0`** (exact, root `devDependency`).

---

## 3. DATA_MODEL / TECH / BUILD amendments (quoted)

- **§2 regions:** `pack_version int not null default 0`
- **§5:** added `ui_cues` (`key in ('hush_listen')`, `unique nulls not distinct (region_id, key, language)`)
- **§6:** `check (num_nonnulls(music_zone_id, grove_id) = 1)`
- **§8:** added `jobs` outbox; region pack bumps `regions.pack_version`
- **§9:** security definer functions owned by `postgres` with `search_path = ''`; `expires_on is null` never expires
- **§10:** two-phase publish (check → storage copy in edge → commit); triggers **enqueue** `rebuild_pack` / `purge_asset`; crossroads close enqueues rebuild; published grove may later have zero playable revisions
- **§11:** `fn_publish_check` returns `{ok, failures:[{code,severity,message,entity_id}], asset_shas_to_publish[]}`; `RADIUS_OVERLAP` / `LOUDNESS` are warnings
- **§12.4:** seed ledger credits need `credit_status='approved'`; revision credits use `display_credit` gated by active consent
- **TECH_SPEC §5:** publish/unpublish point at DATA_MODEL §10; D1 path fix
- **BUILD_PLAN M2:** “Delivered as M2a and M2b; see docs/briefs/M2-database.md.”
- **AUDIO_SPEC:** D2 path → `packages/shared/src/audio/loudness.ts`

---

## 4. Review extras

### `anon` `has_table_privilege(..., 'SELECT')` (all false)

All 42 `public` tables returned `anon_select = f` (see `060_rls_anon.test.sql`). Sample:

```
ambience_layers f | audio_assets f | fragments f | groves f | jobs f | seeds f | staff f | ui_cues f | …
```

### Demo Park constants (B8 still placeholder)

```sql
-- TODO(JoJo): placeholder coordinates — replace with a walkable public site
c_park_lon      constant double precision := -111.9000;
c_park_lat      constant double precision := 40.9000;
c_park_half_deg constant double precision := 0.0015; -- ~300 m square
```

### B7 still placeholders

Sites: `ogden-nature-center`, `todo-site-2`, `todo-site-3` — name `"TODO: placeholder"`, draft, TODO coordinates comment.

---

## 5. Deviations from brief/plan

1. **R1 `supabase_admin` default privileges:** local migrations cannot `alter default privileges for role supabase_admin` (SQLSTATE 42501). Revoked defaults for `postgres` only; migration 11 still `revoke all … from anon` on existing objects. Noted in migration 01 comment.
2. **`get_pack_index`:** deferred to M2b (review C19); `anon` executes no functions.
3. **Vault secrets:** not in `seed.sql`; use `pnpm db:setup-local` (review §10.3). `100_vault_run_jobs_missing` asserts clean failure when secrets absent.
4. **Seed tones:** regenerable under `tools/audio-fixtures/seed-tones/` (gitignored); metadata committed as `supabase/seed-media.json`. Storage upload deferred to M2b (C23).

---

## 6. Open questions for JoJo

1. Replace B7 site names/coords and B8 Demo Park with the real walkable site (store also has Farmington Bird Refuge notes — not wired, per assignment placeholders).
2. Confirm `host.docker.internal:54321` reachability for `run-jobs` in M2b (CI may use Kong).
3. Ready for JoJo review of this report before opening a PR / starting M2b.
