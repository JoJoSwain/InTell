# Brief: M2, database, rights, playability and packs

**Milestone:** M2 (BUILD_PLAN), delivered as **two PRs**: **M2a** (schema, playability, RLS, seed, DB tests) and then **M2b** (publish pipeline, pack builder, jobs, CI database job)
**Branches:** `m2a-schema` from `origin/master`; then `m2b-packs` from `origin/master` after M2a merges
**Author:** architect (Claude), 2026-11-19
**Read first:** `AGENTS.md`, `docs/DATA_MODEL.md` (all of it), `docs/BUILD_PLAN.md` M2, `docs/TECH_SPEC.md` §5–6 and §10, `docs/PRODUCT_SPEC.md` §2

## Goal
Make Postgres the authoring system and versioned JSON packs the delivery system, exactly as DATA_MODEL describes. When this milestone is done:
- every table, rule and permission exists and is tested
- publishing a revision produces a pack a phone could download
- revoking consent removes the content from the pack and from public storage

## Status of M1 (context)
M1's code is merged, but **ADR 0001 is still Proposed**: the 60-minute device test and the iPhone test are outstanding. This milestone doesn't touch audio and must not wait on it. Don't change anything under `apps/mobile/src/audio/` or `packages/shared/src/audio/`.

## Preconditions (check these first; stop and report if any fails)
1. `docker --version` works and Docker Desktop is running (the Supabase CLI's local stack needs it). **If Docker isn't installed, stop and tell JoJo. Installing it needs admin rights and WSL2, and he'll do it himself.**
2. M1 is merged: `origin/master` contains the M1 merge commit.
3. `git status` is clean apart from this brief.
4. `git switch -c m2a-schema origin/master`, then commit this brief: `docs: add M2 database brief`.

## Decisions already made (don't revisit)
1. **Local only.** Use the Supabase CLI local stack (`supabase start`). **Don't create or link a hosted Supabase project, and don't put any keys in the repo.** The hosted staging project comes later; JoJo creates it.
2. **Supabase CLI as a root devDependency** (`supabase` npm package), run through `pnpm exec supabase …`. Migrations are created with `supabase migration new <name>` (timestamped names), one migration per DATA_MODEL area, in this order: extensions and enums → places → assets and rights → story → ambience → music → participation → ops → playability functions → triggers → RLS → storage → cron.
3. **DATA_MODEL shorthand is expanded in full.** `id uuid pk`, `…ts` and `L10n` all become real SQL. `updated_at` uses one shared trigger function.
4. **PostGIS lives in Supabase's `extensions` schema.** Reference types and functions so they resolve for every role (verify that the search path works for `anon`, `authenticated` and `service_role`).
5. **Security definer functions** set `search_path = ''` (or an explicit schema list) and use fully qualified names. `revoke execute … from public`, then grant only what each function needs. Only `get_pack_index()` is granted to `anon`.
6. **Publishing is two-phase, so storage and the database can't disagree.** (This amends DATA_MODEL §10; update the doc in this milestone.)
   - `fn_publish_check(entity, ids[])`: read-only. Returns `{ok, failures[], asset_shas_to_publish[]}`.
   - The `publish` edge function copies each staged asset to `public-media/a/{sha}.{ext}`. If any copy fails, it stops, and nothing is committed.
   - `fn_publish_commit(entity, ids[])`: in one transaction, re-runs the checks, sets statuses and `is_public`, marks seed links grown, writes the audit log, and **enqueues** pack rebuilds.
7. **Side effects go through an outbox, not HTTP inside triggers.** (This amends DATA_MODEL §8 and §10.)
   - Add a table `jobs (id, kind text check in ('rebuild_pack','purge_asset'), payload jsonb, status text default 'queued', attempts int default 0, last_error text, run_after timestamptz default now(), created_at, updated_at)`.
   - Triggers and functions only **insert jobs**.
   - pg_cron runs every minute and calls the `run-jobs` edge function through `pg_net`. That function processes queued jobs idempotently, with retries and backoff (max 5 attempts).
   - Locally, the edge function URL and service key come from Vault secrets or config set by the seed. They're never hard-coded in a migration.
8. **`seeds.memory_contact` encryption is deferred to M9.** Create the column now, readable only by editor and admin. Mark it with a `-- TODO(M9): encrypt via Vault` comment and add a test that `viewer`, `writer` and `anon` can't read it.
9. **One source of truth for pack schemas.** The zod `GrovePack` and `RegionPack` schemas live in `packages/shared/src/schemas/packs.ts`. The Deno edge functions must use the same definitions, not a copy. Investigate how Supabase Edge Functions can import from the monorepo (import maps or a relative import), and propose the approach in the plan.
10. **Tests:**
    - **Database:** pgTAP through `supabase test db`, covering constraints, triggers, playability, RLS (by switching role and setting JWT claims) and the publish checklist
    - **Edge functions:** Vitest integration tests against the local stack (in M2b)
11. **Seed:** only DATA_MODEL §15's demo content, plus the three real sites in `draft` with **clearly marked placeholder coordinates**. Test audio comes from `tools/audio-fixtures` output or tiny generated tones, never real recordings.

## Out of scope
- Admin UI (M3–M4), mobile pack download and sync (M5), the device and participation edge functions (`register-device`, `plant-seed`, `vote` and so on, in M5 and M9–M11)
- A hosted Supabase project, production keys, or a deployed environment
- Anything under audio

## Hard constraints most at risk here
- **Protected coordinates and marker codes must never reach a pack, a public view, logs or an anon-callable function.** Test this directly.
- `anon` has **no** table grants. The only things it can reach: `get_pack_index`, public storage, and later the edge functions.
- **Rights gate playability.** A revoked consent or right, or an expired site approval, makes content unplayable, removes it from packs and deletes the public object.
- **PII columns** (`contributors.legal_name/contact_*`, `consents.document_path`, `seeds.memory_contact`) are readable only by editor and admin.
- Packs never include seed text or voice, vote counts before a crossroads is decided, or credit names that aren't approved.

---

## M2a: schema, playability, RLS, seed and database tests (PR 1)
1. **Migrations** for DATA_MODEL §1–9 and §13, plus the `jobs` table (decision 7), with every constraint and trigger described there:
   - tier/parent rules
   - point-in-polygon on fragments
   - `protected` requires `marker_code`
   - equal stem duration and loop points (enforced at publish, not by trigger)
   - the `updated_at` trigger
2. **Playability functions** (§9) and `fn_publish_check` / `fn_publish_commit` (§11 checklist codes, decision 6).
3. **Triggers that enqueue jobs:** a consent, right or approval leaving `active`; a revision or cue publishing; and scheduled `publish_at` (pg_cron every 5 minutes enqueues rebuilds). Plus the daily expiry job and the retention purges in §10.
4. **RLS on every table**, with the `has_role()` helper and the role matrix in §13; the column-privacy view(s); storage buckets and policies.
5. **Seed** per §15 and decision 11.
6. **Generated types** in `packages/shared/src/db.ts` (`supabase gen types typescript --local`).
7. **pgTAP tests**, at least:
   - every checklist code fires on a crafted bad case
   - tier/parent and point-in-polygon rejections
   - `fn_revision_is_playable` false for each rights failure mode (consent revoked, expired, missing `app` channel; asset right revoked; site approval expired; outcome not decided)
   - `fn_current_revision` picks the highest playable revision and falls back when the newest is revoked
   - revocation enqueues `rebuild_pack` and `purge_asset` jobs
   - RLS: `anon` can't select any table; the role matrix holds (viewer reads but can't write; writer can't publish or set `grown`; sound can't edit groves; editor can't manage staff); PII columns are hidden from viewer and writer
   - protected coordinates aren't returned by any function `anon` can call

**M2a acceptance:**
- [ ] `pnpm exec supabase db reset` applies every migration and the seed cleanly
- [ ] `pnpm exec supabase test db` is all green
- [ ] Types are generated and committed; `pnpm lint && pnpm typecheck && pnpm test` green
- [ ] DATA_MODEL updated for the decision 6 and 7 amendments (two-phase publish, jobs outbox)

## M2b: publish pipeline, pack builder, jobs, CI database job (PR 2)
1. **zod `GrovePack` and `RegionPack`** in `packages/shared/src/schemas/packs.ts` exactly per §12, with unit tests including a "forbidden fields" test: the schema rejects any `lat`/`lng` on a protected fragment, any `markerCode`, and unapproved credits.
2. **Edge functions:**
   - `publish`: check → copy → commit
   - `unpublish`
   - `build-pack`: deterministic output; the manifest is written to `public-media/packs/{scope}/{id}/{version}.json`, with a `pack_builds` row and the sha256
   - `purge-assets`
   - `run-jobs`: the outbox worker
3. **`get_pack_index()`** RPC, granted to `anon`.
4. **Vitest integration tests** against the local stack:
   - publishing the demo revision produces a pack that validates against zod and whose asset URLs resolve
   - revoking the demo consent → after `run-jobs`, the pack no longer contains that revision and the asset URL returns 404
   - deciding the demo crossroads → the dependent revision appears in the next pack
   - a scheduled `publish_at` in the past → included after the cron/job run
   - building the same inputs twice gives a byte-identical manifest
5. **CI:** add a `db` job to `.github/workflows/ci.yml` (ubuntu, Docker available) that runs `supabase start`, `supabase db reset`, `supabase test db` and the Vitest integration suite. Keep the existing `check` job unchanged.

**M2b acceptance** (BUILD_PLAN M2):
- [ ] RLS tests pass (TECH_SPEC §10)
- [ ] The demo grove pack validates against zod and contains no forbidden fields (DATA_MODEL §12.4)
- [ ] Revoking the demo consent rebuilds the pack without that revision, and the asset returns 404
- [ ] Deciding the demo crossroads makes the dependent revision playable and present in the pack
- [ ] The CI `db` job is green; `pnpm lint && pnpm typecheck && pnpm test` green

## Plan checkpoint (before M2a)
Write `docs/briefs/M2-database-plan.md` and **stop for architect review**. Include:
- the precondition results
- the migration file list and the order of application
- how PostGIS is referenced across schemas (decision 4)
- how the edge functions will import the shared zod schemas (decision 9), with the option you chose and its trade-offs
- how `run-jobs` gets its URL and key locally (decision 7)
- the test approach and a list of the pgTAP test files
- every DATA_MODEL ambiguity or contradiction you find (there will be some; list them, don't resolve them silently)

Write a second short plan before M2b (`docs/briefs/M2b-plan.md`) and stop again.

## Report back with (each PR)
1. `git log --oneline` for the branch; the output of `supabase db reset`, `supabase test db` and the root checks
2. Any amendments made to DATA_MODEL, quoted
3. Deviations from this brief, and why
4. Open questions
