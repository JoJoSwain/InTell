# M3f report — Supabase publishable/secret API keys

**Branch:** `m3f-api-keys`  
**PR:** https://github.com/JoJoSwain/InTell/pull/15  
**Tip:** `992b097`  
**Brief:** `docs/briefs/M3f-api-keys.md`  
**Stop for architect review.** Do not start M4, M5, or M3e F1/F2. Do not run the hosted staging runbook from this report.

---

## 1. Acceptance

| Criterion | Result |
|---|---|
| Integration refusals: `run-jobs` / `build-pack` / `purge-assets` refuse no key (401), wrong key (403), publishable/anon (403), staff JWT (403) | **PASS** |
| Integration acceptances: those three accept secret in `apikey`; `publish` accepts editor JWT + service key; refuses writer (403) and no credentials (401) | **PASS** |
| `fn_call_run_jobs()` → pg_net → `run-jobs` returns 200 (Vault secret as `apikey`) | **PASS** (closes deferred cron → pg_net → run-jobs e2e) |
| Unit: `keys.ts` parses JSON maps, falls back to legacy env, `safeLog` redacts keys | **PASS** (6 tests) |
| Existing suites green (pgTAP, integration, Playwright, root checks); CI green | **PASS** |
| No secret value in repo, report, or logs | **PASS** (names/placeholders only) |

---

## 2. Suite results

| Check | Result |
|---|---|
| `pnpm db:setup-local` | **PASS** — migrations through `20261121190001_m3f_run_jobs_apikey.sql` + Vault + seed media |
| `pnpm exec supabase test db` | **PASS** — Files=**35**, Tests=**194** |
| `pnpm test:integration` | **PASS** — **30** tests (6 keys unit + 24 pack; includes 3 new M3f cases) |
| Playwright (`apps/admin`) | **PASS** — **16** tests (one `staff-gate` sign-in timeout on first full local run; clean on re-run of that file) |
| `pnpm lint && pnpm typecheck && pnpm test` | **PASS** — shared **83**; admin **5**; pack-integration keys **6** |
| `pnpm --filter @intell/admin build` | **PASS** |
| CI `check` + `db` on tip `992b097` | **PASS** |
| Vercel on tip `992b097` | **PASS** — status *Deployment has completed*; Preview Comments success |

---

## 3. Git log (`origin/master..HEAD`)

```
992b097 feat(m3f): adopt Supabase publishable/secret API keys
```

(Report commit follows on the same branch after CI.)

---

## 4. `config.toml` `verify_jwt` as shipped

| Function | `verify_jwt` |
|---|---|
| `build-pack` | `false` |
| `purge-assets` | `false` |
| `run-jobs` | `false` |
| `publish` | `false` |
| `unpublish` | `true` |
| `invite-staff` | `true` |
| `preview` | `true` |

Comment in `config.toml`: *verify_jwt = false only for service-called functions that validate a secret key in-function (requireServiceCaller / publish service path), with tests proving every other caller is refused. Staff-JWT-only functions stay true.*

---

## 5. README staging runbook (quoted)

From `apps/admin/README.md` § Deploy (staging) → Supabase staging:

> The hosted staging project uses Supabase's **new API keys** (publishable `sb_publishable_…` and secret `sb_secret_…`). There are **no function secrets to set for M3f** — `SUPABASE_*` keys are injected automatically. `GOOGLE_ROUTES_API_KEY` comes in M5.
>
> 1. In the dashboard, under **Settings → API Keys**, create a **dedicated secret key named `run-jobs`**, used only by the cron/Vault path, so it can be rotated on its own. `requireServiceCaller` accepts any key in `SUPABASE_SECRET_KEYS`.
> 2. `pnpm exec supabase login`, then `pnpm exec supabase link --project-ref <ref>` …
> 3. `pnpm exec supabase db push` **from master**.
> 4. `pnpm exec supabase functions deploy`, which applies the per-function `verify_jwt` from `config.toml`.
> 5. Vault secrets via `vault.create_secret` for `run_jobs_url` and `run_jobs_service_key` (placeholders only in the repo).
> 6. Smoke: `select public.fn_call_run_jobs();` then check `run-jobs` logs return 200.
> 7–8. Auth dashboard + bootstrap first admin (A4) as before.

Hosted runbook steps were **not** executed by this agent (per brief / assignment).

---

## 6. Doc amendments (quoted)

**TECH_SPEC §6** (new bullet):

> **`verify_jwt = false` only for service-called functions** (`run-jobs`, `build-pack`, `purge-assets`, `publish`) that validate a secret key in-function (`requireServiceCaller` / publish service path), with tests proving every other caller is refused. Staff-JWT-only functions (`invite-staff`, `unpublish`, `preview`) keep `verify_jwt = true`. Service callers send the secret in the `apikey` header (Bearer still accepted during the transition).

**TECH_SPEC §7** (names):

> **Mobile** `extra`: … `SUPABASE_PUBLISHABLE_KEY` (`EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`) …  
> **Admin:** … `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` … No secret / service role key.  
> Hosted projects inject `SUPABASE_URL`, `SUPABASE_SECRET_KEYS` / `SUPABASE_SERVICE_ROLE_KEY`, and `SUPABASE_PUBLISHABLE_KEYS` / `SUPABASE_ANON_KEY` automatically.

**AGENTS.md §5:**

> Never ship the Supabase service role key, secret API key, or any secret to mobile or browser code.  
> **`verify_jwt = false` only for service-called edge functions** that validate a secret key in-function … Staff-JWT-only functions keep platform JWT verification on.

**`.env.example`:** `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (empty values). Admin `.env.example` shows only the publishable name. `getSupabaseAnonKey()` prefers publishable, keeps `…ANON_KEY` fallback for one milestone.

---

## 7. What landed (code)

- `supabase/functions/_shared/keys.ts` — `secretKeys` / `serviceKey` / `publishableKey` / `safeLog`
- `requireServiceCaller` replaces `requireServiceRole` (`apikey` first, else Bearer; 401 missing / 403 wrong or publishable)
- `run-jobs` `invoke()` sends `apikey` + Bearer via `serviceKey()`
- `publish`: secret → service path; else `auth.getUser()` + `fn_is_editor_or_admin`
- Migration `20261121190001_m3f_run_jobs_apikey.sql` — `fn_call_run_jobs` headers include `apikey`
- Tools: `db-setup-local`, `seed-media-upload`, `e2e-prepare`, pack-integration `env` prefer `SECRET_KEY` / `PUBLISHABLE_KEY`
- CI wait curl sends `apikey` + Bearer; Playwright maps publishable

---

## 8. Deviations

- None from the brief’s decisions. Prior worker mid-turn state on `m3f-api-keys` was completed in place (no separate plan PR).
- Local Playwright: one transient `staff-gate` timeout (webServer abort on `/sign-in`); not reproduced on re-run. CI Playwright green.

---

## 9. Open questions

1. After merge, when should JoJo run the hosted staging runbook (create dedicated `run-jobs` secret, `db push`, `functions deploy`, Vault)? This agent did not.
2. When to drop the admin `NEXT_PUBLIC_SUPABASE_ANON_KEY` fallback in `env.ts` (brief: keep for one milestone)?
3. Mobile runtime still out of scope; only `.env.example` / TECH_SPEC renamed — confirm when app.config reads `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.

---

## 10. Not done (by design)

- Hosted staging runbook execution
- M4 / M5 / Embark / Routes key
- M3e F1/F2
- Mobile app code changes beyond env example naming
