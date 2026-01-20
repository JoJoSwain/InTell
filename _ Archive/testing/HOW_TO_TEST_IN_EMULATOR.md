# How to Test in Android Emulator

## Quick Steps

### Step 1: Start Android Emulator

**In Android Studio:**
1. Open Android Studio
2. Go to **Tools** → **Device Manager** (or click the device icon)
3. Find your emulator in the list
4. Click the **▶️ Play button** (green triangle) to start it
5. Wait for emulator to boot (1-2 minutes)

**✅ Success:** You should see the Android home screen on the emulator

---

### Step 2: Start Expo Development Server

**Open Terminal/Command Prompt:**
1. Navigate to your project folder:
   ```bash
   cd App.js
   ```

2. Start Expo in offline mode (recommended):
   ```bash
   npm run start:offline
   ```
   
   Or regular mode:
   ```bash
   npm start
   ```

**✅ Success:** You should see:
- Metro bundler starting
- QR code displayed
- Message: "Metro waiting on exp://..."
- Options: Press `a` for Android, `i` for iOS, `w` for web

---

### Step 3: Launch App on Emulator

**In the Expo terminal window:**

1. Wait for Metro bundler to fully start
2. Press **`a`** (lowercase 'a') on your keyboard
3. Expo will automatically:
   - Detect the running Android emulator
   - Build the app
   - Install it on the emulator
   - Launch the app

**✅ Success:** The ReplacePlace app should launch on your Android emulator!

---

## What You DON'T Need to Do

❌ **You don't need to:**
- Open any file in Android Studio
- Build the project in Android Studio
- Run from Android Studio
- Open `App.js/App.js` in Android Studio (unless you want to edit it)

**Why?** This is an Expo app, which handles building and deployment automatically.

---

## Alternative: Test on Physical Phone

If you want to test on your **connected phone** instead:

### Option A: Expo Go App (Easiest)
1. Install **Expo Go** app from Google Play Store on your phone
2. Start Expo server: `npm start` (in `App.js` folder)
3. Scan QR code with Expo Go app
4. App loads on your phone

### Option B: Development Build on Phone
1. Enable **USB Debugging** on your phone:
   - Settings → About Phone → Tap "Build Number" 7 times
   - Settings → Developer Options → Enable "USB Debugging"
2. Connect phone via USB
3. Run: `npx expo run:android` (builds and installs on phone)

---

## Troubleshooting

### "Device not found"
- Make sure emulator is fully booted (wait for home screen)
- Check: `adb devices` should show emulator
- Try pressing `a` again in Expo terminal

### "App won't install"
- Make sure emulator has enough space
- Try: `adb install -r` (force reinstall)

### "Metro bundler connection failed"
- Check emulator and computer are on same network
- Try restarting Metro: `npm start --clear`
- Use offline mode: `npm run start:offline`

---

## Quick Reference Commands

```bash
# Start Expo server
cd App.js
npm run start:offline

# Or regular start
npm start

# Then press 'a' in Expo terminal for Android

# Check connected devices
adb devices

# Clear cache and restart
npm start --clear
```

---

## Summary

**To test in Android emulator:**
1. ✅ Start emulator in Android Studio
2. ✅ Run `npm run start:offline` in `App.js` folder
3. ✅ Press `a` in Expo terminal
4. ✅ App launches on emulator

**No need to open files in Android Studio** - Expo handles everything!
