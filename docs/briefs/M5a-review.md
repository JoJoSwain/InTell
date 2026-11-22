# M5a implementation review (Lane B): mobile data layer, steps 1–9

**PR:** #20 · **Tip reviewed:** `fdcda15` · **Plan review:** `docs/briefs/M5a-plan-review.md`

## Verdict

**Two required changes (R1, R2), then step 10.**

Most of the work is right: the database and migrations, the staged install with its one-transaction commit, reconcile, the device id with a redacted log, preview isolation, and the backup split. The Android XML is exactly right, and the iOS module sets the exclude flag on every directory it creates. The clean export passes, and 20 tests pass on `node:sqlite`. The deviations listed in the report are **accepted**.

## R1. Sync must update installed packs only, never download new groves

`syncContent` installs **every** index entry that isn't installed:

```ts
if (!installed || installed.version < entry.version) await args.install(entry);
```

and `dataLayer` runs sync on every foreground, on Wi-Fi. So the phone would quietly download **every published grove**, plus region packs, each time it opens. The spec makes the first download the listener's choice: the index shows groves and sizes, and the Grove sheet offers the download (TECH_SPEC §3.4 step 1–2; PRODUCT_SPEC §4). Sync only brings **installed** packs up to date (step 3, "for newer versions").

- In sync, call `install` only when the pack **is installed** and the index version is newer.
- Install a **region** pack automatically only when an installed grove needs it (its `regionId`), and update it like any installed pack.
- A first install stays an explicit action: `syncNow`/`installGrove` from the dev screen now, the Grove sheet in M5b.
- **Tests:**
  - a grove in the index that isn't installed is never downloaded by sync
  - an installed grove with a newer version is updated
  - the region pack follows an installed grove

## R2. Download only assets the phone doesn't already have

`installPack` downloads every asset in the manifest into staging, even when the same sha is already installed. So updating a pack downloads it **in full** again, cellular included, which defeats the diff.

- Skip any asset whose sha already has an `assets` row **and** its file on disk. Use `assetsToFetch` from `@intell/shared` after step 10.
- Point the new `assets` row at the existing file. Don't move it over.
- **Test:** an update whose new version shares assets with the installed one downloads only the new shas, and the shared files stay.

## Step 10 (A1 merged: `6e93845`)

- **Merge `origin/master`** into `b/m5a-mobile-data`.
  - On a `pnpm-lock.yaml` conflict, take either side, run `pnpm install`, and commit the regenerated lockfile. Never edit it by hand.
  - React is now `19.3.0` across the workspace, with no override, so re-run `npx expo-doctor` and include the summary.
- **`src/packs/syncDiff.ts`:** re-export `manifestShas`, `assetsToFetch` and `assetsToDelete` from `@intell/shared`, and delete the local copies. The tests stay.
- **`DeviceRegistrar`:**
  - POST a `RegisterDeviceRequest` to `register-device` with the publishable key (no user JWT).
  - Call it on first launch, and when `nativeApplicationVersion` differs from `kv.last_registered_app_version`.
  - Write the kv value **only after** a successful `RegisterDeviceResponse`.
  - On 429 or a network failure, try again next launch.
  - Never log more than 8 characters of the id.
  - **Tests:** registers once per version; doesn't record the version on failure; handles 429.
- **Re-run** mobile test, typecheck and lint, plus the clean export.
- **Hand check:** call `register-device` once against Lane A's local stack and record the response status. That's an API call, so it's allowed. Don't reset anything.

## Notes (follow-ups, not blocking)

- **N5 (M7):** downloads are buffered in memory (`fetch` → `arrayBuffer`) and hashed in JS. That's fine for today's fixtures. Large music stems and ambience libraries will need streaming to disk and hashing outside the JS heap. Lane B checks this when M7 brings real audio sizes.
- **N6 (M5b):** one failed pack install stops the rest of the sync. No deletions run, so it's safe. M5b should continue with the other packs and surface the failure.
- **N7 (first iOS build):** iOS prebuild couldn't run on Windows. Verify the Application Support path and the exclude flags on the first iOS dev build (EAS or a Mac).

## Report back with
Add a "Review fixes and step 10" section to `docs/briefs/M5a-report.md` covering:
- R1 and R2, with their tests
- the merge and lockfile handling
- the expo-doctor summary
- the registrar and its tests
- the `register-device` hand-check status
- the test, typecheck, lint and export results
- PR #20 CI and Vercel on the new head
- `git log --oneline origin/master..HEAD`

**Then stop for verification.**
