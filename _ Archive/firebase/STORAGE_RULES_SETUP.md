# Firebase Storage Security Rules Setup Guide

## Step 3: Set Up Storage for Audio Files - Security Rules

Your Firebase Storage security rules are now in `App.js/storage.rules`.

### Current Rules Status

The rules file contains **restrictive rules** that deny all access by default:
```javascript
allow read, write: if false;
```

**⚠️ Important:** These rules will prevent your app from accessing Firebase Storage. You'll need to update them based on your app's needs.

---

## Option 1: Deploy Rules via Firebase CLI (Recommended)

1. **Install Firebase CLI** (if not already installed):
   ```bash
   npm install -g firebase-tools
   ```

2. **Login to Firebase**:
   ```bash
   firebase login
   ```

3. **Initialize Firebase in your project** (if not done):
   ```bash
   cd App.js
   firebase init storage
   ```
   - Select your project: `replaceplace-111dd`
   - Select `storage.rules` as your rules file

4. **Deploy rules**:
   ```bash
   firebase deploy --only storage
   ```

---

## Option 2: Copy Rules to Firebase Console (Quick Method)

1. **Open Firebase Console**:
   - Go to: https://console.firebase.google.com/project/replaceplace-111dd/storage/rules

2. **Copy the rules** from `App.js/storage.rules`

3. **Paste into Firebase Console**

4. **Click "Publish"**

---

## Recommended Security Rules for ReplacePlace App

For development, you can use **test mode** (allows all access for 30 days):
```javascript
rules_version = '2';

service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      allow read, write: if request.time < timestamp.date(2025, 12, 31);
    }
  }
}
```

**⚠️ Important:** Test mode expires after 30 days. For production, use proper authentication-based rules:

```javascript
rules_version = '2';

service firebase.storage {
  match /b/{bucket}/o {
    // Audio files (story segments) - all authenticated users can read
    match /audio/story-segments/{segmentId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null; // Or restrict to admins only
    }
    
    // Background soundtracks - all authenticated users can read
    match /audio/background-soundtracks/{soundtrackId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null; // Or restrict to admins only
    }
    
    // Navigation audio files - all authenticated users can read
    match /audio/navigation/{audioId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null; // Or restrict to admins only
    }
    
    // User-uploaded content (recommendations, etc.) - users can manage their own
    match /users/{userId}/{allPaths=**} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Public assets (images, etc.) - all authenticated users can read
    match /public/{allPaths=**} {
      allow read: if request.auth != null;
      allow write: if request.auth != null; // Or restrict to admins only
    }
    
    // Deny all other paths by default
    match /{allPaths=**} {
      allow read, write: if false;
    }
  }
}
```

---

## Next Steps

1. **For Development:**
   - Use test mode rules (allows all access temporarily)
   - Or use the recommended rules above

2. **For Production:**
   - Update rules to use proper authentication checks
   - Test rules thoroughly before deploying
   - Organize files in folders (e.g., `/audio/story-segments/`, `/audio/background-soundtracks/`)

3. **Deploy Rules:**
   - Use Firebase CLI: `firebase deploy --only storage`
   - Or copy/paste to Firebase Console

---

## Current Rules File Location

- **File:** `App.js/storage.rules`
- **Purpose:** Version control and Firebase CLI deployment
- **Status:** Contains restrictive rules (denies all access) - needs update before app can use Storage

---

## Important Notes

1. **Test Mode:** If you started Storage in test mode, you have 30 days before it requires proper rules
2. **Rules Testing:** Use Firebase Console Rules Playground to test your rules
3. **File Organization:** Organize audio files in folders (e.g., `/audio/story-segments/`) for better rule management
4. **Development vs Production:** Use more permissive rules for development, strict rules for production
5. **File Size Limits:** Firebase Storage has file size limits - ensure audio files don't exceed limits (default is 32MB)

---

## Storage Structure Recommendations

For ReplacePlace app, organize files like this:

```
/audio/
  /story-segments/
    /location-1/
      segment-1.mp3
      segment-2.mp3
    /location-2/
      segment-1.mp3
  /background-soundtracks/
    /geofence-1/
      soundtrack.mp3
    /geofence-2/
      soundtrack.mp3
  /navigation/
    location-reached.mp3
    approaching-location.mp3

/public/
  /images/
    /locations/
      location-1.jpg
      location-2.jpg

/users/
  /{userId}/
    /recommendations/
      audio-upload.mp3
      image-upload.jpg
```

---

Your `storage.rules` file is ready! Update the rules based on your needs and deploy them to Firebase.
