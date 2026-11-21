# Brief: M3f, Supabase's new API keys

**Branch:** `m3f-api-keys`, cut from `origin/master` after the M3e PR (#14) merges.
**Size:** small, one PR. **Implement directly** (no separate plan), then **stop for architect review** with a report.
**Why now:** the hosted staging project uses Supabase's **new API keys**, a publishable `sb_publishable_…` and a secret `sb_secret_…`. The legacy `anon` and `service_role` JWT keys are **retired in early 2027**. Everything server-to-server in the repo assumes the legacy JWT keys, so this has to land **before** the first `db push` and `functions deploy` to staging.

## What's built on the legacy keys today (master)
1. **`verify_jwt = true` on every function** (`supabase/config.toml`, M2b S3). Secret keys aren't JWTs, so the platform's JWT check rejects any service-to-service call made with them.
2. **`_shared/http.ts` `requireServiceRole`** compares the bearer token with `SUPABASE_SERVICE_ROLE_KEY`. Used by `run-jobs`, `build-pack` and `purge-assets`.
3. **`run-jobs` `invoke()`** calls `build-pack`, `purge-assets` and `publish` with `Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>`.
4. **`publish`** treats `bearer === SUPABASE_SERVICE_ROLE_KEY` as the service path (scheduled releases). Everything else is a staff JWT.
5. **`fn_call_run_jobs()`** (pg_cron → pg_net) sends `Authorization: Bearer <vault run_jobs_service_key>`.
6. **Clients:** `_shared/clients.ts` and `_shared/supabase.ts` use `SUPABASE_SERVICE_ROLE_KEY`; `userClient` and `_shared/auth.ts` use `SUPABASE_ANON_KEY`.
7. **Tools:** `tools/db-setup-local.mjs`, `tools/seed-media-upload.mjs` and `apps/admin/scripts/e2e-prepare.mjs` read `SERVICE_ROLE_KEY` / `ANON_KEY` from `supabase status -o env`.
8. **Docs and examples:** `.env.example`, `apps/admin/.env.example`, `apps/admin/README.md` and TECH_SPEC §7 name `…ANON_KEY`.

## Decisions (don't revisit)
1. **One key module:** `supabase/functions/_shared/keys.ts`.
   - `secretKeys()`: every value in `SUPABASE_SECRET_KEYS` (a JSON object, name → key), plus `SUPABASE_SERVICE_ROLE_KEY` if it's set. The legacy key keeps local, CI and the transition working.
   - `serviceKey()`: `SUPABASE_SECRET_KEYS.default`, falling back to `SUPABASE_SERVICE_ROLE_KEY`.
   - `publishableKey()`: `SUPABASE_PUBLISHABLE_KEYS.default`, falling back to `SUPABASE_ANON_KEY`.
   - Never log any key.
2. **Service-to-service calls carry the secret key in the `apikey` header** (Supabase's recommended pattern). Senders: `run-jobs` `invoke()` and `fn_call_run_jobs()` (in a new migration). During the transition, receivers also accept `Authorization: Bearer <key>` when the key matches.
3. **`requireServiceCaller(req)`** replaces `requireServiceRole`. It's a constant-time match of the `apikey` header (or the bearer) against `secretKeys()`, returning 401 when no key is present and 403 for a wrong key. A publishable key, a user JWT or an anon JWT is **always refused**.
4. **`verify_jwt` per function:**
   - **`false`** for functions called by services: `run-jobs`, `build-pack`, `purge-assets`, and `publish` (called by staff *and* by `run-jobs`). Each must run `requireServiceCaller`, or for `publish` its own check, as the **first** thing it does.
   - **`true`** for functions called only with a user JWT: `invite-staff`, `unpublish`, `preview`.
   - Replace the M2b "never ship `verify_jwt = false`" comment with this rule, and record it in TECH_SPEC §6 and AGENTS.md: *`verify_jwt = false` only for service-called functions that validate a secret key in-function, with tests proving every other caller is refused.*
5. **`publish` auth:** if the `apikey` or bearer matches `secretKeys()`, it's the service path. Otherwise it requires a valid **user JWT** (verified with `auth.getUser()`, not by decoding claims) **and** `fn_is_editor_or_admin`. No credentials → 401.
6. **Clients:** `serviceClient()` uses `serviceKey()`; `userClient()` and `_shared/auth.ts` use `publishableKey()`, with the caller's `Authorization` header as today.
7. **Vault:** keep the secret names `run_jobs_url` and `run_jobs_service_key`; the latter now holds a **secret key**. `db-setup-local` writes the local secret key there, falling back to the legacy service key on older CLIs.
8. **Tools and tests** read `SECRET_KEY` / `PUBLISHABLE_KEY` from `supabase status -o env`, falling back to `SERVICE_ROLE_KEY` / `ANON_KEY`. CI uses whatever the CLI prints.
9. **Admin and mobile names:**
   - Admin: `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` is primary. Keep the `…ANON_KEY` fallback in `env.ts` for one milestone; README and `.env.example` show only the publishable name.
   - Mobile (`.env.example`, TECH_SPEC §7): `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.

## Hosted staging runbook (write it into `apps/admin/README.md` "Deploy (staging)", replacing the old steps)
For JoJo, step by step, with **no values** in the repo:
1. In the dashboard, under **Settings → API Keys**, create a **dedicated secret key named `run-jobs`**, used only by the cron/Vault path, so it can be rotated on its own. `requireServiceCaller` accepts any key in `SUPABASE_SECRET_KEYS`.
2. `pnpm exec supabase login`, then `pnpm exec supabase link --project-ref <ref>`.
3. `pnpm exec supabase db push` **from master**.
4. `pnpm exec supabase functions deploy`, which applies the per-function `verify_jwt` from `config.toml`.
5. In the SQL editor, create the Vault secrets: `run_jobs_url` = `https://<ref>.supabase.co/functions/v1/run-jobs`, and `run_jobs_service_key` = the `run-jobs` secret key, typed in the dashboard only. Show the exact `vault.create_secret` statements with placeholders.
6. Smoke test: `select public.fn_call_run_jobs();`, then check the `run-jobs` logs return 200 and that no jobs are stuck.
7. Bootstrap the first admin: the existing A4 step, the SQL insert of the staff row for the user created in the dashboard.

Also: the hosted project has **no function secrets to set** for M3f, because the `SUPABASE_*` keys are injected automatically. `GOOGLE_ROUTES_API_KEY` comes in M5.

## Acceptance
- [ ] **Integration (local stack), refusals:** `run-jobs`, `build-pack` and `purge-assets` refuse:
  - no key (401)
  - a wrong key (403)
  - the publishable or anon key (403)
  - a staff user JWT (403)
- [ ] **Integration, acceptances:**
  - those three functions accept the secret key in `apikey`
  - `publish` accepts a staff editor JWT and the service key, and refuses a writer JWT (403) and no credentials (401)
  - `fn_call_run_jobs()` → pg_net → `run-jobs` succeeds end to end with the Vault secret sent as `apikey`. This closes the deferred **cron → pg_net → run-jobs** e2e follow-up.
- [ ] **Unit:** `keys.ts` parses the `SUPABASE_SECRET_KEYS` and `SUPABASE_PUBLISHABLE_KEYS` JSON and falls back to the legacy variables; no key ever appears in logs (test the logger path).
- [ ] **Existing suites stay green:** pgTAP, integration, Playwright, and the root checks. CI is green.
- [ ] **No secret value** appears anywhere in the repo, the report or the logs.

## Out of scope
Embark and the Routes key (M5); mobile code; any change to RLS or the schema beyond the `fn_call_run_jobs()` header change.

## Report back with
`git log --oneline`; the suite results; the `config.toml` `verify_jwt` table as shipped; the new README runbook, quoted; doc amendments (TECH_SPEC §6 and §7, AGENTS.md, `.env.example`), quoted; deviations; open questions. **Then stop for architect review.**
