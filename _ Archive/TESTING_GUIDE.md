# ReplacePlace Testing Guide

## 🎉 Status: All Files Restored!

All 18 critical files have been successfully restored with bug fixes implemented.

---

## ✅ Pre-Test Verification

- ✅ All service files restored (9 files)
- ✅ All screen files restored (6 files)
- ✅ Storage and config files restored
- ✅ App.js restored with all bug fixes
- ✅ Mock data service created
- ✅ Dependencies installed (`npm install` completed)

---

## 🚀 Quick Start Testing

### Step 1: Start the Development Server

```bash
# You are currently in: C:\Users\swainj2399\Replaceplace\App.js

# Start Expo in offline mode (recommended for testing)
npm run start:offline
```

**Expected Result:**
- Metro bundler starts
- QR code appears
- No "fetch failed" errors

---

### Step 2: Launch on Emulator/Device

**Option A: Android Emulator**
```bash
# Press 'a' in the terminal
# OR run:
npx expo run:android
```

**Option B: iOS Simulator (Mac only)**
```bash
# Press 'i' in the terminal
# OR run:
npx expo run:ios
```

**Option C: Physical Device**
- Install Expo Go app
- Scan QR code from terminal

---

## 📋 Testing Checklist

### Phase 1: App Startup (5 minutes)

#### Test 1.1: Initial Load
- [ ] App launches without crashing
- [ ] White screen with "ReplacePlace" title appears
- [ ] "Audio-Guided Story Journey" subtitle visible
- [ ] Two buttons visible: "Login" and "🧪 Test with Mock User"

**✅ PASS:** Auth screen displays properly  
**❌ FAIL:** App crashes or blue screen → Check console for errors

---

#### Test 1.2: Mock Login (Critical)
- [ ] Click "🧪 Test with Mock User" button
- [ ] Button shows loading indicator briefly
- [ ] Home screen appears within 2-3 seconds
- [ ] Welcome message shows "Welcome, Test User!"

**✅ PASS:** Successfully logged in with mock user  
**❌ FAIL:** Button doesn't work → Check AuthScreen.js console logs

---

### Phase 2: Home Screen Verification (5 minutes)

#### Test 2.1: GPS Status Section
- [ ] "GPS Status" section visible
- [ ] "Getting location..." text appears initially
- [ ] Location permission popup appears (grant it)
- [ ] GPS coordinates appear within 10 seconds
  - Format: `📍 Latitude: XX.XXXXXX`
  - Format: `📍 Longitude: -XX.XXXXXX`
  - Format: `🎯 Accuracy: XXm`

**✅ PASS:** GPS coordinates updating  
**❌ FAIL:** Still shows "Getting location..." → Check GPS permissions in device settings

---

#### Test 2.2: Location Progress Section
- [ ] "Location Progress" section visible
- [ ] Progress bar appears
- [ ] Shows "X% Complete"
- [ ] Shows "X of 3 locations completed" (should be "0 of 3")

**✅ PASS:** Progress section displays correctly

---

#### Test 2.3: Locations List
- [ ] "Locations" section visible
- [ ] **3 locations appear** (mock data):
  1. Starting Point - Central Park Entrance
  2. The Great Lawn
  3. Bethesda Fountain

- [ ] **First location status: "🔓 Unlocked"** ✅ CRITICAL
- [ ] Second location status: "🔒 Locked"
- [ ] Third location status: "🔒 Locked"

**✅ PASS:** First location is unlocked (auto-unlock fix working!)  
**❌ FAIL:** All locked → ProgressService.initializeProgress() bug not fixed

---

#### Test 2.4: Navigation Buttons
- [ ] "View Full Progress" button visible
- [ ] "Recommend a Location" button visible (orange)
- [ ] "Logout" button visible (top right, red text)

---

### Phase 3: Navigation Testing (10 minutes)

#### Test 3.1: Location Details Screen
- [ ] Click on unlocked location (Starting Point)
- [ ] Location details screen opens
- [ ] Shows location name
- [ ] Shows GPS coordinates
- [ ] Shows trigger radius
- [ ] "Back to Home" button works

**✅ PASS:** Navigation to Location screen works

---

#### Test 3.2: Progress Screen
- [ ] Click "View Full Progress"
- [ ] Progress screen opens
- [ ] Shows stats: Completed (0), Unlocked (1), Total (3)
- [ ] Shows location progress bar (0%)
- [ ] Shows list of all 3 locations
- [ ] First location highlighted as unlocked

**✅ PASS:** Progress screen displays correctly

---

#### Test 3.3: Audio Player Screen
- [ ] Navigate to "AudioPlayer" (if accessible from menu)
- [ ] Shows "No story audio playing"
- [ ] Shows "No background playing"
- [ ] Info text visible

**✅ PASS:** Audio player screen loads

---

#### Test 3.4: Recommendation Screen
- [ ] Click "Recommend a Location" button
- [ ] Form appears with fields
- [ ] "📍 Use Current Location" button visible
- [ ] Can enter location name
- [ ] Can enter coordinates
- [ ] "Submit Recommendation" button visible

**✅ PASS:** Recommendation form works

---

### Phase 4: GPS Proximity Testing (Advanced - 15 minutes)

#### Test 4.1: Simulate Location (Emulator Only)

**Android Emulator:**
1. Open Extended Controls (three dots in emulator sidebar)
2. Go to "Location" section
3. Enter coordinates for mock location 1:
   - Latitude: `40.785091`
   - Longitude: `-73.968285`
4. Click "Send"

**iOS Simulator:**
1. Debug → Location → Custom Location
2. Enter same coordinates

**Expected Results:**
- [ ] GPS coordinates update in Home screen
- [ ] Within 50 meters: Audio should play (if implemented)
- [ ] Haptic feedback triggers (if on real device)

---

#### Test 4.2: Location Unlock Progression
1. Simulate reaching location 1 (coordinates above)
2. Wait for location to be marked completed
3. Check if location 2 automatically unlocks

**Note:** This requires proximity detection logic to be fully implemented.

---

### Phase 5: Offline Mode Testing (5 minutes)

#### Test 5.1: Network Errors Handled
- [ ] Disable WiFi/mobile data
- [ ] Restart app
- [ ] Mock login still works
- [ ] Mock data loads from MockDataService
- [ ] Console shows: "⚠️ Backend unavailable - using mock data"

**✅ PASS:** App works offline with mock data  
**❌ FAIL:** App crashes without network → Check APIService.js

---

### Phase 6: Logout & Re-login (5 minutes)

#### Test 6.1: Logout
- [ ] Click "Logout" button (top right)
- [ ] Confirmation dialog appears
- [ ] Click "Logout" in dialog
- [ ] Returns to Auth screen
- [ ] GPS tracking stops

**✅ PASS:** Logout works correctly

---

#### Test 6.2: Re-login
- [ ] Click "🧪 Test with Mock User" again
- [ ] Progress is preserved (0 of 3 completed)
- [ ] First location still unlocked
- [ ] GPS restarts

**✅ PASS:** Data persists across sessions (LocalStorage working)

---

## 🐛 Common Issues & Solutions

### Issue 1: App Crashes on Startup
**Symptoms:** Blue screen, "Something went wrong"  
**Solutions:**
1. Check console for error messages
2. Run: `npm run start:offline -- --clear`
3. Delete app from emulator and reinstall

---

### Issue 2: "Getting location..." Forever
**Symptoms:** GPS never updates  
**Solutions:**
1. Grant location permissions in device settings
2. Android: Settings → Apps → Expo Go → Permissions → Location → Allow
3. Emulator: Send a mock location (see Phase 4.1)
4. Check console for GPS errors

---

### Issue 3: All Locations Locked
**Symptoms:** No locations show "🔓 Unlocked"  
**Solutions:**
1. Check console for: "✅ Unlocked first location: ..."
2. If not present, ProgressService.initializeProgress() bug
3. Clear app data: Settings → Apps → Expo Go → Clear Data
4. Re-login with mock user

---

### Issue 4: Mock Login Doesn't Work
**Symptoms:** Button does nothing or error  
**Solutions:**
1. Check console for errors
2. Verify LocalStorage is working
3. Try regular login with any email/password (will use mock backend)

---

### Issue 5: Navigation Doesn't Work
**Symptoms:** Clicking buttons does nothing  
**Solutions:**
1. Check if `react-native-gesture-handler` is imported first in App.js
2. Run: `npm install react-native-gesture-handler`
3. Restart Metro bundler

---

## 📊 Test Results Summary

Fill this out as you test:

| Test Phase | Status | Notes |
|------------|--------|-------|
| App Startup | ⬜ | |
| Home Screen | ⬜ | |
| Navigation | ⬜ | |
| GPS Tracking | ⬜ | |
| Offline Mode | ⬜ | |
| Logout/Login | ⬜ | |

**Overall Status:** 
- ⬜ All tests passed - Ready for next phase
- ⬜ Some tests failed - Need fixes
- ⬜ Major issues - Need debugging

---

## 🎯 Success Criteria

The app is **ready for production** when:
- ✅ All 6 test phases pass
- ✅ No console errors during normal operation
- ✅ First location auto-unlocks
- ✅ Mock data loads correctly
- ✅ GPS tracking works
- ✅ Navigation between screens works
- ✅ Logout/login preserves data
- ✅ Works offline (with mock data)

---

## 🚀 Next Steps After Testing

If all tests pass:
1. ✅ Basic app is complete
2. 📱 Test on real device (not just emulator)
3. 🔊 Add real audio files
4. 🌐 Connect to real backend API
5. 🔥 Integrate Firebase authentication
6. 📍 Add more locations
7. 🎨 Polish UI/UX
8. 📦 Prepare for app store submission

---

## 📝 Testing Notes

Use this space to record any observations:

```
Date: _____________
Tester: ___________

Observations:
- 
- 
- 

Issues Found:
- 
- 
- 

```

---

**Current Status:** Ready to start testing!  
**Last Updated:** File restoration completed  
**Next Action:** Run `npm run start:offline`
