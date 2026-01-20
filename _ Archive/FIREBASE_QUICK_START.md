# 🔥 Firebase Quick Start - 3 Steps!

## ⚡ While the App is Building...

Complete these 3 quick steps to activate Firebase:

---

## Step 1: Enable Email/Password Auth (30 seconds)

1. **Open**: https://console.firebase.google.com/project/replaceplace-111dd/authentication/providers
2. **Click** "Email/Password"
3. **Toggle "Enable"** → ON
4. **Click "Save"**

✅ Done! Your app can now create user accounts.

---

## Step 2: Deploy Firestore Rules (1 minute)

1. **Open**: https://console.firebase.google.com/project/replaceplace-111dd/firestore/rules
2. **Replace ALL existing rules** with this:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    function isSignedIn() {
      return request.auth != null;
    }
    
    function isOwner(userId) {
      return request.auth.uid == userId;
    }
    
    match /users/{userId} {
      allow read: if isSignedIn() && isOwner(userId);
      allow write: if isSignedIn() && isOwner(userId);
    }
    
    match /userProgress/{userId} {
      allow read: if isSignedIn() && isOwner(userId);
      allow write: if isSignedIn() && isOwner(userId);
    }
    
    match /locations/{locationId} {
      allow read: if true;
      allow write: if isSignedIn();
    }
    
    match /storySegments/{segmentId} {
      allow read: if true;
      allow write: if isSignedIn();
    }
  }
}
```

3. **Click "Publish"**

✅ Done! Your data is now secure.

---

## Step 3: Seed Database (30 seconds)

**Open a NEW terminal** and run:

```powershell
cd C:\Users\swainj2399\Replaceplace\App.js
node scripts/seedFirestore.js
```

**You should see**:
```
🔥 Initializing Firebase...
✅ Firebase initialized
📍 Seeding locations...
✅ Added location: Temple Square
✅ Added location: Liberty Park
✅ Added location: Red Butte Garden
📖 Seeding story segments...
✅ Added segment: Chapter 1: The Beginning
✅ Added segment: Chapter 2: Discovery
✅ Added segment: Chapter 3: The Revelation
🎉 Firestore seeding complete!
```

✅ Done! Your database has locations!

---

## 🎮 Test Your Firebase Backend!

Once the app finishes building (1-2 minutes), you'll see a **new Sign Up screen**:

### Create Your First Account:

1. **Click** "Don't have an account? Sign Up"
2. **Enter**:
   - Name: `Your Name`
   - Email: `test@replaceplace.com`
   - Password: `password123`
3. **Click "Create Account"**

**What happens**:
- 🔥 Account created in Firebase
- 📍 Map loads with Salt Lake City
- ☁️ Progress auto-syncs to cloud
- ✨ You can sign in from any device!

### Test Sign In/Out:

1. **Click "Logout"**
2. **Enter credentials** and **"Sign In"**
3. **Your progress is restored!** 🎉

---

## ✅ Success Checklist:

- [ ] Email/Password auth enabled in Firebase
- [ ] Firestore rules deployed
- [ ] Database seeded (ran script successfully)
- [ ] App rebuilt and running
- [ ] Created a test account
- [ ] Signed in successfully
- [ ] Map shows Salt Lake City locations

---

## 🎯 You're All Set!

Once these 3 steps are done, your app has:
- ✅ Real user authentication
- ✅ Cloud database
- ✅ Progress sync across devices
- ✅ Production-ready backend

**Welcome to Firebase! 🔥**
