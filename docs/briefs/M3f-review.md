# M3f review: Supabase publishable/secret API keys

**PR:** #15 · **Tips reviewed:** `992b097` (code), `5d6e0f4` (report) · **Brief:** `docs/briefs/M3f-api-keys.md`

## Verdict

**Approved.** Merge once CI and Vercel are green on the head that includes this review. Nothing below blocks the merge.

## What I checked

- **`_shared/keys.ts`:** `secretKeys()`, `serviceKey()` (`default`, then legacy), `publishableKey()`, and the redacting `safeLog`.
- **`requireServiceCaller`:** reads `apikey` first, then the bearer token. Each comparison is constant-time. It returns 401 when there's no credential and 403 for a wrong key. A publishable key is refused explicitly. A user or anon JWT is refused because it isn't in the secret-key list.
- **`publish`:** a secret key takes the service path. Any other caller needs a bearer token verified with `auth.getUser()` plus `fn_is_editor_or_admin`. The service client is created only after the caller passes.
- **`verify_jwt`:** the shipped table matches the brief: `false` for `run-jobs`, `build-pack`, `purge-assets` and `publish`; `true` for `invite-staff`, `unpublish` and `preview`.
- **The `fn_call_run_jobs` migration:** it sends the Vault key as `apikey`, and the grants are unchanged.
- **`run-jobs` `invoke()`:** it uses `serviceKey()`.
- **The new-key path is really exercised, not just the legacy fallback.** CI on `992b097` shows the CLI (3.2.0) issuing `sb_publishable_…` and `sb_secret_…` keys locally. These pass with that `sb_secret_` key:
  - the secret key in `apikey` → 200, plus every refusal case
  - both `publish` paths
  - cron → pg_net → `run-jobs`
- **Docs:** TECH_SPEC §6 and §7, AGENTS.md, and both `.env.example` files.

**Proven only on staging:** that the hosted `SUPABASE_SECRET_KEYS` includes the separately named `run-jobs` key. The runbook's smoke test (step 6) is that proof.

## Architect edit in this commit

`apps/admin/README.md`, staging runbook:
- Vault secrets go in through the dashboard's **Vault** screen. The SQL editor keeps query history, so a key typed there stays stored with it.
- The steps follow the order staging is actually being set up.
- `db push` notes that staging starts without seed content, and that cron begins calling `run-jobs` right away.
- The smoke test now checks `net._http_response` and explains what 401, 403 and 404 mean.
- The first-admin SQL looks the user up by email, so no uuid needs copying.

## Follow-ups (with M4)

- **K1. Stop sending the secret key as a bearer token.** Supabase's guidance is to send API keys only in `apikey`, because they aren't JWTs. No deployed caller needs the transition bearer, since staging goes live on this code. Remove it from the senders:
  - `run-jobs` `invoke()`
  - `fn_call_run_jobs` (a new migration)
  - the CI wait `curl`
  - the integration helper

  Drop the receivers' bearer fallback at the same time.
- **K2.** In `keys.ts`, also read `SUPABASE_SECRET_KEY` and `SUPABASE_PUBLISHABLE_KEY` (singular). Supabase documents these as the local single-key fallback. CI shows the plural variables present today, so this is insurance.
- **K3. Remove the legacy fallbacks.** That means the admin's `NEXT_PUBLIC_SUPABASE_ANON_KEY`, the legacy entries in `keys.ts`, and the tools' `SERVICE_ROLE_KEY`/`ANON_KEY` fallbacks. This answers report Q2. Disable the legacy keys on staging only **after** K3 lands. `requireServiceCaller` compares the legacy service-role key as a plain string, so a legacy key disabled in the dashboard would still pass it for as long as the platform keeps injecting `SUPABASE_SERVICE_ROLE_KEY`.

## Report questions

1. **Hosted runbook:** JoJo is running it now with the architect, after this merges.
2. **ANON fallback:** see K3 (M4).
3. **Mobile:** M5 reads `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` when the app gets its Supabase client.

**Next after merge:** the hosted staging runbook (JoJo), then M3e F1, the textarea "save twice" sweep, before writers enter real content.
