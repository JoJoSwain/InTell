# Test Checklist - Steps 153-159

## Testing Guide for ReplacePlace App

### Prerequisites
- ✅ Expo development server running
- ✅ Android emulator or iOS simulator started (or physical device connected)

---

## Test 1: Start Android Emulator or iOS Simulator

### Android Emulator:
```bash
# Option A: Start from Android Studio
# Open Android Studio → Tools → Device Manager → Start emulator

# Option B: Start from command line (if Android SDK tools are in PATH)
emulator -avd <your_avd_name>
```

### iOS Simulator:
```bash
# From macOS terminal:
open -a Simulator

# Or from Xcode:
# Xcode → Open Developer Tool → Simulator
```

**Status:** ⚠️ **Requires manual setup** - Cannot be automated

---

## Test 2: Run App (`npm start` or `expo start`)

**Command:** Already running in background

**What to Check:**
- [ ] Expo Metro bundler starts successfully
- [ ] QR code displays in terminal
- [ ] No compilation errors
- [ ] App loads on emulator/simulator

**Expected Output:**
- Metro bundler running
- Expo DevTools accessible
- QR code for Expo Go scanning (if on physical device)

**Status:** ✅ **Running** - Check terminal for Metro bundler status

---

## Test 3: Test Login/Signup

### What to Test:

1. **Auth Screen Display:**
   - [ ] Auth screen appears on app start
   - [ ] Email and password input fields visible
   - [ ] Login button visible
   - [ ] Signup option visible (if implemented)

2. **Login Functionality:**
   - [ ] Enter valid email/password
   - [ ] Click "Login" button
   - [ ] Verify successful login
   - [ ] User redirected to HomeScreen after login

3. **Signup Functionality (if implemented):**
   - [ ] Navigate to signup screen
   - [ ] Enter new user credentials
   - [ ] Verify successful signup
   - [ ] User automatically logged in after signup

4. **Error Handling:**
   - [ ] Enter invalid credentials
   - [ ] Verify error message displays
   - [ ] App doesn't crash

**Expected Behavior:**
- Firebase Authentication handles login/signup
- User session persists (checked via LocalStorage)
- AuthScreen shows when user is not logged in
- HomeScreen shows when user is logged in

**Manual Steps:**
1. Open app in emulator/simulator
2. Observe initial screen (should be AuthScreen)
3. Test login with test credentials
4. Verify navigation to HomeScreen

**Status:** ⚠️ **Requires manual testing** - Test in emulator/simulator

---

## Test 4: Test GPS Permission Request

### What to Test:

1. **Permission Prompt:**
   - [ ] App requests location permission on first launch
   - [ ] Permission dialog appears (iOS/Android native dialog)
   - [ ] "Allow" and "Deny" options visible

2. **Permission Grant:**
   - [ ] Click "Allow" or "Allow While Using App"
   - [ ] Permission granted successfully
   - [ ] App can access location

3. **Permission Denial:**
   - [ ] Click "Deny" (test on fresh install)
   - [ ] App handles denial gracefully
   - [ ] Appropriate message shows to user
   - [ ] Option to request again (if applicable)

4. **Permission Status:**
   - [ ] Check permission status in app state
   - [ ] GPS indicator shows correct status
   - [ ] Location tracking only works when permission granted

**Expected Behavior:**
- `GPSService.requestPermission()` is called on app initialization
- Native permission dialog appears
- Permission status tracked in app state
- Location services only work with permission

**Manual Steps:**
1. Uninstall and reinstall app (to reset permissions)
2. Launch app
3. Observe permission request dialog
4. Test both "Allow" and "Deny" scenarios

**Status:** ⚠️ **Requires manual testing** - Test in emulator/simulator

**Note:** On emulator/simulator, you may need to set mock location:
- **Android:** Use emulator's "..." menu → Location → Set location
- **iOS:** Features → Location → Custom Location

---

## Test 5: Test Location Tracking

### What to Test:

1. **GPS Service Initialization:**
   - [ ] GPSService initializes correctly
   - [ ] Location permissions granted
   - [ ] GPS tracking starts automatically after login

2. **Current Location:**
   - [ ] `GPSService.getCurrentLocation()` works
   - [ ] Current coordinates displayed on screen
   - [ ] Location accuracy displayed
   - [ ] Location updates in real-time

3. **Location Updates:**
   - [ ] Location updates every 5 seconds (or configured interval)
   - [ ] Location updates when moving 10 meters (or configured distance)
   - [ ] Location callback triggers correctly
   - [ ] UI updates with new location

4. **Error Handling:**
   - [ ] Handle GPS unavailable errors
   - [ ] Handle timeout errors
   - [ ] Show appropriate error messages

**Expected Behavior:**
- Location tracking starts automatically (if permission granted)
- Location updates displayed on HomeScreen
- `onLocationUpdate` callback fired on location changes
- Location used to check proximity to story locations

**Manual Steps:**
1. Grant location permissions
2. Observe location coordinates on HomeScreen
3. Move around (or change mock location in emulator)
4. Verify location updates in real-time
5. Check console logs for location updates

**Status:** ⚠️ **Requires manual testing** - Test in emulator/simulator

**Mock Location for Testing:**
- **Android Emulator:** Use emulator's Extended Controls → Location → Set coordinates
- **iOS Simulator:** Features → Location → Custom Location → Enter coordinates

---

## Test 6: Test Audio Playback

### What to Test:

1. **Audio Service Initialization:**
   - [ ] AudioService initializes correctly
   - [ ] No errors on startup

2. **Audio Playback:**
   - [ ] Audio file loads successfully
   - [ ] Audio plays when triggered
   - [ ] Audio plays at correct volume
   - [ ] Audio stops when requested

3. **Story Audio:**
   - [ ] Story segment audio plays when location reached
   - [ ] Audio fades in/out correctly (10 seconds)
   - [ ] Audio can be paused/resumed
   - [ ] Audio stops when user leaves location

4. **Background Soundtrack:**
   - [ ] Background soundtrack plays when entering geofence
   - [ ] Soundtrack fades in smoothly
   - [ ] Soundtrack stops when leaving geofence
   - [ ] Soundtrack volume is lower (0.3) than story audio (1.0)

5. **Audio Navigation:**
   - [ ] Navigation announcements play
   - [ ] "Location reached" announcement works
   - [ ] Progress announcements work

**Expected Behavior:**
- Audio plays automatically when user reaches story location
- Background soundtrack plays when entering geofence
- Audio can be controlled via AudioPlayerScreen
- Audio respects volume settings

**Manual Steps:**
1. Navigate to a story location (or set mock location)
2. Verify audio plays automatically
3. Test audio controls (play/pause/stop)
4. Test audio fade in/out
5. Test multiple audio sources (background + story)

**Status:** ⚠️ **Requires manual testing** - Test in emulator/simulator

**Note:** Audio files need to be uploaded to Firebase Storage first, or use local test audio files.

---

## Test 7: Test Progress Saving

### What to Test:

1. **Progress Initialization:**
   - [ ] User progress initializes on first launch
   - [ ] Progress loaded from LocalStorage
   - [ ] Progress synced with Firebase (if logged in)

2. **Location Unlocking:**
   - [ ] Visit a story location
   - [ ] Location marked as "unlocked" in progress
   - [ ] Progress saved to LocalStorage
   - [ ] Progress synced to Firebase (if logged in)

3. **Story Progress:**
   - [ ] Listen to story segment
   - [ ] Segment marked as "heard" in progress
   - [ ] Progress saved locally
   - [ ] Progress synced to Firebase

4. **Progress Persistence:**
   - [ ] Close and restart app
   - [ ] Progress persists (loaded from LocalStorage)
   - [ ] Progress syncs with Firebase on app start

5. **Progress Sync:**
   - [ ] Progress syncs to Firebase Firestore
   - [ ] Progress can be loaded from Firebase on new device
   - [ ] Offline changes sync when connection restored

**Expected Behavior:**
- Progress saved to LocalStorage immediately
- Progress synced to Firebase Firestore (if user logged in)
- Progress persists across app restarts
- Progress can be viewed in ProgressService

**Manual Steps:**
1. Visit a story location
2. Listen to a story segment
3. Close the app
4. Reopen the app
5. Verify progress persists
6. Check Firebase Console → Firestore → users → {userId} → progress

**Status:** ⚠️ **Requires manual testing** - Test in emulator/simulator

---

## Test Results Summary

| Test | Status | Notes |
|------|--------|-------|
| 1. Start Emulator/Simulator | ⚠️ Manual | Requires user setup |
| 2. Run App (`npm start`) | ✅ Running | Check terminal |
| 3. Test Login/Signup | ⚠️ Manual | Test in emulator |
| 4. Test GPS Permission | ⚠️ Manual | Test in emulator |
| 5. Test Location Tracking | ⚠️ Manual | Test in emulator |
| 6. Test Audio Playback | ⚠️ Manual | Test in emulator |
| 7. Test Progress Saving | ⚠️ Manual | Test in emulator |

---

## Quick Testing Commands

```bash
# Check if Metro bundler is running
# (Should see QR code and "Metro waiting on exp://...")

# View logs in terminal where Metro is running

# Restart Metro bundler (if needed)
# Press 'r' in Metro terminal to reload app
# Press 'm' to toggle menu
```

---

## Troubleshooting

### App Won't Start:
- Check Metro bundler logs for errors
- Verify all dependencies installed: `npm install`
- Check `package.json` main entry point: `"./App.js"`

### GPS Not Working:
- Verify location permissions granted
- Set mock location in emulator
- Check `GPSService.js` for errors

### Audio Not Playing:
- Verify audio files exist in Firebase Storage
- Check audio file format (MP3 recommended)
- Verify permissions for audio playback

### Progress Not Saving:
- Check LocalStorage implementation
- Verify Firebase connection (if syncing)
- Check Firestore security rules allow writes

---

## Next Steps After Testing

Once all tests pass:
1. Test on real device (Step 10)
2. Deploy to TestFlight (iOS) or Internal Testing (Android)
3. Gather user feedback
4. Fix any issues found

---

*Last Updated: $(date)*
*Testing Guide for ReplacePlace App*
