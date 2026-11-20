# M3b hosted foundation: architect review of the plan

**Plan reviewed:** `docs/briefs/M3b-plan.md` (`89fd6c1`, PR #8)
**Verdict:** **APPROVED with the answers and additions below.** Implement M3b once PR #6 (M3a) is merged and this branch is rebased onto `master`. Where this review conflicts with the plan or the brief, this review wins.
**Reviewer:** architect (Claude), 2026-11-20

A clear, well-scoped plan. The Next.js upgrade as the first commit, the region choice, the names-only hosting tables and the deploy sequence are right.

---

## Additions (required)

### A1. Never lock out the last admin
`staff` changes (role, active) must never leave zero active admins. Add a trigger on `staff` that raises when an update or delete would leave no active `admin`. Self-deactivation is refused in `invite-staff` (as planned). pgTAP: demoting or deactivating the last admin fails; doing it with a second admin present succeeds.

### A2. Deactivation takes effect immediately
`has_role()` already requires `active`, so database access stops at once. In addition, `deactivate` bans the Auth user (`auth.admin.updateUserById(…, { ban_duration: … })`) so they can't sign in again, and `reactivate` lifts the ban. Both are audited.

### A3. Auth redirect URLs cover Vercel previews
Supabase Auth must accept the invite and password-reset callbacks on preview deployments too: add the production admin URL, `http://localhost:3000/**`, and a glob for this project's preview URLs (`https://intell-admin-*.vercel.app/**`, adjusted to the exact pattern Vercel uses for the team) to the staging project's Redirect URLs. Document it in the README's deploy section.

### A4. Bootstrap the first admin without the admin app
On an empty staging project, JoJo invites himself from the Supabase dashboard (**Authentication → Users → Invite user**), sets a password from the email, then runs one documented SQL statement in the SQL editor to insert his `staff` row as `admin`. After that, every other invite goes through the admin. Put the exact steps in the README; no script needs the service key for this.

---

## Answers to §10

| # | Decision |
|---|---|
| 1 | **Yes**: rewrite the F1 guard as an allowlist (only `indigeny_earth`, `indigeny_world`, `indigeny_body`, `updated_at` may differ for non-editors), with pgTAP proving a newly added column is protected by default. |
| 2 | **Yes**: tighten `audit_log` select to editor and admin, with a pgTAP case for writer and viewer refusal. |
| 3 | **Yes**: `invite-staff` gains `reactivate` (admin only, audited, lifts the ban per A2). |
| 4 | **RLS, not edge**: admins update `staff.role` and `display_name` directly under an admin-only policy; an audit trigger records every change; A1 protects the last admin. Only invite, deactivate and reactivate need the service role, so only those live in `invite-staff`. |
| 5 | **Provider-agnostic**: the code doesn't care. JoJo chooses in the Supabase dashboard. The expected setup is a dedicated sending mailbox (e.g. `no-reply@replaceplace.com`) on `smtp.gmail.com`, port 465, with an app password; the Workspace SMTP relay also works. The README documents both without values. |
| 6 | See A4. |
| 7 | **Not on Free.** Leaked-password protection, session timeouts and backups need Supabase Pro. Document "turn these on when staging upgrades to Pro, before real content." Minimum length 10 applies now. |
| 8 | Leave Supabase's default. Sign-ups are disabled, and accepting an invite confirms the address. |
| 9 | **Yes**, previews share the staging database. It's staging. Note that the Maps web key won't load on preview URLs (its website restriction lists only the production URL and localhost); that's fine because M3b has no map. |
| 10 | Take the **latest 15.5.x at implement time (≥ 15.5.24)**, and record the exact version in the report. |
| 11 | **Yes**: rebase onto `master` immediately after PR #6 merges, before any implementation commit. |

## Notes
- **Function region:** `cle1` for staging and `pdx1` later for production are correct. If the Hobby plan doesn't allow setting the region, report it and leave the default; it isn't a blocker.
- **Google Maps (status from JoJo, 2026-11-20):** the three keys and three Map IDs now exist in Google Cloud project `InTell` (admin web key restricted to `https://intell-admin.vercel.app/*` and `http://localhost:3000/*`; Android and iOS keys restricted to `org.replaceplace.intell`). M3b still needs none of them. Keep `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` and `NEXT_PUBLIC_GOOGLE_MAP_ID` empty-safe.
- **Sentry** isn't set up yet. Keep `SENTRY_DSN` optional and empty-safe.

## Unchanged from the plan (approved as written)
§0–§9 and §11, with A1–A4 added to the implementation order: A1 with the F1 allowlist migration (step 2), A2 and the reactivate action in `invite-staff` (step 4), A3 and A4 in the README deploy docs (step 6).

## Report back with (in addition to the brief's list)
- The exact Next.js, React and eslint-config-next versions installed, and whether the Vercel preview for the PR now builds and deploys
- pgTAP evidence for A1, the F1 allowlist and the audit tightening
- The README deploy section, quoted
- Whether the function region could be set on Hobby
