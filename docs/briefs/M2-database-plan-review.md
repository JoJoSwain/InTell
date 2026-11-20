# M2 database: architect review of the plan

**Plan reviewed:** `docs/briefs/M2-database-plan.md`
**Verdict:** **APPROVED with the changes below.** Start M2a. Where this review conflicts with the plan or the brief, this review wins.
**Reviewer:** architect (Claude), 2026-11-19

The plan is strong. The preconditions are evidenced, the migration order is sound, and the ambiguity list in §7 is exactly what was asked for. The changes below close three security gaps the plan doesn't mention, and the answers settle every item in §7 and §10.

---

## Required changes

### R1. Supabase's default grants: revoke them explicitly
By default, Supabase grants `anon` and `authenticated` full privileges on every table, function and sequence created in `public` (through default privileges). RLS alone is not "no grants".
- In migration 01, `alter default privileges in schema public revoke all on tables, functions, sequences from anon, authenticated, public;` (for the roles that create objects in migrations: `postgres` and `supabase_admin` where permitted).
- In migration 11 (`rls`), also `revoke all on all tables in schema public from anon` and `revoke execute on all functions in schema public from anon, public`. Then grant `authenticated` only the table privileges its policies need.
- `060_rls_anon.test.sql` checks **privileges** (`has_table_privilege`, `has_function_privilege` for `anon` on every object in `public`), not just that `select` returns zero rows.

### R2. Signed-in users who aren't staff can see nothing
Anyone can create an auth user if signups are on, so `authenticated` doesn't mean staff.
- `has_role()` is true only when `staff.user_id = auth.uid()`, `staff.active = true` and the role is in the list. A deactivated staff member loses access immediately.
- Add a test: an `authenticated` JWT with no `staff` row (and one with `active = false`) can't read or write any table, view or bucket.
- Set `[auth] enable_signup = false` in `supabase/config.toml` for the local stack. Staff are created by an admin.

### R3. No coordinates or marker codes in logs or job payloads
The hard constraint covers logs, and two new places can leak:
- `audit_log.detail` for fragment changes never includes `location` or `marker_code`. Log the ids and the names of the fields that changed, not their values.
- `jobs.payload` carries ids only (`{grove_id}`, `{asset_sha}`), never coordinates or codes.
- Extend `070_protected_coords_anon.test.sql`: after creating, editing and publishing a protected fragment, no `audit_log` or `jobs` row contains its coordinates or its `marker_code` (search the `jsonb` as text).

### R4. Pin the Supabase CLI
Add `supabase` as a root devDependency pinned to an **exact** version (`3.2.0` or whatever is current when you install it, with no `^`), and record it in the PR report. This is approved now; no need to ask again.

---

## Answers to §7 (ambiguities)

### 7.1 Doc amendments (A1–A5)
Amend these docs in M2a. Draft the wording yourself; I'll review it in the PR, not before.
- **DATA_MODEL §8:** add the `jobs` table (brief decision 7) and `regions.pack_version` (B1). Add `ui_cues` (B2) under §5.
- **DATA_MODEL §9:** add the owner role (B4) and the null-expiry rule (C9).
- **DATA_MODEL §10:** replace the `fn_publish` row with the two-phase flow (check → copy → commit). Every "rebuild / purge / pg_net" effect becomes "enqueue a `rebuild_pack` / `purge_asset` job; `run-jobs` processes it". The crossroads row gains "closing also enqueues a rebuild" (C7).
- **DATA_MODEL §11:** rename to `fn_publish_check`, with the new return shape (C3).
- **TECH_SPEC §5:** point to DATA_MODEL §10 instead of describing `fn_publish`.
- **BUILD_PLAN M2:** add one line: "Delivered as M2a and M2b; see docs/briefs/M2-database.md."
- Fix D1 and D2 (path typos) while you're in those files.

### 7.2 Missing schema (B1–B8)

| # | Decision |
|---|---|
| B1 | Add `regions.pack_version int not null default 0`. A region pack rebuild bumps it |
| B2 | Add `ui_cues (id uuid pk, region_id uuid references regions(id) /* null = global */, key text not null check (key in ('hush_listen')), language lang not null, asset_id uuid not null references audio_assets(id), status publish_status not null default 'draft', …ts, unique nulls not distinct (region_id, key, language))`, in the `ambience` migration. New keys mean a migration that extends the check, which is deliberate. It's included in packs only when published and its asset is playable. Seed one test-tone `hush_listen` cue (en) |
| B3 | Yes. See A1 above |
| B4 | **No dedicated role.** Security definer functions are owned by `postgres` (the migration owner, which owns the tables), with `search_path = ''` and the revoke/grant rules from decision 5. A separate role would need `BYPASSRLS`, which we can't reliably grant on Supabase. Amend §9 to say so |
| B5 | `get_pack_index()` (M2b) returns the **latest** `pack_builds` row per `(scope, scope_id)`. `name` is `L10n` `jsonb`: groves use `groves.name`, and regions wrap their text name as `{"en": name}`. `bbox` is `[minLng, minLat, maxLng, maxLat]` from `ST_Envelope` of `groves.boundary` / `regions.bounds` (geometry cast). Only published groves are listed |
| B6 | (M2b) `growers` holds the **distinct** `credit_name`s of seeds in that ring with `status = 'grown'` **and** `credit_status = 'approved'`, ordered by earliest `planted_at`, with no cap. `anonymousCount` counts grown seeds in the ring without an approved credit name |
| B7 | **Waiting on JoJo (the three real site names).** If there's no answer when you reach the seed, use `ogden-nature-center` plus `todo-site-2` and `todo-site-3`, all `draft`, with name text "TODO: placeholder" and a `-- TODO(JoJo): placeholder coordinates` comment |
| B8 | **Waiting on JoJo (the Demo Park location).** It should be a public place he can walk for field tests. Until he answers, use a fictional small polygon (about 300 m × 300 m) in a clearly marked spot, with the same TODO comment. Build every fragment and zone coordinate from one constants block at the top of `seed.sql`, so moving the park means editing one place. **The GPX is in M2a:** generate `apps/mobile/e2e/demo-route.gpx` from the same coordinates (a small script under `tools/` is fine), passing every marked and unmarked fragment (not the protected one) and crossing the ambience-zone and music-zone edges |

### 7.3 Rules (C1–C24)

| # | Decision |
|---|---|
| C1 | `retired` fragments **stay playable** (Journal replay). They're in the pack with `retired: true`, and the device doesn't trigger them on the map (that's M6). `in_review` and `approved` fragments aren't playable: only `published` and `retired` are |
| C2 | "Published" means fragment `status in ('published','retired')`, or the fragment is in the same publish batch. It does **not** require a playable revision |
| C3 | Warnings don't fail the check. The return shape is `{ok, failures: [{code, severity: 'error'|'warning', message, entity_id}]}`, and `ok` is true when there are no `error` entries. `RADIUS_OVERLAP` and `LOUDNESS` are warnings; everything else is an error |
| C4 | Postgres doesn't run zod. In M2a, `fn_publish_check` makes structural checks only (`conditions` is a `jsonb` object, `state_gains` is a `jsonb` array) and reports `CONDITION_SCHEMA` on failure. In M2b, the `publish` edge function validates with zod **before** calling `fn_publish_check`, and reports failures with the same code. No plv8, and no duplicate JSON Schema |
| C5 | Confirmed: `STEM_MISMATCH` in the checklist only, with no constraint or trigger |
| C6 | **Exactly one.** Change the check to `num_nonnulls(music_zone_id, grove_id) = 1`. In the pack, a cue has either `zone` or `useGroveBoundary: true`, never both. Amend §6 |
| C7 | Closing enqueues a rebuild too: the pack carries the crossroads `status`, so devices stop offering the vote. Deciding enqueues another |
| C8 | The pg_cron job runs **hourly**. It processes each region whose local time (`regions.timezone`) is in the 02:00 hour. That's correct for any number of time zones and handles daylight saving time |
| C9 | `expires_on is null` means it never expires. An item expires when `expires_on < current_date` in the **region's** time zone, so the expiry job and playability agree |
| C10 | `contributor_id` and `consent_id` are required only for `consent_form`. See C11 for the other checks |
| C11 | **Database check constraints:** `license = 'consent_form'` ⇒ `consent_id is not null`; `license = 'cc_by'` ⇒ `attribution is not null`; `license = 'community_sound_grant'` ⇒ `seed_id is not null`. Test each one |
| C12 | **Conservative:** protected fragments' `location` and `marker_code` are visible to **editor and admin only**. Viewer, writer, sound and moderator see the protected fragment's row with `location` and `marker_code` returned as null. Marked and unmarked coordinates are visible to every staff role. (JoJo can loosen this later; tightening after the fact is harder) |
| C13 | **Approach:** base tables that hold PII or protected data (`contributors`, `consents`, `seeds`, `fragments`) get RLS `select` for **editor and admin only**. Other staff roles read through `security definer` views with `security_barrier = true`, owned by `postgres`, each with an explicit `where has_role(...)` filter, that null or omit the private columns: `contributors_staff`, `consents_staff`, `seeds_staff`, `fragments_staff`. Revoke the views from `anon`. Writes still go to the base tables under their own RLS policies (column-level grants can't tell staff roles apart, because every staff member is `authenticated`). Expect the Supabase linter to flag these views; note in a migration comment that this is intentional |
| C14 | Confirmed: a plaintext column, visible to editor and admin only, with the `TODO(M9)` comment and the test from decision 8 |
| C15 | **Intentional.** Append-only or rarely updated tables (`devices`, `checkins`, `events`, `audit_log`, `pack_builds`, `crossroads_votes`, `seed_terms`, `landcover_*`, junction tables) keep the columns DATA_MODEL gives them, with no `…ts`. `jobs` gets `…ts` (decision 7) |
| C16 | Fine. Postgres 17 has `num_nonnulls` |
| C17 | Confirmed: `geography` `ST_Covers` (spheroidal) is what we want. Test a point about 1 m outside a boundary edge and a point exactly on a vertex |
| C18 | The `approved` rule in §12.4 applies to **seed** credit names (the ledger). Revision credits use `contributors.display_credit`, which the contributor chose in their consent, so the active consent is the approval. Amend §12.4 to say so |
| C19 | Wait for M2b. In M2a, `anon` can execute **no** function. M2b adds `get_pack_index` and updates the test to "exactly one" |
| C20 | Yes. `has_role()` reads `auth.uid()`, which works in `storage.objects` policies. Add a test that a `viewer` can't read `private-docs` and an `editor` can |
| C21 | Confirmed: M2a checks job rows, and M2b checks for 404s |
| C22 | Allowed. A grove can be `published` and later have no playable revisions after a revocation. The checklist gates the publish only. The pack builder (M2b) must still produce a valid pack with whatever is playable, possibly none, and must not auto-unpublish. Note this in §10 |
| C23 | Make the audio generator **deterministic** (`tools/audio-fixtures`: fixed tones, no random seed). A script writes `supabase/seed-media.json` with each file's `sha256`, bytes, duration, channels and sample rate, and `seed.sql` uses those values. Uploading the files to `staging-audio` is a `pnpm` script in **M2b**, because nothing in M2a reads the files. Use tones only for the "CC0 test sounds" too |
| C24 | Approved: create `set_updated_at()` in migration 01, and have each table migration attach it |

### 7.4 Typos (D1–D3)
D1 and D2: fix them (see 7.1). D3: already handled by the order in plan §2.

---

## Answers to §10 (blockers)

| # | Decision |
|---|---|
| 1 | Resolved above. Only B7 and B8 wait on JoJo, and both have defaults, so they don't block M2a |
| 2 | Migration 01 (C24) |
| 3 | **Approved, with one change:** Vault secrets are **not** written by `seed.sql`, because `seed.sql` can't read the local keys. Add `pnpm db:setup-local`, which runs `supabase db reset` and then writes `run_jobs_url` and `run_jobs_service_key` into Vault from `supabase status -o env` through `psql`. Default URL: `http://host.docker.internal:54321/functions/v1/run-jobs`. Because the URL lives in Vault, CI can use a different host (for example the in-network Kong container) without a migration change. Verify the real reachability in M2b; M2a only needs the wrapper to read Vault and fail cleanly when the secret is missing (add a test for that) |
| 4 | **Option A (import map) is approved**, with two checks in M2b: (a) Supabase CLI 3.x may prefer a per-function `deno.json` to `import_map.json`, so follow the docs for the pinned version; (b) confirm that `supabase functions serve` resolves files outside `supabase/functions/`. If (b) fails, use option C **plus** a CI check that fails when the copy differs from the source. Don't use option B on its own |
| 5 | No dedicated role (B4) |

---

## Unchanged from the plan (approved as written)
The migration list and order (with C24 and the B2/C6/C11 additions); the PostGIS approach in §3; the pgTAP file list in §6, plus the tests named above; the M2a/M2b split of work in §2; the implementation sketch in §8 (step 1 is pre-approved by R4); the out-of-scope list in §9.

## Report back with (in addition to the brief's list)
- The pinned Supabase CLI version
- The `has_table_privilege` output for `anon` from `060_rls_anon` (it should be all false)
- The final Demo Park constants block, and whether B7/B8 are still placeholders
