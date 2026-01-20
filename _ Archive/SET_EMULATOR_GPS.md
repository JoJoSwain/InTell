# How to Set GPS Location in Android Emulator

## Your GPS is Already Working! 🎉

The ReplacePlace app has **full GPS functionality** implemented:
- ✅ Location permissions requested
- ✅ Real-time GPS tracking with `watchPosition`
- ✅ Blue circle showing your location on map
- ✅ "My Location" button to center map on you
- ✅ Live coordinates displayed in header
- ✅ Auto-centering when location is found

## To Set Your Location in the Emulator:

### Method 1: Android Studio Extended Controls

1. **In Android Studio**, with the emulator running, look for the emulator window

2. **Click the "..." (More) button** on the emulator's toolbar (right side)

3. **Select "Location"** from the left menu

4. **Enter GPS Coordinates**:
   - Latitude: `40.7589` (Times Square, NYC - where mock locations are)
   - Longitude: `-73.9851`
   
   OR use your own coordinates!

5. **Click "Send"** to update the emulator's location

6. **Watch the app update!** You should see:
   - The blue circle move to your new location
   - The coordinates in the header update
   - The map re-center on your position

### Method 2: Use a Route

1. In the same **Location** panel in Extended Controls
2. Click **"Routes"** tab
3. Select a pre-made route (like "City walk") or create your own
4. Click **"Play Route"** to simulate movement
5. The app will track your movement in real-time!

### Method 3: Quick Test Locations

Here are some coordinates near the mock story locations:

**Times Square** (near mock locations):
- Latitude: `40.7589`
- Longitude: `-73.9851`

**Central Park** (current default):
- Latitude: `40.7829`
- Longitude: `-73.9654`

**Brooklyn Bridge**:
- Latitude: `40.7061`
- Longitude: `-73.9969`

## What You'll See:

When GPS is working, the app displays:

1. **📍 Blue Circle** - Your exact location on the map (with 50m radius)
2. **Live Coordinates** - In the header (e.g., "📍 40.7589, -73.9851")
3. **Floating Button** - Right side to re-center on you
4. **"My Location" Button** - Bottom nav to center map
5. **Green Markers** - Unlocked story locations
6. **Red Markers** - Locked locations you haven't reached yet

## Troubleshooting:

**If location isn't updating:**
1. Make sure you clicked "Send" in Android Studio
2. Check the app logs for "📍 Current location:" messages
3. Try setting a different location
4. The app defaults to Central Park if GPS unavailable

**Network Error** (shown in your screenshot):
- This is **expected** when running offline
- Mock data is being used instead
- The app works perfectly without a backend!

## Next Steps:

1. **Set GPS coordinates** in Android Studio (Method 1 above)
2. **Watch the magic happen!** The map should:
   - Show your blue circle
   - Update the header coordinates
   - Center on your position
3. **Try tapping the 📍 button** to re-center on yourself
4. **Move to a story location** and see if it unlocks!

---

**Your GPS is fully functional and ready to test! 🗺️**
