# Enable Google Maps for ReplacePlace

## Why the Map Isn't Showing

Your app has the Google Maps API key in `AndroidManifest.xml`, but the **Maps SDK for Android** isn't enabled in Google Cloud Console yet. Without this, the map won't render.

## ⚡ Quick Fix - Enable Maps SDK:

### Step 1: Go to Google Cloud Console

1. **Open**: https://console.cloud.google.com/
2. **Sign in** with the Google account that owns the API key
3. **Select your project** (or create one if needed)

### Step 2: Enable Maps SDK for Android

1. **Click** "☰ Menu" (top left)
2. **Go to**: "APIs & Services" → "Library"
3. **Search for**: `Maps SDK for Android`
4. **Click** on "Maps SDK for Android"
5. **Click** the blue **"ENABLE"** button
6. **Wait** 1-2 minutes for it to activate

### Step 3: Verify API Key Restrictions (Optional but Recommended)

1. Go to "APIs & Services" → "Credentials"
2. Click on your API key: `AIzaSyAF7ClkLXMx0E200Xd4Z7LLzBnIImhmxS8`
3. Under "API restrictions":
   - Select "Restrict key"
   - Check ✓ "Maps SDK for Android"
4. Click "Save"

### Step 4: Rebuild the App

After enabling the SDK, rebuild:

```bash
cd "C:\Users\swainj2399\Replaceplace\App.js"
npx expo run:android
```

---

## Alternative: Use Open Street Map (No API Key Needed)

If you don't want to use Google Maps, we can switch to **react-native-maps** with OpenStreetMap, which requires NO API key!

Let me know if you want to try this instead.

---

## What You'll See After Enabling:

Once the Maps SDK is enabled and you rebuild:

- ✅ **Map appears** with satellite/street view
- ✅ **Your location** shown as blue circle
- ✅ **Story locations** as green/red pins
- ✅ **Interactive map** with zoom, pan, rotate
- ✅ **"My Location" button** to center on you

---

**Quick Link**: https://console.cloud.google.com/apis/library/maps-android-backend.googleapis.com

👆 This will take you directly to the Maps SDK for Android page!
