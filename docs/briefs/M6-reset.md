# M6 reset (Claude): read this first. It replaces every earlier "Next" list.

## Why we're resetting
- **The code fixes are on the branch** (`54ca713`): reviews 4, 5 and 6 (F1–F6, RC6, RC7) plus the `file://` pack URIs. **Their requirements still stand.** Only the process is reset.
- **What has been missing is a reliable, repeatable way to build, load and check the phone.** The last session went into setup, not audio.
- **The app installed on the Pixel was built without the walk settings.** Its Data screen says "Supabase URL and publishable key are not set". It can't download the walk packs, so every device step after that was bound to fail.
- **The walk is now Friday. There's no rush.** We want correctness and evidence, not speed. Audio is the product.

## The one goal
**A scanned story plays audibly on Jordan's Pixel, from the walk packs, through the full M6 path (session → director → engine), and we can prove it with evidence, then repeat it the same way every time.**

## Ground rules (these apply from now on)
1. **The Pixel is Jordan's personal phone.**
   - Never run adb commands that touch the screen or apps (`input`, `am start`, `uiautomator`, `screencap`) unless Jordan has said in this chat that **the phone is free now**. Ask at the start of each device step.
   - Stop the moment he says he needs it.
2. **Capture only InTell.**
   - Prefer `uiautomator dump` text of the Data screen to screenshots.
   - Never capture other apps, notifications or calls.
   - **Now:** delete `local/m6-walk-test/wake-check.png` and `shade-check.png`, and any other capture showing anything but InTell.
3. **Keep the repo free of personal details.** It's public.
   - No device usage, apps, contacts or call details in committed docs.
   - Move `docs/briefs/M6-a1-silence-handoff.md` into `local/m6-walk-test/` (gitignored), and don't commit it.
4. **One script per job.**
   - No hand-typed command sequences.
   - Scripts live in `local/m6-walk-test/` (gitignored). Each one prints what it checks, and never prints keys or coordinates.
5. **Two strikes.** If a step fails twice, stop: save the evidence to a timestamped folder and report. No speculative fixes.
6. **Scope:** `apps/mobile` and the local scripts only.
   - No new product features, refactors or `packages/shared` changes.
   - No database reset.
   - No change to the walk layout or the narrations.
   - The only new code allowed is the dev-only deep links in step 3.

## Current state (verified by Claude)
- Branch `b/m6-narration-session` at `54ca713`, pushed. The working tree is clean apart from the untracked handoff doc. **Confirm that CI is green on `54ca713`.**
- **On the phone:** a release build without the walk env; the session is idle. Whether the walk packs are installed is unconfirmed.

## Steps (in order; each has a "done when")
### Step 0: housekeeping (no device)
- Delete the screenshots (rule 2), and move the handoff doc (rule 3).
- **Done when:** `git status` is clean, and `local/` holds no non-InTell captures.

### Step 1: prove the play path in tests (no device)
- If it doesn't exist yet, add one end-to-end runtime test that uses all of these:
  - the real `buildPackedSession` on an existing demo pack fixture, with one fragment physical and given a test marker hash (no real coordinates)
  - the real `ExploringRuntime`
  - the real `applyDirectorCommands`
  - the strict fake engine
- **Assert:**
  - A scan → `engine.load` is called with a `file://` URI for that narration's sha at 24 kHz.
  - `playNarration` is executed once, the voice is live, and master is restored.
  - There are no `cmd-fail` breadcrumbs.
  - A fake natural end → completion → afterglow.
- **Done when:** the test passes, and `pnpm --filter @intell/mobile lint`, `typecheck` and `test` are green.

### Step 2: one reliable build script (`run-release-build.mjs`)
Make one command do everything and check itself:
1. **Preflight** (fail fast, with a clear message):
   - adb sees exactly one USB device.
   - Local Supabase answers at `http://127.0.0.1:54321`. If it doesn't, STOP and ask Jordan to have Lane A start its stack. Never start a stack from Lane B's folder.
   - The pack index lists both walk groves.
2. **Env for this process only:**
   - the URL
   - the publishable key, from `supabase status`, never printed
   - `EXPO_PUBLIC_ALLOW_LOCAL_CLEARTEXT=1`
   - the Maps key, from `apps/mobile/.env`, never printed
3. `pnpm exec expo prebuild --clean --platform android`, then the release build (no Metro).
4. **Verify before installing:**
   - the **merged** release manifest has `FOREGROUND_SERVICE_LOCATION`, `LocationTaskService` with type `location`, both intent filters, and `networkSecurityConfig`
   - the JS bundle inside the APK contains `127.0.0.1:54321`, which proves the env was baked in
5. `adb install -r`, keeping the data. Never uninstall without Jordan's OK.
- **Done when:** the script exits 0 and prints every check as passed. Then, **with Jordan's OK,** a `uiautomator` dump of the Data screen no longer says "not set".

### Step 3: one reliable pack load (no typing on the phone)
- **Add dev-only deep links**, handled by the Data screen and active only in local walk builds (behind `EXPO_PUBLIC_ALLOW_LOCAL_CLEARTEXT`):
  - `intell://dev/data?install=<groveId>,<groveId>&sync=1` installs both groves, syncs, and shows the result
  - `intell://dev/data?reset=1` runs "Reset session (keep packs)"
- **One script, `load-walk-packs.mjs`,** replaces both `adb-install-groves*.mjs` (delete those). It:
  - runs `adb reverse tcp:54321 tcp:54321`
  - opens the install link
  - waits
  - reads the Data screen text
  - checks for **Packs ≥ 3** and **Assets ≥ 21**
- **Done when:** the counts match, with Jordan's OK to use the phone.

### Step 4: prove playback without anyone's ears (`check-play.mjs`; phone free)
1. Open the reset link.
2. `adb shell am start -W -a android.intent.action.VIEW -d "intell://f/WTQR0001" org.replaceplace.intell`
3. Wait 8 s.
4. Open `intell://dev/data`, dump its text, and collect `adb logcat -d -s InTellAudio`.

**It passes when all of these are true:**
- `sessionStarted=true`
- the narration line shows a live voice, not paused, with the position above 0
- **`out` is between −35 and −10 dB**
- the breadcrumbs show the load and `playNarration` with no `cmd-fail`

**Optional:** about 110 s later, a `natural` end breadcrumb and a completion.
- **Done when:** it passes **twice in a row.** On failure, save the dumps and log to `local/m6-walk-test/check-<time>/`, report, and STOP (rule 5).

### Step 5: Jordan's ear check (arrange a time with him)
- Run A1–A9 from review 5 unchanged, using these scripts, with earbuds connected first.
- Jordan listens. You drive only while he says the phone is free.
- One line per step.

### Step 6: report and stop
- Update `M6-report.md`: what passed, the evidence for each, and what's open. No personal details.
- Push, and STOP.

## After this (not now)
Once step 5 passes, Claude writes the next brief: **a listening pass on the real phone**. That covers:
- how a story starts and ends
- fades and the feel of a resume
- loudness consistency
- the threshold motif and the afterglow

That's where we make it beautiful. Don't start any of it now.
