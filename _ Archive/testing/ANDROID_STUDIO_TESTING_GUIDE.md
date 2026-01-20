# Android Studio Testing Guide - ReplacePlace App

## Step-by-Step Guide to Test in Android Studio

---

## Prerequisites Checklist

Before starting, ensure you have:
- [ ] Android Studio installed (latest version recommended)
- [ ] Android SDK installed
- [ ] At least one Android Virtual Device (AVD) created
- [ ] Expo development server running (`npm start` in `App.js` folder)
- [ ] Node.js and npm installed

---

## Part 1: Set Up Android Emulator

### Step 1.1: Open Android Studio

1. Launch **Android Studio**
2. If you see "Welcome to Android Studio" screen, click **"More Actions"** → **"Virtual Device Manager"**
3. Or go to: **Tools** → **Device Manager** (from an open project)

### Step 1.2: Create Android Virtual Device (AVD) - If Not Already Created

1. In **Device Manager**, click **"Create Device"** (or **"+"** button)
2. **Select Hardware:**
   - Choose **"Pixel 7"** or **"Pixel 5"** (recommended for testing)
   - Click **"Next"**
3. **Select System Image:**
   - Choose **"Tiramisu"** (API Level 33) or **"UpsideDownCake"** (API Level 34)
   - If image not downloaded, click **"Download"** next to it
   - Wait for download to complete
   - Click **"Next"**
4. **Verify Configuration:**
   - Name: `Pixel_7_API_33` (or your preferred name)
   - Orientation: **Portrait** (recommended)
   - Click **"Finish"**

### Step 1.3: Start the Emulator

1. In **Device Manager**, find your created AVD
2. Click the **▶️ Play button** (green triangle) next to your AVD
3. Wait for emulator to boot (may take 1-2 minutes on first launch)
4. You should see the Android home screen

**✅ Success:** Android emulator is now running

---

## Part 2: Connect Expo App to Android Emulator

### Step 2.1: Verify Expo Server is Running

1. Open **Terminal/Command Prompt**
2. Navigate to your project:
   ```bash
   cd App.js
   ```
3. Start Expo server (if not already running):
   ```bash
   npm start
   ```
4. You should see:
   - Metro bundler starting
   - QR code displayed
   - Message: "Metro waiting on exp://..."
   - Options: Press `a` for Android, `i` for iOS, `w` for web

### Step 2.2: Launch App on Emulator - Method 1 (Recommended)

1. In the **Expo terminal**, press **`a`** (lowercase 'a' for Android)
2. Expo will automatically:
   - Detect the running Android emulator
   - Build and install the app
   - Launch the app on the emulator

**Alternative:** If pressing 'a' doesn't work, try Method 2 below.

### Step 2.3: Launch App on Emulator - Method 2 (Manual)

1. In **Android Studio**, open the **Android Studio Terminal** (bottom panel)
2. Run:
   ```bash
   cd App.js
   npx expo start --android
   ```
3. This will automatically launch on the connected emulator

### Step 2.4: Verify App Launched Successfully

1. Check the **Android emulator** window
2. You should see the ReplacePlace app launching
3. First launch may take 30-60 seconds (Metro bundler is building)
4. App should show the **AuthScreen** (login screen)

**✅ Success:** App is running on Android emulator

---

## Part 3: Test Login/Signup (Test #3)

### Step 3.1: Test Authentication Screen

1. **Observe the Auth Screen:**
   - [ ] Email input field is visible
   - [ ] Password input field is visible
   - [ ] "Login" button is visible

### Step 3.2: Test Login Functionality

**Note:** You'll need a test user account first. If Firebase Authentication is set up:

1. **Create Test User Account:**
   - Go to Firebase Console: https://console.firebase.google.com/project/replaceplace-111dd/authentication
   - Click **"Add user"** (if available)
   - Or use the signup flow in the app

2. **Test Login:**
   - Enter email: `test@example.com` (or your test email)
   - Enter password: (your test password)
   - Click **"Login"** button
   - Wait for authentication

3. **Verify Success:**
   - [ ] Login button shows loading state
   - [ ] User is redirected to HomeScreen after successful login
   - [ ] No error messages appear

### Step 3.3: Test Error Handling

1. **Test Invalid Credentials:**
   - Enter wrong email: `wrong@example.com`
   - Enter wrong password: `wrongpassword`
   - Click **"Login"**
   - [ ] Error message displays (e.g., "Login failed")
   - [ ] App doesn't crash

**✅ Test Complete:** Login/Signup functionality tested

---

## Part 4: Test GPS Permission Request (Test #4)

### Step 4.1: Reset App Permissions (Fresh Install)

**Important:** To test permission request, you need a fresh install:

1. In **Android Studio Terminal**, uninstall app from emulator:
   ```bash
   adb uninstall com.replaceplace.replaceplace
   ```
2. Restart the app (follow Step 2.2 again)

### Step 4.2: Test Permission Request

1. **App Launches:**
   - App should start and initialize

2. **GPS Permission Dialog Appears:**
   - After login (or during initialization), Android should show:
     - **"Allow ReplacePlace to access this device's location?"**
     - Options: **"Allow only while using the app"**, **"Deny"**

3. **Test "Allow":**
   - Click **"Allow only while using the app"**
   - [ ] Permission granted
   - [ ] App continues normally
   - [ ] GPS functionality should work

4. **Test "Deny" (Optional - requires fresh install again):**
   - Restart fresh install (Step 4.1)
   - Click **"Deny"** when permission dialog appears
   - [ ] App handles denial gracefully
   - [ ] Appropriate message or UI state shown

**✅ Test Complete:** GPS permission request tested

---

## Part 5: Test Location Tracking (Test #5)

### Step 5.1: Set Mock Location in Emulator

1. **Open Extended Controls:**
   - In Android emulator, click the **"..."** (three dots) button on the right sidebar
   - This opens **Extended Controls** panel

2. **Set Mock Location:**
   - Click **"Location"** in the left sidebar
   - Under **"Location method"**, select **"Single points"**
   - Enter coordinates:
     - **Latitude:** `40.7128` (New York City)
     - **Longitude:** `-74.0060`
   - Click **"Send"**

   **Alternative:** Use a different location (e.g., San Francisco: `37.7749, -122.4194`)

### Step 5.2: Verify Location Tracking in App

1. **Check HomeScreen:**
   - After logging in, navigate to HomeScreen
   - Look for GPS status or location coordinates displayed

2. **Observe Location Updates:**
   - Location should update every 5 seconds (default interval)
   - Coordinates should match mock location you set
   - [ ] Current location displayed correctly
   - [ ] Location accuracy shown (if displayed)

3. **Test Location Changes:**
   - In Extended Controls → Location
   - Change coordinates to a new location:
     - **Latitude:** `34.0522` (Los Angeles)
     - **Longitude:** `-118.2437`
   - Click **"Send"**
   - [ ] App detects location change
   - [ ] UI updates with new location

### Step 5.3: Check Console Logs (Optional)

1. In **Android Studio**, open **Logcat** (bottom panel)
2. Filter by: `ReactNativeJS` or `GPSService`
3. You should see location update logs:
   ```
   Location update: { latitude: 40.7128, longitude: -74.0060 }
   ```

**✅ Test Complete:** Location tracking tested

---

## Part 6: Test Audio Playback (Test #6)

### Step 6.1: Verify Audio Files (Prerequisites)

**Note:** Audio files need to be in Firebase Storage or locally accessible.

1. **Check if audio files exist:**
   - Go to Firebase Console → Storage
   - Verify audio files are uploaded (or use test audio files)

2. **If no audio files:**
   - Use local test audio file (MP3 format)
   - Or upload test audio to Firebase Storage

### Step 6.2: Trigger Audio Playback

1. **Method 1: Reach Story Location**
   - Set mock location to match a story location (from your Firestore data)
   - When app detects proximity, audio should play automatically

2. **Method 2: Manual Test (if audio player screen exists)**
   - Navigate to audio player screen
   - Click "Play" button
   - [ ] Audio starts playing
   - [ ] Audio controls work (play/pause/stop)

### Step 6.3: Test Audio Features

1. **Volume Control:**
   - [ ] Background soundtrack volume is lower (0.3)
   - [ ] Story audio volume is full (1.0)

2. **Fade In/Out:**
   - When entering geofence, background soundtrack should fade in (10 seconds)
   - When leaving geofence, soundtrack should fade out (10 seconds)

3. **Multiple Audio Sources:**
   - Test if background soundtrack and story audio can play simultaneously
   - [ ] Audio mixing works correctly

### Step 6.4: Check Audio Errors

1. In **Logcat**, filter by: `AudioService` or `react-native-sound`
2. Look for any audio-related errors

**✅ Test Complete:** Audio playback tested

---

## Part 7: Test Progress Saving (Test #7)

### Step 7.1: Trigger Progress Events

1. **Visit a Story Location:**
   - Set mock location to match a story location
   - App should detect you've reached the location
   - [ ] Location marked as "unlocked" in progress

2. **Listen to Story Segment:**
   - When story audio plays, mark segment as "heard"
   - [ ] Story segment marked as completed in progress

### Step 7.2: Verify Local Storage

1. **Check Progress Persistence:**
   - Close the app (swipe away from recent apps)
   - Reopen the app
   - [ ] Progress persists (locations still marked as visited)
   - [ ] Story segments still marked as heard

### Step 7.3: Verify Firebase Sync (If Logged In)

1. **Check Firebase Console:**
   - Go to: https://console.firebase.google.com/project/replaceplace-111dd/firestore
   - Navigate to: `users` → `{your-user-id}` → `progress`
   - [ ] Progress data synced to Firestore
   - [ ] Data matches what you see in app

2. **Test Sync:**
   - Make progress changes in app
   - Wait a few seconds
   - Refresh Firebase Console
   - [ ] New progress data appears

**✅ Test Complete:** Progress saving tested

---

## Part 8: Android Studio Debugging Tools

### Using Logcat

1. **Open Logcat:**
   - Bottom panel in Android Studio
   - Or: **View** → **Tool Windows** → **Logcat**

2. **Filter Logs:**
   - Enter filter: `ReactNativeJS` (for React Native logs)
   - Or: `GPSService`, `AudioService`, etc. (for specific services)

3. **View Real-time Logs:**
   - See console.log outputs from your app
   - Monitor errors and warnings

### Using Breakpoints (Advanced)

1. **Set Breakpoint:**
   - Open source file in Android Studio (e.g., `App.js`)
   - Click left margin to add breakpoint (red dot)

2. **Debug App:**
   - Run app in debug mode
   - App will pause at breakpoint
   - Inspect variables and step through code

### Using Device File Explorer

1. **Open Device File Explorer:**
   - **View** → **Tool Windows** → **Device File Explorer**

2. **Access App Files:**
   - Navigate to: `/data/data/com.replaceplace.replaceplace/`
   - View app's internal storage
   - Check AsyncStorage data (in `shared_prefs/` or similar)

---

## Troubleshooting Common Issues

### Issue: Emulator Won't Start

**Solution:**
- Check if HAXM is installed (for Intel processors)
- Enable virtualization in BIOS
- Try different AVD (create new one)
- Check Android Studio → SDK Manager → ensure Intel x86 Emulator Accelerator installed

### Issue: App Won't Launch on Emulator

**Solution:**
1. Ensure emulator is fully booted (wait for home screen)
2. In Expo terminal, press `a` again
3. Check Logcat for errors
4. Verify `adb devices` shows emulator connected:
   ```bash
   adb devices
   ```

### Issue: GPS Not Working

**Solution:**
- Verify mock location is set in Extended Controls
- Check permissions are granted in Android Settings → Apps → ReplacePlace → Permissions
- Restart app after setting mock location

### Issue: Audio Not Playing

**Solution:**
- Verify audio files exist and are accessible
- Check audio format (MP3 recommended)
- Check Logcat for audio errors
- Verify audio permissions (should be automatic)

### Issue: App Crashes on Launch

**Solution:**
1. Check Logcat for crash logs
2. Common issues:
   - Missing dependencies: Run `npm install` in `App.js` folder
   - Firebase config incorrect: Check `config.js`
   - Native module error: May need to rebuild app

### Issue: Metro Bundler Connection Issues

**Solution:**
1. Stop Metro bundler (Ctrl+C)
2. Clear cache: `npx expo start --clear`
3. Restart Metro bundler: `npm start`
4. Press `a` to launch on Android

---

## Quick Reference Commands

```bash
# Start Expo server
cd App.js
npm start

# Launch on Android emulator
# (Press 'a' in Expo terminal, or:)
npx expo start --android

# Check connected devices
adb devices

# Uninstall app from emulator
adb uninstall com.replaceplace.replaceplace

# View logs
adb logcat | grep ReactNativeJS

# Clear app data
adb shell pm clear com.replaceplace.replaceplace
```

---

## Testing Checklist Summary

| Test | Status | Notes |
|------|--------|-------|
| ✅ Emulator Started | ⬜ | Part 1 completed |
| ✅ App Launched | ⬜ | Part 2 completed |
| ✅ Login/Signup | ⬜ | Part 3 completed |
| ✅ GPS Permission | ⬜ | Part 4 completed |
| ✅ Location Tracking | ⬜ | Part 5 completed |
| ✅ Audio Playback | ⬜ | Part 6 completed |
| ✅ Progress Saving | ⬜ | Part 7 completed |

---

## Next Steps

After completing all tests:
1. Document any bugs or issues found
2. Test on real Android device (USB debugging)
3. Test on iOS (if available)
4. Prepare for production deployment

---

**Last Updated:** $(date)
**Guide Version:** 1.0
**Project:** ReplacePlace App Testing
