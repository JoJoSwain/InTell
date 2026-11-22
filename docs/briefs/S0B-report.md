Lane B · S0B

Report-only health check of the mobile workspace on `b/s0-mobile-check` (tip before this report: `090fb5c`). Nothing under `apps/` or `packages/` was changed. No Supabase stack, `db reset`, `pnpm db:setup-local`, or admin Playwright run.

## Checks

| Command | Result |
|---|---|
| `pnpm --filter @intell/mobile typecheck` | Pass. `tsc --noEmit`, exit 0 (~8 s). |
| `pnpm --filter @intell/mobile lint` | Pass. `expo lint`, exit 0 (~11 s). No findings printed. |
| `pnpm --filter @intell/shared test` | Pass. Vitest 3.2.7, 13 files, 83 tests, ~3.4 s. |

`apps/mobile` `test` is still `echo "mobile: no unit tests in M0"`, so a root `pnpm test` does not exercise mobile code.

## expo-doctor

`pnpm --filter @intell/mobile exec expo-doctor` failed: `expo-doctor` is not a dependency of `@intell/mobile` (`Command "expo-doctor" not found`).

Fallback, from `apps/mobile`: `npx expo-doctor` (ephemeral `expo-doctor@1.21.8`, not added to the repo). **19/20 checks passed. 1 failed.**

Failed check: packages must match the installed Expo SDK.

| package | expected | found |
|---|---|---|
| `react` | 19.3.0 | 19.2.4 |
| `react-dom` | 19.3.0 | 19.2.4 |

`apps/mobile/package.json` declares `react` and `react-dom` at `19.3.0`. The lockfile resolves both to `19.2.4` (React Native `0.88.1` is installed against that). Doctor's advice was `npx expo install --check`. Not run, and nothing was upgraded.

Expo SDK on this branch: `expo ~58.0.26`, `react-native 0.88.1`.

## Bundling

`pnpm --filter @intell/mobile exec expo export --platform android --output-dir` a temp folder outside the repo (`%TEMP%\intell-s0b-android-export`).

**Metro started and the Android bundle failed.** Exit 1. Wall time ~17 s. Expo reported bundling failed after ~11 s (`entry.js`, 1282 modules) with:

`Unable to resolve "../../../assets/spike-audio/narration_90s.wav" from apps/mobile/src/audio/spike/assets.ts`

`app/dev/audio-spike.tsx` imports that module, and Expo Router's `require.context` pulls the route in, so the static `require`s of the spike WAVs fail the whole export. Those WAVs are gitignored (`apps/mobile/.gitignore`). This worktree has `assets/spike-audio/README.md` only. The README says to generate them with `pnpm --filter @intell/audio-fixtures generate`. `fixturesReady.ts` can show a “run the generator” message at runtime, but Metro still resolves the `require`s first, so a missing fixture set blocks export. Not generated here (that would write under `apps/mobile`).

Incidental Metro warning: `NO_COLOR` is ignored because `FORCE_COLOR` is set.

## Inventory of `apps/mobile`

SDK 58 Expo Router app. Routes are in `app/`. Non-route code is only the M1 audio spike.

**Routes (`app/`)**

| Path | What it is |
|---|---|
| `_layout.tsx` | Stack. Map home, modal Welcome / Journal / Grow / Settings, `f/[code]`, dev audio spike. |
| `index.tsx` | M0 map stub. Bottom bar: Journal, Grow, Settings. One `pickL10n` string. Comment still says MapLibre lands in M5. |
| `welcome.tsx` | First-launch stub. Copy still says the story grows with what you plant. |
| `journal/index.tsx` | Stub. Copy still describes the Chronicle's look-back role. |
| `grow/index.tsx` | Stub. ADR 0004 replaced Grow with Journal. |
| `settings/index.tsx` | Stub. |
| `f/[code].tsx` | QR entry stub. Renders the route param on screen. Comment says universal links in M6. |
| `dev/audio-spike.tsx` | M1 spike screen. |
| `+not-found.tsx`, `+html.tsx` | Router defaults. |

No `chronicle/` route. No Embark control. Settings is a bottom-bar item, not top right.

**`src/`**

- `audio/engine/`: `index.ts`, `RNAudioApiEngine.ts`, `lruCache.ts`, `routeMap.ts`
- `audio/spike/`: `assets.ts`, `fixturesReady.ts`, `logger.ts` (`expo-file-system` legacy API, log under `documentDirectory`)

`AGENTS.md` lists `map/`, `location/`, `session/`, `packs/`, `chronicle/`, `journal/`, `preview/`, `recording/`, `analytics/`, `api/`, `ui/`, `i18n/`. None of those directories exist.

**`e2e/` and `assets/`**

- `e2e/demo-route.gpx` only (Farmington Bird Refuge demo route, generated from the fixture).
- `assets/fonts/SpaceMono-Regular.ttf`
- `assets/images/`: icon, splash, favicon, Android adaptive icon foreground / background / monochrome
- `assets/spike-audio/README.md` only (WAVs absent; see bundling)

**`app.json` / `eas.json` (names only)**

- Name `InTell`, slug `intell`, version `0.0.0`, scheme `intell`, portrait, light UI.
- iOS `bundleIdentifier` and Android `package`: `org.replaceplace.intell`.
- Plugins: `expo-router`; `expo-splash-screen`; `react-native-audio-api` (iOS background mode, Android foreground service type `mediaPlayback`, permissions `MODIFY_AUDIO_SETTINGS`, `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_MEDIA_PLAYBACK`, `POST_NOTIFICATIONS`).
- No maps plugin, no `app.config.js`, no `apps/mobile/.env` or `.env.example` on this branch. No Maps SDK key name is wired in the current app config.
- `extra.eas.projectId` is still the placeholder `replace-with-eas-project-id`.
- `eas.json`: CLI `>= 14`, `appVersionSource: remote`. Profiles `development` (dev client, internal, iOS simulator false), `preview` (internal), `production` (empty). `submit.production` empty.

**Native `android/`**

Absent, and so is `ios/`. Both are gitignored for Continuous Native Generation. No prebuild output in this worktree, so there is no `fullBackupContent` / `dataExtractionRules` (or any other native backup rule) on disk.

Dependencies present that M5 will build on: `expo-dev-client`, `expo-file-system`, `expo-router`, `@intell/shared`, `react-native-audio-api`. Not installed: `expo-sqlite`, `expo-secure-store`, `expo-location`, `react-native-maps`.

## `origin/preview/m5-google-map-home`

Read only. `8c0e712` (2026-11-19), subject `preview(m5): Google Maps home map demo (pending ADR 0002)`. Parent `5130faf` (M0 scaffold).

Against `origin/master` (`dbc9412`, 2026-11-22): **151 commits behind, 1 commit ahead.** `git diff origin/master...origin/preview/m5-google-map-home --stat`: 10 files, +687 / −90.

What that commit contains:

- `apps/mobile/src/map/MapHome.tsx`, `demoContent.ts`, `src/ui/tokens.ts`
- `app/index.tsx` renders `MapHome`
- `app.config.js` adds plugins `expo-location` and `react-native-maps`, and reads the env **name** `GOOGLE_MAPS_API_KEY` into the Android Maps config (empty string if unset). `extra.hasGoogleMapsApiKey` is a boolean. iOS key is not set there.
- `apps/mobile/.env.example` and a root `.env.example` hunk document `GOOGLE_MAPS_API_KEY` with an empty value. No key value is in the commit.
- `package.json` adds `expo-location ~58.0.22` and `react-native-maps 1.29.11`, plus a `prebuild` script. Lockfile updated.
- `docs/intell-home-map-notes.md` (2026-11-19): full-bleed Google map, While-Using location, demo grove polygon and two root markers, chrome **Journal · Grow · Settings**. Notes say no device install was done and a Maps key still had to be pasted locally.

**ADR 0004 / 0005:** the map provider matches later Accepted ADR 0002 (Google, `PROVIDER_GOOGLE`). The chrome does not match ADR 0004 decision 19 or ADR 0005 §5. The bar is three equal items, Journal · Grow · Settings. There is no Chronicle (bottom left), no Embark (center), no Journal at bottom right, and Settings is not top right. Grow is the center control; ADR 0004 decision 17 replaced Grow with Journal. Location permission is requested when the map mounts, with no explainer screen (`apps/mobile/AGENTS.md` says the explainer comes first). Markers set `title` to the root title; locked fragments must not show a title. The commit message still says ADR 0002 was pending.

It will not drop onto current `master` cleanly. `app/index.tsx`, `package.json`, and `pnpm-lock.yaml` have all moved since M0 (M1 audio spike and later). Master has no `app.config.js`.

## Gaps for M5a

M5a, per `docs/WORKFLOW.md` §6: device database (OS backup includes it), pack index, download and sync with mandatory deletion, device registration, staff preview. None of that exists in `apps/mobile`.

**Device database.** No `expo-sqlite`. No local tables from DATA_MODEL §14 (`packs`, `assets`, `completions`, `unlocks`, `progress`, `visits`, `met_characters`, `my_entries`, `preview`, queues, `kv`). Nothing chooses a backed-up path (TECH_SPEC §3.3 / ADR 0005 §1: iOS Application Support, not excluded from backup; Android Auto Backup with the database in `fullBackupContent` / `dataExtractionRules`). No native project exists to hold those rules. `expo-file-system` is only used by the spike log under `documentDirectory`.

**Pack index, download, sync.** Server `get_pack_index()` exists and `anon` may execute it. Shared already exports `PackIndexEntry`, `GrovePack`, `RegionPack`, and `PreviewManifest`. There is no mobile API client, no download or sha verify, no atomic install, and no sync that deletes local assets whose sha is absent from installed manifests. The M5 acceptance test for that deletion does not exist. `packages/shared` has no sync-deletion helper. If that rule is pure logic, it belongs in `packages/shared` (Lane A). Lane B cannot add it.

**Device registration.** No `register-device` edge function under `supabase/functions/`. No mobile caller. `expo-secure-store` is not installed (`device_id` has nowhere to live as a bearer secret). This endpoint is Lane A's.

**Staff preview.** The `preview` edge function exists (staff JWT, preview manifest). The phone has no staff sign-in, no preview mode, and no local `preview` row kept apart from installed packs.

**Unit-test runner.** Mobile `test` is the M0 echo. No Jest or Vitest config or devDependency in `apps/mobile`. A deletion test cannot land until a runner exists. Shared Vitest is green and is the place for pure rules; mobile still needs its own runner for anything that is not pure.

**Shared logic M5 will also need, not in the tree yet.** `timeWindow.ts` is present. There is no `unlock.ts`. WORKFLOW schedules that in Lane A M4a before the map uses it. Marker opacity is M5b, not M5a, but M5a should not assume `unlock` is available.

**Not M5a, visible while inventorying.** Current shell and the preview branch both still use the M0 Grow bar. Embark, Chronicle, and the backup copy in Settings are unbuilt. `welcome.tsx` and `journal/index.tsx` still use pre-realignment copy. `f/[code].tsx` prints the route param.

## Not done

No code or dependency changes. Spike WAVs were not generated. `expo install --check` was not run. No prebuild, no device install, no `supabase` commands, no admin Playwright.
