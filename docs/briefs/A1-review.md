# A1 review (Lane A): M5a enablers

**PR:** #21 · **Tip reviewed:** `65a3101` · **Brief:** `docs/briefs/A1-m5a-enablers.md`

## Verdict

**Approved.** CI shows one `check` and one `db` run, both green, and Vercel is green. The report is complete, and it says the local database was reset and the seed restored.

## Checked
- **The React pin.** The global override is gone, and the workspace now runs one React, `19.3.0`. Keeping the admin on `19.2.4` beside mobile's `19.3.0` put two Reacts on disk under the hoisted linker, which broke `next build`. One shared version is the right fix, and it's within Next 15.5.29's `^19.0.0` range. The admin build and all 27 Playwright tests pass, and expo-doctor passes 20/20. **Consequence, recorded here:** React is shared across the workspace, so a future Expo SDK upgrade that moves React moves the admin too. That makes it a Lane A task, with the admin build and Playwright as the gate.
- **`register-device`.**
  - It checks the publishable key in-function, then parses the body with the shared zod schema.
  - It calls `fn_device_rate_allow` before the upsert, so a limited call writes nothing.
  - `fn_register_device` sets `first_seen_at` once and writes `age_gate` only when the body includes it.
  - Both functions are `security invoker` with `search_path = ''`, and execute is granted only to `service_role`. `device_rate_limits` has RLS on and no `anon` or `authenticated` grants.
  - Logs carry at most 8 characters of the device id.
  - The integration tests cover the publishable-key, missing-key, secret-key and staff-JWT callers, plus a bad body and the 429.
- **Sync-diff.** `manifestShas`, `assetsToFetch` and `assetsToDelete` cover every sha-bearing field. A schema-walk test catches a new field that isn't collected. The M5 acceptance case and the shared-asset survival case are both tested.

## Docs (Claude, in this commit)
- **AGENTS.md and TECH_SPEC §6** now allow `verify_jwt = false` for **mobile device endpoints** that check the publishable key in-function and rate-limit per `device_id`, beside the existing service-caller case.
- **TECH_SPEC §6** records the known limit: client-generated ids can be rotated to dodge per-device limits. A per-IP or global cap is scheduled for M12.

## Follow-ups (later, not blocking)
- **F1 (Lane A, small):** a CI job that runs `expo export --platform android` (M5a plan-review gap 9). Comes after M5a merges.
- **F2 (M9):** should `age_gate` be allowed to change once it's set? That's decided with the Journal spec.

**Next:** merge PR #21. Then Lane B merges `origin/master` into M5a and does its step 10.
