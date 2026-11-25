# A8 brief (Lane A): cleanup

**Lane:** A · **Branch:** `a/a8-cleanup`, cut from `master` at `d02c664`. This brief is its first commit. · **No plan step.** Do the items in order, as separate commits, then stop for review.

## 1. TECH_SPEC: location and the session clock (docs only)
These record what M6 (PR #36) actually does.

**§3.3 Location:**
- **During a session**, location runs at **High accuracy for the whole session** (5 m distance interval, roughly 2–5 s). There's no Balanced ↔ High switching. The reason: Android 14+ won't let the location foreground service restart from the background, and expo-location refuses to start it unless the app is in the foreground. On Android, Balanced gives roughly 100 m, network-level accuracy, which never meets the trigger tolerance.
- **Without a session**, there's an on-screen watch, also at High accuracy.
- **A session can only start while the app is on screen.** Once it has started, the phone can be locked and pocketed.
- **There are two foreground services:**
  - **media playback** (the `audio-session` module): playback controls, plus a **Stop exploring** custom command on the notification and the lock screen
  - **location** (expo-location): the notification "InTell is playing your Grove"; tapping it opens the app
- **One location source at a time**, and fixes must be strictly newer than the last one.

**§3.2 Session (the paragraph on the heartbeat):**
- The session and AudioDirector clock is the engine's silent-heartbeat **session clock** (`startSessionClock` / `stopSessionClock`). It runs while exploring and never requests audio focus.
- Location fixes also drive `tick` as a backup.
- The time window is recomputed on every dispatch.

## 2. Archive audio
Version 1 of `export-archive` lists assets but doesn't include their bytes. Make the archive complete without putting a key in any script.
- **`export-archive`:** in `manifest.json`, add a **1-hour signed URL** and an `expiresAt` for every audio and image asset. Use the existing service-side signing; it's still `editor+` only and still audited.
- **`tools/archive-audio`:** a small Node script run by staff. It takes the unzipped archive folder, reads `manifest.json`, downloads every asset into `audio/` and `images/`, **verifies each sha256**, and prints a summary (downloaded, already present, failed). It needs no keys or env. If the URLs have expired, it tells the person to export again.
- **Tests:**
  - the manifest has a URL and an expiry for each asset
  - the tool verifies shas (a mismatch fails) and skips files already present
- Add a short README to the tool.

## 3. Dashboard layout
On `/dashboard`, the **Session starts** section puts "Download CSV" on the right of the heading, while every other section puts it below the description. Make them all match the other sections.

## 4. Duplicate `package.json` script keys (deferred since M2)
Find duplicate keys in the `scripts` of every `package.json` in the repo. JSON silently keeps the last one. Remove the duplicates, keeping the behaviour that's actually used now, and list in the report what you removed.

## 5. WORKFLOW roadmap
Update the roadmap/status table in `docs/WORKFLOW.md` to match reality, using the merged PRs and `docs/briefs/`:
- M3 is complete
- the two-lane setup
- M4: A5 / A6, with the sound features and the AudioDirector
- M5a and M5b are done; M5c (Embark mobile) and M5d (first run) are open
- B·S1–B·S3 are done, and ADR 0001 is decided for Android (iOS pending)
- M6 is in progress (PR #36)
- M11 is done (A7, A7b)

Note the open items:
- the iOS run
- bed streaming (M7)
- the Routes API key for embark
- link-domain hosting (M12)
- removing the debug SHA-1 before launch

## Accept when
- [ ] `pnpm lint` (for the packages you touched), `typecheck` and `test` pass, and both CI jobs are green.
- [ ] No database reset without asking Jordan. Nothing aimed at staging.
- [ ] The report (`docs/briefs/A8-report.md`) lists each item and its commit.

Push with `git push -u origin a/a8-cleanup`, open a PR titled "A8: cleanup", and **stop for review.** **After it merges,** Jordan redeploys `export-archive` to staging; list that step in the report.
