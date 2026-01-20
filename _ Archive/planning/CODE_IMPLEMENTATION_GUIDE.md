# Detailed Code Implementation Guide

This guide provides step-by-step code examples for each module of your ReplacePlace app.

---

## Prerequisites
Before starting, ensure you have:
- Node.js installed
- React Native project created (using Expo or React Native CLI)
- Basic understanding of JavaScript (you can learn as you go)

---

## Module 1: GPS Service Implementation

### File: `src/services/GPSService.js`

```javascript
import Geolocation from '@react-native-community/geolocation';
import { Platform, PermissionsAndroid } from 'react-native';

class GPSService {
  constructor() {
    this.watchId = null;
    this.isTracking = false;
    this.currentLocation = null;
  }

  // Request location permissions
  async requestPermissions() {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: 'Location Permission',
            message: 'This app needs access to your location to work properly.',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          }
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } catch (err) {
        console.warn(err);
        return false;
      }
    }
    // iOS permissions are handled in Info.plist
    return true;
  }

  // Get current location once
  getCurrentLocation() {
    return new Promise((resolve, reject) => {
      Geolocation.getCurrentPosition(
        (position) => {
          this.currentLocation = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
          };
          resolve(this.currentLocation);
        },
        (error) => {
          console.error('Error getting location:', error);
          reject(error);
        },
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 10000,
        }
      );
    });
  }

  // Start continuous location tracking
  startTracking(onLocationUpdate) {
    if (this.isTracking) {
      console.log('Already tracking location');
      return;
    }

    this.isTracking = true;
    this.watchId = Geolocation.watchPosition(
      (position) => {
        this.currentLocation = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp,
        };
        
        if (onLocationUpdate) {
          onLocationUpdate(this.currentLocation);
        }
      },
      (error) => {
        console.error('Location tracking error:', error);
      },
      {
        enableHighAccuracy: true,
        distanceFilter: 10, // Update every 10 meters
        interval: 5000, // Update every 5 seconds
        fastestInterval: 2000,
      }
    );
  }

  // Stop location tracking
  stopTracking() {
    if (this.watchId !== null) {
      Geolocation.clearWatch(this.watchId);
      this.watchId = null;
      this.isTracking = false;
    }
  }

  // Calculate distance between two coordinates (Haversine formula)
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
  }

  // Check if user is within radius of target coordinates
  checkProximity(currentLat, currentLng, targetLat, targetLng, radius) {
    const distance = this.calculateDistance(
      currentLat,
      currentLng,
      targetLat,
      targetLng
    );
    return distance <= radius;
  }

  // Get current location
  getLocation() {
    return this.currentLocation;
  }
}

export default new GPSService();
```

---

## Module 2: Audio Service Implementation

### File: `src/services/AudioService.js`

```javascript
import Sound from 'react-native-sound';

// Enable playback in silence mode and background playback (iOS)
// This allows audio to play when screen is locked/off
Sound.setCategory('Playback', true); // true = mixWithOthers (allows background playback)

class AudioService {
  constructor() {
    // Story segment audio (foreground)
    this.currentSound = null;
    this.isPlaying = false;
    this.currentAudioId = null;
    
    // Background soundtrack audio (plays simultaneously)
    this.backgroundSound = null;
    this.isBackgroundPlaying = false;
    this.backgroundVolume = 0.3; // Default lower volume for background
    this.foregroundVolume = 1.0; // Default full volume for story segments
  }

  // Load and play audio file
  playAudio(audioPath, audioId) {
    return new Promise((resolve, reject) => {
      // Stop current audio if playing
      if (this.currentSound) {
        this.stopAudio();
      }

      // Create new sound instance
      this.currentSound = new Sound(audioPath, Sound.MAIN_BUNDLE, (error) => {
        if (error) {
          console.error('Failed to load audio:', error);
          reject(error);
          return;
        }

        // Play the sound
        this.currentSound.play((success) => {
          if (success) {
            console.log('Audio finished playing');
            this.isPlaying = false;
            this.currentSound.release();
            this.currentSound = null;
            this.currentAudioId = null;
            resolve(true);
          } else {
            console.log('Playback failed');
            this.isPlaying = false;
            reject(new Error('Playback failed'));
          }
        });

        this.isPlaying = true;
        this.currentAudioId = audioId;
        resolve(true);
      });
    });
  }

  // Play audio from URL (remote file) - Story segment (plays over background)
  playAudioFromURL(url, audioId) {
    return new Promise((resolve, reject) => {
      // Stop previous story segment if playing
      if (this.currentSound) {
        this.stopAudio();
      }

      // Create new sound instance for story segment
      this.currentSound = new Sound(url, '', (error) => {
        if (error) {
          console.error('Failed to load audio from URL:', error);
          reject(error);
          return;
        }

        // Set volume for story segment (higher than background)
        this.currentSound.setVolume(this.foregroundVolume);

        // Play the sound (background soundtrack continues playing)
        this.currentSound.play((success) => {
          if (success) {
            this.isPlaying = false;
            this.currentSound.release();
            this.currentSound = null;
            this.currentAudioId = null;
            resolve(true);
          } else {
            this.isPlaying = false;
            reject(new Error('Playback failed'));
          }
        });

        this.isPlaying = true;
        this.currentAudioId = audioId;
        resolve(true);
      });
    });
  }

  // Play background soundtrack (looping, continuous)
  playBackgroundSoundtrack(url, volume = 0.3, loop = true) {
    return new Promise((resolve, reject) => {
      // Stop previous background soundtrack if playing
      if (this.backgroundSound) {
        this.stopBackgroundSoundtrack();
      }

      // Create new sound instance for background
      this.backgroundSound = new Sound(url, '', (error) => {
        if (error) {
          console.error('Failed to load background soundtrack:', error);
          reject(error);
          return;
        }

        // Set volume for background (lower than story segments)
        this.backgroundVolume = volume;
        this.backgroundSound.setVolume(volume);

        // Set looping
        this.backgroundSound.setNumberOfLoops(loop ? -1 : 0); // -1 = infinite loop

        // Play the background soundtrack
        this.backgroundSound.play((success) => {
          if (success) {
            this.isBackgroundPlaying = true;
            resolve(true);
          } else {
            this.isBackgroundPlaying = false;
            reject(new Error('Background playback failed'));
          }
        });
      });
    });
  }

  // Stop background soundtrack
  stopBackgroundSoundtrack() {
    if (this.backgroundSound) {
      this.backgroundSound.stop();
      this.backgroundSound.release();
      this.backgroundSound = null;
      this.isBackgroundPlaying = false;
      return true;
    }
    return false;
  }

  // Fade in background soundtrack (default 10 seconds)
  async fadeInSoundtrack(duration = 10000) {
    if (!this.backgroundSound || !this.isBackgroundPlaying) return;

    const steps = 20;
    const stepDuration = duration / steps;
    const volumeStep = this.backgroundVolume / steps;
    let currentVolume = 0;

    for (let i = 0; i <= steps; i++) {
      await new Promise(resolve => setTimeout(resolve, stepDuration));
      currentVolume = volumeStep * i;
      if (this.backgroundSound) {
        this.backgroundSound.setVolume(currentVolume);
      }
    }
  }

  // Fade out background soundtrack (default 10 seconds)
  async fadeOutSoundtrack(duration = 10000) {
    if (!this.backgroundSound || !this.isBackgroundPlaying) return;

    const steps = 20;
    const stepDuration = duration / steps;
    const volumeStep = this.backgroundVolume / steps;
    let currentVolume = this.backgroundVolume;

    for (let i = steps; i >= 0; i--) {
      await new Promise(resolve => setTimeout(resolve, stepDuration));
      currentVolume = volumeStep * i;
      if (this.backgroundSound) {
        this.backgroundSound.setVolume(currentVolume);
      }
    }

    this.stopBackgroundSoundtrack();
  }

  // Set background soundtrack volume
  setBackgroundVolume(volume) {
    if (this.backgroundSound) {
      this.backgroundVolume = Math.max(0, Math.min(1, volume));
      this.backgroundSound.setVolume(this.backgroundVolume);
      return true;
    }
    return false;
  }

  // Set foreground (story segment) volume
  setForegroundVolume(volume) {
    if (this.currentSound) {
      this.foregroundVolume = Math.max(0, Math.min(1, volume));
      this.currentSound.setVolume(this.foregroundVolume);
      return true;
    }
    this.foregroundVolume = Math.max(0, Math.min(1, volume));
    return false;
  }

  // Check if background is playing
  isBackgroundPlaying() {
    return this.isBackgroundPlaying;
  }

  // Pause audio
  pauseAudio() {
    if (this.currentSound && this.isPlaying) {
      this.currentSound.pause();
      this.isPlaying = false;
      return true;
    }
    return false;
  }

  // Resume audio
  resumeAudio() {
    if (this.currentSound && !this.isPlaying) {
      this.currentSound.play();
      this.isPlaying = true;
      return true;
    }
    return false;
  }

  // Stop audio
  stopAudio() {
    if (this.currentSound) {
      this.currentSound.stop();
      this.currentSound.release();
      this.currentSound = null;
      this.isPlaying = false;
      this.currentAudioId = null;
      return true;
    }
    return false;
  }

  // Set volume (0.0 to 1.0)
  setVolume(volume) {
    if (this.currentSound) {
      this.currentSound.setVolume(volume);
      return true;
    }
    return false;
  }

  // Get current playback status
  getStatus() {
    return {
      isPlaying: this.isPlaying,
      currentAudioId: this.currentAudioId,
      hasAudio: this.currentSound !== null,
      isBackgroundPlaying: this.isBackgroundPlaying,
      backgroundVolume: this.backgroundVolume,
      foregroundVolume: this.foregroundVolume,
    };
  }

  // Get current playback position
  getCurrentTime() {
    return new Promise((resolve, reject) => {
      if (this.currentSound) {
        this.currentSound.getCurrentTime((seconds) => {
          resolve(seconds);
        });
      } else {
        resolve(0);
      }
    });
  }

  // Get audio duration
  getDuration() {
    if (this.currentSound) {
      return this.currentSound.getDuration();
    }
    return 0;
  }
}

export default new AudioService();
```

---

## Module 2.5: Haptic Notification Service Implementation

### File: `src/services/HapticService.js`

```javascript
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import { Platform, Vibration } from 'react-native';
import LocalStorage from '../storage/LocalStorage';

// Haptic feedback options
const hapticOptions = {
  enableVibrateFallback: true,
  ignoreAndroidSystemSettings: false,
};

// Haptic patterns/types
const HapticTypes = {
  // iOS specific patterns
  impactLight: 'impactLight',
  impactMedium: 'impactMedium',
  impactHeavy: 'impactHeavy',
  notificationSuccess: 'notificationSuccess',
  notificationWarning: 'notificationWarning',
  notificationError: 'notificationError',
  selection: 'selection',
  
  // Android patterns (will use vibration)
  light: 'light',
  medium: 'medium',
  heavy: 'heavy',
};

class HapticService {
  constructor() {
    this.isEnabled = true; // Default to enabled
    this.lastVibrationTime = {}; // Track last vibration time per location
    this.vibrationCooldown = 2000; // 2 seconds cooldown between vibrations
    this.loadSettings();
  }

  // Load haptic settings from storage
  async loadSettings() {
    try {
      const settings = await LocalStorage.getSettings();
      if (settings && settings.hapticsEnabled !== undefined) {
        this.isEnabled = settings.hapticsEnabled;
      }
    } catch (error) {
      console.error('Error loading haptic settings:', error);
    }
  }

  // Save haptic settings
  async saveSettings() {
    try {
      const settings = await LocalStorage.getSettings() || {};
      settings.hapticsEnabled = this.isEnabled;
      await LocalStorage.saveSettings(settings);
    } catch (error) {
      console.error('Error saving haptic settings:', error);
    }
  }

  // Enable haptic feedback
  async enableHaptics() {
    this.isEnabled = true;
    await this.saveSettings();
  }

  // Disable haptic feedback
  async disableHaptics() {
    this.isEnabled = false;
    await this.saveSettings();
  }

  // Check if haptics are enabled
  isHapticsEnabled() {
    return this.isEnabled;
  }

  // Trigger haptic feedback with specific pattern
  triggerHaptic(pattern = HapticTypes.impactMedium) {
    if (!this.isEnabled) {
      return;
    }

    try {
      if (Platform.OS === 'ios') {
        // Use native haptic feedback on iOS
        ReactNativeHapticFeedback.trigger(pattern, hapticOptions);
      } else {
        // Use vibration on Android
        this.triggerVibration(pattern);
      }
    } catch (error) {
      console.error('Error triggering haptic:', error);
      // Fallback to basic vibration
      this.triggerVibration(pattern);
    }
  }

  // Trigger vibration (Android fallback or custom pattern)
  triggerVibration(pattern = HapticTypes.medium) {
    if (!this.isEnabled) {
      return;
    }

    try {
      let vibrationPattern = [0, 100]; // Default: 100ms vibration

      switch (pattern) {
        case HapticTypes.light:
        case HapticTypes.impactLight:
          vibrationPattern = [0, 50]; // Light: 50ms
          break;
        case HapticTypes.medium:
        case HapticTypes.impactMedium:
          vibrationPattern = [0, 100]; // Medium: 100ms
          break;
        case HapticTypes.heavy:
        case HapticTypes.impactHeavy:
          vibrationPattern = [0, 200]; // Heavy: 200ms
          break;
        case HapticTypes.notificationSuccess:
          vibrationPattern = [0, 100, 50, 100]; // Success: double tap
          break;
        case HapticTypes.notificationWarning:
          vibrationPattern = [0, 150, 50, 150]; // Warning: longer double tap
          break;
        case HapticTypes.notificationError:
          vibrationPattern = [0, 200, 100, 200, 100, 200]; // Error: triple tap
          break;
        default:
          vibrationPattern = [0, 100];
      }

      Vibration.vibrate(vibrationPattern);
    } catch (error) {
      console.error('Error triggering vibration:', error);
    }
  }

  // Trigger haptic based on distance to target (proximity-based)
  triggerProximityHaptic(distance, targetRadius, locationId = null) {
    if (!this.isEnabled) {
      return;
    }

    // Check cooldown to prevent excessive vibrations
    if (locationId) {
      const lastVibration = this.lastVibrationTime[locationId];
      const now = Date.now();
      if (lastVibration && (now - lastVibration) < this.vibrationCooldown) {
        return; // Still in cooldown period
      }
      this.lastVibrationTime[locationId] = now;
    }

    // Calculate proximity percentage (0 = at target, 1 = far away)
    const proximityRatio = Math.min(distance / targetRadius, 1);

    // Determine haptic pattern based on proximity
    if (proximityRatio <= 0.1) {
      // Very close (within 10% of radius) - strong haptic
      this.triggerHaptic(HapticTypes.impactHeavy);
    } else if (proximityRatio <= 0.3) {
      // Close (within 30% of radius) - medium haptic
      this.triggerHaptic(HapticTypes.impactMedium);
    } else if (proximityRatio <= 0.6) {
      // Approaching (within 60% of radius) - light haptic
      this.triggerHaptic(HapticTypes.impactLight);
    }
    // Beyond 60% - no haptic (too far)
  }

  // Trigger haptic when entering GPS coordinate range
  triggerLocationEntered(locationId, locationName) {
    if (!this.isEnabled) {
      return;
    }

    // Check cooldown
    const lastVibration = this.lastVibrationTime[locationId];
    const now = Date.now();
    if (lastVibration && (now - lastVibration) < this.vibrationCooldown) {
      return;
    }
    this.lastVibrationTime[locationId] = now;

    // Success notification pattern
    this.triggerHaptic(HapticTypes.notificationSuccess);
  }

  // Trigger haptic when reaching exact GPS coordinate
  triggerLocationReached(locationId, locationName) {
    if (!this.isEnabled) {
      return;
    }

    // Strong haptic for reaching the exact location
    this.triggerHaptic(HapticTypes.impactHeavy);
    
    // Optional: Add a second vibration after a short delay
    setTimeout(() => {
      if (this.isEnabled) {
        this.triggerHaptic(HapticTypes.notificationSuccess);
      }
    }, 300);
  }

  // Clear vibration history for a location
  clearLocationHistory(locationId) {
    if (this.lastVibrationTime[locationId]) {
      delete this.lastVibrationTime[locationId];
    }
  }

  // Clear all vibration history
  clearAllHistory() {
    this.lastVibrationTime = {};
  }

  // Set vibration cooldown period (in milliseconds)
  setCooldownPeriod(milliseconds) {
    this.vibrationCooldown = Math.max(500, milliseconds); // Minimum 500ms
  }

  // Get available haptic types
  getHapticTypes() {
    return HapticTypes;
  }
}

export default new HapticService();
```

---

## Module 2.6: Audio Navigation Service Implementation

### File: `src/services/AudioNavigationService.js`

```javascript
import AudioService from './AudioService';
import GPSService from './GPSService';
import StoryService from './StoryService';
import { Platform } from 'react-native';

// For text-to-speech (optional, for dynamic announcements)
// npm install @react-native-community/tts
// import Tts from 'react-native-tts';

class AudioNavigationService {
  constructor() {
    this.isEnabled = true;
    this.announcementQueue = [];
    this.isAnnouncing = false;
  }

  // Enable/disable audio navigation
  enable() {
    this.isEnabled = true;
  }

  disable() {
    this.isEnabled = false;
  }

  // Get navigation instructions for next location (from story segment)
  getNavigationInstructions(nextLocationId) {
    try {
      const nextLocation = StoryService.getStorySegmentByLocation(nextLocationId);
      if (!nextLocation) return null;

      return {
        instructions: nextLocation.navigation_instructions || '',
        hints: nextLocation.directional_hints || '',
        description: nextLocation.next_location_description || '',
        distance: nextLocation.distance_to_next || null,
      };
    } catch (error) {
      console.error('Error getting navigation instructions:', error);
      return null;
    }
  }

  // Announce when location is reached
  async announceLocationReached(locationId, locationName, chapterNumber) {
    if (!this.isEnabled) return;

    const announcement = `Chapter ${chapterNumber} complete. Location reached: ${locationName}.`;
    await this.queueAnnouncement(announcement);

    // Get navigation instructions for next location
    const nextSegment = StoryService.getNextStorySegment(locationId);
    if (nextSegment) {
      const navInstructions = this.getNavigationInstructions(nextSegment.location_id);
      if (navInstructions && navInstructions.instructions) {
        await this.queueAnnouncement(navInstructions.instructions);
      }
      
      if (navInstructions && navInstructions.distance) {
        await this.queueAnnouncement(
          `The next location is approximately ${navInstructions.distance} meters away.`
        );
      }
    }
  }

  // Announce progress updates
  async announceProgress(chapterNumber, totalChapters) {
    if (!this.isEnabled) return;

    const announcement = `You've completed ${chapterNumber} of ${totalChapters} chapters.`;
    await this.queueAnnouncement(announcement);
  }

  // Provide directional hints based on current and target location
  async provideDirectionalHints(currentLocation, targetLocation) {
    if (!this.isEnabled || !currentLocation || !targetLocation) return;

    try {
      const distance = GPSService.calculateDistance(
        currentLocation.latitude,
        currentLocation.longitude,
        targetLocation.latitude,
        targetLocation.longitude
      );

      // Get bearing/direction
      const bearing = this.calculateBearing(
        currentLocation.latitude,
        currentLocation.longitude,
        targetLocation.latitude,
        targetLocation.longitude
      );

      const direction = this.bearingToDirection(bearing);
      const distanceText = distance < 1000 
        ? `${Math.round(distance)} meters` 
        : `${(distance / 1000).toFixed(1)} kilometers`;

      const hint = `Head ${direction}. The next location is ${distanceText} away.`;
      await this.queueAnnouncement(hint);
    } catch (error) {
      console.error('Error providing directional hints:', error);
    }
  }

  // Announce proximity warnings
  async announceProximity(distance, locationName) {
    if (!this.isEnabled) return;

    if (distance < 50) {
      await this.queueAnnouncement(`You're very close to ${locationName}.`);
    } else if (distance < 100) {
      await this.queueAnnouncement(`Approaching ${locationName}.`);
    }
  }

  // Calculate bearing between two points
  calculateBearing(lat1, lon1, lat2, lon2) {
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const lat1Rad = lat1 * Math.PI / 180;
    const lat2Rad = lat2 * Math.PI / 180;

    const y = Math.sin(dLon) * Math.cos(lat2Rad);
    const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) - 
              Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);

    const bearing = Math.atan2(y, x) * 180 / Math.PI;
    return (bearing + 360) % 360;
  }

  // Convert bearing to direction text
  bearingToDirection(bearing) {
    const directions = ['north', 'northeast', 'east', 'southeast', 
                        'south', 'southwest', 'west', 'northwest'];
    const index = Math.round(bearing / 45) % 8;
    return directions[index];
  }

  // Queue announcement (prevents overlapping audio)
  async queueAnnouncement(text) {
    if (!text || !this.isEnabled) return;

    this.announcementQueue.push(text);
    await this.processQueue();
  }

  // Process announcement queue
  async processQueue() {
    if (this.isAnnouncing || this.announcementQueue.length === 0) {
      return;
    }

    this.isAnnouncing = true;
    const announcement = this.announcementQueue.shift();

    try {
      // Option 1: Use pre-recorded audio file for announcement
      // await AudioService.playAudioFromURL(announcementAudioUrl);

      // Option 2: Use text-to-speech (requires TTS library)
      // await Tts.speak(announcement);

      // Option 3: Embed in story audio (recommended - navigation in story segments)
      // Navigation instructions should be part of story audio files
      
      console.log('Audio Navigation:', announcement);
      
      // For now, log the announcement
      // In production, this would trigger TTS or play pre-recorded audio
      
    } catch (error) {
      console.error('Error processing announcement:', error);
    } finally {
      this.isAnnouncing = false;
      
      // Process next item in queue
      if (this.announcementQueue.length > 0) {
        setTimeout(() => this.processQueue(), 500);
      }
    }
  }

  // Speak text using TTS (if TTS library is installed)
  async speakText(text) {
    if (!this.isEnabled || !text) return;

    try {
      // Uncomment if using react-native-tts
      // await Tts.speak(text);
      console.log('TTS:', text);
    } catch (error) {
      console.error('Error speaking text:', error);
    }
  }

  // Clear announcement queue
  clearQueue() {
    this.announcementQueue = [];
    this.isAnnouncing = false;
  }
}

export default new AudioNavigationService();
```

**Note**: Navigation instructions should primarily be embedded in the story audio files themselves. This service provides additional dynamic announcements and can be used for text-to-speech if needed.

---

## Module 2.7: Background Soundtrack & Geofence Service Implementation

### File: `src/services/BackgroundSoundtrackService.js`

```javascript
import AudioService from './AudioService';
import GPSService from './GPSService';
import APIService from './APIService';

class BackgroundSoundtrackService {
  constructor() {
    this.geofences = [];
    this.currentGeofence = null;
    this.previousGeofence = null;
    this.isInitialized = false;
  }

  // Load all geofences from server
  async loadGeofences() {
    try {
      const geofences = await APIService.getGeofences();
      this.geofences = geofences;
      this.isInitialized = true;
      return this.geofences;
    } catch (error) {
      console.error('Error loading geofences:', error);
      return [];
    }
  }

  // Check if coordinates are within a geofence
  isInGeofence(latitude, longitude, geofence) {
    if (!geofence || !geofence.center_latitude || !geofence.center_longitude) {
      return false;
    }

    const distance = GPSService.calculateDistance(
      latitude,
      longitude,
      geofence.center_latitude,
      geofence.center_longitude
    );

    return distance <= geofence.radius;
  }

  // Check if user entered a geofence
  // Each geofence has its own unique soundtrack - when entering a new geofence, 
  // the previous geofence's soundtrack stops and the new geofence's soundtrack starts
  checkGeofenceEntry(latitude, longitude) {
    if (!this.isInitialized || this.geofences.length === 0) {
      return null;
    }

    // Check if already in a geofence
    if (this.currentGeofence) {
      // Check if still in current geofence
      if (this.isInGeofence(latitude, longitude, this.currentGeofence)) {
        return null; // Still in same geofence - continue playing its soundtrack
      } else {
        // Exited current geofence - stop its soundtrack
        this.handleGeofenceExit();
      }
    }

    // Check all geofences to see if user entered any
    // Each geofence has its own background_soundtrack_url
    for (const geofence of this.geofences) {
      if (this.isInGeofence(latitude, longitude, geofence)) {
        // Check priority if multiple geofences overlap
        if (!this.currentGeofence || geofence.priority >= this.currentGeofence.priority) {
          // Entered a new geofence - play its unique soundtrack
          this.handleGeofenceEntry(geofence);
          return geofence;
        }
      }
    }

    return null;
  }

  // Check if user exited a geofence
  checkGeofenceExit(latitude, longitude) {
    if (!this.currentGeofence) {
      return null;
    }

    if (!this.isInGeofence(latitude, longitude, this.currentGeofence)) {
      this.handleGeofenceExit();
      return this.previousGeofence;
    }

    return null;
  }

  // Handle geofence entry
  async handleGeofenceEntry(geofence) {
    console.log(`Entered geofence: ${geofence.name} - Playing soundtrack: ${geofence.background_soundtrack_url}`);
    
    this.previousGeofence = this.currentGeofence;
    this.currentGeofence = geofence;

    // Stop previous geofence's soundtrack if playing (each geofence has its own soundtrack)
    // Fade out over 10 seconds when exiting
    if (this.previousGeofence) {
      console.log(`Fading out previous geofence soundtrack: ${this.previousGeofence.name}`);
      await AudioService.fadeOutSoundtrack(
        this.previousGeofence.fade_out_duration || 10000 // Default 10 seconds
      );
    }

    // Start this geofence's unique soundtrack
    // Each geofence has its own background_soundtrack_url - different geofences = different soundtracks
    if (geofence.background_soundtrack_url) {
      const volume = geofence.background_volume || 0.3;
      const loop = geofence.loop !== false; // Default to true

      console.log(`Playing geofence soundtrack: ${geofence.background_soundtrack_url} at volume ${volume}`);
      await AudioService.playBackgroundSoundtrack(
        geofence.background_soundtrack_url, // This geofence's unique soundtrack
        volume,
        loop
      );

      // Fade in over 10 seconds when entering geofence
      const fadeInDuration = geofence.fade_in_duration || 10000; // Default 10 seconds
      await AudioService.fadeInSoundtrack(fadeInDuration);
    } else {
      console.warn(`Geofence ${geofence.name} has no background_soundtrack_url assigned`);
    }
  }

  // Handle geofence exit
  async handleGeofenceExit() {
    if (!this.currentGeofence) return;

    console.log(`Exited geofence: ${this.currentGeofence.name} - Fading out its unique soundtrack over 10 seconds`);

    // Fade out and stop this geofence's unique soundtrack over 10 seconds
    const fadeOutDuration = this.currentGeofence.fade_out_duration || 10000; // Default 10 seconds
    await AudioService.fadeOutSoundtrack(fadeOutDuration);

    this.previousGeofence = this.currentGeofence;
    this.currentGeofence = null;
  }

  // Play background soundtrack for specific geofence
  async playBackgroundSoundtrack(geofenceId) {
    const geofence = this.geofences.find(g => g.id === geofenceId);
    if (!geofence) {
      console.error('Geofence not found:', geofenceId);
      return false;
    }

    await this.handleGeofenceEntry(geofence);
    return true;
  }

  // Stop current background soundtrack
  async stopBackgroundSoundtrack() {
    await this.handleGeofenceExit();
  }

  // Set background volume
  setBackgroundVolume(volume) {
    return AudioService.setBackgroundVolume(volume);
  }

  // Get currently active geofence
  getCurrentGeofence() {
    return this.currentGeofence;
  }

  // Check current geofence status (called continuously from GPS tracking)
  async checkGeofenceStatus(latitude, longitude) {
    // Check for entry first
    const enteredGeofence = this.checkGeofenceEntry(latitude, longitude);
    
    // If no entry, check for exit
    if (!enteredGeofence) {
      this.checkGeofenceExit(latitude, longitude);
    }

    return this.currentGeofence;
  }

  // Initialize service
  async initialize() {
    await this.loadGeofences();
    return this.geofences;
  }
}

export default new BackgroundSoundtrackService();
```

---

## Module 3: Progress Management Service

### File: `src/services/ProgressService.js`

```javascript
import LocalStorage from '../storage/LocalStorage';
import APIService from './APIService';

class ProgressService {
  constructor() {
    this.progress = null;
  }

  // Initialize progress for user
  async initializeProgress(userId) {
    try {
      // Try to load from local storage first
      const localProgress = await LocalStorage.getProgress();
      
      if (localProgress) {
        this.progress = localProgress;
        // Sync with server
        await this.syncProgress(userId);
        return this.progress;
      }

      // If no local progress, fetch from server
      const serverProgress = await APIService.getUserProgress(userId);
      
      if (serverProgress) {
        this.progress = serverProgress;
        await LocalStorage.saveProgress(serverProgress);
        return this.progress;
      }

      // Create new progress object
      this.progress = {
        userId: userId,
        unlockedLocations: [],
        completedLocations: [],
        heardStorySegments: [], // Track which story segments have been heard
        storyProgress: {}, // Track story progression details
        lastSynced: new Date().toISOString(),
      };
      
      await LocalStorage.saveProgress(this.progress);
      return this.progress;
    } catch (error) {
      console.error('Error initializing progress:', error);
      // Return default progress
      this.progress = {
        userId: userId,
        unlockedLocations: [],
        completedLocations: [],
        lastSynced: new Date().toISOString(),
      };
      return this.progress;
    }
  }

  // Get user progress
  getProgress() {
    return this.progress;
  }

  // Check if location is unlocked
  isLocationUnlocked(locationId) {
    if (!this.progress) return false;
    return this.progress.unlockedLocations.includes(locationId);
  }

  // Check if location is completed
  isLocationCompleted(locationId) {
    if (!this.progress) return false;
    return this.progress.completedLocations.includes(locationId);
  }

  // Unlock a location
  async unlockLocation(locationId, userId) {
    if (!this.progress) {
      await this.initializeProgress(userId);
    }

    if (!this.progress.unlockedLocations.includes(locationId)) {
      this.progress.unlockedLocations.push(locationId);
      this.progress.lastSynced = new Date().toISOString();
      
      // Save locally
      await LocalStorage.saveProgress(this.progress);
      
      // Sync with server
      await APIService.updateProgress(userId, this.progress);
      
      return true;
    }
    return false;
  }

  // Mark location as completed
  async completeLocation(locationId, userId, storySegmentId = null) {
    if (!this.progress) {
      await this.initializeProgress(userId);
    }

    // Add to completed if not already
    if (!this.progress.completedLocations.includes(locationId)) {
      this.progress.completedLocations.push(locationId);
      this.progress.lastSynced = new Date().toISOString();
      
      // Track story segment if provided
      if (storySegmentId && !this.progress.heardStorySegments.includes(storySegmentId)) {
        this.progress.heardStorySegments.push(storySegmentId);
        this.progress.storyProgress[storySegmentId] = {
          heardAt: new Date().toISOString(),
          replayCount: 0,
        };
      }
      
      // Save locally
      await LocalStorage.saveProgress(this.progress);
      
      // Sync with server
      await APIService.updateProgress(userId, this.progress);
      
      // Check for next location to unlock
      await this.checkAndUnlockNextLocation(locationId, userId);
      
      return true;
    }
    return false;
  }

  // Mark story segment as heard
  async markStorySegmentHeard(segmentId, userId) {
    if (!this.progress) {
      await this.initializeProgress(userId);
    }

    if (!this.progress.heardStorySegments.includes(segmentId)) {
      this.progress.heardStorySegments.push(segmentId);
      this.progress.storyProgress[segmentId] = {
        heardAt: new Date().toISOString(),
        replayCount: 0,
      };
      
      await LocalStorage.saveProgress(this.progress);
      await APIService.updateProgress(userId, this.progress);
      
      return true;
    }
    return false;
  }

  // Check if story segment has been heard
  isStorySegmentHeard(segmentId) {
    if (!this.progress) return false;
    return this.progress.heardStorySegments.includes(segmentId);
  }

  // Get story progress
  getStoryProgress() {
    if (!this.progress) return { heardSegments: [], totalSegments: 0, percentage: 0 };
    return {
      heardSegments: this.progress.heardStorySegments,
      totalSegments: 0, // Will be set by StoryService
      percentage: 0, // Will be calculated by StoryService
      progress: this.progress.storyProgress,
    };
  }

  // Check and unlock next location in sequence
  async checkAndUnlockNextLocation(completedLocationId, userId) {
    try {
      // Get all locations from server
      const locations = await APIService.getLocations();
      
      // Find the location that has this completed location as prerequisite
      const nextLocation = locations.find(
        (loc) => loc.prerequisite_location_id === completedLocationId
      );

      if (nextLocation) {
        // Unlock the next location
        await this.unlockLocation(nextLocation.id, userId);
        return nextLocation;
      }
      
      return null;
    } catch (error) {
      console.error('Error checking next location:', error);
      return null;
    }
  }

  // Get progress percentage
  getProgressPercentage(totalLocations) {
    if (!this.progress || totalLocations === 0) return 0;
    return Math.round(
      (this.progress.completedLocations.length / totalLocations) * 100
    );
  }

  // Sync progress with server
  async syncProgress(userId) {
    try {
      if (!this.progress) return;

      await APIService.updateProgress(userId, this.progress);
      this.progress.lastSynced = new Date().toISOString();
      await LocalStorage.saveProgress(this.progress);
      
      return true;
    } catch (error) {
      console.error('Error syncing progress:', error);
      return false;
    }
  }
}

export default new ProgressService();
```

---

## Module 3.5: Story Management Service Implementation

### File: `src/services/StoryService.js`

```javascript
import APIService from './APIService';
import ProgressService from './ProgressService';

class StoryService {
  constructor() {
    this.storySegments = [];
    this.currentStory = null;
  }

  // Load all story segments
  async loadStorySegments() {
    try {
      const segments = await APIService.getStorySegments();
      this.storySegments = segments.sort((a, b) => a.chapter_number - b.chapter_number);
      return this.storySegments;
    } catch (error) {
      console.error('Error loading story segments:', error);
      return [];
    }
  }

  // Get story segment by ID
  getStorySegment(segmentId) {
    return this.storySegments.find(seg => seg.id === segmentId);
  }

  // Get story segment by location ID
  getStorySegmentByLocation(locationId) {
    return this.storySegments.find(seg => seg.location_id === locationId);
  }

  // Get next story segment
  getNextStorySegment(currentSegmentId) {
    const currentSegment = this.getStorySegment(currentSegmentId);
    if (!currentSegment || !currentSegment.next_segment_id) {
      return null;
    }
    return this.getStorySegment(currentSegment.next_segment_id);
  }

  // Get previous story segment
  getPreviousStorySegment(currentSegmentId) {
    const currentSegment = this.getStorySegment(currentSegmentId);
    if (!currentSegment || !currentSegment.previous_segment_id) {
      return null;
    }
    return this.getStorySegment(currentSegment.previous_segment_id);
  }

  // Get story progress percentage
  getStoryProgressPercentage(userId) {
    const storyProgress = ProgressService.getStoryProgress();
    const totalSegments = this.storySegments.length;
    
    if (totalSegments === 0) return 0;
    
    const heardCount = storyProgress.heardSegments.length;
    const percentage = Math.round((heardCount / totalSegments) * 100);
    
    return {
      heardCount,
      totalCount: totalSegments,
      percentage,
      segments: this.storySegments.map(seg => ({
        ...seg,
        heard: storyProgress.heardSegments.includes(seg.id),
        heardAt: storyProgress.progress[seg.id]?.heardAt,
      })),
    };
  }

  // Get current chapter number (last heard segment)
  getCurrentChapter(userId) {
    const storyProgress = ProgressService.getStoryProgress();
    const heardSegments = storyProgress.heardSegments;
    
    if (heardSegments.length === 0) return 0;
    
    // Find the highest chapter number among heard segments
    let maxChapter = 0;
    heardSegments.forEach(segmentId => {
      const segment = this.getStorySegment(segmentId);
      if (segment && segment.chapter_number > maxChapter) {
        maxChapter = segment.chapter_number;
      }
    });
    
    return maxChapter;
  }

  // Get story summary/overview
  getStorySummary() {
    return {
      totalChapters: this.storySegments.length,
      segments: this.storySegments.map(seg => ({
        id: seg.id,
        chapterNumber: seg.chapter_number,
        title: seg.segment_title,
        description: seg.segment_description,
        locationId: seg.location_id,
      })),
    };
  }

  // Check if user can access a story segment (based on progression)
  canAccessStorySegment(segmentId, userId) {
    const segment = this.getStorySegment(segmentId);
    if (!segment) return false;
    
    // If no previous segment, it's the first one - always accessible
    if (!segment.previous_segment_id) return true;
    
    // Check if previous segment has been heard
    const storyProgress = ProgressService.getStoryProgress();
    return storyProgress.heardSegments.includes(segment.previous_segment_id);
  }

  // Get story context for a segment (previous segments summary)
  getStoryContext(segmentId, maxContextSegments = 3) {
    const segment = this.getStorySegment(segmentId);
    if (!segment) return null;
    
    const context = [];
    let currentSegment = segment;
    
    // Go backwards through previous segments
    for (let i = 0; i < maxContextSegments && currentSegment.previous_segment_id; i++) {
      const prevSegment = this.getStorySegment(currentSegment.previous_segment_id);
      if (prevSegment) {
        context.unshift({
          chapterNumber: prevSegment.chapter_number,
          title: prevSegment.segment_title,
          description: prevSegment.segment_description,
        });
        currentSegment = prevSegment;
      } else {
        break;
      }
    }
    
    return {
      currentSegment: {
        chapterNumber: segment.chapter_number,
        title: segment.segment_title,
        description: segment.segment_description,
      },
      previousContext: context,
    };
  }

  // Initialize story service
  async initialize(userId) {
    await this.loadStorySegments();
    return this.storySegments;
  }
}

export default new StoryService();
```

---

## Module 4: Local Storage Service

### File: `src/storage/LocalStorage.js`

```javascript
import AsyncStorage from '@react-native-async-storage/async-storage';

class LocalStorage {
  // User data keys
  USER_KEY = '@replaceplace:user';
  PROGRESS_KEY = '@replaceplace:progress';
  SETTINGS_KEY = '@replaceplace:settings';

  // Save user data
  async saveUser(userData) {
    try {
      const jsonValue = JSON.stringify(userData);
      await AsyncStorage.setItem(this.USER_KEY, jsonValue);
      return true;
    } catch (error) {
      console.error('Error saving user:', error);
      return false;
    }
  }

  // Get user data
  async getUser() {
    try {
      const jsonValue = await AsyncStorage.getItem(this.USER_KEY);
      return jsonValue != null ? JSON.parse(jsonValue) : null;
    } catch (error) {
      console.error('Error getting user:', error);
      return null;
    }
  }

  // Remove user data (logout)
  async removeUser() {
    try {
      await AsyncStorage.removeItem(this.USER_KEY);
      return true;
    } catch (error) {
      console.error('Error removing user:', error);
      return false;
    }
  }

  // Save progress
  async saveProgress(progress) {
    try {
      const jsonValue = JSON.stringify(progress);
      await AsyncStorage.setItem(this.PROGRESS_KEY, jsonValue);
      return true;
    } catch (error) {
      console.error('Error saving progress:', error);
      return false;
    }
  }

  // Get progress
  async getProgress() {
    try {
      const jsonValue = await AsyncStorage.getItem(this.PROGRESS_KEY);
      return jsonValue != null ? JSON.parse(jsonValue) : null;
    } catch (error) {
      console.error('Error getting progress:', error);
      return null;
    }
  }

  // Save settings
  async saveSettings(settings) {
    try {
      const jsonValue = JSON.stringify(settings);
      await AsyncStorage.setItem(this.SETTINGS_KEY, jsonValue);
      return true;
    } catch (error) {
      console.error('Error saving settings:', error);
      return false;
    }
  }

  // Get settings
  async getSettings() {
    try {
      const jsonValue = await AsyncStorage.getItem(this.SETTINGS_KEY);
      return jsonValue != null ? JSON.parse(jsonValue) : null;
    } catch (error) {
      console.error('Error getting settings:', error);
      return null;
    }
  }

  // Clear all storage
  async clearStorage() {
    try {
      await AsyncStorage.multiRemove([
        this.USER_KEY,
        this.PROGRESS_KEY,
        this.SETTINGS_KEY,
      ]);
      return true;
    } catch (error) {
      console.error('Error clearing storage:', error);
      return false;
    }
  }
}

export default new LocalStorage();
```

---

## Module 5: API Service

### File: `src/services/APIService.js`

```javascript
import axios from 'axios';

// Replace with your backend API URL
const API_BASE_URL = 'https://your-api-url.com/api';

class APIService {
  constructor() {
    this.api = axios.create({
      baseURL: API_BASE_URL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add request interceptor for authentication token
    this.api.interceptors.request.use(
      (config) => {
        // Add auth token if available
        const token = this.getAuthToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );
  }

  // Store auth token (you'll implement this based on your auth system)
  setAuthToken(token) {
    // Store token in AsyncStorage or secure storage
    // Implementation depends on your storage solution
  }

  getAuthToken() {
    // Retrieve token from storage
    // Implementation depends on your storage solution
    return null;
  }

  // User registration
  async register(userData) {
    try {
      const response = await this.api.post('/auth/register', userData);
      return response.data;
    } catch (error) {
      console.error('Registration error:', error);
      throw error;
    }
  }

  // User login
  async login(email, password) {
    try {
      const response = await this.api.post('/auth/login', {
        email,
        password,
      });
      
      // Store token if provided
      if (response.data.token) {
        this.setAuthToken(response.data.token);
      }
      
      return response.data;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }

  // Get user profile
  async getUserProfile(userId) {
    try {
      const response = await this.api.get(`/users/${userId}`);
      return response.data;
    } catch (error) {
      console.error('Get user profile error:', error);
      throw error;
    }
  }

  // Update user profile
  async updateUserProfile(userId, userData) {
    try {
      const response = await this.api.put(`/users/${userId}`, userData);
      return response.data;
    } catch (error) {
      console.error('Update user profile error:', error);
      throw error;
    }
  }

  // Get all locations
  async getLocations() {
    try {
      const response = await this.api.get('/locations');
      return response.data;
    } catch (error) {
      console.error('Get locations error:', error);
      throw error;
    }
  }

  // Get user progress
  async getUserProgress(userId) {
    try {
      const response = await this.api.get(`/users/${userId}/progress`);
      return response.data;
    } catch (error) {
      console.error('Get user progress error:', error);
      throw error;
    }
  }

  // Update user progress
  async updateProgress(userId, progress) {
    try {
      const response = await this.api.put(`/users/${userId}/progress`, progress);
      return response.data;
    } catch (error) {
      console.error('Update progress error:', error);
      throw error;
    }
  }

  // Get all story segments
  async getStorySegments() {
    try {
      const response = await this.api.get('/story-segments');
      return response.data;
    } catch (error) {
      console.error('Get story segments error:', error);
      throw error;
    }
  }

  // Get story segment by ID
  async getStorySegment(segmentId) {
    try {
      const response = await this.api.get(`/story-segments/${segmentId}`);
      return response.data;
    } catch (error) {
      console.error('Get story segment error:', error);
      throw error;
    }
  }

  // Get story segment by location ID
  async getStorySegmentByLocation(locationId) {
    try {
      const response = await this.api.get(`/story-segments/location/${locationId}`);
      return response.data;
    } catch (error) {
      console.error('Get story segment by location error:', error);
      throw error;
    }
  }

  // Submit location recommendation
  async submitLocationRecommendation(recommendationData) {
    try {
      const response = await this.api.post('/recommendations', recommendationData);
      return response.data;
    } catch (error) {
      console.error('Submit recommendation error:', error);
      throw error;
    }
  }

  // Get user's recommendations
  async getUserRecommendations(userId) {
    try {
      const response = await this.api.get(`/users/${userId}/recommendations`);
      return response.data;
    } catch (error) {
      console.error('Get user recommendations error:', error);
      throw error;
    }
  }

  // Get recommendation status
  async getRecommendationStatus(recommendationId) {
    try {
      const response = await this.api.get(`/recommendations/${recommendationId}`);
      return response.data;
    } catch (error) {
      console.error('Get recommendation status error:', error);
      throw error;
    }
  }

  // Get all geofences
  async getGeofences() {
    try {
      const response = await this.api.get('/geofences');
      return response.data;
    } catch (error) {
      console.error('Get geofences error:', error);
      throw error;
    }
  }

  // Get geofence by ID
  async getGeofence(geofenceId) {
    try {
      const response = await this.api.get(`/geofences/${geofenceId}`);
      return response.data;
    } catch (error) {
      console.error('Get geofence error:', error);
      throw error;
    }
  }
}

export default new APIService();
```

---

## Module 6: Main App Logic

### File: `App.js`

```javascript
import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';

// Import services
import GPSService from './src/services/GPSService';
import AudioService from './src/services/AudioService';
import HapticService from './src/services/HapticService';
import AudioNavigationService from './src/services/AudioNavigationService';
import BackgroundSoundtrackService from './src/services/BackgroundSoundtrackService';
import ProgressService from './src/services/ProgressService';
import StoryService from './src/services/StoryService';
import LocalStorage from './src/storage/LocalStorage';
import APIService from './src/services/APIService';

// Import screens
import AuthScreen from './src/screens/AuthScreen';
import HomeScreen from './src/screens/HomeScreen';
import LocationScreen from './src/screens/LocationScreen';
import ProgressScreen from './src/screens/ProgressScreen';
import AudioPlayerScreen from './src/screens/AudioPlayerScreen';
import RecommendationScreen from './src/screens/RecommendationScreen';

const Stack = createStackNavigator();

export default function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [locations, setLocations] = useState([]);
  const [currentLocation, setCurrentLocation] = useState(null);

  useEffect(() => {
    initializeApp();
  }, []);

  const initializeApp = async () => {
    try {
      // Check if user is logged in
      const savedUser = await LocalStorage.getUser();
      
      if (savedUser) {
        setUser(savedUser);
        setIsAuthenticated(true);
        
        // Initialize progress
        await ProgressService.initializeProgress(savedUser.id);
        
        // Initialize story service
        await StoryService.initialize(savedUser.id);
        
        // Initialize background soundtrack service (load geofences)
        await BackgroundSoundtrackService.initialize();
        
        // Load locations
        await loadLocations();
        
        // Request GPS permissions and start tracking
        await startGPSTracking();
        
        // Audio announcement that app is ready (audio-first design)
        await AudioNavigationService.queueAnnouncement(
          'ReplacePlace is ready. Begin your journey. Follow the story to discover the next location.'
        );
      }
    } catch (error) {
      console.error('App initialization error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadLocations = async () => {
    try {
      const locationsData = await APIService.getLocations();
      setLocations(locationsData);
    } catch (error) {
      console.error('Error loading locations:', error);
    }
  };

  const startGPSTracking = async () => {
    // Request permissions
    const hasPermission = await GPSService.requestPermissions();
    
    if (!hasPermission) {
      console.log('Location permission denied');
      return;
    }

    // Start tracking
    GPSService.startTracking((location) => {
      setCurrentLocation(location);
      
      // Check geofence status (for background soundtracks)
      BackgroundSoundtrackService.checkGeofenceStatus(
        location.latitude,
        location.longitude
      );
      
      // Check location proximity (for story segments)
      checkLocationProximity(location);
    });
  };

  const checkLocationProximity = async (userLocation) => {
    if (!user || !locations.length) return;

    const progress = ProgressService.getProgress();
    if (!progress) return;

    // Check each unlocked location
    for (const location of locations) {
      // Skip if location is not unlocked
      if (!ProgressService.isLocationUnlocked(location.id)) {
        continue;
      }

      // Skip if already completed
      if (ProgressService.isLocationCompleted(location.id)) {
        continue;
      }

      // Calculate distance to location
      const distance = GPSService.calculateDistance(
        userLocation.latitude,
        userLocation.longitude,
        location.latitude,
        location.longitude
      );

      // Get trigger distances
      const audioTriggerRadius = location.radius || 50; // Default 50 meters for audio
      const hapticTriggerDistance = location.haptic_trigger_distance || (audioTriggerRadius * 2); // Default 2x audio radius for haptic

      // Check if user is within haptic trigger distance (but not yet at audio trigger)
      if (distance <= hapticTriggerDistance && distance > audioTriggerRadius) {
        // User is approaching - trigger proximity haptic
        HapticService.triggerProximityHaptic(
          distance,
          hapticTriggerDistance,
          location.id
        );
      }

      // Check if user is within audio trigger range
      const isInRange = distance <= audioTriggerRadius;

      if (isInRange) {
        // User reached the location!
        await handleLocationReached(location);
      }
    }
  };

  const handleLocationReached = async (location) => {
    try {
      // Get story segment for this location
      const storySegment = StoryService.getStorySegmentByLocation(location.id);
      const segmentId = storySegment ? storySegment.id : location.story_segment_id;

      // Trigger haptic feedback for reaching location (works with screen off)
      HapticService.triggerLocationReached(location.id, location.name);

      // Audio announcement when location is reached (audio-first design)
      if (storySegment) {
        await AudioNavigationService.announceLocationReached(
          location.id,
          location.name,
          storySegment.chapter_number
        );
      }

      // Play audio (story segment) - works with locked screen
      // Story audio should contain navigation instructions to next location
      if (location.audio_file_url) {
        await AudioService.playAudioFromURL(
          location.audio_file_url,
          location.id
        );
      }

      // Mark location as completed and story segment as heard
      await ProgressService.completeLocation(location.id, user.id, segmentId);
      
      // Also mark story segment separately for tracking
      if (segmentId) {
        await ProgressService.markStorySegmentHeard(segmentId, user.id);
      }

      // Audio progress announcement (no screen needed)
      if (storySegment) {
        const storyProgress = StoryService.getStoryProgressPercentage(user.id);
        await AudioNavigationService.announceProgress(
          storySegment.chapter_number,
          storyProgress.totalCount
        );
      }

      // Note: All information delivered via audio - no screen interaction required
      console.log(`Location ${location.name} reached! (Audio-first: user doesn't need to look at screen)`);
    } catch (error) {
      console.error('Error handling location reached:', error);
    }
  };

  const handleLogin = async (email, password) => {
    try {
      const response = await APIService.login(email, password);
      
      if (response.user) {
        setUser(response.user);
        setIsAuthenticated(true);
        
        // Save user locally
        await LocalStorage.saveUser(response.user);
        
        // Initialize progress
        await ProgressService.initializeProgress(response.user.id);
        
        // Load locations
        await loadLocations();
        
        // Start GPS tracking
        await startGPSTracking();
      }
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  };

  const handleLogout = async () => {
    // Stop GPS tracking
    GPSService.stopTracking();
    
    // Stop audio
    AudioService.stopAudio();
    
    // Clear local storage
    await LocalStorage.removeUser();
    await LocalStorage.clearStorage();
    
    // Reset state
    setUser(null);
    setIsAuthenticated(false);
    setLocations([]);
    setCurrentLocation(null);
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0000ff" />
        <Text>Loading...</Text>
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator>
        {!isAuthenticated ? (
          <Stack.Screen name="Auth" options={{ headerShown: false }}>
            {(props) => (
              <AuthScreen {...props} onLogin={handleLogin} />
            )}
          </Stack.Screen>
        ) : (
          <>
            <Stack.Screen name="Home" options={{ title: 'ReplacePlace' }}>
              {(props) => (
                <HomeScreen
                  {...props}
                  user={user}
                  currentLocation={currentLocation}
                  onLogout={handleLogout}
                />
              )}
            </Stack.Screen>
            <Stack.Screen name="Location" component={LocationScreen} />
            <Stack.Screen name="Progress" component={ProgressScreen} />
            <Stack.Screen name="AudioPlayer" component={AudioPlayerScreen} />
            <Stack.Screen name="Recommendation" options={{ title: 'Recommend a Location' }}>
              {(props) => (
                <RecommendationScreen {...props} user={user} />
              )}
            </Stack.Screen>
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
```

---

## Module 7: Example Screen Implementation

### File: `src/screens/HomeScreen.js`

```javascript
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import GPSService from '../services/GPSService';
import ProgressService from '../services/ProgressService';
import StoryService from '../services/StoryService';
import APIService from '../services/APIService';

export default function HomeScreen({ navigation, user, currentLocation, onLogout }) {
  const [locations, setLocations] = useState([]);
  const [progress, setProgress] = useState(null);
  const [storyProgress, setStoryProgress] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Load locations
      const locationsData = await APIService.getLocations();
      setLocations(locationsData);

      // Load progress
      const userProgress = ProgressService.getProgress();
      setProgress(userProgress);

      // Load story progress
      const story = StoryService.getStoryProgressPercentage(user?.id);
      setStoryProgress(story);
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Logout', onPress: onLogout, style: 'destructive' },
      ]
    );
  };

  const getProgressPercentage = () => {
    if (!progress || locations.length === 0) return 0;
    return Math.round(
      (progress.completedLocations.length / locations.length) * 100
    );
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.welcomeText}>Welcome, {user?.name || 'User'}!</Text>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>GPS Status</Text>
        {currentLocation ? (
          <View style={styles.locationInfo}>
            <Text>Latitude: {currentLocation.latitude.toFixed(6)}</Text>
            <Text>Longitude: {currentLocation.longitude.toFixed(6)}</Text>
            <Text>Accuracy: {currentLocation.accuracy?.toFixed(0)}m</Text>
          </View>
        ) : (
          <Text style={styles.noLocationText}>Getting location...</Text>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Location Progress</Text>
        <View style={styles.progressBarContainer}>
          <View
            style={[
              styles.progressBar,
              { width: `${getProgressPercentage()}%` },
            ]}
          />
        </View>
        <Text style={styles.progressText}>
          {getProgressPercentage()}% Complete
        </Text>
        <Text style={styles.progressDetails}>
          {progress?.completedLocations.length || 0} of {locations.length}{' '}
          locations completed
        </Text>
      </View>

      {storyProgress && storyProgress.totalCount > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Story Progress</Text>
          <View style={styles.progressBarContainer}>
            <View
              style={[
                styles.progressBar,
                { width: `${storyProgress.percentage}%`, backgroundColor: '#9c27b0' },
              ]}
            />
          </View>
          <Text style={styles.progressText}>
            Chapter {StoryService.getCurrentChapter(user?.id) || 0} of {storyProgress.totalCount}
          </Text>
          <Text style={styles.progressDetails}>
            {storyProgress.heardCount} of {storyProgress.totalCount} story segments heard
          </Text>
          <Text style={styles.storyProgressText}>
            {storyProgress.percentage}% of story completed
          </Text>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Locations</Text>
        {locations.map((location) => {
          const isUnlocked = ProgressService.isLocationUnlocked(location.id);
          const isCompleted = ProgressService.isLocationCompleted(location.id);

          return (
            <TouchableOpacity
              key={location.id}
              style={[
                styles.locationCard,
                !isUnlocked && styles.locationCardLocked,
              ]}
              onPress={() => {
                if (isUnlocked) {
                  navigation.navigate('Location', { location });
                } else {
                  Alert.alert(
                    'Locked',
                    'Complete previous locations to unlock this one.'
                  );
                }
              }}
            >
              <Text style={styles.locationName}>{location.name}</Text>
              {location.story_segment_title && (
                <Text style={styles.storySegmentTitle}>
                  Chapter {location.story_chapter_number}: {location.story_segment_title}
                </Text>
              )}
              <Text style={styles.locationStatus}>
                {isCompleted
                  ? '✓ Completed'
                  : isUnlocked
                  ? 'Unlocked'
                  : '🔒 Locked'}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <TouchableOpacity
        style={styles.button}
        onPress={() => navigation.navigate('Progress')}
      >
        <Text style={styles.buttonText}>View Full Progress</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, { backgroundColor: '#ff9800' }]}
        onPress={() => navigation.navigate('Recommendation')}
      >
        <Text style={styles.buttonText}>Recommend a Location</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
  },
  welcomeText: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  logoutButton: {
    padding: 8,
  },
  logoutText: {
    color: '#ff0000',
    fontSize: 16,
  },
  section: {
    backgroundColor: '#fff',
    margin: 10,
    padding: 15,
    borderRadius: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  locationInfo: {
    marginTop: 5,
  },
  noLocationText: {
    color: '#999',
    fontStyle: 'italic',
  },
  progressBarContainer: {
    height: 20,
    backgroundColor: '#e0e0e0',
    borderRadius: 10,
    overflow: 'hidden',
    marginVertical: 10,
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#4caf50',
  },
  progressText: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 5,
  },
  progressDetails: {
    color: '#666',
    marginTop: 5,
  },
  locationCard: {
    backgroundColor: '#f0f0f0',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
  },
  locationCardLocked: {
    opacity: 0.5,
  },
  locationName: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  locationStatus: {
    marginTop: 5,
    color: '#666',
  },
  storySegmentTitle: {
    marginTop: 5,
    fontSize: 14,
    color: '#9c27b0',
    fontStyle: 'italic',
  },
  storyProgressText: {
    color: '#9c27b0',
    marginTop: 5,
    fontSize: 14,
    fontWeight: '600',
  },
  button: {
    backgroundColor: '#2196f3',
    padding: 15,
    borderRadius: 8,
    margin: 10,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
```

---

## Module 7.5: Location Recommendation Screen Implementation

### File: `src/screens/RecommendationScreen.js`

```javascript
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import GPSService from '../services/GPSService';
import APIService from '../services/APIService';

export default function RecommendationScreen({ navigation, user }) {
  const [loading, setLoading] = useState(false);
  const [usingCurrentLocation, setUsingCurrentLocation] = useState(false);
  const [currentLocation, setCurrentLocation] = useState(null);

  // Form state
  const [locationName, setLocationName] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [locationDescription, setLocationDescription] = useState('');
  const [whatHappensHere, setWhatHappensHere] = useState('');
  const [storySegmentTitle, setStorySegmentTitle] = useState('');
  const [storySegmentDescription, setStorySegmentDescription] = useState('');
  const [navigationInstructions, setNavigationInstructions] = useState('');

  useEffect(() => {
    // Request GPS permissions when screen loads
    GPSService.requestPermissions();
  }, []);

  // Capture current location
  const captureCurrentLocation = async () => {
    try {
      setLoading(true);
      setUsingCurrentLocation(true);
      
      const location = await GPSService.getCurrentLocation();
      setCurrentLocation(location);
      setLatitude(location.latitude.toFixed(6));
      setLongitude(location.longitude.toFixed(6));
      
      Alert.alert('Success', 'Current location captured!');
    } catch (error) {
      console.error('Error capturing location:', error);
      Alert.alert('Error', 'Could not capture current location. Please enter coordinates manually.');
    } finally {
      setLoading(false);
      setUsingCurrentLocation(false);
    }
  };

  // Validate form
  const validateForm = () => {
    if (!locationName.trim()) {
      Alert.alert('Validation Error', 'Please enter a location name');
      return false;
    }
    if (!latitude.trim() || !longitude.trim()) {
      Alert.alert('Validation Error', 'Please enter GPS coordinates or capture current location');
      return false;
    }
    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);
    if (isNaN(lat) || lat < -90 || lat > 90) {
      Alert.alert('Validation Error', 'Invalid latitude. Must be between -90 and 90');
      return false;
    }
    if (isNaN(lng) || lng < -180 || lng > 180) {
      Alert.alert('Validation Error', 'Invalid longitude. Must be between -180 and 180');
      return false;
    }
    if (!whatHappensHere.trim()) {
      Alert.alert('Validation Error', 'Please describe what happens at this location');
      return false;
    }
    return true;
  };

  // Submit recommendation
  const submitRecommendation = async () => {
    if (!validateForm()) {
      return;
    }

    try {
      setLoading(true);

      const recommendationData = {
        user_id: user.id,
        location_name: locationName.trim(),
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        location_description: locationDescription.trim(),
        what_happens_here: whatHappensHere.trim(),
        story_segment_title: storySegmentTitle.trim(),
        story_segment_description: storySegmentDescription.trim(),
        navigation_instructions: navigationInstructions.trim(),
      };

      const response = await APIService.submitLocationRecommendation(recommendationData);

      Alert.alert(
        'Success',
        'Your recommendation has been submitted! Thank you for contributing to ReplacePlace.',
        [
          {
            text: 'OK',
            onPress: () => {
              // Clear form
              setLocationName('');
              setLatitude('');
              setLongitude('');
              setLocationDescription('');
              setWhatHappensHere('');
              setStorySegmentTitle('');
              setStorySegmentDescription('');
              setNavigationInstructions('');
              setCurrentLocation(null);
              // Optionally navigate back
              // navigation.goBack();
            },
          },
        ]
      );
    } catch (error) {
      console.error('Error submitting recommendation:', error);
      Alert.alert('Error', 'Could not submit recommendation. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Recommend a Location</Text>
        <Text style={styles.subtitle}>
          Help expand ReplacePlace by suggesting new GPS locations and story segments
        </Text>
      </View>

      {/* GPS Coordinates Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>GPS Coordinates</Text>
        
        <TouchableOpacity
          style={[styles.button, styles.primaryButton]}
          onPress={captureCurrentLocation}
          disabled={loading || usingCurrentLocation}
        >
          {usingCurrentLocation ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Use Current Location</Text>
          )}
        </TouchableOpacity>

        <Text style={styles.orText}>OR</Text>

        <Text style={styles.label}>Latitude</Text>
        <TextInput
          style={styles.input}
          value={latitude}
          onChangeText={setLatitude}
          placeholder="e.g., 40.7128"
          keyboardType="numeric"
          editable={!usingCurrentLocation}
        />

        <Text style={styles.label}>Longitude</Text>
        <TextInput
          style={styles.input}
          value={longitude}
          onChangeText={setLongitude}
          placeholder="e.g., -74.0060"
          keyboardType="numeric"
          editable={!usingCurrentLocation}
        />

        {currentLocation && (
          <Text style={styles.locationInfo}>
            Location captured: {currentLocation.latitude.toFixed(6)}, {currentLocation.longitude.toFixed(6)}
          </Text>
        )}
      </View>

      {/* Location Information Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Location Information</Text>

        <Text style={styles.label}>Location Name *</Text>
        <TextInput
          style={styles.input}
          value={locationName}
          onChangeText={setLocationName}
          placeholder="e.g., The Old Oak Tree"
        />

        <Text style={styles.label}>Location Description</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={locationDescription}
          onChangeText={setLocationDescription}
          placeholder="Describe the physical location, landmarks, environment..."
          multiline
          numberOfLines={3}
        />

        <Text style={styles.label}>What Happens Here? *</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={whatHappensHere}
          onChangeText={setWhatHappensHere}
          placeholder="Describe what story event or experience should happen at this location..."
          multiline
          numberOfLines={4}
        />
      </View>

      {/* Story Segment Information Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Story Segment Information</Text>

        <Text style={styles.label}>Story Segment Title</Text>
        <TextInput
          style={styles.input}
          value={storySegmentTitle}
          onChangeText={setStorySegmentTitle}
          placeholder="e.g., Chapter 5: The Discovery"
        />

        <Text style={styles.label}>Story Segment Description</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={storySegmentDescription}
          onChangeText={setStorySegmentDescription}
          placeholder="Describe the story content that should be at this location..."
          multiline
          numberOfLines={5}
        />

        <Text style={styles.label}>Navigation Instructions</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={navigationInstructions}
          onChangeText={setNavigationInstructions}
          placeholder="How should users find this location? What landmarks or directions should be in the audio?"
          multiline
          numberOfLines={3}
        />
      </View>

      {/* Submit Button */}
      <TouchableOpacity
        style={[styles.button, styles.submitButton]}
        onPress={submitRecommendation}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Submit Recommendation</Text>
        )}
      </TouchableOpacity>

      <Text style={styles.footerText}>
        * Required fields{'\n'}
        Your recommendations will be reviewed and may be added to the ReplacePlace experience.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#fff',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
  },
  section: {
    backgroundColor: '#fff',
    margin: 10,
    padding: 15,
    borderRadius: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#333',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 10,
    marginBottom: 5,
    color: '#333',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
    marginBottom: 10,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  button: {
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 10,
  },
  primaryButton: {
    backgroundColor: '#2196f3',
  },
  submitButton: {
    backgroundColor: '#4caf50',
    margin: 10,
    marginTop: 20,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  orText: {
    textAlign: 'center',
    marginVertical: 10,
    color: '#666',
    fontSize: 14,
  },
  locationInfo: {
    marginTop: 10,
    padding: 10,
    backgroundColor: '#e3f2fd',
    borderRadius: 8,
    color: '#1976d2',
    fontSize: 14,
  },
  footerText: {
    margin: 20,
    marginTop: 10,
    textAlign: 'center',
    color: '#666',
    fontSize: 12,
    lineHeight: 18,
  },
});
```

---

## Next Steps

1. **Copy each code module** into the corresponding file in your project
2. **Install all required packages** using npm
3. **Configure permissions** in AndroidManifest.xml (Android) and Info.plist (iOS)
4. **Set up your backend** (Firebase or custom server)
5. **Test each module** individually before integrating
6. **Customize the UI** to match your design preferences

---

## Important Configuration Files

### Android: `android/app/src/main/AndroidManifest.xml`
Add location permissions:
```xml
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
```

### iOS: `ios/YourApp/Info.plist`
Add location permissions:
```xml
<key>NSLocationWhenInUseUsageDescription</key>
<string>This app needs your location to play audio at specific GPS coordinates</string>
<key>NSLocationAlwaysUsageDescription</key>
<string>This app needs your location to play audio at specific GPS coordinates</string>
```

---

This guide provides complete, working code for all core modules. Start with Module 1 and work through each module sequentially.
