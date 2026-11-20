# InTell Admin

Next.js App Router staff tools for Replaceplace. M3b: auth, shell, regions, staff, audit. Grove / Maps authoring arrives in M3c.

## Local development

```bash
# from repo root
pnpm install
pnpm exec supabase start
pnpm db:setup-local
pnpm exec supabase functions serve &

# copy apps/admin/.env.example → apps/admin/.env.local and fill local URL + anon key
# (from `pnpm exec supabase status`)
pnpm --filter @intell/admin dev
```

Open http://localhost:3000. Never put the service role key in admin env files.

## Environment (names only)

See `apps/admin/.env.example` and the root `.env.example`. Required for the admin:

| Name | Notes |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Staging or local API URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anon key (RLS). Never the service role |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Optional until M3c; empty-safe. Restricted to `https://intell-admin.replaceplace.com/*` and `http://localhost:3000/*`, so maps won't load on preview URLs |
| `NEXT_PUBLIC_GOOGLE_MAP_ID` | Optional until M3c; empty-safe |
| `NEXT_PUBLIC_LINK_DOMAIN` | Marker QR host (M3c) |
| `SENTRY_DSN` | Optional; empty-safe |

## Deploy (staging)

### 1. Supabase staging (JoJo)

1. `supabase login` then `supabase link --project-ref <staging-ref>` (ref from the dashboard; do not commit it).
2. `supabase db push` — apply migrations.
3. `supabase functions deploy` — deploy `invite-staff`, `publish`, `unpublish`, `build-pack`, `purge-assets`, `run-jobs`.
4. Hosted Vault / `run-jobs` URL setup (same idea as `pnpm db:setup-local`).
5. **Auth dashboard**
   - Disable sign-ups; anonymous sign-ins off; MFA off.
   - Minimum password length **10**.
   - Leaked-password protection, session timeouts and backups: **not on Free** — turn on when staging upgrades to Pro, before real content.
   - Site URL: `https://intell-admin.replaceplace.com` (custom domain on the `intell-admin` Vercel project; `intell-admin.vercel.app` belongs to someone else). Invites and resets use Site URL, so invite links from a preview still land on production admin; that is expected while previews share the staging database.
   - **Redirect URLs (A3):** `https://intell-admin.replaceplace.com/**`, `http://localhost:3000/**`, and `https://intell-admin-*-replaceplace.vercel.app/**`. Supabase's `*` stops only at `.` and `/`, so that one glob covers both hash-style and branch-style preview hosts.
   - **Email templates:** paste `supabase/templates/invite.html` and `supabase/templates/recovery.html` into **Authentication → Emails → Templates** (**Invite user** and **Reset password**). Subjects: "You're invited to InTell" and "Reset your InTell password". Local/CI already wire these via `supabase/config.toml`.
   - **SMTP:** provider-agnostic. Use either a dedicated sending mailbox on `smtp.gmail.com` port 465 with an app password, or the Workspace SMTP relay (`smtp-relay.gmail.com`). Configure values only in the dashboard (no values in the repo).
6. **Bootstrap the first admin (A4)** — no email and no service-key script:
   1. Supabase dashboard → **Authentication → Users → Add user → Create new user**.
   2. Enter the email and a password of at least 10 characters, and tick **Auto Confirm User**.
   3. In the SQL editor, insert your staff row (replace the uuid):

   ```sql
   insert into public.staff (user_id, display_name, role, active)
   values ('<your-auth-user-uuid>', 'JoJo', 'admin', true);
   ```

   After that, every other invite goes through the admin **Staff** page (`invite-staff`).

### 2. Vercel project `intell-admin`

1. Root directory: `apps/admin`. Framework: Next.js.
2. Production domain: **`intell-admin.replaceplace.com`**, added under **Domains** and connected to Production. DNS: a CNAME `intell-admin` in Squarespace pointing to the value Vercel shows. The default `intell-admin-ashy.vercel.app` keeps working.
3. Function region: staging **`cle1`** (us-east-2, closest to Supabase us-east-2). Production later: **`pdx1`**. Configured in `vercel.json` as `"regions": ["cle1"]`. If Hobby refuses a custom region, leave the default and note it — not a blocker.
4. Set Preview + Production env vars from the table above (names only; values in the Vercel UI). **Never** add a service role key.
5. Deploy from Git after the Next.js 15.5.x security upgrade lands. Previews share the staging database.

### 3. Smoke

Open the staging admin, sign in as the bootstrap admin, invite a second staff user, confirm they land in the shell (or "no access" if inactive).

## Playwright

```bash
# with local Supabase + functions serve running
pnpm --filter @intell/admin e2e:prepare   # creates gitignored test users
pnpm --filter @intell/admin test:e2e
```

Credentials are written to `apps/admin/e2e/.auth-users.json` (gitignored). No Google Maps key is required for M3b. Invite and recovery flows read messages from local Mailpit.
