# M3g review: explicit `service_role` grants

**PR:** #16 · **Tip reviewed:** `0b463ab` · **Brief:** `docs/briefs/M3g-service-role-grants.md`

## Verdict

**Approved.** Merge once CI and Vercel are green on the head that includes the report and this review.

## Checked

- **The migration matches the brief exactly.** It covers table, sequence and function grants plus postgres's default privileges, all for `service_role` only. `anon` and `authenticated` are untouched.
- **Local now behaves like hosted.** `config.toml` sets `auto_expose_new_tables = false`, and the local suite passes with it, so CI runs under the same default privileges as hosted staging. Without this migration, the new guard would fail locally, which is the regression net the brief asked for.
- **`111_m3g_service_role_grants`:**
  - `service_role` has SIDU (select, insert, update, delete) on every table, view and materialized view in `public`, and EXECUTE on every function.
  - `anon` still has no table SELECT.
  - `authenticated` doesn't get blanket EXECUTE.
  - `110_definer_grants` is unchanged.
- **Docs:**
  - AGENTS.md and TECH_SPEC §6 carry the explicit-grants rule.
  - The README runbook uses `db push --remote` and tells you to check the `Target:` line on `functions deploy`.

## Hosted follow-through (JoJo, after merge)

1. `git checkout master` then `git pull`.
2. `pnpm exec supabase db push --remote`. One migration: `20261121200001_m3g_service_role_grants.sql`. No function redeploy is needed, because no function code changed.
3. Smoke test: after a minute, the newest `net._http_response` rows show `200`.
4. Invite Ashley from the admin **Staff** page.

Open follow-ups are unchanged: M3e F1/F2 and M3f K1–K3.
