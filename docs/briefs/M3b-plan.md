# M3b plan — hosted foundation

**Branch:** `m3b-hosted-foundation` from tip of `m3a-schema-realign` (`e39fef0`, PR #6; rebase onto `origin/master` after M3a merges)  
**Brief:** `docs/briefs/M3-admin.md` § M3b + plan checkpoint  
**Review context:** `docs/briefs/M3a-review.md` “Next: M3b planning”  
**Wins on conflicts:** ADR 0004 → TECH_SPEC §4–7 → M3 brief → this plan; do not invent product behavior  
**Stop after this plan** for architect review. **Do not implement** auth UI, edge functions, hosting wiring, or Playwright until approved.

---

## 0. Preconditions

| Check | Result |
|---|---|
| M3a F1/F2 on `m3a-schema-realign` | **PASS** — `e39fef0`; GitHub CI all 4 checks green |
| Branch cut from M3a tip | **PASS** — `git checkout -b m3b-hosted-foundation` at `e39fef0` |
| Hosted Supabase **staging** | **Exists** (JoJo, 2026-11-20): Free plan, region **us-east-2** (prod later **us-west-2**) |
| Vercel admin host | **In progress** (JoJo): Hobby plan, project **`intell-admin`**, root **`apps/admin`** |
| Google Maps API key + map ID | **Pending** (JoJo) — M3b map surfaces stay GeoJSON / lat-lng only until keys exist; Playwright never requires them |
| SMTP for invite email | **Pending** (JoJo) — likely **Google Workspace**, not a new provider |

No secret **values** are requested or written in this plan or in chat.

---

## 1. Scope (from brief M3b)

1. **Auth:** sign in / out, password reset, session refresh; staff gate; password policy (decision 9)  
2. **`invite-staff` edge function:** invite + deactivate (admin only)  
3. **Admin shell:** DESIGN §5 sidebar, role-aware layout, tokens in Tailwind, status badges  
4. **Regions** CRUD (editor+), **staff management** (admin only), **audit log** viewer with filters (editor + admin)  
5. **Hosting:** wire admin → hosted staging Supabase + Vercel via env vars; document deploy in `README.md`; documented commands for migrations + edge deploy to staging (no keys committed)  
6. **Playwright** harness + test-user script + CI wiring; smoke E2E: admin invites writer → writer signs in → writer cannot reach staff management or publish  

**Out of scope for M3b:** Grove editor / Google Maps drawing (M3c), audio/image library (M3c), revisions/releases UI (M3d), `preview` (M3d), mobile, production Supabase project, Listening Simulator.

---

## 2. Auth / session design

### 2.1 Stack
- **`@supabase/ssr`** cookie sessions on Next.js App Router (TECH_SPEC §1, decision 9).
- Browser + server components / server actions use the **anon key + user session only**. **Never** the service role in `apps/admin` (browser or server).
- Middleware refreshes the session on each request; protected routes redirect unauthenticated users to `/sign-in`.

### 2.2 Flows
| Flow | Behavior |
|---|---|
| Sign in | Email + password → cookie session |
| Sign out | Clear session cookies; redirect to `/sign-in` |
| Password reset | Supabase recovery email → `/auth/callback` → set new password |
| Invite accept | Invite link → set password → land in shell (or no-access if `staff.active` false) |
| Session refresh | `@supabase/ssr` middleware + refresh token rotation (local `config.toml` already enables rotation) |

### 2.3 Staff gate
After auth, load `staff` for `auth.uid()`:
- **No row** or **`active = false`** → sole page: **“no access”** (no sidebar).
- **Active staff** → shell; nav items filtered by role (UI only; RLS remains the boundary).

### 2.4 Password / signup policy (local `supabase/config.toml` + hosted dashboard)
Align local config and staging dashboard with decision 9 / TECH_SPEC §6:

| Setting | Target |
|---|---|
| Self-signup | **Off** (`enable_signup = false` — already local; mirror on hosted) |
| Anonymous sign-ins | **Off** |
| MFA / 2FA | **Off** (ADR 0004) |
| Minimum password length | **10** (local today is `6` — raise in M3b) |
| Leaked-password protection | **On** where the Free/Hobby plan supports it (dashboard) |
| Session / JWT expiry | Keep sensible defaults; document chosen values in README (no values in this plan) |
| Email confirmations | Invite flow sets password via invite link; confirm whether hosted invites need `enable_confirmations` — propose **off** for invite-only staff if invite email already proves address |

### 2.5 Route sketch (M3b only)
```
/sign-in
/auth/callback          # invite + recovery
/no-access
/(shell)/               # layout: sidebar + staff gate
  /                     # home stub
  /regions
  /regions/[id]
  /staff                # admin only
  /audit                # editor + admin
```
Story / Media / Sound / Journal / Releases nav entries may appear as **disabled stubs** or be omitted until M3c/M3d — prefer **omit** so writers aren’t teased with empty screens.

---

## 3. `invite-staff` edge function

### 3.1 Why an edge function
Auth Admin APIs (invite user by email, etc.) need the **service role**. The admin must not hold that key (decision 10). Pattern matches `publish`: verify caller JWT as **admin**, then elevate with service client only inside the function.

### 3.2 Proposed API
| Action | Body (zod) | Effect |
|---|---|---|
| `invite` | `{ email, displayName, role }` | `auth.admin.inviteUserByEmail`; insert `staff` (`invited_by` = caller, `active` true); audit `staff.invite` |
| `deactivate` | `{ userId }` | set `staff.active = false`; optionally ban/disable Auth user; audit `staff.deactivate` |
| `reactivate` (optional same PR) | `{ userId }` | set `active = true` if product wants it — **ask in ambiguities** if required for M3b |

Refuse non-admin with **403**. Refuse self-deactivation. Never return service errors that leak other users’ emails beyond the invite target.

### 3.3 Auth helper
Add `requireStaffAdmin` beside existing `requireStaffEditor` in `supabase/functions/_shared/auth.ts` (RPC `has_role(['admin'])` or new `fn_is_admin()` — prefer reusing `has_role` via a small RPC for parity with `fn_is_editor_or_admin`).

### 3.4 Email
Hosted Auth sends the invite via **dashboard SMTP** (see §5). Locally, Inbucket (or configured local SMTP) captures invite mail for Playwright.

### 3.5 Staff row writes
Prefer: edge uses **service role** for Auth invite + `staff` insert (admin RLS already allows admin writes, but invite must create the Auth user first). Admin UI never inserts `staff` directly for new emails—always via `invite-staff`.

### 3.6 Audit
Every invite / deactivate writes `audit_log` (`action`, `entity = 'staff'`, `entity_id`, `detail` without secrets).

---

## 4. Admin shell, regions, staff, audit

### 4.1 Shell
- Light theme, DESIGN §1 tokens mirrored in Tailwind (already started in `apps/admin`).
- Sidebar groups per DESIGN §5; M3b implements **Ops:** Regions, Audit, Staff (+ home).
- Status badge styles from DESIGN §5 (used later by releases; ship the component now).
- Role-aware nav: hide Staff unless admin; hide Audit unless editor or admin.

### 4.2 Regions (editor+)
Fields: `name`, `slug`, `timezone`, `sun_reference` (lat/lng inputs → geography), `bounds` (optional GeoJSON paste). No Google Maps in M3b. RLS already: staff select; editor+ write.

### 4.3 Staff management (admin only)
List staff; invite form; deactivate switch. Role changes: **admin-only** update via RLS or via edge — propose **direct RLS update** for `role` / `display_name` on existing rows, **edge-only** for invite/deactivate. Audit role changes.

### 4.4 Audit log (editor + admin)
Read-only table with filters: actor, action, entity, date range.  
**RLS gap to fix in M3b:** today `audit_log_staff_select` allows **all** staff roles; DATA_MODEL §13 / brief say **editor and admin**. Migration: tighten select to `editor`/`admin`; keep admin write/export as today (triggers/functions insert as definer/service).

---

## 5. Hosting setup and configuration inventory

**Rule:** list names and **where** each goes. **Never** commit or paste values.

### 5.1 Env vars — Admin (`apps/admin`)

| Name | Where set | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Vercel project env (Preview + Production); local `apps/admin/.env.local` (gitignored); empty key in root `.env.example` | Staging Supabase API URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Same | Anon/public key (RLS-enforced) |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Same (may stay empty until JoJo provides) | Maps JS API — unused in M3b UI paths; required empty-safe for M3c |
| `NEXT_PUBLIC_GOOGLE_MAP_ID` | Same (may stay empty) | Cloud map style id |
| `NEXT_PUBLIC_LINK_DOMAIN` | Same (default placeholder already in `.env.example`) | Marker QR host (print UI is M3c; still declare) |
| `SENTRY_DSN` | Vercel env (server); optional local | Admin error reporting — omit PII/coords |

**Forbidden in admin:** `SUPABASE_SERVICE_ROLE_KEY` / any service role name.

### 5.2 Env vars — Edge functions (hosted staging)

| Name | Where set | Purpose |
|---|---|---|
| `SUPABASE_URL` | Injected by Supabase edge runtime | Project URL |
| `SUPABASE_ANON_KEY` | Injected | User-scoped clients |
| `SUPABASE_SERVICE_ROLE_KEY` | Injected (edge only) | Auth admin + privileged writes inside `invite-staff` / existing publish pipeline |
| Vault secrets `run_jobs_url`, `run_jobs_service_key` | Hosted Vault / SQL setup (documented command) | pg_net → `run-jobs` (already required by M2/M3a pipeline) |

### 5.3 Env vars — Local tools / Playwright (never in the browser)

| Name | Where set | Purpose |
|---|---|---|
| `SUPABASE_URL` / `API_URL` | CI job env / developer shell; root `.env.example` | Local API |
| `SUPABASE_SERVICE_ROLE_KEY` / `SERVICE_ROLE_KEY` | CI secrets / local gitignored env | Test-user script, seed upload, integration |
| `ANON_KEY` | CI / local | Optional helper for scripts |
| Playwright test user emails/passwords | Generated by script into **gitignored** file or CI env | E2E login — **never committed** |

### 5.4 Env vars — Mobile (not M3b runtime; leave `.env.example` entries empty)

Unchanged placeholders from TECH_SPEC §7 / root `.env.example` (`EXPO_PUBLIC_*`). No mobile work in M3b.

### 5.5 Supabase dashboard settings (staging project)

| Setting | Where | Notes |
|---|---|---|
| Project region | Already **us-east-2** | Prod later us-west-2 — out of M3b |
| Auth → Enable sign-ups | **Disabled** | Invite-only |
| Auth → Minimum password length | **10** | |
| Auth → Leaked password protection | **Enabled** if plan allows | |
| Auth → Site URL | Staging admin URL (Vercel) | |
| Auth → Redirect URLs | Staging admin origin(s) + local `http://127.0.0.1:3000` for dev | Exact URLs only |
| Auth → SMTP | Host / port / user / pass / sender | **Google Workspace** expected; values only in dashboard |
| Auth → Email templates (invite / recovery) | Optional customize | No secrets in repo templates if added |
| API URL + anon key | Copied into Vercel `NEXT_PUBLIC_*` | By JoJo / deployer |
| Service role key | Edge + Vault / CLI only — **never** Vercel admin env | |
| Storage buckets | Already in migrations | Confirm public-media / staging-* after `db push` |

### 5.6 Vercel dashboard (`intell-admin`)

| Setting | Notes |
|---|---|
| Root directory | `apps/admin` |
| Framework | Next.js |
| Env vars | §5.1 names only |
| Production branch | After M3b merges: `master` (or JoJo’s choice) |
| Preview deployments | Optional for PR previews pointing at **staging** Supabase (same project) |

### 5.7 Google Cloud (Maps) — pending; M3b-safe

| Setting | Where | M3b stance |
|---|---|---|
| Maps JavaScript API key (HTTP referrer–restricted to admin origins) | Google Cloud → Vercel `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | May be empty; no map widget in M3b |
| Map ID | Google Cloud → `NEXT_PUBLIC_GOOGLE_MAP_ID` | May be empty |

### 5.8 Documented deploy commands (README; no keys in repo)

Propose documenting (exact flags confirmed at implementation):

1. Link CLI to staging: `supabase link` (project ref from dashboard — not committed).  
2. `supabase db push` (or migration deploy workflow JoJo prefers).  
3. `supabase functions deploy` for `invite-staff` + existing M3a functions.  
4. Vault / `run-jobs` URL secret setup for hosted (analogue of `pnpm db:setup-local`).  
5. Vercel: env vars set in UI; deploy from Git.

---

## 6. Playwright without a Google key

### 6.1 Principle (decision 11)
When `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` is missing/empty, any future map surface falls back to GeoJSON / lat-lng inputs. **M3b has no map UI**, so E2E never loads Maps JS.

### 6.2 Harness
- Package: `@playwright/test` in `apps/admin`.
- Target: local Next (`pnpm dev:admin`) + local Supabase (`db:setup-local`) + `functions serve` (or built-in edge runtime).
- **No Google key** in CI env for admin.

### 6.3 Test-user script
- `tools/admin-test-users.mjs` (name TBD): service role creates Auth users + `staff` rows for **admin**, **editor**, **writer** (and optionally a signed-in user **without** staff for no-access).
- Credentials written to gitignored path / exported as CI env — never committed.
- Local: Inbucket for invite-email assertions if smoke covers invite end-to-end against local stack.

### 6.4 Smoke E2E (acceptance)
1. Admin signs in → Staff → invite writer (local: assert Inbucket mail **or** script-precreated writer if invite email is flaky in CI).  
2. Writer signs in → shell loads; **no** Staff nav; forced navigation to `/staff` redirects or shows forbidden.  
3. Writer cannot publish: no publish UI (M3d) **and** forced `publish` edge call returns **403** (reuse integration pattern).

Prefer one CI path that is deterministic: script creates users; separate test hits `invite-staff` with admin JWT and asserts `staff` row + audit (API-level) if full email round-trip is unreliable on CI.

### 6.5 CI wiring
Extend `.github/workflows/ci.yml` `db` job (after integration tests): install Playwright browsers, start admin, run `apps/admin` e2e. Keep concurrency cancel-in-progress from M3a F1/F2 CI harden.

---

## 7. Proposed file / change list (implementation later)

| Area | Changes |
|---|---|
| `supabase/config.toml` | `minimum_password_length = 10`; confirm signup off; document SMTP for local if needed |
| Migration | Tighten `audit_log` select to editor+admin; optional `fn_is_admin()` |
| `supabase/functions/invite-staff/` | New edge function + deno.json |
| `supabase/functions/_shared/auth.ts` | `requireStaffAdmin` |
| `apps/admin` | Auth pages, middleware, shell, regions, staff, audit; shadcn as needed |
| `apps/admin/e2e` | Playwright smoke |
| `tools/admin-test-users.mjs` | Test users |
| Root / admin README | Hosting + deploy + env inventory (names only) |
| `.env.example` | Ensure all §5.1 / tool keys listed **empty**; no new secret values |
| `.github/workflows/ci.yml` | Playwright step |
| pgTAP | Audit RLS; invite/deactivate role guards if SQL helpers added |
| Integration | `invite-staff` admin-only; writer 403 |

**Dependencies (already allowed):** `@supabase/ssr`, `@supabase/supabase-js`, shadcn/ui, `@playwright/test`. No Maps packages required to **ship** M3b UI (may add stubs that read empty env).

---

## 8. Acceptance mapping

| Brief acceptance | Plan coverage |
|---|---|
| Staff sign in to hosted staging from their computers | §2 + §5 Vercel/Supabase wiring |
| Non-staff → “no access”; writer refused for editor actions (pgTAP + Playwright) | §2.3, §6.4, F1 already covers fragment column writes |
| Self-signup disabled; invites work end to end | §2.4, §3, §5.5 SMTP |
| Every CI job green | §6.5 |

---

## 9. Ambiguities / open questions (do not resolve silently)

1. **Audit RLS:** tighten select to editor+admin in M3b (matches brief/DATA_MODEL) even though M2 allowed all staff — confirm.  
2. **Reactivate:** is reactivation in M3b or later?  
3. **Role change path:** RLS-only update vs edge function for `staff.role`?  
4. **Hosted invite email:** confirm Google Workspace SMTP is ready before claiming “invites work on staging,” or accept local/Inbucket proof + staging manual check by JoJo.  
5. **Vercel ↔ staging:** Preview deployments share staging DB — OK for M3b, or Production-only until M3d?  
6. **First admin bootstrap:** how does the very first `staff` admin row get created on empty staging (dashboard SQL once vs seed)? Must be documented; no password in repo.  
7. **Password leaked-protection on Free plan:** if unavailable, document as deferred without blocking M3b.  
8. **`enable_confirmations`:** on or off for invite-only staging?  
9. **Nav stubs:** omit M3c/M3d sections entirely vs disabled items?  
10. Rebase timing: implement on `m3b-hosted-foundation` now, rebase onto `master` after PR #6 merges — confirm.

---

## 10. Explicit non-goals

- No M3b **implementation** in this checkpoint (plan only).  
- No secret values in git, chat, or this file.  
- No production Supabase project; no mobile; no Grove map; no publish UI.

---

**Stop for architect review.** After approval, implement on `m3b-hosted-foundation` and open a PR → `master` (rebased as needed).
