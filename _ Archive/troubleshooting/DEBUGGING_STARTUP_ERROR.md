# Debugging Startup Error - Blue Screen

## Problem
App loads for ~45 seconds, then shows blue error screen with "Something went wrong" message.

## Root Cause
The app had **conflicting navigation systems**:
- `app.json` had `"expo-router"` plugin enabled
- App uses React Navigation (not Expo Router)
- There's an `app/` folder with Expo Router files that conflicts

## Fix Applied
✅ **Removed `expo-router` plugin from `app.json`**
✅ **Removed `typedRoutes` experiment** (only works with Expo Router)

## Next Steps to Fix

### Step 1: View Error Log
**In the Expo app on your phone/emulator:**
1. Click **"View error log"** at the bottom of the blue screen
2. Screenshot or copy the error message
3. This will tell us the exact JavaScript error

### Step 2: Clear Cache and Restart
**In your terminal:**
```bash
cd App.js
npx expo start --clear
```

Then press `a` to launch on Android again.

### Step 3: Check for Other Issues

**Common causes of crashes:**

1. **Missing native modules**
   - Some packages like `react-native-sound` require native code
   - If using Expo Go, these won't work
   - Need a development build instead

2. **Import errors**
   - Check terminal for "Module not found" errors
   - Verify all imports in `App.js` are correct

3. **Missing assets**
   - Check if splash screen images exist:
     - `./assets/images/splash-icon.png`
     - `./assets/images/icon.png`
   - If missing, create placeholder files

### Step 4: Check Terminal for Errors
**While Expo is running:**
- Look for red error messages in the terminal
- Check for "Unable to resolve module" errors
- Look for "Cannot read property" errors

## Quick Test: Try Simplified Version

If the error persists, try temporarily commenting out services in `App.js` to isolate the issue:

1. Comment out service imports one by one
2. Comment out `initializeApp()` calls
3. See if a minimal version loads

## Most Likely Issues

### Issue #1: Native Modules in Expo Go
If you're using **Expo Go**, these packages won't work:
- `react-native-sound` (requires native code)
- `@react-native-firebase/*` (requires native code)
- `react-native-haptic-feedback` (may not work)

**Solution:** Create a development build:
```bash
cd App.js
npx expo prebuild
npx expo run:android
```

### Issue #2: Missing Mock Login Handler
The `AuthScreen` might be trying to call `onLogin` but it fails.

**Check:** Does `App.js` have a `handleLogin` function that's properly implemented?

### Issue #3: API Service Crash on Startup
`APIService` tries to make API calls during initialization, which might crash.

**Check:** Does the error log mention "fetch failed" or "network error"?

## What to Do Right Now

1. **Click "View error log"** in the app and share the error
2. **Clear cache:** `npx expo start --clear`
3. **Check terminal** for error messages
4. **Share the error log** so we can fix the specific issue

---

**The fix I applied should help, but we need to see the actual error message to fix the root cause.**
