# InTell Admin

Next.js App Router staff tools for Replaceplace. M3b: auth, shell, regions, staff, audit. M3c: Story (groves, characters, Story Notes) and Media (audio, images) authoring, physical marker print, Maps + Terra Draw when configured.

**Browser support for loudness analysis:** current Chrome and Edge. Other browsers may fail soft on decode (upload still works with a LOUDNESS warning).

## Local development

```bash
# from repo root
pnpm install
pnpm exec supabase start
pnpm db:setup-local
# Optional for a second edge process: create supabase/.env.local with
# SUPABASE_URL / ANON / SERVICE_ROLE from `pnpm exec supabase status -o env`
# (gitignored). After db reset, if edge is unhealthy: stop then start again.
# CI starts `functions serve` in parallel; local often uses the built-in edge runtime.
pnpm exec supabase functions serve --env-file supabase/.env.local &

# copy apps/admin/.env.example → apps/admin/.env.local and fill local URL + anon key
# (from `pnpm exec supabase status`)
pnpm --filter @intell/admin dev
```

Open http://localhost:3000. Never put the service role key in admin env files.
Deploy edge includes `preview` (staff JWT; 1-hour signed URLs).

## Environment (names only)

See `apps/admin/.env.example` and the root `.env.example`. Required for the admin:

| Name | Notes |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Staging or local API URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable key (RLS). Never a secret / service role key |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Optional; empty-safe. Map mounts only when both key and Map ID are set. Restricted to `https://intell-admin.replaceplace.com/*` and `http://localhost:3000/*`, so maps won't load on preview URLs |
| `NEXT_PUBLIC_GOOGLE_MAP_ID` | Required with the API key for the grove map; empty-safe falls back to GeoJSON / lat-lng |
| `NEXT_PUBLIC_LINK_DOMAIN` | Marker QR host (listener domain, default `intell.replaceplace.com`) |
| `SENTRY_DSN` | Optional; empty-safe |

## Deploy (staging)

### 1. Supabase staging (JoJo)

The hosted staging project uses Supabase's **new API keys** (publishable `sb_publishable_…` and secret `sb_secret_…`). There are **no function secrets to set for M3f** — `SUPABASE_*` keys are injected automatically. `GOOGLE_ROUTES_API_KEY` comes in M5.

1. In the dashboard, under **Settings → API Keys**, create a **dedicated secret key named `run-jobs`** (or `run_jobs` if the form refuses the hyphen), used only by the cron/Vault path, so it can be rotated on its own. `requireServiceCaller` accepts any key in `SUPABASE_SECRET_KEYS`. Store it in the password manager only.
2. Create the two Vault secrets in the dashboard under **Integrations → Vault → Secrets**, not in the SQL editor: the SQL editor keeps query history, so a key typed there stays stored with it. Migrations only read these secrets, so they can be created before or after `db push`.
   - `run_jobs_url`: the Project URL with `/functions/v1/run-jobs` appended (`https://<ref>.supabase.co/functions/v1/run-jobs`, no trailing slash)
   - `run_jobs_service_key`: the `run-jobs` secret key from step 1
3. `pnpm exec supabase login`, then `pnpm exec supabase link --project-ref <ref>` (ref from the dashboard; do not commit it). If `link` asks for the database password, press Enter to skip.
4. `pnpm exec supabase db push` **from master**. This applies migrations only: `seed.sql` is local-only, so staging starts with no demo content. Run step 5 right after, because pg_cron starts calling `run-jobs` every minute once the migrations land.
5. `pnpm exec supabase functions deploy`, which applies the per-function `verify_jwt` from `config.toml`.
6. Smoke test in the SQL editor:

   ```sql
   select public.fn_call_run_jobs();
   -- wait a few seconds, then:
   select status_code, error_msg, created
   from net._http_response
   order by id desc
   limit 3;
   ```

   Expect `200`. A `401`/`403` means `run_jobs_service_key` isn't a current secret key (if the key was created after the last deploy, run `functions deploy` again). A `404` means the functions aren't deployed or `run_jobs_url` is wrong. Also check that no rows in `public.jobs` are stuck in a failed state.
7. **Auth dashboard**
   - Disable sign-ups; anonymous sign-ins off; MFA off.
   - Minimum password length **10**.
   - Leaked-password protection, session timeouts and backups: **not on Free** — turn on when staging upgrades to Pro, before real content.
   - Site URL: `https://intell-admin.replaceplace.com` (custom domain on the `intell-admin` Vercel project; `intell-admin.vercel.app` belongs to someone else). Invites and resets use Site URL, so invite links from a preview still land on production admin; that is expected while previews share the staging database.
   - **Redirect URLs (A3):** `https://intell-admin.replaceplace.com/**`, `http://localhost:3000/**`, and `https://intell-admin-*-replaceplace.vercel.app/**`. Supabase's `*` stops only at `.` and `/`, so that one glob covers both hash-style and branch-style preview hosts.
   - **Email templates:** paste `supabase/templates/invite.html` and `supabase/templates/recovery.html` into **Authentication → Emails → Templates** (**Invite user** and **Reset password**). Subjects: "You're invited to InTell" and "Reset your InTell password". Local/CI already wire these via `supabase/config.toml`.
   - **SMTP:** provider-agnostic. Use either a dedicated sending mailbox on `smtp.gmail.com` port 465 with an app password, or the Workspace SMTP relay (`smtp-relay.gmail.com`). Configure values only in the dashboard (no values in the repo).
8. **Bootstrap the first admin (A4)** — no email and no service-key script:
   1. Supabase dashboard → **Authentication → Users → Add user → Create new user**.
   2. Enter the email and a password of at least 10 characters, and tick **Auto Confirm User**.
   3. In the SQL editor, insert your staff row, looked up by email so no uuid needs copying:

   ```sql
   insert into public.staff (user_id, display_name, role, active)
   select id, 'JoJo', 'admin', true
   from auth.users
   where email = '<your-admin-email>';

   -- check: one row, role admin, active true
   select u.email, s.display_name, s.role, s.active
   from public.staff s
   join auth.users u on u.id = s.user_id;
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
# On Windows, export NEXT_PUBLIC_SUPABASE_* from `pnpm exec supabase status -o env`
# (map PUBLISHABLE_KEY or ANON_KEY → NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) before
# test:e2e. Playwright's webServer.env only passes through variables that are
# actually set, so it will not override apps/admin/.env.local with empty
# publishable/url values (M3e A17).
pnpm --filter @intell/admin test:e2e
```

Credentials are written to `apps/admin/e2e/.auth-users.json` (gitignored). No Google Maps key is required for M3b. Invite and recovery flows read messages from local Mailpit.
