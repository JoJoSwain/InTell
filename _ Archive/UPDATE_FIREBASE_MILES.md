# 📏 Updated to Miles!

## ✅ Changed Distances:

### Before (Meters/Kilometers):
- Temple Square → Liberty Park: **3200 meters** (3.2 km)
- Liberty Park → Red Butte Garden: **7000 meters** (7 km)

### After (Miles):
- Temple Square → Liberty Park: **2.0 miles**
- Liberty Park → Red Butte Garden: **4.3 miles**

---

## 🔄 Update Firebase Database:

Run this command to update your Firebase data with miles:

```powershell
cd C:\Users\swainj2399\Replaceplace\App.js
node scripts/seedFirestore.js
```

This will **overwrite** the existing story segments with the new mile distances.

---

## ✅ What Changed:

**In `MockDataService.js` and `seedFirestore.js`:**
- ✅ `distance_to_next: 2.0` (instead of 3200)
- ✅ `distance_to_next: 4.3` (instead of 7000)
- ✅ `distance_unit: 'miles'` (new field)
- ✅ `directional_hints: "Travel south for about 2 miles."` (updated text)
- ✅ `directional_hints: "Travel northeast for about 4.3 miles..."` (updated text)

---

## 🎯 After Updating:

Your app will show:
- ✅ **2 miles** to Liberty Park (instead of 3.2 km)
- ✅ **4.3 miles** to Red Butte Garden (instead of 7 km)
- ✅ All navigation hints in miles

---

**Run the seeding script now to update Firebase!** 📏
