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
