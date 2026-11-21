# M3g report — explicit `service_role` grants

**Branch:** `m3g-service-role-grants`  
**PR:** https://github.com/JoJoSwain/InTell/pull/16  
**Impl tip:** `0b463ab` · **Review:** `655e93d` (Approved) · **This report:** on tip after review  
**Brief:** `docs/briefs/M3g-service-role-grants.md` · **Review:** `docs/briefs/M3g-review.md`  
**Stop.** Jordan merges and runs hosted `db push --remote`. Do not push hosted DB from this agent. No M3e F1/F2, M3f K1–K3, M4, M5.

---

## 1. Acceptance

| Criterion | Result |
|---|---|
| Full local suite green **with `auto_expose_new_tables = false`** | **PASS** |
| pgTAP `111_m3g_service_role_grants` passes; `110_definer_grants` unchanged and passing | **PASS** |
| CI + Vercel green on head that includes report + review | Re-triggered with empty commit `69cc71d` after a push/PR `db` port-race flake on `672ce87` (sibling run on that SHA succeeded) |

---

## 2. Suite results (local, `auto_expose_new_tables = false`)

Confirmed in `supabase/config.toml`: `auto_expose_new_tables = false`. Stack restarted before `db:setup-local`.

| Check | Result |
|---|---|
| `pnpm db:setup-local` | **PASS** — migrations through `20261121200001_m3g_service_role_grants.sql` |
| `pnpm exec supabase test db` | **PASS** — Files=**36**, Tests=**198** (incl. `110` + `111`) |
| `pnpm test:integration` | **PASS** — **30** tests (incl. M3f `fn_call_run_jobs` → pg_net → run-jobs **200**) |
| Playwright (`apps/admin`) | **PASS** — **16** tests |
| `pnpm lint && pnpm typecheck && pnpm test` | **PASS** |
| `pnpm --filter @intell/admin build` | **PASS** |

**Extra grants exposed by the config flip:** none. No suite failure required additional grants beyond the brief’s migration.

**CI note:** tip `672ce87` had one `db` job fail with `address already in use` on `:54322` when push and pull_request workflows overlapped; the sibling `db` on the same SHA passed, and Vercel was green. Empty commit `69cc71d` re-triggers a clean run.

---

## 3. Git log (`26a60de..HEAD` at report time)

```
<report-sha> docs: add M3g service_role grants report
655e93d docs: M3g review (approved)
0b463ab feat(m3g): explicit service_role grants; match hosted secure-by-default
fdde0cf docs: M3g brief (explicit service_role grants; Supabase secure-by-default)
```

---

## 4. Migration (quoted)

`supabase/migrations/20261121200001_m3g_service_role_grants.sql`:

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

`anon` / `authenticated` grants unchanged.

---

## 5. Doc changes (quoted)

**AGENTS.md / TECH_SPEC §6:**

> **Explicit API-role grants.** Supabase no longer auto-grants new `public` objects to API roles. Every migration grants what each role needs explicitly. `service_role` is covered by the default privileges from M3g. Local config sets `auto_expose_new_tables = false` to match hosted.

**`apps/admin/README.md` staging runbook:**

> `pnpm exec supabase db push --remote` **from master** (optional preview: `… --remote --dry-run`). With CLI 3.x, bare `db push` targets the **local** stack unless you pass `--remote`.  
> `functions deploy` prints a `Target:` line — it must name the staging project, not local.

---

## 6. Deviations / open

- None from the brief’s decisions. Architect review **Approved** (`docs/briefs/M3g-review.md`).
- Hosted `db push --remote` is JoJo’s after merge (not run here).
