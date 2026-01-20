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
  checkGeofenceEntry(latitude, longitude) {
    if (!this.isInitialized || this.geofences.length === 0) {
      return null;
    }

    // Check if already in a geofence
    if (this.currentGeofence) {
      // Check if still in current geofence
      if (this.isInGeofence(latitude, longitude, this.currentGeofence)) {
        return null; // Still in same geofence
      } else {
        // Exited current geofence
        this.handleGeofenceExit();
      }
    }

    // Check all geofences to see if user entered any
    for (const geofence of this.geofences) {
      if (this.isInGeofence(latitude, longitude, geofence)) {
        // Check priority if multiple geofences overlap
        if (!this.currentGeofence || geofence.priority >= this.currentGeofence.priority) {
          // Entered a new geofence
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
    console.log(`Entered geofence: ${geofence.name}`);
    
    this.previousGeofence = this.currentGeofence;
    this.currentGeofence = geofence;

    // Stop previous geofence's soundtrack if playing
    if (this.previousGeofence) {
      console.log(`Fading out previous geofence soundtrack: ${this.previousGeofence.name}`);
      await AudioService.fadeOutSoundtrack(
        this.previousGeofence.fade_out_duration || 10000
      );
    }

    // Start this geofence's unique soundtrack
    if (geofence.background_soundtrack_url) {
      const volume = geofence.background_volume || 0.3;
      const loop = geofence.loop !== false; // Default to true

      await AudioService.playBackgroundSoundtrack(
        geofence.background_soundtrack_url,
        volume,
        loop
      );

      // Fade in over 10 seconds
      const fadeInDuration = geofence.fade_in_duration || 10000;
      await AudioService.fadeInSoundtrack(fadeInDuration);
    }
  }

  // Handle geofence exit
  async handleGeofenceExit() {
    if (!this.currentGeofence) return;

    console.log(`Exited geofence: ${this.currentGeofence.name}`);

    // Fade out and stop soundtrack
    const fadeOutDuration = this.currentGeofence.fade_out_duration || 10000;
    await AudioService.fadeOutSoundtrack(fadeOutDuration);

    this.previousGeofence = this.currentGeofence;
    this.currentGeofence = null;
  }

  // Get currently active geofence
  getCurrentGeofence() {
    return this.currentGeofence;
  }

  // Check current geofence status
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
