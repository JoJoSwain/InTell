# Fixing Expo CLI "TypeError: fetch failed" Error

## Problem

The error is coming from **Expo CLI itself** (not your app code), during Metro bundler startup. Expo is trying to fetch native module version information from their API and failing.

**Error location:** `@expo/cli/src/api/getNativeModuleVersions.ts`

## Quick Fixes (Try in Order)

### Solution 1: Start Expo in Offline Mode (Fastest Fix)

Start Expo with `--offline` flag to skip API checks:

```bash
cd App.js
npx expo start --offline
```

Or use:
```bash
npx expo start --no-dev --offline
```

### Solution 2: Clear Expo Cache

Clear Expo's cache and try again:

```bash
cd App.js
npx expo start --clear
```

### Solution 3: Check Internet Connection

- Verify you have internet access
- Try opening: https://exp.host in your browser
- If blocked, you may need to use offline mode

### Solution 4: Skip Version Checking (If Offline Mode Doesn't Work)

Add this to your `package.json` scripts:

```json
"start:offline": "expo start --offline",
"start:no-check": "EXPO_NO_VERSION_CHECK=true expo start"
```

Then run:
```bash
npm run start:offline
```

### Solution 5: Use Alternative Start Command

Try using the legacy start command:

```bash
cd App.js
npx expo-cli start
```

Or with React Native CLI (if available):
```bash
npx react-native start
```

## Recommended Action

**Start with Solution 1** (offline mode) - this is the quickest fix:

```bash
cd App.js
npx expo start --offline
```

The `--offline` flag tells Expo to skip version checks and work entirely from your local cache.

## Why This Happens

- Expo CLI tries to fetch latest module versions during startup
- This requires internet connection to Expo's API
- Network issues, firewall, or proxy can block this
- The `--offline` flag bypasses all API calls

## Testing After Fix

Once Expo starts successfully:
1. You should see the QR code
2. Metro bundler will be running
3. You can press `a` for Android or `i` for iOS

---

**Status:** This is an Expo CLI issue, not your app code. Using `--offline` flag should resolve it immediately.
