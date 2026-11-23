# M5a brief (Lane B): the mobile data layer

**Lane:** B (Mobile) · **Branch:** `b/m5a-mobile-data` (in `C:\dev\intell-lanes\b`, cut from `87d32cf`, with this brief committed) · **Plan first:** write `docs/briefs/M5a-plan.md`, push, open the PR, and stop for Claude's plan review before writing code.

**What M5a is:** everything the phone needs to hold and refresh story content, with no map or design work. Screens come in M5b, after the DESIGN rewrite with Ashley. M5a may add a **dev-only** screen under `app/dev/` to exercise the data layer by hand. **Sources:** BUILD_PLAN M5, TECH_SPEC §3.3–3.4, DATA_MODEL §12 and §14, ADR 0005 §1, and the S0B review.

## Depends on Lane A's A1 (in progress in parallel)

These come from `packages/shared` after A1 merges. **Lane B never edits `packages/shared` or `supabase/`.**
- `RegisterDeviceRequest` and `RegisterDeviceResponse`, and the `register-device` function
- `manifestShas`, `assetsToFetch` and `assetsToDelete`

Build everything else first, behind small interfaces. When Claude says A1 has merged, merge `origin/master` and wire these in. M5a can't finish before then.

## Scope

1. **Fix the clean export (S0B D2).**
   - `pnpm --filter @intell/mobile exec expo export --platform android` must succeed on a clean checkout without the gitignored spike WAVs.
   - Keep the M1 audio-spike screen working when the fixtures are generated, because the ADR 0001 device tests are still pending.
2. **Add a real mobile test runner.** Use `jest-expo` (Expo's standard). Make `pnpm --filter @intell/mobile test` run real tests, and add the matching `lint`/`typecheck` hygiene. Root `turbo`/CI wiring is Lane A's: if the root needs a change to pick up mobile tests, say so in the report.
3. **Device database (DATA_MODEL §14).**
   - Use `expo-sqlite` and create every table listed in §14 now, with a schema version and forward-only migrations.
   - Wrap it in a thin, typed data-access module (`src/db/`).
4. **Backup split (decision D6, made in this brief).**
   - **The database is backed up.** It's small and is the listener's progress (ADR 0005 §1):
     - iOS: Application Support, not excluded from backup.
     - Android: included by Auto Backup.
   - **Downloaded packs and assets are excluded from backup.** They can be downloaded again. On iOS, Apple's storage guidelines want re-downloadable data kept out of backups. On Android, Auto Backup has a 25 MB per-app limit, and going over it means **nothing** is backed up, the progress database included.
   - **Set the backup rules through app config or a config plugin** (CNG; there's no committed `android/` or `ios/`). That means Android `dataExtractionRules`/`fullBackupContent` that include the database and exclude the asset folders. To check, run `expo prebuild` into a temp folder and quote the generated manifest and rules in the report. Don't commit native folders.
   - **After a restore,** the `packs` and `assets` rows survive but the files don't. On launch, reconcile the rows against the files on disk, and treat any pack with missing files as not installed, so it downloads again.
   - Claude updates TECH_SPEC §3.3 to match this split in this commit.
5. **Device identity.**
   - On first launch, generate a v4 UUID `device_id` and keep it in `expo-secure-store`. It's a bearer secret: never shown, and never logged beyond 8 characters.
   - Call `register-device` on first launch and whenever the app version changes, once A1 lands.
6. **Pack index, download and install (TECH_SPEC §3.4, DATA_MODEL §12).**
   - Call `get_pack_index()` with the publishable key.
   - **Download** means: fetch the manifest and verify its sha256, then fetch the missing assets by sha, verifying each file's sha256. Write to a temp location, then **install atomically**: move the files, then one database transaction. A restart must skip files already verified.
   - Treat Storage **400 and 404** both as "missing".
   - **Cellular versus Wi-Fi** is a policy hook. M5a auto-downloads on Wi-Fi and asks a callback on cellular; the prompt UI comes in M5b.
7. **Sync (TECH_SPEC §3.4)** runs on app foreground, on regaining connectivity, and as a manual dev action. It re-fetches the index, diffs the manifests of newer versions, downloads new assets under the policy above, and then **deletes every local asset that isn't in any kept pack** (the shared helper). It skips the steps that belong to later milestones: queues and `my-entries`.
8. **Staff preview (DATA_MODEL §12.5).**
   - Staff sign-in uses email and password through Supabase Auth, as a minimal dev-screen flow; the Settings UI comes in M5b.
   - Fetch a preview manifest for a chosen release from `preview`, and store it in the `preview` table, **apart from installed packs**. Its assets are fetched at fetch time.
   - Discard everything on sign-out.
   - **A non-staff device never gets preview content.** Test it.
9. **Config.** Add an `app.config` pattern that reads the Supabase URL and **publishable** key from public env names. Document the names in `apps/mobile/.env.example`, with names only.

## Accept when (M5a's share of the M5 criteria)
- [ ] The clean `expo export --platform android` passes, and `pnpm --filter @intell/mobile test`, `typecheck` and `lint` pass.
- [ ] **Unit tests:**
  - the database migrations create every §14 table
  - the installer is atomic: a failed download leaves no partial pack
  - verification rejects a bad sha
  - Storage 400/404 is treated as missing
  - the post-restore reconcile works
  - preview is isolated and cleared on sign-out
  - **sync deletes assets missing from every kept manifest** (using the shared helper)
- [ ] The prebuild output shows the backup split (the database in, the assets out) on Android and iOS.
- [ ] By hand on a dev build (an emulator is fine): download the seeded demo grove from the **local** stack (Lane A runs it, and Lane B never resets it), sync, and check that the files and rows match. Record the steps.
- [ ] `device_id` never appears in full in logs. No location is stored.

## Out of scope
The map, markers, Embark, sheets, onboarding and any design tokens (M5b). Also location, audio playback and sessions (M6), the event queue and analytics (M11), and the Journal (M9).

## Plan (stop after this)
`docs/briefs/M5a-plan.md` should cover:
- the libraries and their versions
- the module layout under `src/`
- the database schema and migration approach
- the backup config approach and how you'll verify it
- the installer's atomicity design
- the test strategy (what's mocked)
- the order of work and where A1 plugs in
- any spec gaps

Push with `git push -u origin b/m5a-mobile-data`, open a PR titled "M5a: mobile data layer (plan)", and **stop for plan review.**
