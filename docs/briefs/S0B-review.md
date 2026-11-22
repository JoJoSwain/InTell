# S0B review (Lane B): mobile workspace health check

**PR:** #19 · **Tip reviewed:** `9ddb04c` · **Brief:** `docs/briefs/S0B-mobile-check.md`

## Verdict

**Accepted.** The report is thorough and stayed inside the brief: report only, no changes under `apps/` or `packages/`, and no database commands. The two-lane loop worked end to end for Lane B. The findings become the decisions below, which feed the first real briefs.

## Decisions from the findings

- **D1. The preview map branch is reference only.** `origin/preview/m5-google-map-home` is 151 commits behind and still has the M0 bar (Journal · Grow · Settings), no explainer before the location prompt, and titles on markers. Don't rebase or merge it. M5b rebuilds the map home on `master` to ADR 0004/0005. It may borrow its patterns: `react-native-maps` with `PROVIDER_GOOGLE`, and an `app.config.js` that reads the key **name**.
- **D2. `expo export` must succeed on a clean checkout (Lane B, M5a).** The M1 audio spike statically `require`s gitignored WAVs, so Metro fails the whole Android bundle. Keep the spike, because the ADR 0001 device tests are still pending, but it must not break a clean export. For example, load the fixtures at runtime from the generated folder, or keep the dev route out of production bundles. Acceptance: `expo export --platform android` passes in CI.
- **D3. The React version mismatch (Lane A, before M5a's native work).**
  - **The cause:** the root `package.json` `pnpm.overrides` pins `react`/`react-dom` to `19.2.4` for the whole workspace. That was added for the admin's Next.js upgrade.
  - **The conflict:** Expo SDK 58 expects `19.3.0`, so expo-doctor fails.
  - **The fix:** scope the pin so the admin keeps the version Next.js needs and mobile gets what its SDK expects, e.g. a per-package dependency instead of a global override. The admin build and tests must stay green, and expo-doctor must pass for mobile.
  - **Owner:** the root `package.json` is shared config, so this is Lane A's.
- **D4. M5a needs three server or shared pieces from Lane A:**
  - the `register-device` edge function (the `devices` table exists; TECH_SPEC §6 lists the endpoint)
  - a pure **sync-diff helper** in `packages/shared`, which decides which local assets to delete when they're absent from every installed manifest, with tests
  - D3 above

  So Lane A's first real task is **A1: M5a enablers**, ahead of M4a. Lane B starts M5a with the parts that don't depend on them: the mobile test runner, the export fix, the device database in a backed-up location, secure `device_id` storage, pack index fetch, download, sha verification and atomic install, and staff sign-in and preview. It wires in registration and the shared sync helper once A1 merges.
- **D5. Native backup rules come through config.** There's no `android/` or `ios/` folder, because CNG generates them. So the database's backup inclusion (Android `fullBackupContent`/`dataExtractionRules`, iOS Application Support not excluded) must be set through app config or a config plugin, not edited native files. That's M5a.

## Workflow amendment (in this commit)

`docs/WORKFLOW.md` §1 now covers the shared root files. The root `package.json`, `pnpm-workspace.yaml` and root tool configs belong to Lane A. Each lane may add dependencies to **its own** package's `package.json`. `pnpm-lock.yaml` conflicts are never edited by hand: merge `origin/master`, run `pnpm install`, and commit the regenerated lockfile. §6 now has A1 ahead of M4a.

## Next
1. Lane B pushes this review (docs only) to PR #19.
2. PR #18 (S0A) merges first, then #19.
3. Claude writes **A1** (Lane A) and **M5a** (Lane B).
