# Google Services Integration Guide

## ✅ Integration Complete

The `google-services.json` file has been integrated into your Expo project.

### File Location
- **Current Location:** `App.js/google-services.json` ✅
- **This is correct** - Expo will automatically handle this file during the build process

### Configuration Added

1. **Package Name Added to app.json:**
   - `android.package: "com.replaceplace.replaceplace"`
   - This matches the package name in your google-services.json ✅

2. **Google Services File Reference:**
   - Added `googleServicesFile: "./google-services.json"` to Android config ✅

3. **Firebase Plugin Added:**
   - Added `@react-native-firebase/app` plugin configuration ✅
   - This plugin will automatically copy google-services.json to the correct Android location during build

### Your google-services.json Configuration

- **Project ID:** `replaceplace-111dd`
- **Project Number:** `30649905858`
- **Package Name:** `com.replaceplace.replaceplace`
- **Storage Bucket:** `replaceplace-111dd.firebasestorage.app`
- **App ID:** `1:30649905858:android:7412e0274243ddc764015b`

## 📦 Next Steps - Install Firebase Packages

To use Firebase in your app, you'll need to install the Firebase packages:

```bash
cd App.js
npm install firebase @react-native-firebase/app
```

For specific Firebase services you need:

```bash
# For Authentication
npm install @react-native-firebase/auth

# For Firestore Database
npm install @react-native-firebase/firestore

# For Storage
npm install @react-native-firebase/storage
```

**Note:** If you're using the Firebase JavaScript SDK instead of native modules, you only need:
```bash
npm install firebase
```

## 🔄 How It Works

1. **During Development:**
   - The `google-services.json` file is in your project root
   - Expo development builds will reference it

2. **During Build (`npx expo prebuild` or `eas build`):**
   - The `@react-native-firebase/app` plugin automatically:
     - Copies `google-services.json` to `android/app/google-services.json`
     - Configures the Android build.gradle files
     - Sets up Firebase for your app

3. **No Manual Steps Required:**
   - You don't need to manually copy the file
   - Expo handles everything automatically

## ✅ Verification Checklist

- [x] `google-services.json` file is in project root (`App.js/google-services.json`)
- [x] Package name matches in both `app.json` and `google-services.json`
- [x] Firebase plugin added to `app.json`
- [x] Google services file reference added to Android config
- [ ] Firebase packages installed (run npm install commands above)
- [ ] Test Firebase connection after installing packages

## 🚀 Testing Firebase Integration

After installing Firebase packages, test the connection:

1. Create a Firebase service file (e.g., `src/services/FirebaseService.js`)
2. Initialize Firebase using your config
3. Test authentication or database connection

Example:
```javascript
import { initializeApp } from 'firebase/app';
import { FIREBASE_CONFIG } from '../constants/config';

const app = initializeApp(FIREBASE_CONFIG);
export default app;
```

## 📝 Important Notes

1. **File Location:** Keep `google-services.json` in the project root. Don't move it to the android folder manually.

2. **Package Name:** The package name in `app.json` (`com.replaceplace.replaceplace`) must match exactly with the package name in `google-services.json`.

3. **Build Process:** The file will be automatically copied to the correct location during:
   - `npx expo prebuild` (generates native folders)
   - `eas build` (Expo Application Services build)
   - `npx expo run:android` (local development build)

4. **Version Control:** Consider adding `google-services.json` to `.gitignore` if it contains sensitive information, or use environment variables for production.

## 🔍 Troubleshooting

If Firebase doesn't work after setup:

1. **Verify file location:** `google-services.json` should be in `App.js/` root
2. **Check package name:** Must match in both `app.json` and `google-services.json`
3. **Clear build cache:** Run `npx expo prebuild --clean`
4. **Reinstall packages:** Delete `node_modules` and run `npm install`

Your integration is complete! ✅
