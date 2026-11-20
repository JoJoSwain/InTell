# M1 audio spike — build notes

## Dependencies
Installed with `pnpm exec expo install` (from `apps/mobile`, via short path `R:\` when needed):

| Package | Version |
|---|---|
| `react-native-audio-api` | `1.0.1` |
| `expo-dev-client` | `~58.0.21` |
| `expo-file-system` | `~58.0.14` |

Docs used: https://docs.swmansion.com/react-native-audio-api/ (Latest). After install, plugin schema matched the plan (`iosBackgroundMode`, `androidForegroundService`, `androidFSTypes`, `androidPermissions` including `POST_NOTIFICATIONS`). No DynamicsCompressorNode in 1.0.1 — master path is gain-only.

## Fixtures
```bash
pnpm --filter @intell/audio-fixtures generate
```
WAVs are gitignored. Run before Metro / prebuild / `run:android`.

## Android local dev build (required)
Windows long paths: use subst drive **`R:` → `C:\Users\jorda\source\Replaceplace`** (preferred over `C:\rp`).

```bat
subst R: C:\Users\jorda\source\Replaceplace
cd /d R:\apps\mobile
pnpm --filter @intell/audio-fixtures generate
rmdir /s /q android
pnpm exec expo prebuild --platform android --clean
pnpm exec expo run:android
```

Deep link: `adb shell am start -a android.intent.action.VIEW -d "intell://dev/audio-spike"`

Package id: `org.replaceplace.intell`

## iOS cloud dev build (JoJo — needs credentials)
**Do not run credentialed EAS from the spike agent.**

1. Expo account + Apple Developer account; register the physical iPhone.
2. From `apps/mobile`:
   ```bash
   pnpm exec eas-cli init   # sets real projectId (app.json still has placeholder)
   pnpm exec eas-cli device:create
   pnpm exec eas-cli build --profile development --platform ios
   ```
3. `eas.json` `development` profile: `developmentClient: true`, `distribution: internal`, `ios.simulator: false`.
4. Install the build on device; open `intell://dev/audio-spike`.

## Capability summary (library 1.0.1)
| Capability | Status | Docs |
|---|---|---|
| Background / locked screen | Plugin + `PlaybackNotificationManager.show` (Android FGS) | [plugin](https://docs.swmansion.com/react-native-audio-api/docs/other/audio-api-plugin/), [best practices](https://docs.swmansion.com/react-native-audio-api/docs/fundamentals/best-practices/) |
| Lock-screen controls | `PlaybackNotificationManager` | [notification manager](https://docs.swmansion.com/react-native-audio-api/docs/system/playback-notification-manager/) |
| Route changes | `routeChange` + `getDevicesInfo` (Android `currentOutputs` empty — heuristic) | [AudioManager](https://docs.swmansion.com/react-native-audio-api/docs/system/audio-manager/) |
| Interruptions | `observeAudioInterruptions('gain')` | same |
