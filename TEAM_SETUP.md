# 👥 ReplacePlace - Team Setup Guide

**Complete guide for new developers joining the project**

---

## 🎯 Overview

This guide will walk you through setting up ReplacePlace on your local machine for development. **Estimated time: 30-45 minutes**

---

## ✅ Prerequisites Checklist

Before starting, ensure you have:

- [ ] **Node.js** v16+ ([Download](https://nodejs.org/))
- [ ] **npm** (comes with Node.js)
- [ ] **Git** ([Download](https://git-scm.com/))
- [ ] **Java JDK 17** ([Download Eclipse Adoptium](https://adoptium.net/))
- [ ] **Android Studio** ([Download](https://developer.android.com/studio))
- [ ] **Android SDK 24+** (installed via Android Studio)
- [ ] **Android Emulator** (set up in Android Studio)
- [ ] **Access to Firebase Console** (from project admin)

---

## 📥 Step 1: Clone the Repository

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/ReplacePlace.git
cd ReplacePlace

# Navigate to the app directory
cd App.js

# Install dependencies
npm install
```

**Expected output**: `added XXX packages` with no errors

---

## 🔥 Step 2: Firebase Configuration

### 2.1 Get Firebase Credentials

**Option A: From Project Admin**
- Contact the project admin for:
  - Firebase `google-services.json` file
  - Firebase API credentials for `config.js`

**Option B: Create Your Own Firebase Project**

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Click **"Add project"**
3. Name it `replaceplace-dev-YOUR_NAME`
4. Enable **Google Analytics** (optional)
5. Click **"Create project"**

### 2.2 Set Up google-services.json

```bash
# From App.js directory
cd App.js

# Copy the template
cp google-services.example.json google-services.json
```

**Now replace the content** with your actual file:

1. In Firebase Console, go to **Project Settings** (gear icon)
2. Scroll down to **"Your apps"**
3. Click on the Android app icon
4. Click **"Download google-services.json"**
5. Replace `App.js/google-services.json` with the downloaded file

### 2.3 Set Up config.js

```bash
# From App.js directory
cd src/constants

# Copy the template
cp config.example.js config.js
```

**Edit `config.js`** with your Firebase credentials:

1. In Firebase Console → **Project Settings**
2. Scroll to **"SDK setup and configuration"**
3. Copy the configuration values
4. Paste into `config.js`:

```javascript
export const FIREBASE_CONFIG = {
  apiKey: "YOUR_ACTUAL_API_KEY",
  authDomain: "your-project-id.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project-id.firebasestorage.app",
  messagingSenderId: "123456789",
  appId: "1:123456789:android:abc123def456"
};
```

### 2.4 Configure Firestore & Authentication

1. **Enable Firestore Database**:
   - Firebase Console → **Firestore Database** → **Create database**
   - Start in **test mode** (for development)
   - Choose a location (e.g., `us-central1`)

2. **Enable Authentication**:
   - Firebase Console → **Authentication** → **Get started**
   - Enable **Email/Password** provider

3. **Seed the Database** (optional):
   ```bash
   cd App.js
   node scripts/seedFirestore.js
   ```

---

## 🗺️ Step 3: Google Maps API Configuration

### 3.1 Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select existing
3. **Enable Billing** (required for Directions API)

### 3.2 Enable Required APIs

In Cloud Console, enable these APIs:

- [ ] **Maps SDK for Android**
- [ ] **Directions API**

**Navigation**: APIs & Services → Library → Search for each API → Enable

### 3.3 Create API Key

1. Go to **APIs & Services → Credentials**
2. Click **+ CREATE CREDENTIALS → API key**
3. Copy the API key
4. Click **Restrict Key** (recommended for production)
   - Application restrictions: Android apps
   - Add package name: `com.swainj2399.replaceplace`
   - API restrictions: Select only enabled APIs

### 3.4 Add API Key to AndroidManifest.xml

Edit `App.js/android/app/src/main/AndroidManifest.xml`:

```xml
<application>
  <!-- Add this inside <application> tag -->
  <meta-data
    android:name="com.google.android.geo.API_KEY"
    android:value="YOUR_GOOGLE_MAPS_API_KEY_HERE"/>
  
  <!-- Rest of your manifest... -->
</application>
```

---

## 🤖 Step 4: Android Configuration

### 4.1 Set Android SDK Path

Create `App.js/android/local.properties`:

```properties
# Windows
sdk.dir=C:\\Users\\YOUR_USERNAME\\AppData\\Local\\Android\\Sdk

# Mac/Linux
# sdk.dir=/Users/YOUR_USERNAME/Library/Android/sdk
```

**Find your SDK path**:
- Android Studio → Settings → Appearance & Behavior → System Settings → Android SDK
- Copy the "Android SDK Location" path

### 4.2 Set Up Environment Variables

**Windows (PowerShell)**:
```powershell
# Add these to your PowerShell profile or run before each build
$env:JAVA_HOME = "C:\Program Files\Eclipse Adoptium\jdk-17.0.17.10-hotspot"
$env:ANDROID_HOME = "C:\Users\YOUR_USERNAME\AppData\Local\Android\Sdk"
$env:Path = "$env:ANDROID_HOME\platform-tools;$env:JAVA_HOME\bin;$env:Path"
```

**Mac/Linux (bash/zsh)**:
```bash
# Add to ~/.bashrc or ~/.zshrc
export JAVA_HOME=/Library/Java/JavaVirtualMachines/temurin-17.jdk/Contents/Home
export ANDROID_HOME=$HOME/Library/Android/sdk
export PATH=$PATH:$ANDROID_HOME/platform-tools:$ANDROID_HOME/tools
```

### 4.3 Create Android Emulator

1. Open Android Studio
2. Click **AVD Manager** (Device Manager icon)
3. Click **+ Create Virtual Device**
4. Choose **Phone → Pixel 7**
5. Select **System Image**: API Level 34 (Android 14)
6. Click **Finish**
7. **Launch** the emulator

---

## 🚀 Step 5: Run the App

```bash
# From App.js directory
cd App.js

# Windows PowerShell (set environment first)
$env:JAVA_HOME = "C:\Program Files\Eclipse Adoptium\jdk-17.0.17.10-hotspot"
$env:ANDROID_HOME = "C:\Users\YOUR_USERNAME\AppData\Local\Android\Sdk"
$env:Path = "$env:ANDROID_HOME\platform-tools;$env:JAVA_HOME\bin;$env:Path"

# Build and run
npx expo run:android
```

**First build takes 5-10 minutes**. Subsequent builds are much faster!

---

## ✅ Step 6: Verify Installation

### 6.1 Check the App Loads

- [ ] App opens without crashing
- [ ] Login screen appears
- [ ] Can log in with "mockuser@test.com" / "password"

### 6.2 Check Map Features

- [ ] Map loads and displays
- [ ] Green/red markers appear (Temple Square, Liberty Park, Red Butte Garden)
- [ ] Blue dot shows your location

### 6.3 Set GPS in Emulator

1. Click **"..."** on emulator toolbar
2. Go to **Location**
3. Enter: `40.7704, -111.8922` (Temple Square, SLC)
4. Click **"SEND"**
5. Check that GPS coordinates appear in app header

### 6.4 Test Route Recommendations

1. Tap on **Temple Square** (green marker)
2. Click **"Get Directions"**
3. Verify walking, biking, and transit routes appear

**If you see "REQUEST_DENIED"**: Check Google Cloud Console billing and API enablement

---

## 🐛 Common Issues & Solutions

### Issue: "google-services.json not found"

**Solution**:
```bash
cd App.js
ls google-services.json  # Should exist
# If not, copy from google-services.example.json and fill in real values
```

### Issue: "Firebase API Error"

**Solution**: Check `src/constants/config.js` has correct Firebase credentials

### Issue: "SDK not found"

**Solution**: 
1. Check `android/local.properties` exists
2. Verify SDK path is correct
3. Check `ANDROID_HOME` environment variable

### Issue: "Gradle build failed"

**Solution**:
```bash
cd android
./gradlew clean  # Mac/Linux
.\gradlew.bat clean  # Windows

cd ..
npx expo run:android
```

### Issue: "Google Maps not showing"

**Solution**:
1. Check `AndroidManifest.xml` has API key
2. Verify API key is valid in Google Cloud Console
3. Ensure "Maps SDK for Android" is enabled

### Issue: "Routes show 'REQUEST_DENIED'"

**Solution**:
1. Enable billing in Google Cloud Console
2. Enable "Directions API"
3. Wait 5-10 minutes for changes to propagate

---

## 📞 Getting Help

1. **Check this guide** first
2. **Search existing issues**: [GitHub Issues](https://github.com/YOUR_USERNAME/ReplacePlace/issues)
3. **Ask the team**: Slack/Discord channel
4. **Create a new issue**: Include error messages and screenshots

---

## ✅ Setup Complete!

You're now ready to start developing ReplacePlace! 🎉

**Next steps**:
- Read [CONTRIBUTING.md](CONTRIBUTING.md) for development guidelines
- Check [_ Archive/](_.Archive/) for project history and decisions
- Review the codebase starting with `App.js/src/screens/HomeScreen.js`

**Happy coding!** 🚀
