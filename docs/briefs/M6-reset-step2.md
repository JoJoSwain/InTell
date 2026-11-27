# M6 reset, Step 2 unblock (Claude)

Good stop. The two-strikes rule worked as intended.

**The diagnosis:**
- **Strike 1** is the Windows path-length problem. The folder Ninja tried to create is **263 characters**, over Windows' 248-character limit for folders.
- **The build used the old Ninja** (`Sdk\cmake\3.22.1\bin\ninja.exe`, from Ninja 1.10), which can't handle long paths.
- **This was solved in M1:** `docs/spikes/M1-audio-build-notes.md` has the recipe.
  - Windows long paths on.
  - SDK **CMake 3.31.6**, which ships **Ninja 1.12.1** and is long-path aware.
  - `android.cmakeVersion=3.31.6`.
- The reset's `prebuild --clean` wiped the `android/` copy of that setting.
- `react-native-audio-api` doesn't pin a CMake version, so without an override AGP falls back to 3.22.1.
- **Strike 2** (`No such property: libraryVariants for class: java.lang.String` in expo-constants) came after hand edits and passing `-Pandroid.cmakeVersion` on the command line. Treat it as a side effect of those experiments: undo them, and don't pass that flag again.

## Jordan's approval for this step
Jordan approves deleting **build caches only**:
- `apps/mobile/android/` (`prebuild` regenerates it)
- every `node_modules/**/android/.cxx` and `node_modules/**/android/build` folder

Nothing else. Don't touch `%USERPROFILE%\.gradle` beyond the single line described below.

## 2a. Read-only diagnosis (no changes)
Write your findings to `local/m6-walk-test/step2-diagnosis.txt`:
1. `reg query HKLM\SYSTEM\CurrentControlSet\Control\FileSystem /v LongPathsEnabled`. **If it isn't `0x1`, STOP** and ask Jordan to run this once in an **admin** PowerShell, then reboot:
   `New-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem" -Name LongPathsEnabled -Value 1 -PropertyType DWORD -Force`
2. Which CMake versions are installed: `dir %LOCALAPPDATA%\Android\Sdk\cmake`. If `3.31.6` is missing, install it with `sdkmanager "cmake;3.31.6"`.
3. Whether `%USERPROFILE%\.gradle\gradle.properties` contains `android.cmakeVersion=3.31.6`. Report the line only; never print the rest of the file.
4. How the **post-F4 release build that worked today** (the one installed at about 13:30–14:30 MT) was run: the exact command, env and `android/gradle.properties` lines. That recipe worked this afternoon.
5. Any native module that pins a CMake version: grep `node_modules/*/android/build.gradle*` for `version "3.` / `version = "3.`.

## 2b. Fix the build script (`run-release-build.mjs`)
- **Reproduce today's working recipe** from 2a.4, plus:
  - After `prebuild --clean`, make sure `android.cmakeVersion=3.31.6` is in `apps/mobile/android/gradle.properties` (the M1 recipe).
  - **If the build still invokes 3.22.1:** write `android/local.properties` with `sdk.dir` and `cmake.dir` pointing to the SDK's `cmake\3.31.6`. This is AGP's documented override, and the file is machine-local and regenerated. Do this only if 2a.5 found no module pinning a different version; otherwise STOP and report.
- **Build only `arm64-v8a`** (the Pixel). Set it via the env var `ORG_GRADLE_PROJECT_reactNativeArchitectures=arm64-v8a`. That's four times less native work and fewer long paths.
- **No `-P` flags** for the CMake version, and no hand edits inside `android/`.
- **Before the first rebuild,** delete the approved caches, so no stale CMake cache points at the old Ninja.
- **Check that it worked:** the build log must show `cmake\3.31.6\bin\ninja.exe`. Make the script fail if 3.22.1 appears.
- **Keep the existing checks:** the merged manifest, and `127.0.0.1:54321` in the bundle.
- **Supabase preflight:** `imgproxy` and `pooler` being stopped is normal for a local stack and isn't a blocker. Check that `GET /rest/v1/` with the publishable key answers and that the pack index lists both walk groves. If the API doesn't answer, STOP and ask Jordan to have Lane A restart its stack.
- **For later builds,** use `prebuild --clean` only when native config changes (plugins, `app.config.ts`, native package versions). Otherwise reuse `android/`, and still run every check.

## Commit
- Commit Step 1's test now: "test(mobile): M6 play-path end-to-end (reset step 1)".
- The script and its logs stay in `local/` (gitignored).

## Two strikes
They reset for this new attempt. If the build fails twice more, STOP: save the logs and the diagnosis, and report.

**Done when:** the script exits 0 with every check passed, and the log shows Ninja 3.31.6. Then ask Jordan, "Is the phone free for about 10 minutes?", and continue with the reset's Step 2 final check and Steps 3–4.
