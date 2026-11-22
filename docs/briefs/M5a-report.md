Lane B · M5a

Implementation of steps 1–9 is on PR #20. Step 10 is not done. A1 is not merged, so `syncDiff` stays a local stand-in and device registration is the noop registrar.

## Libraries (resolved)

Installed from `apps/mobile` only. The root `package.json` was not edited.

| Package | Resolved |
|---|---|
| expo-sqlite | 58.0.18 |
| expo-secure-store | 58.0.3 |
| expo-file-system | 58.0.14 |
| expo-network | 58.0.5 |
| expo-crypto | 58.0.8 |
| @supabase/supabase-js | 2.119.2 |
| jest-expo | 58.0.15 |
| @types/jest | 30.0.0 |
| @types/node | 20.19.43 |
| intell-storage | `file:./modules/intell-storage` |

`react` and `react-dom` still resolve to **19.2.4** through the root pnpm override (D3). `apps/mobile/package.json` asks for 19.3.0. Prebuild still finished.

## N1

The test driver is **`node:sqlite`** (`DatabaseSync`, in-memory). The probe `node:sqlite opens an in-memory database under jest-expo` passed on Node v26, so the suite did not switch to `sql.js`. Repositories and the install, sync, reconcile, and preview tests all run on that driver.

## Prebuild

`pnpm exec expo prebuild --platform android --no-install` finished. The generated `apps/mobile/android` tree was deleted and is not committed.

Manifest application attributes:

```xml
android:dataExtractionRules="@xml/intell_data_extraction_rules"
android:fullBackupContent="@xml/intell_full_backup_content"
```

`app/src/main/res/xml/intell_data_extraction_rules.xml`:

```xml
<?xml version="1.0" encoding="utf-8"?>
<data-extraction-rules>
  <cloud-backup>
    <exclude domain="sharedpref" path="SecureStore"/>
    <exclude domain="file" path="intell-assets"/>
    <exclude domain="file" path="intell-preview"/>
    <exclude domain="file" path="intell-staging"/>
  </cloud-backup>
  <device-transfer>
    <exclude domain="sharedpref" path="SecureStore"/>
    <exclude domain="file" path="intell-assets"/>
    <exclude domain="file" path="intell-preview"/>
    <exclude domain="file" path="intell-staging"/>
  </device-transfer>
</data-extraction-rules>
```

`app/src/main/res/xml/intell_full_backup_content.xml`:

```xml
<?xml version="1.0" encoding="utf-8"?>
<full-backup-content>
  <exclude domain="sharedpref" path="SecureStore"/>
  <exclude domain="file" path="intell-assets"/>
  <exclude domain="file" path="intell-preview"/>
  <exclude domain="file" path="intell-staging"/>
</full-backup-content>
```

`file/SQLite` is not excluded, so `intell.db` and its `-wal` / `-shm` stay in backup. SecureStore is excluded because `configureAndroidBackup` is false.

iOS prebuild did not run. On Windows, Expo skips the iOS native project (`Skipping generating the iOS native project files`). The committed module is the source of the paths and the exclude call:

```swift
Function("progressDirectory") { () -> String in
  applicationSupport().path
}

Function("ensureExcludedDirectory") { (name: String) throws -> String in
  let directory = applicationSupport().appendingPathComponent(name, isDirectory: true)
  try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
  var values = URLResourceValues()
  values.isExcludedFromBackup = true
  var mutable = directory
  try mutable.setResourceValues(values)
  return directory.path
}
```

`applicationSupport()` is `FileManager.urls(for: .applicationSupportDirectory, in: .userDomainMask)`. The database is opened in that directory, so the WAL files sit beside it. `ensureExcludedDirectory` sets `isExcludedFromBackup = true` on every call, including the one preview sign-out makes after it deletes `intell-preview`. Android `progressDirectory` is `filesDir/SQLite`. Android `ensureExcludedDirectory` only creates `filesDir/<name>`; exclusion is the XML above.

## Tests

`pnpm --filter @intell/mobile test`: 11 suites, 20 tests, all passed. `typecheck` and `lint` passed.

- node:sqlite opens an in-memory database under jest-expo
- migration 1 creates every device table
- a second completion for the same version keeps the first row
- audio and images use the public object prefixes
- Wi-Fi downloads without asking
- cellular asks the callback
- offline does not download
- a failed download leaves no pack and a retry skips a verified file
- a bad asset sha writes no pack
- storage 400 and 404 are missing
- sync deletes an asset missing from every kept manifest
- a declined cellular download does not install
- reconcile drops a pack whose file is gone and keeps completions
- device id is created once and logs only a prefix
- the noop registrar does not record a version
- a non-staff response writes no preview and leaves the installed asset
- sign-out clears preview and asks for the exclude flag again
- ensure sets the exclude flag on both directories every call (the assertion covers assets, preview, and staging)
- a numeric asset id counts as a bundled spike fixture
- the missing-file sentinel is not a bundled spike fixture

## Clean export

`expo export --platform android --clear` rebuilt an empty Metro cache and finished with exit 0. Android bundle: 1410 modules, about 18s, written to a temp directory outside the repo. The missing spike WAVs resolve to the sentinel, so export no longer depends on `pnpm --filter @intell/audio-fixtures generate`.

## Hand check

The local API was already listening on `127.0.0.1:54321`. Lane B did not start or reset it, and did not create a staff user.

`POST /functions/v1/preview` with `{"releaseId":"00000000-0000-4000-8000-000000000000"}`:

- no `Authorization` header: **401**
- `Authorization: Bearer not-a-staff-jwt`: **401**

Both bodies were empty (the gateway answered before the function). The positive staff path was not run. No dev-client install, and no grove download on a device.

## `git log --oneline origin/master..HEAD`

Recorded before this report commit:

```
9ac1bfa Keep listener progress in a backed-up database and downloaded packs out of backup.
f4c5dcb docs: M5a plan review (approved, notes N1-N4); DATA_MODEL §14 backup split
fdd56b9 docs: plan the M5a mobile data layer
cdc288f docs: M5a brief (Lane B: mobile data layer, plan first); TECH_SPEC backup split (D6)
```

## CI

On `9ac1bfa`, GitHub `check` and `db` completed success, and `Vercel Preview Comments` completed success.

## Deviations

- The staff Supabase session lives in memory. SecureStore's value limit is too small for a session JWT, and the JWT does not belong in SQLite. `device_id` stays in SecureStore and is not copied into the database. An Android restore therefore comes back with progress and a new device id, which M9 still has to decide.
- `intell-staging` is a third excluded directory, beside `intell-assets` and `intell-preview`, so a partial download is not backed up.
- Ethernet is treated like Wi-Fi. An unknown network asks the callback. Automatic sync (AppState active, connectivity regained) passes a callback that returns false, so it does not download on cellular. The dev screen forces Wi-Fi.
- A pack that disappears from a successful index is dropped, then assets no remaining manifest names are deleted. A failed index fetch, or transport `none`, returns without deleting anything.
- The dev screen's copy is English in the component. i18n arrives with M5b. It uses the same hex colors as the existing screens. `src/ui/tokens.ts` is not in the tree yet.
- There is no CI `expo export` job. That workflow lives under `.github`, which is Lane A's, and the review schedules it after A1.
- Sync on Grove entry, queue flush, `my-entries`, the Chronicle replay rule, the age gate, and preview URL refresh are left for later milestones, as the review accepted.
- `src/packs/syncDiff.ts` re-exports `manifestShas`, `assetsToFetch`, and `assetsToDelete` from `@intell/shared` (step 10).

## Review fixes and step 10

### R1

`syncContent` installs a grove only when that grove is already installed and the index version is newer. A region pack is installed when an installed grove that is still in the index names its `regionId`, and an already installed region pack is updated the same way. A grove that is only in the index is not downloaded. The dev screen's Sync button stays on that path. First install is the new Install grove action, which installs that grove and then runs sync so its region pack follows.

Tests, all passed:

- a grove in the index that isn't installed is never downloaded by sync
- an installed grove with a newer version is updated
- the region pack follows an installed grove (also updates an installed region to a newer version)
- a declined cellular download does not install (the grove is installed and newer, and the callback returns false)

### R2

`installPack` asks `assetsToFetch` for shas that are not already in the `assets` table with a file on disk. Those are skipped. The pack row points at the existing file and does not move it. A shared sha is not requested again.

Test, passed: an update downloads only new shas and keeps the shared file.

### Merge and lockfile

`git merge --no-edit origin/master` conflicted only in `pnpm-lock.yaml`. The master copy was taken, then `pnpm install --no-frozen-lockfile` regenerated the lockfile. That result is in merge commit `066d8ab`. `expo-application` was added after the merge, and the lockfile change from that install is in the review-fix commit. The lockfile was not edited by hand.

React and react-dom now resolve to **19.3.0**. The root override is gone.

### expo-doctor

`npx expo-doctor` from `apps/mobile`: **19/20 checks passed**. The React version check that failed under the 19.2.4 override now passes. The remaining failure is a duplicate `intell-storage@0.0.0`, once at `modules/intell-storage` and once at the `file:` link in `node_modules`. It is the same local module, not two versions.

### Registrar

`httpRegistrar` POSTs a `RegisterDeviceRequest` to `{url}/functions/v1/register-device` with the publishable key in `apikey` and no user JWT. Age gate is omitted. `registerIfNeeded` runs on launch and when `nativeApplicationVersion` (falling back to the Expo config version when that is null) differs from `kv.last_registered_app_version`. The kv value is written only after `RegisterDeviceResponse` parses. A 429, a non-OK status, or a network failure returns `{ registered: false }` and leaves the kv unset, so the next launch tries again. Logs go through `logDevice`, which writes 8 characters.

`expo-application` **58.1.2** was added so the app can read `nativeApplicationVersion`.

Tests, all passed:

- registers once per version
- does not record the version on failure
- handles 429 without logging the full device id

### register-device hand check

`127.0.0.1:54321` was already listening. Lane B did not start, stop, or reset it. One POST of a v4 `RegisterDeviceRequest` (`platform: android`, `appVersion: 0.0.0`, `uiLanguage: en`, no age gate) with the local anon key as `apikey` returned **403** and an empty body. The device id was not recorded here.

### Test, typecheck, lint, export

`pnpm --filter @intell/mobile test`: 12 suites, 27 tests, all passed. Typecheck passed. Lint passed. `expo export --platform android --clear` rebuilt an empty Metro cache and finished with exit 0 (1415 modules, about 15s).

### CI and Vercel

On `d764652`, GitHub `check` and `db` completed success, and `Vercel Preview Comments` completed success.

### `git log --oneline origin/master..HEAD`

Before this review-fix commit:

```
066d8ab Merge origin/master into b/m5a-mobile-data.
65d4ab3 docs: M5a implementation review (R1 sync installed-only, R2 fetch missing assets only; step 10)
fdcda15 docs: record the M5a mobile data layer
9ac1bfa Keep listener progress in a backed-up database and downloaded packs out of backup.
f4c5dcb docs: M5a plan review (approved, notes N1-N4); DATA_MODEL §14 backup split
fdd56b9 docs: plan the M5a mobile data layer
cdc288f docs: M5a brief (Lane B: mobile data layer, plan first); TECH_SPEC backup split (D6)
```

