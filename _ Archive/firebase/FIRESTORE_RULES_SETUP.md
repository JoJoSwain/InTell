# Firestore Security Rules Setup Guide

## Step 3: Set Up Firestore Database - Security Rules

Your Firestore security rules are now in `App.js/firestore.rules`.

### Current Rules Status

The rules file contains **restrictive rules** that deny all access by default:
```javascript
allow read, write: if false;
```

**⚠️ Important:** These rules will prevent your app from accessing Firestore. You'll need to update them based on your app's needs.

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
   firebase init firestore
   ```
   - Select your project: `replaceplace-111dd`
   - Select `firestore.rules` as your rules file
   - Select `firestore.indexes.json` for indexes (or create empty file)

4. **Deploy rules**:
   ```bash
   firebase deploy --only firestore:rules
   ```

---

## Option 2: Copy Rules to Firebase Console (Quick Method)

1. **Open Firebase Console**:
   - Go to: https://console.firebase.google.com/project/replaceplace-111dd/firestore/rules

2. **Copy the rules** from `App.js/firestore.rules`

3. **Paste into Firebase Console**

4. **Click "Publish"**

---

## Recommended Security Rules for ReplacePlace App

For development, you can use **test mode** (allows all access for 30 days):
```javascript
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.time < timestamp.date(2025, 12, 31);
    }
  }
}
```

**⚠️ Important:** Test mode expires after 30 days. For production, use proper authentication-based rules:

```javascript
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    // Users collection - users can read/write their own data
    match /users/{userId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Locations collection - all authenticated users can read
    match /locations/{locationId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null; // Or restrict to admins only
    }
    
    // Story segments - all authenticated users can read
    match /story-segments/{segmentId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null; // Or restrict to admins only
    }
    
    // User progress - users can read/write their own progress
    match /users/{userId}/progress/{progressId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Geofences - all authenticated users can read
    match /geofences/{geofenceId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null; // Or restrict to admins only
    }
    
    // Recommendations - users can create their own, read all
    match /recommendations/{recommendationId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null && request.resource.data.user_id == request.auth.uid;
      allow update, delete: if request.auth != null && 
        resource.data.user_id == request.auth.uid;
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
   - Set up proper indexes for queries

3. **Deploy Rules:**
   - Use Firebase CLI: `firebase deploy --only firestore:rules`
   - Or copy/paste to Firebase Console

---

## Current Rules File Location

- **File:** `App.js/firestore.rules`
- **Purpose:** Version control and Firebase CLI deployment
- **Status:** Contains restrictive rules (denies all access) - needs update before app can use Firestore

---

## Important Notes

1. **Test Mode:** If you started Firestore in test mode, you have 30 days before it requires proper rules
2. **Rules Testing:** Use Firebase Console Rules Playground to test your rules
3. **Indexes:** Some queries may require composite indexes - Firebase will prompt you when needed
4. **Development vs Production:** Use more permissive rules for development, strict rules for production

---

Your `firestore.rules` file is ready! Update the rules based on your needs and deploy them to Firebase.
