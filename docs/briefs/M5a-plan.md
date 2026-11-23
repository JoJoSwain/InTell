Lane B · M5a

Plan only. No code in this commit. Lane B will not edit `packages/shared` or `supabase/`, and will not run `supabase start`/`stop`, `db reset`, `db:setup-local`, or the admin Playwright suite.

M5a is the phone's content store: a backed-up progress database, pack download and sync, device identity, and staff preview. No map, tokens, location, or playback. A dev-only screen under `app/dev/` is the hand check.

## Libraries and versions

Install Expo modules from `apps/mobile` with `pnpm exec expo install` so they match SDK 58 (`expo ~58.0.26`). Record the resolved versions in the implementation report. Do not hand-pin them ahead of that command.

| Package | Role |
|---|---|
| `expo-sqlite` | Device database. SDK 58 API: `openDatabaseAsync(name, options, directory)`. |
| `expo-secure-store` | `device_id`. Plugin `configureAndroidBackup: false`, because our own backup rules must exclude `SecureStore` (see Backup). |
| `expo-file-system` | Already installed (`~58.0.14`). New API only: `File`, `Directory`, `Paths`, `downloadAsync`. The spike logger stays on `expo-file-system/legacy` until a later cleanup. |
| `expo-network` | Connectivity for "regained network" and the Wi-Fi / cellular hook. Not named in TECH_SPEC §1. It is the SDK module that does this. Drop it if review wants the hook to stay caller-supplied. |
| `jest-expo` | Mobile test runner, per the brief. Brings Jest. |

One non-Expo dependency: `@supabase/supabase-js` at `^2.49.1`, the same range as `apps/admin`. TECH_SPEC §1 names Supabase Auth and the data API, not this package. It is how the dev screen signs in and how `get_pack_index` and `preview` are called. No TanStack Query in M5a: there is no product screen to cache. `src/api/` stays plain functions; M5b can wrap them.

Not installed in M5a: `expo-location`, `react-native-maps`, `expo-audio`, Sentry.

**D3 stays Lane A's.** The root `pnpm.overrides` still pin `react` / `react-dom` to 19.2.4 while Expo 58 expects 19.3.0. Lane B will not edit the root `package.json`. If temp prebuild fails on that mismatch, the report says so and stops at the backup plugin source rather than "fixing" the override.

## Module layout

All of this is under `apps/mobile`. Routes stay in `app/`.

```
app.config.ts                         static app.json + env extra + plugins
plugins/withBackupSplit.ts            Android backup XML; iOS module is separate
modules/intell-storage/               local Expo module (CNG, not a committed ios/ or android/)
app/dev/data.tsx                      dev-only hand screen
src/db/driver.ts                      SqlDriver interface
src/db/open.ts                        expo-sqlite opener, directory chosen per platform
src/db/migrate.ts                     forward-only migrations
src/db/migrations/001.ts
src/db/repos.ts                       typed reads/writes
src/identity/deviceId.ts              secure-store UUID, redacted log
src/identity/register.ts              DeviceRegistrar interface (no-op until A1)
src/files/store.ts                    staging dir, asset dir, preview dir, sha256 of bytes
src/files/reconcile.ts                rows vs files after restore
src/api/supabase.ts                   client from extra URL + publishable key
src/api/packs.ts                      get_pack_index, public object GET
src/api/preview.ts                    staff JWT → preview function
src/packs/policy.ts                   Wi-Fi downloads; cellular asks a callback
src/packs/install.ts                  verify, stage, atomic commit
src/packs/sync.ts                     foreground, connectivity, dev action
src/packs/syncDiff.ts                 stand-in until A1, then re-export from @intell/shared
src/preview/session.ts                sign-in, fetch, sign-out wipe
```

`src/audio/` stays. No `map/`, `location/`, `session/`, or `ui/` tokens.

## Clean export (S0B D2)

Metro fails a clean export because `src/audio/spike/assets.ts` statically `require`s gitignored WAVs, and Expo Router pulls `app/dev/audio-spike.tsx` into the graph. A `__DEV__` redirect does not skip that resolution.

`metro.config.js` gets a `resolveRequest` only for `assets/spike-audio/*`. If the file is on disk, the default resolver runs and the spike bundles the real fixtures. If it is missing, the request resolves to a committed sentinel module. The spike screen already has `FIXTURES_MISSING_MESSAGE`; it treats a sentinel asset as "not generated" and does not start the mix. ADR 0001 device tests still work after `pnpm --filter @intell/audio-fixtures generate` and a rebuild.

Acceptance command, output outside the repo:

`pnpm --filter @intell/mobile exec expo export --platform android --output-dir <temp>`

**CI.** Root `turbo` already runs each package's `test` script, so a real mobile `test` is picked up by `pnpm test` with no root change. `expo export` is not a CI step. `.github/**` is Lane A's. D2 says the export should pass in CI; this plan makes it pass locally and asks Lane A to add the job if Claude wants it on the workflow.

## Database schema and migrations

`expo-sqlite`, database name `intell.db`. `PRAGMA user_version` is the schema version. Migration 1 runs inside one transaction, then sets `user_version = 1`. Later milestones append a new function. Shipped SQL is not edited.

§14 names the tables and, for most of them, the columns. It does not name primary keys or the queue columns. Assumed keys, so review can correct them before code:

| Table | Assumed primary key | Notes |
|---|---|---|
| `packs` | `(scope, id)` | `scope` in `grove` \| `region`. `manifest_json` is the verified manifest text. |
| `assets` | `sha` | Shared by every installed pack. `local_uri` points at the asset directory, never staging. |
| `completions` | `(fragment_id, revision_no, time_window)` | `on_site` is 0/1. `time_window` is `day` \| `night`. `trigger` is text; the vocabulary is M6. |
| `unlocks` | `fragment_id` | Rows are never deleted by M5a. |
| `progress` | `(fragment_id, revision_no, time_window)` | Display only. No writer in M5a. |
| `visits` | `(session_id, grove_id)` | A session can name more than one grove (TECH_SPEC §3.2). No coordinates. |
| `met_characters` | `character_id` | |
| `my_entries` | `client_entry_id` | Columns as in §14. No writer until M9. |
| `preview` | `release_id` | Not a pack. Sign-out deletes every row. |
| `event_queue` | integer `id` | `payload_json`, `created_at` only. M11 fills the shape. |
| `checkin_queue` | integer `id` | Same. |
| `kv` | `key` | M5a uses `last_registered_app_version`. |

No latitude or longitude column anywhere.

`SqlDriver` is `exec`, `run`, `getAll`, `getFirst`, and `withTransaction`. Production implements it with `expo-sqlite`. Tests implement it with Node 22 `node:sqlite` (CI is Node 22), so Jest does not open the native module. Repositories are generic over the driver.

## Backup config and how it is checked

Decision D6: the database is backed up; downloaded files are not.

SDK 58 facts that the spec does not spell out:

- iOS `expo-sqlite` `defaultDatabaseDirectory` is `documentDirectory/SQLite` (Documents), which iCloud does back up. TECH_SPEC §3.3 asks for Application Support. `expo-file-system` `Paths` has `document`, `cache`, and `bundle` only, no Application Support URL.
- Android `defaultDatabaseDirectory` is `filesDir/SQLite` (backup domain `file`, path `SQLite`), not the `database` domain.

A local Expo module `modules/intell-storage` (autolinked, created with the SDK's local-module flow) exposes:

- `progressDirectory`: iOS `Library/Application Support`, Android `filesDir/SQLite` (the default sqlite directory). The database is opened with that directory argument. Neither path is marked excluded.
- `assetDirectory` and `previewDirectory`: sibling folders (`intell-assets`, `intell-preview`). On iOS the module sets `NSURLIsExcludedFromBackupKey` on those two directories only. The database file, and its `-wal` / `-shm` siblings, stay in the backed-up directory.

`plugins/withBackupSplit.ts` writes the Android rules and points the manifest at them. Because any custom rule replaces `expo-secure-store`'s automatic one, the plugin sets `configureAndroidBackup: false` and excludes SecureStore itself, as the SDK 58 secure-store docs require.

Android 12+ `dataExtractionRules` and Android 11- `fullBackupContent`:

- Exclude `sharedpref` path `SecureStore` (cloud-backup and device-transfer).
- Exclude `file` path `intell-assets` and `file` path `intell-preview`.
- Do not exclude `file/SQLite`. No include-only list, so the rest of the app's small files, including the database, stay in the backup. An include-only list would risk dropping the database.

Assets stay out of the 25 MB Auto Backup cap. Cache is not the asset store: the OS may purge cache, and D6 asks for an explicit exclude of durable files, not a purgeable directory.

**Verify** with `pnpm exec expo prebuild` into a temp directory outside the repo, then delete it. The report quotes:

- Android: `AndroidManifest.xml` `android:dataExtractionRules` and `android:fullBackupContent`, plus the two XML files.
- iOS: the generated module's Application Support path and the `isExcludedFromBackupKey` set only on the asset and preview directories. There is no Info.plist key for a per-directory backup exclude; the generated Swift is the check.

Native `android/` and `ios/` are not committed. Prebuild is this verification only, not a device install.

**After restore.** Launch calls `reconcile`:

1. Delete `assets` rows whose `local_uri` is missing on disk.
2. Delete a `packs` row if any sha in its manifest has no remaining `assets` row. That pack is not installed and downloads again. `completions`, `unlocks`, `progress`, `visits`, `met_characters`, `my_entries`, and `kv` are left alone.
3. If a `preview` manifest names a missing file, delete the preview rows and the preview directory.

`device_id` is a separate store. iOS Keychain with the default `WHEN_UNLOCKED` can come back with an encrypted backup. Android must exclude SecureStore, so an Android restore brings the database back and not `device_id`. The next launch mints a new id and, once A1 exists, registers it. Flagged under gaps; M5a will not try to copy the id into SQLite.

## Installer atomicity

Public object paths, matching publish: `a/{sha}.{ext}` for every kind except `image`, which is `i/{sha}.{ext}`. Manifests: `{SUPABASE_URL}/storage/v1/object/public/public-media/{manifestPath}`. `manifestSha256` is the SHA-256 of the raw UTF-8 file (`uploadManifest`), not `contentSha256` of a re-parsed value. Asset sha is the SHA-256 of the file bytes.

Steps for one pack:

1. Download the manifest into a staging directory for `(scope, id, version)`. Hash the bytes. Mismatch throws and deletes that staging directory. Parse with `GrovePack` or `RegionPack`.
2. For each asset whose sha is not already in `assets` with a file on disk, download to `staging/{sha}.{ext}`. A staging file whose hash already matches is kept (the restart rule). A bad hash deletes that file and fails the install.
3. Storage HTTP 400 and 404 both become a `MissingObject` error. The install fails. No `packs` row is written.
4. Commit, only after every file verifies: move staged files into `assetDirectory`, then one database transaction that upserts `assets` and the `packs` row. The transaction is the installed state. A throw before it leaves the previous `packs` row unchanged. Staging files that verified stay for the retry; the test for "no partial pack" asserts the `packs` table, not an empty disk.
5. A crash after the move and before the commit is the restore case: `reconcile` drops asset rows with no file and pack rows that are incomplete. Orphan files in the asset directory with no row are deleted on the next reconcile.

The region pack for a grove's `regionId` uses the same installer. Wi-Fi starts it immediately. Cellular calls the policy callback and skips it when the callback returns false. The dev screen's callback is an explicit button, not a product prompt.

## Sync, identity, preview

**Sync** (`src/packs/sync.ts`) runs on `AppState` becoming `active`, on `expo-network` reporting a regained connection, and from the dev screen. It does not run on Grove entry; that call site is M6, and this module exports `sync()` for it. It does not flush `event_queue` or `checkin_queue` and does not call `my-entries`.

It re-fetches `get_pack_index()` with the publishable key (`apikey` and `Authorization: Bearer`). For an installed pack whose index `version` is newer, it runs the installer. It then asks the sync-diff helper which local shas to delete and removes those files and `assets` rows. Kept manifests are installed packs only. Preview files are not in `assets`, so sync does not delete them.

Until A1, `src/packs/syncDiff.ts` is a local stand-in with the brief's names:

- `manifestShas` — union of asset shas in the kept manifests
- `assetsToFetch` — shas in that union that are not local
- `assetsToDelete` — local shas absent from that union

The deletion test imports this module. When A1 merges, the module re-exports `manifestShas`, `assetsToFetch`, and `assetsToDelete` from `@intell/shared` and the test stays. The stand-in is not a second source of truth after that.

**Identity.** First launch writes a v4 UUID to Secure Store under `device_id`. Logs that include it print at most 8 characters. A unit test spies on the logger and fails if a full UUID from this store is passed through. The dev screen does not render it.

`DeviceRegistrar.register` is a no-op that records nothing on the server until A1. `kv.last_registered_app_version` is what "app version changed" compares against. After A1, the implementation posts `RegisterDeviceRequest` to `register-device` on first launch and when `Application.nativeApplicationVersion` changes. Age gate is omitted until M9; the field stays optional on our side of the interface.

**Preview.** The dev screen signs in with email and password (`signInWithPassword`). It POSTs `{ releaseId }` to `preview` with the staff JWT. `PreviewManifest.parse` must succeed before any write. Assets are downloaded from the manifest's `url` list into `previewDirectory` at fetch time (signed URLs expire in 1 hour; M5a does not refresh them on a timer). The `preview` row stores `manifest_json` and `fetched_at`. Sign-out calls `signOut`, deletes every `preview` row, and deletes the preview directory. A 401 or 403 throws before the write. The non-staff test is that path: a refused response leaves `preview` empty and the installed pack untouched.

## Test strategy

`pnpm --filter @intell/mobile test` runs `jest-expo`. Tests live in `src/**/*.test.ts`. `tsconfig` includes them. Lint uses the existing `expo lint` config; test files stay inside it.

Mocked or faked:

| Boundary | Double |
|---|---|
| SQLite | `node:sqlite` behind `SqlDriver` |
| HTTP | a fake `fetch` with status, body, and headers |
| Files | an in-memory `FileStore` (read, write, move, exists, delete) |
| Secure Store | an in-memory map |
| Clock / UUID | injected |
| Sync diff | the `syncDiff` module (stand-in now, shared after A1) |
| Supabase Auth | the preview module takes a `PreviewClient` interface |

Not mocked in the unit tests: manifest zod parse, sha256 of bytes, the migration SQL, the install transaction order, reconcile, or the 400/404 mapping.

Unit tests named in the brief:

- Migration 1 creates every §14 table (`sqlite_master`).
- A thrown download leaves the `packs` row absent; a second call skips a staging file whose hash already matches.
- A wrong sha fails and writes no pack.
- HTTP 400 and 404 are `MissingObject`.
- Reconcile drops a pack whose file is gone and keeps `completions`.
- Preview write is refused without a successful staff response; sign-out clears the row and the preview files; an installed asset sha is still there.
- Sync deletes a local sha that `assetsToDelete` returns and keeps one that is still in a manifest.

`device_id` redaction has its own test. No test stores a coordinate.

**Hand check** (implementation report, emulator or dev client, Lane A's stack left as it is):

1. Put the local URL and publishable key in `apps/mobile/.env` (gitignored). Names only in `.env.example`.
2. Open `intell://dev/data`.
3. Fetch the index, download the seeded demo grove, run sync.
4. Record pack version, asset row count, and that each `local_uri` exists.
5. Sign in as staff and fetch the draft release if Lane A's stack has a staff user. Lane B will not create one. If it does not, record the 401/403 path only.

## Order of work, and where A1 plugs in

1. Metro sentinel, so a clean Android export passes.
2. `jest-expo`, one passing test, lint and typecheck still green.
3. Driver, migration 1, repositories, migration test.
4. `intell-storage` module, backup plugin, temp prebuild, quote the rules. Stop and report if D3 makes prebuild fail.
5. `device_id`, redacted logger, no-op registrar.
6. File store, sha, installer, 400/404, resume, reconcile.
7. Index client, policy hook, sync against the stand-in.
8. Preview session and the dev screen.
9. Stop for review if A1 is not on `master` yet. The app downloads, syncs, and previews without registration.
10. When Claude says A1 has merged: merge `origin/master`, `pnpm install`, commit the lockfile as generated. Point `syncDiff.ts` at `@intell/shared`. Implement `DeviceRegistrar` with `RegisterDeviceRequest` / `RegisterDeviceResponse`. Re-run mobile test, typecheck, lint, and the clean export. Then the hand check.

## Spec gaps

1. **iOS database directory.** TECH_SPEC §3.3 says Application Support. SDK 58's default is Documents/`SQLite`, which is also backed up. The plan uses Application Support via the local module, not the default.
2. **§14 primary keys and queue columns** are not specified. The table above is the proposal.
3. **DATA_MODEL §14** still says the database is backed up and does not mention excluding asset files. TECH_SPEC §3.3 already has D6. Docs are Claude's.
4. **Sync triggers.** TECH_SPEC §3.4 also syncs on Grove entry and flushes queues and `my-entries`. The brief says foreground, connectivity, and a dev action, and to skip queues and `my-entries`. Grove entry waits for M6. Chronicle "leave replay" (ADR 0004 §16) is a read rule for M8; M5a does not delete `completions`.
5. **Age gate** is a `register-device` field. M5a has no age-gate UI (M9). The client omits it until then.
6. **Android `device_id` and backup.** Secure Store cannot survive Auto Backup. Progress can. A restored Android phone gets a new `device_id`.
7. **`expo-network` and `@supabase/supabase-js`** are the two additions not written as package names in TECH_SPEC §1.
8. **TECH_SPEC §1 tests** say Jest and React Native Testing Library. The brief says `jest-expo`. M5a uses `jest-expo` and does not add Testing Library; the dev screen is not a product UI test.
9. **Export in CI** is a `.github` change, Lane A.
10. **D3** can block the prebuild check. Lane B does not edit the root override.
11. **Staff hand check** needs a staff user on the local stack Lane A owns. Lane B will not seed one.
12. **Preview URL refresh.** §12.5 says the phone re-fetches the manifest to refresh signed URLs. M5a fetches at the moment of the dev action and discards on sign-out. A timer is out of scope.
