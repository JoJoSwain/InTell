# Java Installation Guide for Android Development

## Problem
Building Android apps requires Java JDK. Error: `JAVA_HOME is not set and no 'java' command could be found`.

## Solution: Install Java JDK 17

### Step 1: Download Java JDK 17

**Option A: Oracle JDK (Recommended for Development)**
1. Go to: https://www.oracle.com/java/technologies/javase/jdk17-archive-downloads.html
2. Download: **Windows x64 Installer** (`.exe` file)
3. Run the installer and follow the installation wizard

**Option B: OpenJDK (Open Source Alternative)**
1. Go to: https://adoptium.net/temurin/releases/
2. Select:
   - **Version:** 17 (LTS)
   - **Operating System:** Windows
   - **Architecture:** x64
   - **Package Type:** JDK
3. Download and run the installer

**Option C: Microsoft Build of OpenJDK**
1. Go to: https://learn.microsoft.com/en-us/java/openjdk/download#openjdk-17
2. Download: **Windows x64 Installer**
3. Run the installer

---

### Step 2: Set JAVA_HOME Environment Variable

**Windows 10/11:**

1. **Open Environment Variables:**
   - Press `Win + R`
   - Type: `sysdm.cpl`
   - Press Enter
   - Go to **Advanced** tab
   - Click **Environment Variables**

2. **Add JAVA_HOME:**
   - Under **User variables** (or **System variables**), click **New**
   - **Variable name:** `JAVA_HOME`
   - **Variable value:** `C:\Program Files\Java\jdk-17` 
     *(Adjust path if Java installed elsewhere - typically `C:\Program Files\Eclipse Adoptium\jdk-17.x.x-hotspot` for Adoptium)*
   - Click **OK**

3. **Add Java to PATH:**
   - Find **Path** variable in **User variables**
   - Click **Edit**
   - Click **New**
   - Add: `%JAVA_HOME%\bin`
   - Click **OK** on all windows

4. **Verify Installation:**
   - Close and reopen your terminal/command prompt
   - Run: `java -version`
   - Run: `echo %JAVA_HOME%` (Command Prompt) or `$env:JAVA_HOME` (PowerShell)
   - You should see Java version 17.x.x

---

### Step 3: Restart Terminal

**Important:** After setting environment variables, you MUST:
1. Close ALL terminal windows
2. Close Android Studio if it's open
3. Reopen your terminal
4. Navigate back to your project: `cd App.js`

---

### Step 4: Try Building Again

```bash
cd App.js
npx expo run:android
```

---

## Alternative: Quick PowerShell Setup Script

**Run this in PowerShell as Administrator:**

```powershell
# Check if Java is installed
$javaPath = Get-ChildItem "C:\Program Files\Java" -ErrorAction SilentlyContinue | Where-Object { $_.Name -like "*jdk*" } | Sort-Object LastWriteTime -Descending | Select-Object -First 1

if ($javaPath) {
    $javaHome = $javaPath.FullName
    Write-Host "Found Java at: $javaHome"
    
    # Set JAVA_HOME for current session
    [Environment]::SetEnvironmentVariable("JAVA_HOME", $javaHome, "User")
    
    # Add to PATH
    $path = [Environment]::GetEnvironmentVariable("Path", "User")
    if ($path -notlike "*$javaHome\bin*") {
        [Environment]::SetEnvironmentVariable("Path", "$path;$javaHome\bin", "User")
        Write-Host "Added Java to PATH"
    }
    
    Write-Host "JAVA_HOME set to: $javaHome"
    Write-Host "Please restart your terminal for changes to take effect."
} else {
    Write-Host "Java not found. Please install Java JDK 17 first."
}
```

---

## Verify Installation

After installing and setting JAVA_HOME, verify:

```bash
# Check Java version
java -version

# Should output something like:
# openjdk version "17.0.x" 2024-xx-xx
# OpenJDK Runtime Environment (build 17.0.x+...)
# OpenJDK 64-Bit Server VM (build 17.0.x+..., mixed mode, sharing)

# Check JAVA_HOME (PowerShell)
$env:JAVA_HOME

# Check JAVA_HOME (Command Prompt)
echo %JAVA_HOME%
```

---

## Still Having Issues?

### Check Java Installation Location
Java might be installed in a different location. Common paths:
- `C:\Program Files\Java\jdk-17`
- `C:\Program Files\Eclipse Adoptium\jdk-17.x.x-hotspot`
- `C:\Program Files\Microsoft\jdk-17.x.x-hotspot`
- `C:\Program Files (x86)\Java\jdk-17`

**Find your Java installation:**
```powershell
Get-ChildItem "C:\Program Files" -Recurse -Filter "java.exe" -ErrorAction SilentlyContinue | Select-Object FullName
```

Then use the parent directory of `bin\java.exe` as your JAVA_HOME.

---

## Alternative: Test in Expo Go First

**Before setting up Java, you might want to test the app in Expo Go first:**

1. Install **Expo Go** app on your phone from Google Play Store
2. Run: `cd App.js && npm start`
3. Scan the QR code with Expo Go

**Note:** Some features won't work in Expo Go (native modules), but you can at least see if the app loads and identify any JavaScript errors.

---

## Next Steps After Java Installation

Once Java is installed and JAVA_HOME is set:

1. **Restart your terminal**
2. **Run the build command:**
   ```bash
   cd App.js
   npx expo run:android
   ```

This will:
- Generate native Android code
- Build the Android app
- Install it on your connected device/emulator
- Launch the app

The first build may take 5-10 minutes.
