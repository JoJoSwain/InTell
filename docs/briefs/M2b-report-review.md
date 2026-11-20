# M2b report: architect review

**Report reviewed:** `docs/briefs/M2b-report.md` (`e085392`)
**Verdict:** **CHANGES REQUIRED before the PR.** The architecture is right (the reconciler, no-op rebuilds, canonical JSON, the R5 seed, option C with a drift check). Three security defects violate AGENTS.md §5 hard constraints. Fix S1–S3, add the tests, then open the PR.
**Reviewer:** architect (Claude), 2026-11-19

---

## Security defects (blocking)

### S1. Protected coordinates can be fetched by any signed-in user
`fn_pack_geog_geojson(p_scope, p_id)` is `security definer`, granted to `authenticated`, and its `'fragment_point'` branch returns `ST_AsGeoJSON(location)` for **any** fragment, **including protected ones**. A viewer, a writer, or any non-staff auth user can call it through PostgREST with frag9's id and get its coordinates. Hard constraint: protected coordinates must never reach a function that non-editors can call.

**Fix:**
- `revoke execute … from authenticated`; grant to **`service_role` only** (only the pack builder needs it).
- Defense in depth: the `fragment_point` branch returns `null` when the fragment's `visibility = 'protected'`. The builder omits protected coordinates anyway.
- pgTAP: as `anon`, as an `authenticated` non-staff user, and as a `viewer`/`writer`, calling it is denied; as `service_role`, frag9 returns `null`.

### S2. Anyone signed in can unpublish anything, bypassing the edge function
`fn_unpublish_commit` is `security definer`, granted to `authenticated`, and **doesn't check the caller's role**. The editor check exists only in the `unpublish` edge function, so a writer, a viewer, or any auth user can call the RPC directly through PostgREST and unpublish a grove. RLS can't help, because security definer bypasses it. (AGENTS.md §6: RLS enforces roles; the database is the boundary, not the UI or an edge function.)

**Fix:**
- Inside `fn_unpublish_commit`: unless `auth.role() = 'service_role'`, require `public.has_role(array['editor','admin'])`; otherwise `raise exception … using errcode = '42501'`.
- Check `fn_publish_commit` (M2a) for the same gap and give it the same guard if it's missing.
- `fn_enqueue_purge_reconcile`: grant to **`service_role` only**.
- pgTAP: direct calls to `fn_unpublish_commit` / `fn_publish_commit` by an `authenticated` non-staff user, a `viewer` and a `writer` are refused; an `editor` succeeds.

### S3. Service-role tokens aren't verified
`requireServiceRole` base64-decodes the JWT payload and trusts `role === 'service_role'` **without checking the signature**, and the functions run with `--no-verify-jwt`. A hand-made token `{"role":"service_role"}` would pass for `build-pack`, `purge-assets` and `run-jobs`. Locally that's harmless; deployed, it would let anyone trigger rebuilds and purges. `requireStaffEditor` is safe only because PostgREST re-verifies the token, but its early `role` check also reads unverified claims.

**Fix:**
- Set `verify_jwt = true` for every function in `supabase/config.toml` (`[functions.<name>]`), and remove `--no-verify-jwt` from local scripts and CI. If CLI 3.2.0's key format makes gateway verification fail locally, find out why and report it. **Don't** ship with verification off.
- In code, **verify** instead of decoding: for service-role endpoints, compare the bearer token with `Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")` using a constant-time comparison (or verify the signature with the project JWT secret or JWKS). Decode claims only **after** verification.
- Integration test: an unsigned or forged token claiming `service_role` gets 401/403 from all three internal functions. A real service key gets 200.

## Required, non-blocking (fix in the same pass)

- **N1. No keys in the repo.** `ci.yml` hard-codes the local Supabase demo service key. It's the public development default, but AGENTS.md §5 says never commit keys, and secret scanners will flag it. Read it at runtime: `eval "$(pnpm exec supabase status -o env)"` and use `$SERVICE_ROLE_KEY`.
- **N2. An audit test for definer functions.** Add `110_definer_grants.test.sql`: list every `security definer` function in `public` that `anon` or `authenticated` can execute, and assert the list equals a reviewed allowlist (`get_pack_index`, `has_role`, …). Any new grant then fails CI until someone looks at it. This would have caught S1 and S2.
- **N3. Reconciler pagination.** `storage.list("a", { limit: 10000 })` will silently miss objects past 10,000. Paginate until it's exhausted. Remove the unused `listPublicAudioShas` / `void publicShas`.
- **N4. "400/404".** Fine for local Storage, which returns 400 "Object not found". Assert "not 2xx and the body says not found", and add a note in TECH_SPEC sync that devices treat 400/404 alike as missing.

## Answers to open questions
1. **CI `RUN_JOBS_URL`:** decide once the `db` job runs on GitHub. If `host.docker.internal` doesn't resolve on Linux runners, use the Kong container on the Supabase Docker network. Record the working value in the report.
2. **`fn_is_editor_or_admin`:** keep it. It's `security invoker`, which is correct, and it's handy for M3. It goes on the N2 allowlist.

## Accepted as reported
Option C with the `db:check-edge-shared` drift check; `functions serve` alongside `supabase start`; the builder re-copying pack assets from staging on non-no-op rebuilds (self-healing; the reconciler still owns deletes); the DATA_MODEL amendments as quoted.

## Report back with
- The list of security definer functions executable by `anon`/`authenticated` (from N2)
- The forged-token test output (S3) and the direct-RPC refusal tests (S1/S2)
- `supabase test db` / `pnpm test:integration` / root checks, all green with JWT verification **on**
