# M3b hosted foundation — implementation report

**Branch:** `m3b-hosted-foundation` (PR #8)  
**Plan:** `docs/briefs/M3b-plan.md` · **Plan review:** `M3b-plan-review.md` · **Impl review (wins):** `M3b-review.md`  
**Status:** R1–R3 + N1–N3 applied; **stopped for architect verification**. M3c not started.  
**Date:** 2026-11-20

---

## 1. `git log --oneline` (vs `origin/master`)

```
fef9b9d fix(admin): M3b R1–R3 invite/confirm flow and review nits
2644147 docs: add M3b implementation review
f2425bd docs: confirm Vercel preview and CI on M3b report
41a5064 docs: add M3b implementation report
bcc1d22 feat(admin): M3b auth shell, regions, staff, audit, Playwright
f9b3b45 feat(db): M3b staff guards, F1 allowlist, invite-staff edge
44c352f fix(admin): upgrade Next.js to 15.5.29 for Vercel security gate
68cccea docs: add M3b plan review
5e89e1d docs: add M3b plan for review
```

**Since `41a5064`:** `f2425bd`, `2644147`, `fef9b9d` (+ this report amend).

---

## 2. Command results

| Command | Result |
|---|---|
| `pnpm db:setup-local` / `supabase db reset` | PASS (through `20261121120003_m3b_review_nits.sql` + seed) |
| `pnpm exec supabase test db` | **PASS** — Files=24, Tests=130 |
| `pnpm test:integration` | **PASS** — 16 tests |
| Playwright | **PASS** — **6** tests |
| Admin vitest (`sanitizeNext`) | **PASS** — 3 tests |
| `pnpm lint && pnpm typecheck && pnpm test` | **PASS** |
| `pnpm --filter @intell/admin build` | **PASS** (Next.js 15.5.29) |

### Playwright / unit tests named (review fixes)

| Test | File |
|---|---|
| invite email → set password → Home; reused link expires | `e2e/auth-email.spec.ts` |
| recovery email → set password → sign in with new password | `e2e/auth-email.spec.ts` |
| re-invite unconfirmed succeeds; confirmed address refused (409) | `e2e/auth-email.spec.ts` |
| open redirect `next` values ignored by confirm | `e2e/auth-email.spec.ts` |
| writer cannot open Staff; publish refused | `e2e/staff-gate.spec.ts` |
| admin Staff invite creates staff row | `e2e/staff-gate.spec.ts` |
| `sanitizeNext` rejects `//evil` / `https://evil` | `src/lib/auth-redirect.test.ts` |

---

## 3. Versions (review “Report back with”)

| Package | Installed |
|---|---|
| `next` | **15.5.29** |
| `eslint-config-next` | **15.5.29** |
| `react` / `react-dom` | **19.2.4** (also pinned via root `pnpm.overrides`) |

**Vercel preview (confirmed on `41a5064`):** Status `Deployment has completed` (success). Preview host seen in checks: `intell-admin-fxo70a2du-replaceplace.vercel.app` (also earlier branch-style `intell-admin-git-m3b-hosted-foundation-replaceplace.vercel.app`). Next 15.5.29 cleared the vulnerable-Next gate. `vercel.json` requests `"regions": ["cle1"]`; Hobby did not block the deploy — treat region as accepted unless JoJo sees a dashboard warning otherwise.

**CI on `41a5064`:** all 6 checks green (`check`, `db` ×2 workflow runs + Vercel).

---

## 4. pgTAP evidence (A1, F1 allowlist, audit)

File: `supabase/tests/064_m3b_staff_guards.test.sql` (11 cases; part of the 130 green suite).

- **A1 last-admin:** demoting/deactivating a non-last admin succeeds; demoting or deactivating the sole remaining active admin raises `42501`.
- **F1 allowlist:** writer may update Indigeny fields; teaser and status refused; a newly added `m3b_probe_col` is refused by default (allowlist).
- **Audit RLS:** writer and viewer see 0 rows; editor can select after a seeded row.

Definer allowlist updated for `fn_admin_upsert_region` in `110_definer_grants.test.sql`.

---

## 5. README deploy section (quoted)

From `apps/admin/README.md`:

### Deploy (staging)

#### 1. Supabase staging (JoJo)

1. `supabase login` then `supabase link --project-ref <staging-ref>` (ref from the dashboard; do not commit it).
2. `supabase db push` — apply migrations.
3. `supabase functions deploy` — deploy `invite-staff`, `publish`, `unpublish`, `build-pack`, `purge-assets`, `run-jobs`.
4. Hosted Vault / `run-jobs` URL setup (same idea as `pnpm db:setup-local`).
5. **Auth dashboard**
   - Disable sign-ups; anonymous sign-ins off; MFA off.
   - Minimum password length **10**.
   - Leaked-password protection, session timeouts and backups: **not on Free** — turn on when staging upgrades to Pro, before real content.
   - Site URL: production admin URL (`https://intell-admin.vercel.app`).
   - **Redirect URLs (A3):** production admin URL, `http://localhost:3000/**`, and the Vercel preview glob for this project (`https://intell-admin-*.vercel.app/**`, adjusted to the exact pattern Vercel shows for the team).
   - SMTP (provider-agnostic): either a dedicated sending mailbox (e.g. `no-reply@replaceplace.com`) on `smtp.gmail.com` port 465 with an app password, or the Workspace SMTP relay (`smtp-relay.gmail.com`). Configure values only in the dashboard.
6. **Bootstrap the first admin (A4)** — no service-key script:
   1. Supabase dashboard → **Authentication → Users → Invite user** (yourself).
   2. Accept the email and set a password (min 10).
   3. In the SQL editor, insert your staff row (replace the uuid):

   ```sql
   insert into public.staff (user_id, display_name, role, active)
   values ('<your-auth-user-uuid>', 'JoJo', 'admin', true);
   ```

   After that, every other invite goes through the admin **Staff** page (`invite-staff`).

#### 2. Vercel project `intell-admin`

1. Root directory: `apps/admin`. Framework: Next.js.
2. Function region: staging **`cle1`** (us-east-2, closest to Supabase us-east-2). Production later: **`pdx1`**. Configured in `vercel.json` as `"regions": ["cle1"]`. If Hobby refuses a custom region, leave the default and note it — not a blocker.
3. Set Preview + Production env vars from the table above (names only; values in the Vercel UI). **Never** add a service role key.
4. Deploy from Git after the Next.js 15.5.x security upgrade lands. Previews share the staging database.

#### 3. Smoke

Open the staging admin, sign in as the bootstrap admin, invite a second staff user, confirm they land in the shell (or "no access" if inactive).

---

## 6. What shipped (map to plan §9 + A1–A4)

1. **Next 15.5.29** + React 19.2.4 + eslint-config-next 15.5.29 + `vercel.json` `cle1` (first impl commit).
2. **F1 allowlist** rewrite + pgTAP (incl. new-column probe).
3. **`config.toml`** `minimum_password_length = 10`; audit select → editor+admin.
4. **`invite-staff`** invite / deactivate / **reactivate** (A2 ban/unban) + `requireStaffAdmin` / `fn_is_admin`.
5. **A1** `staff_preserve_last_admin` trigger + staff change audit trigger.
6. **Admin:** `@supabase/ssr` cookies, sign-in / sign-out / password reset + set-password, no-access gate, DESIGN §5 Ops sidebar (Regions, Audit, Staff), status badges, regions CRUD (lat/lng + optional GeoJSON bounds via `fn_admin_upsert_region`), staff management (RLS role/name updates; edge for invite/deactivate/reactivate), audit filters.
7. **README + `.env.example`** (A3 redirect globs, A4 bootstrap SQL, SMTP names-only, Pro caveats).
8. **Playwright** harness + `e2e:prepare` (gitignored creds) + CI `db` job step. No Maps key required.

---

## 7. Doc amendments

None to PRODUCT_SPEC / DATA_MODEL. Deploy docs live in `apps/admin/README.md` (linked from root README).

---

## 8. Deviations

| Item | Why |
|---|---|
| `fn_admin_upsert_region` helper | PostgREST cannot cast WKT/GeoJSON into `geography` cleanly from the admin; editor+ `SECURITY DEFINER` RPC with `has_role` guard (granted to `authenticated`, on the definer allowlist). |
| React **19.2.4** (not latest 19.3.x) | Dual React copies (admin vs workspace) broke Next build (`useContext` on `/404`); root `pnpm.overrides` + pin 19.2.4 keeps a single tree. |

---

## 9. Open questions / JoJo follow-ups

1. Staging dashboard: Auth redirect URLs (A3), paste email templates (R3), first-admin Create user + SQL (A4), `db push`, `functions deploy`. SMTP already done (2026-11-20).
2. Exact Vercel preview hostname glob from the dashboard (README keeps `https://intell-admin-*.vercel.app/**` as expected form).
3. Optional: confirm Functions region `cle1` in the Vercel UI.

---

## 10. Review fixes (vs `M3b-review.md`)

### Commits since `41a5064`

```
4cc50ea docs: fix M3b report section numbering
17576b9 docs: M3b report Review fixes for R1–R3
fef9b9d fix(admin): M3b R1–R3 invite/confirm flow and review nits
2644147 docs: add M3b implementation review
f2425bd docs: confirm Vercel preview and CI on M3b report
```
(+ this CI confirm commit).


### Required

- **R1:** `/auth/confirm` verifies `token_hash` + `type` ∈ {invite,recovery}; templates `supabase/templates/invite.html` + `recovery.html` wired in `config.toml`; forgot-password uses `redirectTo: origin`; deleted `/auth/callback`; set-password shows “Link required” without session; re-invite unconfirmed + 409 for confirmed; Mailpit Playwright for invite, recovery, expired link.
- **R2:** `sanitizeNext` — only paths starting with `/` that are not `//` or `/\`; unit + Playwright open-redirect coverage.
- **R3:** README A4 is Create user + Auto Confirm (no email); Auth dashboard step to paste templates; SMTP names-only.

### README diff for R3 (summary)

- A4: Add user → Create new user → password ≥10 + Auto Confirm → SQL insert.
- New Auth step: paste invite/recovery templates into dashboard Emails.
- Site URL note: preview invites land on production admin (shared staging DB).
- SMTP remains provider-agnostic, no values.

### Nits

| Nit | Status |
|---|---|
| N1 last-admin `FOR UPDATE` | **Fixed** (`20261121120003_m3b_review_nits.sql`) |
| N2 skip `service_role` staff audit | **Fixed** (same migration) |
| N3 Active / Inactive labels | **Fixed** (staff list) |

### CI / Vercel

Local suite green after fixes. PR #8 head `4cc50ea`: GitHub CI **6/6 green**; Vercel preview **Deployment has completed** (success). `cle1` not blocked by Hobby.

---

## 11. Explicit non-goals (held)

- M3c not started.
- No secret values written or requested.

**Stop for architect verification. Do not start M3c.**
