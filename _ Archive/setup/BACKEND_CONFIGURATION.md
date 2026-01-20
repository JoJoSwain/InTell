# Backend Configuration Guide

This guide explains how to configure the backend for ReplacePlace app.

## Overview

ReplacePlace requires a backend server to:
- Store user accounts and authentication
- Store location data (GPS coordinates, story segments)
- Store user progress (unlocked/completed locations)
- Store geofence data for background soundtracks
- Handle location recommendations

## Option A: Custom Backend (Recommended)

### Step 1: Update API URL

1. Open `src/constants/config.js`
2. Update the `API_BASE_URL` variable:

```javascript
export const API_BASE_URL = __DEV__
  ? 'http://localhost:3000/api'  // Development (adjust port if needed)
  : 'https://your-production-url.com/api';  // Production URL
```

### Step 2: Backend Requirements

Your backend should implement the following REST API endpoints:

#### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login (returns token)

#### Users
- `GET /api/users/:userId` - Get user profile
- `PUT /api/users/:userId` - Update user profile

#### Locations
- `GET /api/locations` - Get all locations
- `GET /api/locations/:id` - Get specific location

#### Progress
- `GET /api/users/:userId/progress` - Get user progress
- `PUT /api/users/:userId/progress` - Update user progress

#### Story Segments
- `GET /api/story-segments` - Get all story segments
- `GET /api/story-segments/:id` - Get specific story segment
- `GET /api/story-segments/location/:locationId` - Get segment by location

#### Recommendations
- `POST /api/recommendations` - Submit location recommendation
- `GET /api/users/:userId/recommendations` - Get user's recommendations
- `GET /api/recommendations/:id` - Get recommendation status

#### Geofences
- `GET /api/geofences` - Get all geofences
- `GET /api/geofences/:id` - Get specific geofence

### Step 3: Database Schema

See `APP_DEVELOPMENT_PLAN.md` for detailed database schema requirements.

### Step 4: Authentication

The app uses Bearer token authentication. Include the token in the `Authorization` header:
```
Authorization: Bearer <token>
```

Tokens are automatically stored and sent with requests after login.

---

## Option B: Firebase Setup

### Step 1: Create Firebase Project

1. Go to https://console.firebase.google.com/
2. Click "Add project"
3. Follow the setup wizard
4. Enable Google Analytics (optional)

### Step 2: Enable Authentication

1. In Firebase Console, go to **Authentication**
2. Click "Get started"
3. Enable **Email/Password** sign-in method

### Step 3: Set Up Firestore Database

1. Go to **Firestore Database**
2. Click "Create database"
3. Start in **test mode** (for development)
4. Choose your region

### Step 4: Set Up Storage for Audio Files

1. Go to **Storage**
2. Click "Get started"
3. Start in **test mode** (for development)
4. Create folders: `audio/story-segments/` and `audio/background-soundtracks/`

### Step 5: Get Firebase Config

1. Go to **Project Settings** (gear icon)
2. Scroll down to "Your apps"
3. Click the web icon (`</>`) to add a web app
4. Copy the Firebase config object

### Step 6: Add Config to App

1. Open `src/constants/config.js`
2. Uncomment and fill in the `FIREBASE_CONFIG` object:

```javascript
export const FIREBASE_CONFIG = {
  apiKey: "AIza...",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123"
};
```

3. Install Firebase SDK:
```bash
npm install firebase
```

4. Create `src/services/FirebaseService.js` to wrap Firebase API calls
5. Update `APIService.js` to use Firebase instead of REST API

---

## Development Setup

### Local Development

For local development, you can use:

1. **Development API URL** (already configured):
   ```javascript
   API_BASE_URL = 'http://localhost:3000/api'
   ```

2. **Test on Android Emulator**:
   - Use `http://10.0.2.2:3000/api` instead of `localhost`
   - Android emulator uses 10.0.2.2 to access host machine

3. **Test on iOS Simulator**:
   - Use `http://localhost:3000/api` (works directly)

4. **Test on Physical Device**:
   - Use your computer's local IP address: `http://192.168.x.x:3000/api`
   - Ensure device and computer are on same network

### Testing Without Backend

You can modify the services to use mock data for testing:

1. Create mock data files in `src/mocks/`
2. Update services to return mock data when `API_BASE_URL` is not set
3. Remove mocks before production

---

## Security Notes

1. **Never commit API keys or tokens** to version control
2. Use environment variables for sensitive configuration
3. Implement proper authentication and authorization on backend
4. Use HTTPS in production
5. Validate all inputs on the backend
6. Implement rate limiting on API endpoints

---

## Next Steps

1. Choose your backend option (Custom or Firebase)
2. Set up your backend server/database
3. Update `src/constants/config.js` with your API URL
4. Test API endpoints using Postman or similar tool
5. Start the app and test authentication flow

For detailed API endpoint specifications, see `APP_DEVELOPMENT_PLAN.md`.
