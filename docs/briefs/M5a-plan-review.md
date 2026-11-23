# M5a plan review (Lane B): mobile data layer

**PR:** #20 · **Tip reviewed:** `fdd56b9` · **Brief:** `docs/briefs/M5a-mobile-data.md`

## Verdict

**Approved. Implement it as planned, with the notes below.**

The plan is specific, stays in Lane B's area, and makes the right calls on the hard parts:
- a sentinel resolver for the spike WAVs
- `PRAGMA user_version` with forward-only migrations
- a `SqlDriver` seam for tests
- a staged install committed in one transaction
- a reconcile that drops incomplete packs and keeps progress
- preview isolated in its own directory

## Answers to the spec gaps

1. **iOS database in Application Support, through the local module:** accepted. A small local Expo module (`modules/intell-storage`) is the right tool, since `expo-file-system` has no Application Support path and no exclude-from-backup flag. Keep the native code minimal and document it in `apps/mobile/AGENTS.md`.
2. **§14 primary keys and queue columns:** **the proposed table is accepted as written.** Upserting `completions` on `(fragment_id, revision_no, time_window)` keeps the first on-site completion. That's fine, because replays never write completions.
3. **DATA_MODEL §14 backup sentence:** Claude amends it in this commit to match D6.
4. **Sync triggers:** accepted. Sync on Grove entry comes with M6, queues and `my-entries` with M9/M11, and the Chronicle replay rule with M8.
5. **Age gate:** accepted. Leave it out until M9.
6. **Android `device_id` after a restore:** accepted for M5a, a new id, with the trade-off recorded. It matters for the Journal in M9, where "your idea grew" follows the device id. **The M9 spec decides** whether the id should survive a restore. Don't copy it into SQLite now.
7. **`expo-network` and `@supabase/supabase-js`:** accepted. Claude adds them to TECH_SPEC §1 later.
8. **`jest-expo` without Testing Library:** accepted for M5a. Testing Library arrives with the first product screens (M5b).
9. **Export in CI:** accepted as a **Lane A follow-up**, a small CI job running `expo export --platform android`. It's scheduled after A1.
10. **D3 blocking the prebuild check:** A1 is fixing the React pin now. If prebuild fails before A1 merges, report it and keep going with everything else, as planned.
11. **The staff hand check:** record only the 401/403 path. The positive staff path gets checked with M5b's settings sign-in, using a staff user Jordan creates.
12. **Preview URL refresh:** accepted. No timer in M5a.

## Notes (do these during implementation)

- **N1. Prove `node:sqlite` under `jest-expo` first,** in step 3, before writing the repositories against it. `jest-expo` runs a React Native test environment, and `node:sqlite` needs Node ≥ 22.13 with no flag. If either fails, switch the test driver to `sql.js` (WASM, no native build) behind the same `SqlDriver`. Note which one you used.
- **N2. Re-apply the iOS exclude flag whenever a directory is created.** `NSURLIsExcludedFromBackupKey` sits on the directory itself. Preview sign-out deletes and later recreates `intell-preview`, and a cleanup could recreate `intell-assets`. So the module's "ensure directory" call must set the flag every time it creates one. Add a test of the JS side that calls it.
- **N3. Write the WAL files next to the database.** Open the database in `progressDirectory`, so its `-wal`/`-shm` files sit beside it, in the backed-up place. Assume nothing ever leaves them in a cache folder.
- **N4. Check the vendored code first.** Before writing the local module, confirm `modules/` isn't excluded by the repo's lint, typecheck or `.gitignore` rules, so the module's Swift and Kotlin actually get committed.

## Order and stop points
Follow the plan's order. **Stop at step 9** (open the PR for implementation review) if A1 isn't on `master` yet. Claude tells you when A1 merges, and then you do step 10.

## Report back with
Write `docs/briefs/M5a-report.md`, starting with `Lane B · M5a`. Cover:
- the libraries with their resolved versions
- N1 (which test driver you used)
- the quoted prebuild output: the Android XMLs and manifest attributes, plus the iOS module paths and exclude calls
- the test list with results
- the clean-export result
- the hand-check steps and results
- `git log --oneline origin/master..HEAD`
- any deviations
