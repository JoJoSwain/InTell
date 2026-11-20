# M3b hosted foundation: architect review of the implementation

**Reviewed:** `docs/briefs/M3b-report.md` and the branch `m3b-hosted-foundation` at `41a5064` (PR #8), against `M3b-plan.md` and `M3b-plan-review.md`
**Verdict:** **Changes requested: two required fixes (R1, R2) and one README correction (R3).** Fix on PR #8, then stop for verification. Do not start M3c.
**Reviewer:** architect (Claude), 2026-11-20

This is solid work. The F1 allowlist, the A1 last-admin trigger, the audit tightening, the `invite-staff` gate (verified JWT plus `fn_is_admin`), ban and unban, the definer allowlist update and the names-only env handling are all right. The one real gap is the path a new writer takes from their invite email to their first sign-in. That path isn't wired, and no test exercises it.

---

## Required

### R1. Invite and password-reset links must land on a server route that sets the session

**Problem.** `invite-staff` calls `inviteUserByEmail` with Supabase's default invite template. That template links to Supabase's `/auth/v1/verify`, which then redirects to the Site URL with the session in the URL **fragment** (`#access_token=…&type=invite`). The admin has no handler for that:

- `/auth/callback` only handles a PKCE `?code=`, and a server route can't read a fragment anyway.
- The browser client from `@supabase/ssr` is PKCE-only.
- Even if a session were picked up, nothing sends the new writer to `/auth/set-password`, so they would have no password.

The Playwright invite test only checks that a `staff` row appears. Nobody follows the email. Password reset works today only when the link is opened in the same browser that requested it, because the PKCE code verifier lives in that browser's cookie.

**Fix:** use Supabase's token-hash pattern for SSR.

1. **New route `apps/admin/src/app/auth/confirm/route.ts`** (GET):
   - Read `token_hash`, `type` and `next`.
   - Accept only `type` ∈ {`invite`, `recovery`}.
   - Sanitize `next` per R2; the default is `/auth/set-password`.
   - Call `supabase.auth.verifyOtp({ type, token_hash })` with the server client so the session cookies are set, then redirect to `next`.
   - On failure, redirect to `/sign-in?error=link`. The sign-in page then shows: "That link has expired or was already used. Ask an admin to resend your invite, or use Forgot password."
2. **Email templates committed to the repo**, with plain, short, brand-neutral copy (Ashley styles them later):
   - `supabase/templates/invite.html`
     - Subject: "You're invited to InTell"
     - Link: `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite&next=/auth/set-password`
   - `supabase/templates/recovery.html`
     - Subject: "Reset your InTell password"
     - Link: `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/auth/set-password`
   - Wire both in `supabase/config.toml` (`[auth.email.template.invite]`, `[auth.email.template.recovery]`) so local and CI use them.
3. **Forgot password:** `resetPasswordForEmail` no longer needs `/auth/callback` (the template sets the link). Pass `redirectTo: window.location.origin` or omit it. Reset links then work from any device.
4. **`/auth/callback`:** delete it if nothing uses it after this change. If something does, apply R2 to it.
5. **`/auth/set-password` with no session:** show "This page needs a valid invite or reset link" with a link to sign in, instead of failing on `updateUser`.
6. **Re-invite:** inviting an address that hasn't accepted yet should resend the invite. Supabase allows this for unconfirmed users, and the `staff` upsert already handles the existing row. Inviting an address that has already confirmed must return a clear error that the Staff page shows. Prove both cases in a test.
7. **Playwright, following the real email from local Mailpit:**
   - **Invite:** admin invites a new address → fetch the message from the local mail catcher → open the link → land on Set password → save → land on Home in the shell.
   - **Recovery:** request a reset from the sign-in page → open the emailed link → set a new password → sign out → sign in with the new password.
   - **Expired link:** opening a used link a second time lands on sign-in with the R1.1 message.

### R2. No open redirect through `next`

Today `/auth/callback` does `new URL(next, origin)`. With `next=https://evil.example`, that resolves to the outside site. Accept `next` only when it starts with `/` and does not start with `//` or `/\`; otherwise use the default. Apply this to `/auth/confirm` (and to `/auth/callback` if it survives R1.4). Add a test for `next=//evil.example` and `next=https://evil.example`.

### R3. README: bootstrap without email, and the hosted template step

1. **A4 bootstrap.** Replace the "Invite user" step with:
   1. **Authentication → Users → Add user → Create new user.**
   2. Enter the email and a password of at least 10 characters, and tick **Auto Confirm User**.
   3. Run the SQL insert.

   This way the first admin doesn't depend on email working at all.
2. **New step under "Auth dashboard":** paste `supabase/templates/invite.html` and `recovery.html` into **Authentication → Emails → Templates** (**Invite user** and **Reset password**), with the subjects above. Note that the links use the Site URL, so Site URL must be the production admin URL. Invites sent from a preview deployment land on the production admin. That's expected because previews share the staging database.
3. **SMTP line.** Staging is now configured: custom SMTP is on, through a Workspace mailbox on `smtp.gmail.com:465` with an app password, done by JoJo on 2026-11-20. Keep the README provider-agnostic, with no values.

---

## Nits (fix if cheap; otherwise list them as follow-ups in the report)

- **N1. A1 race.** Two admins demoting each other at the same moment could both pass the count. Before counting, add `perform 1 from public.staff where role = 'admin' and active for update;` in `fn_staff_preserve_last_admin` so those updates run one after the other.
- **N2. Duplicate audit rows.** On deactivate and reactivate, the trigger writes `staff.update` with a null actor, because the service role has no `auth.uid()`, and `invite-staff` writes its own row with the real actor. Have `fn_staff_audit_changes` skip when `auth.role() = 'service_role'`. Edits made in the SQL editor are still audited.
- **N3. Staff badge labels.** Use **Active** / **Inactive** instead of reusing `published` / `retired`.

## Deviations (accepted)

- **`fn_admin_upsert_region`:** accepted. It is editor+ guarded, uses an empty `search_path` and is on the definer allowlist.
- **React 19.2.4** pinned through root `pnpm.overrides` to keep a single React tree: accepted. Revisit when Next supports the newer React cleanly.

## Answers to report §9

1. **Vercel region on Hobby:** JoJo confirms from the PR #8 deploy. Either outcome is fine.
2. **Staging dashboard:** in progress with JoJo. SMTP was done on 2026-11-20. Redirect URLs, templates (R3), `db push`, `functions deploy` and the bootstrap follow after this fix lands.
3. **Preview hostname glob:** JoJo will read the exact pattern from the Vercel dashboard. Keep `https://intell-admin-*.vercel.app/**` in the README as the expected form.

## Report back with

- New commits on PR #8 (`git log --oneline` since `41a5064`)
- pgTAP, integration and Playwright counts, with the new invite, recovery, expired-link and open-redirect tests named
- The README diff for R3
- PR #8 CI and Vercel preview status, and whether `cle1` was accepted
- Which nits were fixed and which were deferred

**Then stop for verification. Do not start M3c.**
