# M3b hosted foundation — implementation report

**Branch:** `m3b-hosted-foundation` (PR #8)  
**Plan:** `docs/briefs/M3b-plan.md` · **Review (wins on conflict):** `docs/briefs/M3b-plan-review.md`  
**Status:** Implementation complete; **stopped for architect review**. M3c not started.  
**Date:** 2026-11-20

---

## 1. `git log --oneline` (vs `origin/master`)

```
bcc1d22 feat(admin): M3b auth shell, regions, staff, audit, Playwright
f9b3b45 feat(db): M3b staff guards, F1 allowlist, invite-staff edge
44c352f fix(admin): upgrade Next.js to 15.5.29 for Vercel security gate
68cccea docs: add M3b plan review
5e89e1d docs: add M3b plan for review
```

Rebased onto `origin/master` after PR #6 merge (`f40bb59`). Confirmed ancestors: `e39fef0` (F1/F2), `c7c8998` (M3a review).

---

## 2. Command results

| Command | Result |
|---|---|
| `pnpm db:setup-local` / `supabase db reset` | PASS (all migrations through `20261121120002_m3b_admin_region_rpc.sql` + seed) |
| `pnpm exec supabase test db` | **PASS** — Files=24, Tests=130 |
| `pnpm test:integration` | **PASS** — 16 tests |
| Playwright (`pnpm --filter @intell/admin test:e2e`) | **PASS** — 2 tests (writer staff/publish gate; admin invite → staff row) |
| `pnpm lint && pnpm typecheck && pnpm test` | **PASS** |
| `pnpm --filter @intell/admin build` | **PASS** (Next.js 15.5.29) |

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
| Staff active badge reuses `StatusBadge` labels `published`/`retired` | Temporary visual; no product copy claim. |

---

## 9. Open questions / JoJo follow-ups (not blockers for review)

1. Staging dashboard: Auth redirect URLs (A3), SMTP, first-admin SQL (A4), `supabase db push` + `functions deploy`.
2. A3 redirect glob: previews use both `intell-admin-git-m3b-hosted-foundation-replaceplace.vercel.app` and `intell-admin-*-replaceplace.vercel.app` — adjust Supabase Redirect URLs to the team’s exact pattern (likely `https://intell-admin-*-replaceplace.vercel.app/**` rather than `https://intell-admin-*.vercel.app/**`).
3. Optional: confirm in the Vercel project UI that Functions region is `cle1` (deploy succeeded with `vercel.json` set).

---

## 10. Explicit non-goals (held)

- M3c (Maps, media library, Grove editor) not started.
- No secret values written or requested.
- Production Supabase project not created.
- Sentry / Maps keys remain empty-safe.

**Stop for architect review of this report. Do not start M3c.**
