# 🗺️ GPS Testing Guide for ReplacePlace

## 📍 Current Status
✅ Improved location UI - clearly shows YOUR location vs DESTINATION  
✅ Added comprehensive GPS debugging  
✅ Fixed location passing between screens  

---

## 🎯 How to Set Your GPS Location in Android Emulator

### Method 1: Extended Controls (Recommended)
1. **Open the emulator** (Android Studio → AVD Manager)
2. **Click the "..." button** on the emulator toolbar (Extended Controls)
3. **Go to "Location"** in the left sidebar
4. **Enter coordinates:**
   - **Your Office/Home** (example): `40.7585, -111.8761`
   - **Liberty Park** (for testing): `40.7398, -111.8711`
   - **University of Utah** (for testing): `40.7649, -111.8421`
5. **Click "SEND"** to set the location
6. **Watch the app update** - you should see GPS coordinates in the header

### Method 2: Google Maps Search
1. In Extended Controls → Location
2. Type a place name in the search box
3. Click on the location
4. Click "SEND"

---

## 🔍 Understanding the Location Indicators

### In HomeScreen (Map View):
- **🔵 Blue Dot** = YOUR CURRENT LOCATION (from GPS)
- **🟢 Green Dot** = Unlocked story location (DESTINATION)
- **🔴 Red Dot** = Locked story location

### In LocationScreen (Details View):
You'll now see TWO clear boxes:

```
┌─────────────────────────────────────┐
│ 🔵 📍 YOUR LOCATION                 │
│    40.75850, -111.87610             │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ 🟢 🎯 DESTINATION                   │
│    40.77040, -111.89220             │
│    Temple Square                    │
└─────────────────────────────────────┘
```

This makes it **crystal clear** which location is which!

---

## 🐛 GPS Debugging Console Output

When you load the app, watch the console for:

```
════════════════════════════════════════
📍 GPS LOCATION ACQUIRED
Latitude: 40.7585
Longitude: -111.8761
Accuracy: 20 meters
Altitude: 1288 meters
Speed: 0 m/s
Timestamp: 10:30:45 PM
════════════════════════════════════════
```

### If You See Fallback:
```
════════════════════════════════════════
❌ GPS ERROR - USING FALLBACK
Error Code: 3
Error Message: Location request timed out
PERMISSION_DENIED = 1, POSITION_UNAVAILABLE = 2, TIMEOUT = 3
════════════════════════════════════════
⚠️ FALLBACK: Setting location to Temple Square
```

**This means:**
- Error Code 3 = GPS Timeout (emulator GPS not set)
- Error Code 2 = GPS unavailable
- Error Code 1 = Permission denied

**Solution:** Set GPS coordinates in Extended Controls!

---

## 🧪 Testing Steps

### 1. **Test GPS Acquisition**
   - Open app
   - Check header shows green dot + GPS coordinates
   - Verify console shows "GPS LOCATION ACQUIRED"
   - Verify blue dot appears on map at YOUR location

### 2. **Test Location Screen**
   - Tap on Temple Square (green marker)
   - Verify TWO location boxes appear
   - Verify YOUR LOCATION shows your GPS coordinates
   - Verify DESTINATION shows Temple Square coordinates
   - These should be DIFFERENT!

### 3. **Test Route Recommendations**
   - Click "Get Directions" button
   - Verify routes show:
     - 🚶 Walking
     - 🚴 Bicycling
     - 🚌 Transit
   - Verify times and distances appear
   - Click "View Steps" to see turn-by-turn directions

### 4. **Test GPS Updates**
   - In emulator Extended Controls, change GPS location
   - Wait 5-10 seconds
   - Console should show: `🔄 GPS UPDATE: 40.75850 -111.87610 (±20m)`
   - Map should re-center on new location
   - Blue dot should move to new position

---

## 📍 Recommended Test Locations (Salt Lake City)

### Location 1: Your Home/Office
```
Latitude: 40.7585
Longitude: -111.8761
(Near Downtown SLC)
```

### Location 2: Liberty Park
```
Latitude: 40.7398
Longitude: -111.8711
(South of Temple Square - 2.1 miles away)
```

### Location 3: University of Utah
```
Latitude: 40.7649
Longitude: -111.8421
(East of Temple Square - 3.4 miles away)
```

---

## 🎯 Expected Behavior

### ✅ CORRECT:
- Header shows: `GPS: 40.7585, -111.8761` (YOUR coordinates)
- Blue dot on map at YOUR GPS location
- Green/red dots at STORY locations
- LocationScreen shows TWO different locations
- Routes calculate from YOUR location to DESTINATION

### ❌ INCORRECT (OLD BUG):
- ~~App thinks you're at Temple Square when you're not~~
- ~~Routes show "not available"~~
- ~~Location screen confusing about which location is which~~

All these issues should now be FIXED! 🎉

---

## 🚀 Ready to Test!

**Next Steps:**
1. Set emulator GPS using Extended Controls
2. Load the app
3. Watch console for GPS debug output
4. Verify blue dot (you) vs green dot (destination)
5. Test route recommendations

**If you still see issues:**
- Share the GPS debug console output
- Screenshot the location boxes in LocationScreen
- Tell me what GPS coordinates you set in Extended Controls

Let's verify everything works perfectly! 💪
