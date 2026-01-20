# 🗺️ ReplacePlace

**A GPS-powered, location-based storytelling experience for Android**

ReplacePlace is a React Native mobile application that guides users through immersive audio stories triggered by real-world GPS locations. Walk through your city and unlock story chapters as you reach specific landmarks!

---

## ✨ Features

- 🗺️ **Interactive Map View** - See all story locations on an integrated map
- 📍 **GPS-Triggered Stories** - Audio and content unlock when you reach locations
- 🚶 **Route Recommendations** - Walking, biking, and transit directions powered by Google
- 🎵 **Audio Narration** - Immersive audio storytelling experience
- 🔐 **User Authentication** - Firebase-powered secure login
- 📊 **Progress Tracking** - Track your journey and completed locations
- 💡 **Community Recommendations** - Suggest new story locations

---

## 🚀 Tech Stack

- **Framework**: React Native with Expo
- **Backend**: Firebase (Authentication, Firestore, Storage)
- **Maps**: Google Maps SDK for Android
- **Routing**: Google Directions API
- **Location**: React Native Geolocation
- **State Management**: React Hooks

---

## 📋 Prerequisites

Before you begin, ensure you have installed:

- **Node.js** (v16 or higher)
- **npm** or **yarn**
- **Java JDK 17** (for Android builds)
- **Android Studio** (with SDK 24+)
- **Android Emulator** or physical device
- **Git** (for version control)

---

## 🛠️ Team Setup Guide

### Step 1: Clone the Repository

```bash
git clone https://github.com/YOUR_USERNAME/ReplacePlace.git
cd ReplacePlace
cd App.js
npm install
```

### Step 2: Configure Firebase

1. **Get Firebase Configuration**:
   - Contact the project admin for Firebase credentials
   - OR create your own Firebase project at https://console.firebase.google.com

2. **Set up config.js**:
   ```bash
   cd src/constants
   cp config.example.js config.js
   # Edit config.js with your Firebase credentials
   ```

3. **Set up google-services.json**:
   ```bash
   cd ../..  # Back to App.js root
   cp google-services.example.json google-services.json
   # Replace with actual file from Firebase Console
   ```
   
   **Download from**: Firebase Console → Project Settings → Your Apps → Download google-services.json

### Step 3: Configure Google Maps API

1. Get a Google Maps API Key from [Google Cloud Console](https://console.cloud.google.com)
2. Enable these APIs:
   - Maps SDK for Android
   - Directions API
3. Update `android/app/src/main/AndroidManifest.xml`:
   ```xml
   <meta-data
     android:name="com.google.android.geo.API_KEY"
     android:value="YOUR_API_KEY_HERE"/>
   ```

### Step 4: Configure Android SDK Path

Create `android/local.properties`:
```properties
sdk.dir=C:\\Users\\YOUR_USERNAME\\AppData\\Local\\Android\\Sdk
```

### Step 5: Run the App

```bash
# Set environment variables (Windows PowerShell)
$env:JAVA_HOME = "C:\Program Files\Eclipse Adoptium\jdk-17.0.17.10-hotspot"
$env:ANDROID_HOME = "C:\Users\YOUR_USERNAME\AppData\Local\Android\Sdk"

# Build and run
npx expo run:android
```

---

## 📁 Project Structure

```
ReplacePlace/
├── App.js/                      # Main application code
│   ├── src/
│   │   ├── components/         # Reusable UI components
│   │   ├── screens/            # Screen components
│   │   │   ├── HomeScreen.js   # Map view
│   │   │   ├── LocationScreen.js
│   │   │   ├── AuthScreen.js
│   │   │   └── ...
│   │   ├── services/           # API and business logic
│   │   │   ├── FirebaseService.js
│   │   │   ├── RouteService.js
│   │   │   ├── GPSService.js
│   │   │   └── ...
│   │   ├── constants/          # Configuration
│   │   │   └── config.js       # ⚠️ NOT in Git (sensitive)
│   │   └── utils/              # Helper functions
│   ├── assets/                 # Images, audio files
│   ├── android/                # Android native code
│   ├── scripts/                # Utility scripts
│   ├── package.json
│   └── App.js                  # Entry point
├── _ Archive/                  # Project history/docs
└── README.md                   # This file
```

---

## 🧪 Testing

### Setting GPS Location in Emulator

1. Open Android Emulator
2. Click **"..."** (Extended Controls)
3. Go to **"Location"**
4. Enter coordinates (e.g., `40.7704, -111.8922` for Temple Square, SLC)
5. Click **"SEND"**

### Test Locations (Salt Lake City)

- **Temple Square**: `40.7704, -111.8922`
- **Liberty Park**: `40.7398, -111.8711`
- **University of Utah**: `40.7649, -111.8421`

See `GPS_TESTING_GUIDE.md` for detailed testing instructions.

---

## 🔒 Security Notes

**Files that MUST NOT be committed:**

- ❌ `google-services.json` (Firebase config with secrets)
- ❌ `src/constants/config.js` (API keys)
- ❌ `*.keystore` (Signing certificates)
- ❌ `.env` files

These are protected by `.gitignore`. Always use the `.example` templates!

---

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for details on:

- Code style guidelines
- Branch naming conventions
- Pull request process
- Issue reporting

---

## 📚 Additional Documentation

- **[GPS_TESTING_GUIDE.md](App.js/GPS_TESTING_GUIDE.md)** - Comprehensive GPS testing instructions
- **[TEAM_SETUP.md](TEAM_SETUP.md)** - Detailed setup for new developers
- **[_ Archive/](_.Archive/)** - Historical project documentation

---

## 🐛 Troubleshooting

### "google-services.json not found"
- Ensure you've created `google-services.json` from the template
- Download from Firebase Console

### "GPS not working in emulator"
- Set location manually in Extended Controls (...) → Location
- Use coordinates like `40.7704, -111.8922`

### "Build failed - SDK not found"
- Check `android/local.properties` has correct SDK path
- Verify `ANDROID_HOME` environment variable

### "API Error: REQUEST_DENIED"
- Ensure Google Maps API key is in `AndroidManifest.xml`
- Check that Directions API is enabled in Google Cloud Console
- Verify billing is enabled (required for Directions API)

---

## 📞 Support

**Project Lead**: [Your Name]  
**Email**: [your-email@example.com]  
**GitHub Issues**: [Report bugs or request features](https://github.com/YOUR_USERNAME/ReplacePlace/issues)

---

## 📄 License

[Specify your license here - MIT, Apache 2.0, etc.]

---

## 🎯 Roadmap

- [ ] iOS Support
- [ ] Offline mode improvements
- [ ] Multi-language support
- [ ] Social features (share progress)
- [ ] Custom story creation tools
- [ ] AR integration

---

## 🙏 Acknowledgments

- Google Maps Platform for mapping and routing
- Firebase for backend services
- React Native community
- All contributors to this project

---

**Built with ❤️ by the ReplacePlace Team**

🌟 **Star this repo if you find it useful!** 🌟
