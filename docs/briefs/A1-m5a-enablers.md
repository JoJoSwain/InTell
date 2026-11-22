# A1 brief (Lane A): M5a enablers

**Lane:** A (Platform) · **Branch:** `a/a1-m5a-enablers` (in `C:\dev\intell-lanes\a`, cut from `87d32cf`, with this brief committed) · **Implement directly**, open a PR, then stop for review.

**Why now:** Lane B's M5a (the mobile data layer) needs three things that only Lane A may build (S0B review D3–D4). Keep each one small, and land them as **three separate commits** in one PR, in this order.

## 1. Scope the React pin (S0B D3)

The root `package.json` `pnpm.overrides` forces `react`/`react-dom` to `19.2.4` across the workspace. Expo SDK 58 (mobile) expects `19.3.0`, and expo-doctor fails on it.

- **Target:** the admin keeps the version its Next.js needs, and mobile gets the version its Expo SDK expects. Prefer exact versions in each app's own `package.json` over a global override. Keep a narrowly scoped override only if something truly needs one, and say why in a comment.
- Regenerate `pnpm-lock.yaml` with `pnpm install`, never by hand.
- **Accept when:**
  - the full suite is green, including the admin build and Playwright (watch for a duplicate React or an "invalid hook call" in the admin)
  - `npx expo-doctor` run from `apps/mobile` passes its SDK-version check (paste the summary in the report)
  - `pnpm why react` shows each app on its intended version

## 2. `register-device` edge function

TECH_SPEC §5: *upsert a device (platform, version, language, age gate)*. The `devices` table already exists.

- **Contract in `packages/shared`** (new `src/schemas/device.ts`, exported from the package index):
  - `RegisterDeviceRequest = { deviceId: uuid v4, platform: 'ios' | 'android', appVersion: string (≤ 32), uiLanguage: 'en' | 'es', ageGate?: 'under_13' | '13_17' | '18_plus' | 'adult_for_family' }`
  - `RegisterDeviceResponse = { ok: true, firstSeenAt: ISO string }`
  - Lane B imports these names, so keep them exactly.
- **The function:**
  - POST only, with the body parsed by the shared zod schema (400 on a bad body).
  - It upserts `devices` by `id = deviceId`. `first_seen_at` is set once and never changes. Platform, version and language update on every call. `age_gate` is written only when it's provided.
  - It's called by the app with the **publishable key** (no user JWT). Choose `verify_jwt` under the M3f rule and AGENTS.md. Prove that a publishable-key call works, that a call with no key is refused, and that a staff JWT gains nothing extra.
  - **Rate limit:** per `device_id`, about 30 calls an hour (TECH_SPEC §5: *every mobile endpoint is rate limited per device_id*). If no rate-limit helper exists yet, add a minimal reusable one (a small table or function in one migration), because later mobile endpoints will use it. Record the design.
  - **`device_id` is a bearer secret** (TECH_SPEC §6). Never log it in full: at most the first 8 characters. `anon` gains no table grants.
- **Tests:**
  - integration tests: register new, re-register (updates, but `first_seen_at` is unchanged), a bad body (400), no key (refused), the rate limit (429), and no full device id in the logs
  - pgTAP for any new table or function
  - the M3g grant guard and `110_definer_grants` stay green

## 3. Sync-diff helper in `packages/shared` (S0B D4; M5 acceptance)

These are pure functions with Vitest tests, for example in `src/packs/syncDiff.ts`:
- **`manifestShas(pack)`** returns every asset sha a pack references, for grove packs, the region pack and preview manifests. That covers narration versions, music stems, ambience layer assets, the growth cue, character portraits and any other image.
  - Add a test that fails if a new sha-bearing field is added to the pack schemas but isn't collected. For example, walk a fixture that fills every field.
- **`assetsToFetch(pack, localShas)`** returns the shas a pack needs that aren't on the device.
- **`assetsToDelete(localShas, keptPacks)`** returns every local sha that isn't referenced by **any** kept pack. The caller passes its installed packs, plus the active preview manifest while a staff member is signed in.
- **The M5 acceptance test:** a unit test proves that assets missing from every installed manifest are deleted on sync. It also proves an asset shared by two packs survives removing one of them.

## Out of scope
The `embark` relay (later in Lane A), M4, any `apps/mobile` change, and the M3h follow-ups V1/V2 (they go with M4b).

## Report
Write `docs/briefs/A1-report.md`, starting with `Lane A · A1`. Cover:
- each part's result
- the `pnpm why react` and expo-doctor summaries
- the `verify_jwt` choice and the rate-limit design
- the exported names Lane B will import
- the suite results
- `git log --oneline origin/master..HEAD`
- whether you reset the local database

Push with `git push -u origin a/a1-m5a-enablers`. **Then stop for review.**
