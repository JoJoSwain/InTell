# Quick Start Checklist & Troubleshooting Guide

This document provides a step-by-step checklist to get you started and common troubleshooting tips.

---

## Pre-Development Checklist

### ✅ Step 1: Install Required Software

- [ ] **Node.js** (v18 or later)
  - Download: https://nodejs.org/
  - Verify: Open terminal/command prompt, type `node --version`
  - Should display version number (e.g., v18.17.0)

- [ ] **Code Editor**
  - Recommended: Visual Studio Code (free)
  - Download: https://code.visualstudio.com/
  - Install React Native extension in VS Code

- [ ] **Git** (Version Control)
  - Download: https://git-scm.com/
  - Optional but recommended

### ✅ Step 2: Choose Your Development Approach

**Option A: Expo (Easier for Beginners)**
- [ ] Install Expo CLI: `npm install -g expo-cli`
- [ ] Create Expo account: https://expo.dev/
- [ ] Install Expo Go app on your phone (for testing)

**Option B: React Native CLI (More Control)**
- [ ] Install React Native CLI: `npm install -g react-native-cli`
- [ ] For Android: Install Android Studio
- [ ] For iOS (Mac only): Install Xcode

---

## Development Setup Checklist

### ✅ Step 3: Create Your Project

```bash
# Using Expo
npx create-expo-app replaceplace
cd replaceplace

# Or using React Native CLI
npx react-native init replaceplace
cd replaceplace
```

- [ ] Project created successfully
- [ ] Navigate to project folder
- [ ] Verify `package.json` exists

### ✅ Step 4: Install Dependencies

Run these commands in your project folder:

```bash
npm install @react-native-community/geolocation
npm install react-native-maps
npm install @react-native-async-storage/async-storage
npm install react-native-sound
npm install react-native-haptic-feedback
npm install axios
npm install @react-navigation/native
npm install @react-navigation/stack
npm install react-native-gesture-handler
npm install react-native-reanimated
# Optional: For text-to-speech (navigation should primarily be embedded in story audio files)
# npm install @react-native-community/tts
```

- [ ] All packages installed without errors
- [ ] Check `node_modules` folder exists

### ✅ Step 5: Create Project Structure

Create these folders in your project:

```
src/
├── components/
├── screens/
├── services/
├── navigation/
├── storage/
├── utils/
└── constants/
assets/
└── audio/
```

- [ ] All folders created
- [ ] Ready to add code files

### ✅ Step 6: Copy Code Files

From the `CODE_IMPLEMENTATION_GUIDE.md`, copy each module:

- [ ] `src/services/GPSService.js`
- [ ] `src/services/AudioService.js`
- [ ] `src/services/HapticService.js`
- [ ] `src/services/AudioNavigationService.js`
- [ ] `src/services/BackgroundSoundtrackService.js`
- [ ] `src/services/StoryService.js`
- [ ] `src/services/ProgressService.js`
- [ ] `src/services/APIService.js`
- [ ] `src/storage/LocalStorage.js`
- [ ] `src/screens/HomeScreen.js`
- [ ] `src/screens/RecommendationScreen.js`
- [ ] Update `App.js` with main logic

---

## Configuration Checklist

### ✅ Step 7: Configure Permissions

**Android** (`android/app/src/main/AndroidManifest.xml`):
- [ ] Add location permissions
- [ ] Add internet permission

**iOS** (`ios/YourApp/Info.plist`):
- [ ] Add location usage descriptions
- [ ] Add internet permission

### ✅ Step 8: Configure Backend

**Option A: Firebase Setup**
- [ ] Create Firebase project
- [ ] Enable Authentication
- [ ] Set up Firestore database
- [ ] Set up Storage for audio files
- [ ] Get Firebase config keys
- [ ] Add config to your app

**Option B: Custom Backend**
- [ ] Set up Node.js/Express server
- [ ] Set up database (PostgreSQL/MySQL)
- [ ] Create API endpoints
- [ ] Set up file storage
- [ ] Update `APIService.js` with your API URL

---

## Testing Checklist

### ✅ Step 9: Test on Emulator/Simulator

- [ ] Start Android emulator or iOS simulator
- [ ] Run app: `npm start` or `expo start`
- [ ] Test login/signup
- [ ] Test GPS permission request
- [ ] Test location tracking
- [ ] Test audio playback
- [ ] Test progress saving

### ✅ Step 10: Test on Real Device

- [ ] Connect Android device via USB (enable USB debugging)
- [ ] Or scan QR code with Expo Go app
- [ ] Test actual GPS tracking
- [ ] Test audio playback
- [ ] Test background location
- [ ] Test data sync

---

## Common Issues & Solutions

### Issue 1: "Module not found" Error

**Problem**: App can't find a module you installed

**Solutions**:
1. Delete `node_modules` folder
2. Delete `package-lock.json` or `yarn.lock`
3. Run `npm install` again
4. For React Native CLI, run `cd ios && pod install` (iOS only)
5. Restart Metro bundler

---

### Issue 2: GPS Not Working

**Problem**: Location not being detected

**Solutions**:
1. Check permissions are granted in device settings
2. Ensure location services are enabled on device
3. Test on real device (emulators may have GPS issues)
4. Check `AndroidManifest.xml` or `Info.plist` has correct permissions
5. Verify GPS service is started: `GPSService.startTracking()`

---

### Issue 3: Audio Not Playing

**Problem**: Audio files not playing

**Solutions**:
1. Check audio file path is correct
2. Verify audio file format is supported (MP3, WAV, etc.)
3. For remote files, check URL is accessible
4. Check device volume is not muted
5. Verify audio service is initialized correctly
6. Check console for error messages

---

### Issue 4: App Crashes on Startup

**Problem**: App crashes immediately

**Solutions**:
1. Check console/Logcat for error messages
2. Verify all dependencies are installed
3. Check for syntax errors in code
4. Ensure all imports are correct
5. Clear app cache: `npm start -- --reset-cache`
6. Rebuild app: `npx react-native run-android` or `run-ios`

---

### Issue 5: Backend Connection Errors

**Problem**: Can't connect to backend API

**Solutions**:
1. Verify API URL is correct in `APIService.js`
2. Check backend server is running
3. Test API endpoints with Postman or browser
4. Check network connectivity
5. Verify CORS settings on backend (if web-based)
6. Check authentication token is being sent

---

### Issue 6: Progress Not Saving

**Problem**: User progress is lost

**Solutions**:
1. Check AsyncStorage permissions
2. Verify `LocalStorage.js` is working
3. Check if data is being saved to server
4. Verify user ID is correct
5. Check console for storage errors
6. Test with `AsyncStorage.getItem()` directly

---

### Issue 7: Location Unlock Not Working

**Problem**: Next location not unlocking after completion

**Solutions**:
1. Verify `prerequisite_location_id` is set correctly in database
2. Check `checkAndUnlockNextLocation()` function is called
3. Verify location IDs match between app and database
4. Check progress is being saved after completion
5. Verify unlock logic in `ProgressService.js`

---

### Issue 8: Battery Drain

**Problem**: App drains battery quickly

**Solutions**:
1. Increase `distanceFilter` in GPS tracking (update less frequently)
2. Increase `interval` between location updates
3. Only track when app is in foreground (if acceptable)
4. Optimize location accuracy settings
5. Stop tracking when not needed

---

### Issue 9: Haptic/Vibration Not Working

**Problem**: Phone doesn't vibrate when approaching GPS coordinates

**Solutions**:
1. Check if haptics are enabled: `HapticService.isHapticsEnabled()`
2. Verify `react-native-haptic-feedback` package is installed
3. Test on real device (emulators may not support vibration)
4. Check device settings - some devices have vibration disabled in system settings
5. For iOS, verify haptic feedback is supported on device (older devices may not support all patterns)
6. Check if vibration cooldown is preventing triggers (increase cooldown period if needed)
7. Verify GPS coordinates are being detected correctly
8. Check console for haptic service errors
9. Test basic vibration: `HapticService.triggerVibration('medium')`
10. Ensure haptic trigger distance is set correctly in location data

---

## Development Tips

### Tip 1: Start Small
- Build and test one module at a time
- Don't try to build everything at once
- Test each feature before moving to the next

### Tip 2: Use Console Logging
Add `console.log()` statements to debug:
```javascript
console.log('Current location:', currentLocation);
console.log('Progress:', progress);
```

### Tip 3: Test on Real Devices
- Emulators/simulators are great for UI testing
- Real devices are essential for GPS and audio testing
- Test on both Android and iPhone if possible

### Tip 4: Version Control
- Use Git to save your progress
- Commit code frequently
- Create branches for new features

### Tip 5: Read Error Messages
- Error messages usually tell you what's wrong
- Copy error message and search online
- Check React Native documentation

---

## Learning Resources

### Official Documentation
- React Native: https://reactnative.dev/docs/getting-started
- Expo: https://docs.expo.dev/
- React Navigation: https://reactnavigation.org/docs/getting-started

### Video Tutorials
- React Native Tutorial (YouTube)
- Expo Tutorial (YouTube)
- Mobile App Development Courses (Udemy, Coursera)

### Community Support
- Stack Overflow: https://stackoverflow.com/questions/tagged/react-native
- React Native Community: https://github.com/facebook/react-native
- Reddit: r/reactnative

---

## Getting Help

### When You're Stuck:

1. **Check Documentation**: Official docs often have the answer
2. **Search Online**: Copy error message and search
3. **Ask on Stack Overflow**: Provide code and error details
4. **Join Communities**: React Native Discord, Reddit, etc.
5. **Consider Hiring Help**: For complex issues or time constraints

---

## Final Checklist Before Launch

- [ ] All features working on Android
- [ ] All features working on iPhone
- [ ] GPS tracking works in background (if needed)
- [ ] Audio plays correctly
- [ ] Progress saves and syncs
- [ ] User authentication works
- [ ] App doesn't crash
- [ ] Battery usage is reasonable
- [ ] UI looks good and is user-friendly
- [ ] Tested with multiple users
- [ ] Backend is secure
- [ ] Privacy policy created (required for GPS apps)
- [ ] App store listings prepared
- [ ] Icons and splash screens created

---

## Estimated Time Investment

- **Learning Basics**: 1-2 weeks (if new to programming)
- **Setting Up Environment**: 1-2 days
- **Building Core Features**: 2-4 weeks
- **Testing & Debugging**: 1-2 weeks
- **Polish & Deployment**: 1 week

**Total**: 6-10 weeks for a complete beginner

---

## Remember

- **Don't give up**: Programming has a learning curve
- **Break problems into smaller pieces**: Tackle one issue at a time
- **Ask for help**: There's a large community willing to help
- **Practice regularly**: Consistency is key to learning
- **Celebrate small wins**: Each working feature is progress!

---

Good luck with your app development journey! 🚀
