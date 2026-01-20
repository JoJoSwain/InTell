# Firebase Setup Verification Checklist

## ✅ Step-by-Step Verification

Use this checklist to verify your Firebase setup is complete before proceeding.

### Step 1: Create Firebase Project ✅
- [x] Firebase project created (name: `replaceplace`)
- [ ] Verify project is active in Firebase Console

**How to verify:**
1. Go to https://console.firebase.google.com/
2. Confirm you see your "replaceplace" project

---

### Step 2: Enable Authentication

**Action Required:**
1. In Firebase Console, click **"Authentication"** in the left menu
2. Click **"Get started"** if you see it (first time setup)
3. Go to the **"Sign-in method"** tab
4. Click on **"Email/Password"**
5. Toggle **"Enable"** to ON
6. Click **"Save"**

**Verify:**
- [ ] Authentication section is visible in Firebase Console
- [ ] Email/Password sign-in method is enabled
- [ ] You can see "Users" tab in Authentication

---

### Step 3: Set Up Firestore Database

**Action Required:**
1. In Firebase Console, click **"Firestore Database"** in the left menu
2. Click **"Create database"** (if you see this button)
3. Choose **"Start in test mode"** (for development)
4. Select your preferred location/region
5. Click **"Enable"**

**Important:** Test mode allows read/write for 30 days. For production, you'll need to set up proper security rules later.

**Verify:**
- [ ] Firestore Database is created
- [ ] You can see the Firestore console with "Data" and "Rules" tabs
- [ ] Database is in test mode (shown at top of console)

**Security Rules (for later):**
You'll need to set up security rules, but for now test mode is fine for development.

---

### Step 4: Set Up Storage for Audio Files

**Action Required:**
1. In Firebase Console, click **"Storage"** in the left menu
2. Click **"Get started"** (if you see this button)
3. Choose **"Start in test mode"** (for development)
4. Use the same location as your Firestore database (recommended)
5. Click **"Done"**

**Create folders (optional but recommended):**
1. In Storage, you'll see a bucket
2. Click **"Create folder"** and create:
   - `audio/story-segments/` - for story audio files
   - `audio/background-soundtracks/` - for background music
   - `audio/navigation/` - for navigation audio (optional)

**Verify:**
- [ ] Storage is enabled
- [ ] You can see the Storage console
- [ ] You can create folders (optional)

---

### Step 5: Get Firebase Config Keys

**Action Required:**
1. In Firebase Console, click the **gear icon** (⚙️) next to "Project Overview"
2. Select **"Project settings"**
3. Scroll down to **"Your apps"** section
4. If you don't have a web app yet:
   - Click the **Web icon** (`</>`)
   - Register your app with nickname: "ReplacePlace Web" (or any name)
   - You can skip Firebase Hosting setup for now
   - Click **"Register app"**
5. Copy the `firebaseConfig` object (looks like this):

```javascript
const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "replaceplace.firebaseapp.com",
  projectId: "replaceplace",
  storageBucket: "replaceplace.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123def456"
};
```

**Verify:**
- [ ] Web app is registered in Firebase project
- [ ] You have the firebaseConfig object copied
- [ ] All values are filled in (not empty)

---

### Step 6: Add Config to Your App

**Action Required:**
1. Install Firebase SDK (if not already installed):
   ```bash
   npm install firebase
   ```

2. Open `src/constants/config.js`

3. Uncomment the `FIREBASE_CONFIG` section and paste your config:

```javascript
export const FIREBASE_CONFIG = {
  apiKey: "YOUR-API-KEY-HERE",
  authDomain: "replaceplace.firebaseapp.com",
  projectId: "replaceplace",
  storageBucket: "replaceplace.appspot.com",
  messagingSenderId: "YOUR-SENDER-ID",
  appId: "YOUR-APP-ID"
};
```

**Verify:**
- [ ] Firebase SDK is installed (`npm list firebase`)
- [ ] FIREBASE_CONFIG is uncommented in config.js
- [ ] All values are filled in correctly
- [ ] No placeholder values remain

---

## 🚨 Important Notes

1. **Test Mode Security:** Both Firestore and Storage are in test mode, which allows unrestricted access for 30 days. This is fine for development but must be changed for production.

2. **Security Rules:** Before deploying to production, set up proper Firestore and Storage security rules to protect user data.

3. **API Keys:** The Firebase API key in your config is safe to include in your app - it's meant to be public. However, you should set up proper security rules on the backend.

---

## ✅ Final Verification

Before proceeding to Step 3 (Testing), make sure:

- [ ] ✅ Firebase project created
- [ ] ✅ Authentication enabled (Email/Password)
- [ ] ✅ Firestore Database created (in test mode)
- [ ] ✅ Storage enabled (in test mode)
- [ ] ✅ Web app registered
- [ ] ✅ Firebase config keys obtained
- [ ] ✅ Firebase SDK installed (`npm install firebase`)
- [ ] ✅ Config added to `src/constants/config.js`

---

## 📝 Next Steps After Verification

Once all items are checked:

1. You'll need to create Firebase service files to integrate Firebase with your app
2. Update APIService.js to use Firebase instead of REST API calls
3. Test authentication flow
4. Set up Firestore collections for your data structure

**Note:** The current APIService.js uses REST API calls. If you're using Firebase, you'll need to either:
- Create a Firebase service wrapper, OR
- Set up Cloud Functions to act as a REST API, OR
- Modify the services to use Firebase SDK directly

---

## 🔍 Quick Verification Commands

Run these in your terminal to verify installation:

```bash
# Check if Firebase is installed
npm list firebase

# If not installed, install it:
npm install firebase
```
