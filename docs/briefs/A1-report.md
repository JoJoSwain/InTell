# A1 report — M5a enablers

Lane A · A1

**Branch:** `a/a1-m5a-enablers` (`C:\dev\intell-lanes\a`)
**PR:** https://github.com/JoJoSwain/InTell/pull/21
**Tip before this report:** `09bc9d7`
**Brief:** `docs/briefs/A1-m5a-enablers.md`
**Stop for review.** Did not start M4.

I reset the local database twice. Once with `supabase db reset` so pgTAP ran on a clean seed (an earlier run failed `064` and `067` against leftover staff and story rows). `pnpm db:setup-local` reset it again, then wrote Vault secrets and seed media. Demo seed is restored.

---

## 1. React pin

The workspace `pnpm.overrides` pin of `react` / `react-dom` to `19.2.4` is gone. Both apps now depend on **19.3.0** exactly.

Next 15.5.29 accepts `react: ^19.0.0`. Keeping admin on 19.2.4 while mobile used 19.3.0, under `node-linker=hoisted`, put a second React on disk. Next resolved the hoisted 19.3.0 and the admin app resolved 19.2.4, and `next build` died in prerender with `useContext` of null. One shared 19.3.0 fixes that. Admin production build and Playwright (27) passed, with no invalid-hook failure.

`pnpm why react` (both apps resolve `react 19.3.0`, including Next, Radix, and the Expo peers).

`npx expo-doctor` from `apps/mobile` (expo-doctor 1.21.8):

```
Running 20 checks on your project...
20/20 checks passed. No issues detected!
```

That includes "Check that packages match versions required by installed Expo SDK".

## 2. `register-device`

**`verify_jwt = false`.** The app calls with the publishable key and no user JWT. That key is not a JWT, so platform verification would refuse the caller the brief requires. `requirePublishableCaller` accepts only the publishable key (`apikey`, else Bearer), constant-time. A missing key is 401. A secret key or a staff JWT by itself is 403. A staff JWT sent with the publishable key gets the same `{ ok, firstSeenAt }` as any other caller and no other device's data. Integration tests cover those cases.

**Rate limit.** New table `device_rate_limits` and `fn_device_rate_allow(device_id, endpoint, limit, window_seconds)`. Fixed window. `register-device` uses 30 calls per 3600 seconds. The row is incremented before the upsert, so a limited call does not write `devices`. Old windows for that endpoint are deleted on the way in. No foreign key, so a new id can be counted before it is stored. `anon` and `authenticated` have no grants. `service_role` executes it. `fn_register_device` does the upsert: `first_seen_at` is set once, platform / version / language update every call, and `age_gate` is written only when the body includes it. Logs use at most the first 8 characters of `device_id`.

**Lane B imports** from `@intell/shared`:

- `RegisterDeviceRequest`
- `RegisterDeviceResponse`

Also exported: `DevicePlatform`, `UiLanguage`, `AgeGate`.

## 3. Sync-diff

In `packages/shared/src/packs/syncDiff.ts`. **Lane B imports:**

- `manifestShas`
- `assetsToFetch`
- `assetsToDelete`

`manifestShas` covers grove packs, region packs, and preview manifests: narration `assetSha`, music stems, ambience `assetShas`, `growthCueAssetSha`, `portraitSha`, landcover `gridSha`, UI cues, and `assets[].sha`. `markerHash` is not an asset. A test walks the zod schemas and fails if a new sha-bearing field is not filled in the fixture and collected. `assetsToDelete` drops local shas missing from every kept pack, and an asset shared by two packs survives removing one of them. The caller passes installed packs plus the active preview manifest.

## Suite

| Command | Result |
|---|---|
| `pnpm lint`, `pnpm typecheck`, `pnpm test` | pass |
| `pnpm --filter @intell/admin build` | pass |
| `pnpm exec supabase test db` | 37 files, 207 tests, pass (after reset) |
| `pnpm test:integration` | 35 tests, pass |
| `pnpm --filter @intell/admin test:e2e` | 27 passed |
| `npx expo-doctor` in `apps/mobile` | 20/20 |

## CI

Push `09bc9d7` produced one `pull_request` run, one `check`, one `db`. Vercel passed.

- Checks: https://github.com/JoJoSwain/InTell/pull/21/checks
- Run: https://github.com/JoJoSwain/InTell/actions/runs/45067503955
- `check` pass (1m31s): https://github.com/JoJoSwain/InTell/actions/runs/45067503955/job/137346838651
- `db` pass (6m4s): https://github.com/JoJoSwain/InTell/actions/runs/45067503955/job/137346838765
- Vercel pass: https://vercel.com/replaceplace/intell-admin/2idQqBEeqjr4CWkNZFo2co3A5YCG

## `git log --oneline origin/master..HEAD`

```
09bc9d7 build: align admin React with Expo 19.3.0 (A1)
eb6ba9b fix: type the sync-diff schema walker (A1)
e1b1e1a feat: add the sync-diff helper for installed pack assets (A1)
087e399 feat: add register-device with a per-device rate limit (A1)
c53aed2 build: pin React per app instead of a workspace override (A1)
518ce18 docs: A1 brief (Lane A: M5a enablers)
```

The log above is from before this report commit. `09bc9d7` is the follow-up that moved admin from 19.2.4 to 19.3.0 after the split versions broke the admin build. `eb6ba9b` fixes the schema walker's types.
