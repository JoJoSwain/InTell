# M3b plan — hosted foundation

**Branch:** `m3b-hosted-foundation` from `origin/master`  
**Brief:** `docs/briefs/M3-admin.md` § M3b + plan checkpoint  
**Review context:** `docs/briefs/M3a-review.md` “Next: M3b planning” (lands with PR #6)  
**Wins on conflicts:** ADR 0004 → TECH_SPEC §4–7 → M3 brief → this plan; do not invent product behavior  
**Stop after this plan** for architect review. **Do not implement** until approved (and until M3a is on `master`).

---

## 0. Preconditions

| Check | Result |
|---|---|
| `origin/master` at plan write | `3b7f261` (PR #5 docs realign). **PR #6 (M3a) still open** at write time — rebase this branch onto `master` after M3a merges before implementation |
| Target after M3a merge | Confirm `e39fef0` (F1/F2) and `c7c8998` (M3a review) are ancestors of `origin/master` |
| Hosted Supabase **staging** | **Exists** (JoJo, 2026-11-20): Free plan, region **us-east-2** (prod later **us-west-2**) |
| Vercel admin host | **In progress** (JoJo): Hobby plan, project **`intell-admin`**, root **`apps/admin`**. First deploy blocked on vulnerable Next.js (see §1) |
| Google Maps API key + map ID | **Pending** — M3b UI has no map; Playwright never requires them |
| SMTP | **Pending** — expect **Google Workspace** (smtp-relay or dedicated sending mailbox) |

No secret **values** are requested or written in this plan or in chat.

---

## 1. First implementation commit (required before other M3b code)

**Do not ship this commit in the plan PR.** When implementation starts, make it the **first** commit on the implementation work:

### 1.1 Unblock Vercel: upgrade Next.js (security)

Vercel refused the first `apps/admin` deploy: **“Vulnerable version of Next.js detected”** (`next` **15.2.4**).

| Package (today) | Action |
|---|---|
| `next` `15.2.4` | Upgrade to latest **15.5.x** patched line (**≥ 15.5.24**; at plan write npm shows **15.5.29**) |
| `eslint-config-next` `15.2.4` | Same version as `next` |
| `react` / `react-dom` (`^19.0.0`) | Bump to the versions that Next 15.5.x peers recommend at install time (keep React 19) |
| `@types/react` / `@types/react-dom` | Match |
| Lockfile | Regenerate with `pnpm install` from repo root |

**Keep green:** `pnpm lint && pnpm typecheck && pnpm test` (and `pnpm --filter @intell/admin build`).

#### Choice: stay on 15.5.x (not Next 16) — justification

| Option | Patched floor (Aug 2026 advisories) | Proposal |
|---|---|---|
| **15.5.x (Maintenance LTS)** | **15.5.24+** (CVE-2026-75604 / GHSA-p293-qw3h-jr36; also AVIF/image RCE fixes in that release train) | **Chosen** |
| **16.x (Active LTS)** | **16.3.3+** (latest at plan write ~16.4.6) | Defer |

Reasons to stay on **15.5.x**:
1. Admin already targets App Router on the 15 line; M3b is auth/shell/hosting — a **major** (16) jump adds churn (config, eslint, possible routing defaults) without product need.
2. **15.5.24** is the documented Maintenance LTS security floor; taking the **latest 15.5.x** at implement time (≥ that floor) clears Vercel’s gate and picks up follow-on 15.5 patches.
3. Next 16 remains available later (post-M3 or a dedicated chore) once Active LTS is desired.

If an advisory after this plan requires 16.x only, revisit then.

### 1.2 Vercel function region (same early commit or immediate follow-up)

Vercel Functions default to **`iad1`** (us-east-1). Staging Supabase is **us-east-2** → set admin function region to **`cle1`** (Vercel’s us-east-2 / Cleveland). Production Supabase will be **us-west-2** → plan function region **`pdx1`** (Portland).

Configure via project settings and/or `apps/admin/vercel.json` `"regions": ["cle1"]` for staging; document swapping to `pdx1` when the prod project is created. Hobby allows a single region.

---

## 2. Scope (from brief M3b)

1. **Auth:** sign in / out, password reset, session refresh; staff gate; password policy (decision 9)
2. **`invite-staff` edge function:** invite + deactivate (admin only)
3. **Admin shell:** DESIGN §5 sidebar, role-aware layout, tokens in Tailwind, status badges
4. **Regions** CRUD (editor+), **staff management** (admin only), **audit log** viewer with filters (editor + admin)
5. **Hosting:** wire admin → hosted staging Supabase + Vercel via env vars; document deploy in README; JoJo-run commands for migrations + edge deploy (no keys committed)
6. **Playwright** harness + test-user script + CI; smoke E2E: admin invites writer → writer signs in → writer cannot reach staff management or publish
7. **Security follow-up (M3a architect nit):** rewrite F1 writer fragment guard as an **allowlist** (see §8)

**Out of scope:** Grove editor / Maps (M3c), audio/image library (M3c), revisions/releases UI (M3d), `preview` (M3d), mobile, production Supabase create (document region only), Listening Simulator.

---

## 3. Auth / session design

### 3.1 Stack
- **`@supabase/ssr`** cookie sessions on Next.js App Router (TECH_SPEC §1, decision 9).
- Browser + server components / server actions: **anon key + user session only**. **Never** the service role in `apps/admin`.
- Middleware refreshes the session; protected routes → `/sign-in`.

### 3.2 Flows
| Flow | Behavior |
|---|---|
| Sign in | Email + password → cookie session |
| Sign out | Clear cookies → `/sign-in` |
| Password reset | Recovery email → `/auth/callback` → set password |
| Invite accept | Invite link → set password → shell or no-access |
| Session refresh | `@supabase/ssr` + refresh-token rotation |

### 3.3 Staff gate
Load `staff` for `auth.uid()`:
- No row or `active = false` → **“no access”** only.
- Active staff → shell; nav filtered by role (UI only; RLS is the boundary).

### 3.4 Password / signup — `supabase/config.toml` vs hosted dashboard

| Setting | Local `config.toml` | Hosted staging dashboard |
|---|---|---|
| Self-signup | `enable_signup = false` (already) | **Disable** sign-ups |
| Anonymous sign-ins | Off | Off |
| MFA / 2FA | Off | Off (ADR 0004) |
| Min password length | Raise **6 → 10** | **10** |
| Leaked-password protection | N/A locally | **On** if Free plan supports |
| Site URL | `http://127.0.0.1:3000` | Staging admin URL (Vercel) |
| Redirect URLs | local admin origins | Staging (+ local for dev) |
| SMTP | Inbucket / local | Google Workspace (see §6.3) |
| Email confirmations | Invite-only — propose **off** if invite link already proves address | Same (ambiguity §10) |

### 3.5 Route sketch (M3b)
```
/sign-in
/auth/callback
/no-access
/(shell)/
  /
  /regions
  /regions/[id]
  /staff          # admin
  /audit          # editor + admin
```
Omit Story / Media / Sound / Journal / Releases nav until M3c/M3d (no disabled teases).

---

## 4. `invite-staff` edge function

### 4.1 Why
Auth Admin invite APIs need the **service role**. Admin must not hold it (decision 10). Same pattern as `publish`: verify caller as **admin**, then elevate inside the function.

### 4.2 API (proposed)
| Action | Body | Effect |
|---|---|---|
| `invite` | `{ email, displayName, role }` | `auth.admin.inviteUserByEmail`; insert `staff` (`invited_by` = caller); audit |
| `deactivate` | `{ userId }` | `staff.active = false`; optionally disable Auth user; audit |

Refuse non-admin **403**. Refuse self-deactivate. Add `requireStaffAdmin` next to `requireStaffEditor`.

### 4.3 Email
Hosted Auth sends via dashboard SMTP (Google Workspace). Locally Inbucket (or local SMTP) for Playwright.

---

## 5. Admin shell, regions, staff, audit

- Shell: DESIGN §5; Ops = Regions, Audit, Staff; status badge component.
- Regions (editor+): name, slug, timezone, sun_reference (lat/lng), bounds (GeoJSON paste). No Maps in M3b.
- Staff (admin): list, invite, deactivate; role/display_name updates admin-only.
- Audit (editor+admin): read-only filters. **Tighten RLS** so select is editor/admin only (today all staff can select — gap vs DATA_MODEL §13).

---

## 6. Hosting — env vars, dashboard settings, secrets (names only)

**Never commit or paste values.**

### 6.1 Admin — Vercel project `intell-admin` + local `apps/admin/.env.local`

| Name | Where | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Vercel env (Preview/Production); local gitignored; empty in `.env.example` | Staging API URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Same | Anon key (RLS) |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Same (may be empty) | M3c; empty-safe |
| `NEXT_PUBLIC_GOOGLE_MAP_ID` | Same (may be empty) | M3c |
| `NEXT_PUBLIC_LINK_DOMAIN` | Same | Marker QR host (M3c print) |
| `SENTRY_DSN` | Vercel (server); optional local | Errors — no PII/coords |

**Forbidden in Vercel admin / admin app:** any `SERVICE_ROLE` / service role key.

### 6.2 Edge functions — Supabase staging (injected + Vault)

| Name | Where | Purpose |
|---|---|---|
| `SUPABASE_URL` | Edge runtime | Project URL |
| `SUPABASE_ANON_KEY` | Edge runtime | User-scoped clients |
| `SUPABASE_SERVICE_ROLE_KEY` | Edge runtime only | `invite-staff`, publish pipeline |
| Vault `run_jobs_url` | Hosted Vault (SQL setup) | pg_net → `run-jobs` |
| Vault `run_jobs_service_key` | Hosted Vault | Service JWT for run-jobs |

### 6.3 Supabase dashboard (staging)

| Setting | Notes |
|---|---|
| Region | Already **us-east-2** |
| Auth → Enable sign-ups | **Disabled** |
| Auth → Min password length | **10** |
| Auth → Leaked password protection | On if available |
| Auth → Site URL / Redirect URLs | Vercel admin URL(s) + local |
| Auth → SMTP | **Google Workspace**: either **SMTP relay** (`smtp-relay.gmail.com`) or a **dedicated sending mailbox** + SMTP auth — JoJo configures; values only in dashboard |
| API URL + anon key | → Vercel `NEXT_PUBLIC_*` |
| Service role | CLI / edge / Vault only — never Vercel admin |

### 6.4 Vercel dashboard

| Setting | Notes |
|---|---|
| Root | `apps/admin` |
| Framework | Next.js |
| Function region | Staging **`cle1`** (us-east-2); prod later **`pdx1`** (us-west-2). Default `iad1` is wrong for us-east-2 DB latency |
| Env vars | §6.1 only |

### 6.5 GitHub Actions secrets / vars (CI)

| Name | Where | Purpose |
|---|---|---|
| (none new required for plan PR) | — | Existing CI uses local `supabase start` |
| Optional later: Playwright creds | GitHub Actions secrets | Only if not generated in-job by test-user script |
| Hosted service role | **Not** in GitHub for M3b | JoJo runs deploy via CLI; avoid service role in Actions unless a future deploy workflow is approved |

### 6.6 Local developer / tools (gitignored)

| Name | Where | Purpose |
|---|---|---|
| `SUPABASE_URL` / `API_URL` | Shell / `.env` (gitignored); listed empty in root `.env.example` | Local API |
| `SUPABASE_SERVICE_ROLE_KEY` / `SERVICE_ROLE_KEY` | Same | Test users, seed upload, integration |
| `ANON_KEY` | Optional | Scripts |
| Playwright user passwords | Generated file (gitignored) or CI env | Never committed |

### 6.7 Google Cloud (Maps) — pending; M3b-safe

| Name | Where | M3b |
|---|---|---|
| Maps JS API key | Google Cloud → Vercel | May be empty |
| Map ID | Same | May be empty |

### 6.8 Deploy commands (README; run by JoJo — no keys in repo)

Documented sequence (exact flags confirmed at implement):

1. `supabase login` / `supabase link --project-ref <staging-ref>` (ref from dashboard, not committed).
2. `supabase db push` (apply migrations to staging).
3. `supabase functions deploy` (`invite-staff` + existing M3a functions).
4. Hosted Vault / `run-jobs` URL setup (analogue of `pnpm db:setup-local`).
5. Vercel: set env + region `cle1`; deploy from Git after Next upgrade lands.
6. Smoke: open staging admin, sign in as bootstrap admin.

---

## 7. Playwright without a Google Maps key

- `@playwright/test` in `apps/admin/e2e`.
- Target: local Next + local Supabase + functions. **No** `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` in CI.
- M3b has no map UI; decision 11 fallback applies for later milestones.
- Test-user script (service role) creates admin / editor / writer (+ optional non-staff); credentials gitignored.
- Smoke: writer cannot open Staff; forced `publish` → 403.
- Wire into CI `db` job after integration tests.

---

## 8. M3a F1 follow-up — allowlist writer column guard

**Architect nit (post-M3a):** F1’s `fn_fragments_writer_column_guard` lists **blocked** columns. New columns added later would be writable by writers until the list is updated.

**Propose (implement in M3b, early commit after §1):** switch to an **allowlist**. For non-editor/admin/service callers, raise `42501` unless the only columns that differ from `OLD` are among:

- `indigeny_earth`
- `indigeny_world`
- `indigeny_body`
- `updated_at`

Any other difference (including future columns) is refused by default. Keep `characters.status` guard as-is (status-only deny for writers). Update `063_rls_story_notes.test.sql` accordingly.

---

## 9. Proposed implementation order (after plan approval)

1. **§1** Next/React/eslint-config-next upgrade + lockfile + Vercel `cle1` region config
2. **§8** F1 allowlist migration + pgTAP
3. `config.toml` password length 10; audit RLS tighten
4. `invite-staff` edge + `requireStaffAdmin`
5. Admin auth/session/shell/regions/staff/audit
6. README deploy docs + `.env.example` empty keys
7. Playwright + CI
8. JoJo: staging db push / functions deploy / SMTP / first admin bootstrap

---

## 10. Ambiguities / open questions

1. Confirm F1 **allowlist** rewrite in M3b (§8).
2. Audit RLS tighten to editor+admin in M3b?
3. Reactivate deactivated staff in M3b?
4. Role changes: RLS vs edge?
5. Google Workspace: **smtp-relay** vs dedicated mailbox?
6. First admin bootstrap on empty staging (one-time SQL by JoJo)?
7. Leaked-password protection available on Free?
8. `enable_confirmations` on/off for invites?
9. Vercel Preview ↔ shared staging DB OK?
10. Pin exact Next patch (`15.5.29` vs “latest 15.5.x at implement”)? Prefer latest 15.5.x at implement time ≥ 15.5.24.
11. Rebase this plan branch onto `master` immediately after PR #6 merges before any implementation commits.

---

## 11. Explicit non-goals

- No Next upgrade / auth / edge / Playwright **code** in this plan PR.
- No secret values in git or chat.
- No production Supabase project creation in M3b (region plan only).

---

**Stop for architect review.**
