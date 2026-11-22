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
- `manifestShas`, `assetsToFetch`, and `assetsToDelete` are local copies until step 10 can re-export them from `@intell/shared`.
