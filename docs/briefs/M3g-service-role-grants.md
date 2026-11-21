# M3g brief: explicit `service_role` grants (Supabase secure-by-default)

**Branch:** `m3g-service-role-grants` (already created locally from `26a60de`, with this brief committed). **Implement directly**, open a PR, then stop for architect review. Small and urgent: it blocks the staging go-live.

## What happened

On hosted staging, after `db push` and `functions deploy`, every `run-jobs` call returns **500 `permission denied for table jobs`**. The secret key is accepted, so M3f works. The failure comes after that: the service client has no privileges on the tables.

**Cause.** Supabase projects created since May 30, 2026 no longer grant `anon`, `authenticated` and `service_role` default privileges on new objects in `public`. Staging is such a project. Our migrations already grant `anon` and `authenticated` explicitly, because M2a revoked postgres's defaults for them. But `service_role` has **no explicit table grants anywhere**: it relied on the old default privileges. Locally, `supabase/config.toml` leaves `[api] auto_expose_new_tables` unset, and the CLI falls back to `true`, the old behaviour. So local and CI passed while hosted fails.

The same gap affects every edge function that uses `serviceClient()`. For example, `invite-staff` would fail on `staff`. It may also affect `.rpc()` calls to functions without an explicit `service_role` grant. There are 77 explicit grants today, but not necessarily for every function the functions call.

## Decisions

1. **New migration** `20261121200001_m3g_service_role_grants.sql`:
   ```sql
   grant usage on schema public to service_role;
   grant select, insert, update, delete on all tables in schema public to service_role;
   grant usage, select on all sequences in schema public to service_role;
   grant execute on all functions in schema public to service_role;

   alter default privileges for role postgres in schema public
     grant select, insert, update, delete on tables to service_role;
   alter default privileges for role postgres in schema public
     grant usage, select on sequences to service_role;
   alter default privileges for role postgres in schema public
     grant execute on functions to service_role;
   ```
   This restores, explicitly, exactly what `service_role` had locally. `service_role` already bypasses RLS and is server-only. **No grants change for `anon` or `authenticated`.**
2. **Make local and CI match hosted:** set `auto_expose_new_tables = false` under `[api]` in `supabase/config.toml`, with a comment pointing at this brief. Run the full suite after that change. Anything else that silently relied on auto-exposure will fail here. Fix any such failure with an explicit grant in this migration, and list it in the report.
3. **pgTAP guard** (new test file): `service_role` has SELECT, INSERT, UPDATE and DELETE on every table and view in `public`, and EXECUTE on every function in `public`. Assert also that `anon` and `authenticated` grants are unchanged, so `110_definer_grants` still passes as-is.
4. **Docs:**
   - **AGENTS.md and TECH_SPEC §6:** add one rule. *Supabase no longer auto-grants new `public` objects to API roles. Every migration grants what each role needs explicitly. `service_role` is covered by the default privileges from M3g. Local config sets `auto_expose_new_tables = false` to match hosted.*
   - **`apps/admin/README.md` staging runbook:** with CLI 3.x, `db push` targets the local stack unless you pass `--remote`. Write `pnpm exec supabase db push --remote` (and `--remote --dry-run` as an optional preview). Say that `functions deploy` prints a `Target:` line, which must name the staging project.

## Not in scope
M3e F1/F2, M3f K1–K3, M4, M5.

## Acceptance
- [ ] The full local suite is green **with `auto_expose_new_tables = false`**: db reset, pgTAP, integration (including the M3f cron → pg_net → run-jobs case), Playwright, and lint/typecheck/test/build.
- [ ] The new pgTAP guard passes, and `110_definer_grants` is unchanged and passing.
- [ ] CI and Vercel are green.

## Report back with
`git log --oneline`; the suite results; the migration, quoted; any extra grants the config flip exposed; the doc changes, quoted. Write it to `docs/briefs/M3g-report.md`. **Then stop for architect review.** JoJo will run `db push --remote` after the merge; you don't.
