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
        // Sync with server (but don't block on it)
        try {
          await this.syncProgress(userId);
        } catch (error) {
          console.warn('Could not sync progress with server:', error);
        }
        return this.progress;
      }

      // If no local progress, fetch from server
      try {
        const serverProgress = await APIService.getUserProgress(userId);
        
        if (serverProgress) {
          this.progress = serverProgress;
          await LocalStorage.saveProgress(serverProgress);
          return this.progress;
        }
      } catch (error) {
        console.warn('Could not fetch progress from server:', error);
      }

      // Create new progress object
      this.progress = {
        userId: userId,
        unlockedLocations: [],
        completedLocations: [],
        heardStorySegments: [],
        storyProgress: {},
        lastSynced: new Date().toISOString(),
      };
      
      // 🔥 FIX: Unlock first location (no prerequisite) for new users
      try {
        const locations = await APIService.getLocations();
        if (locations && locations.length > 0) {
          const firstLocation = locations.find(
            loc => !loc.prerequisite_location_id || loc.prerequisite_location_id === null
          );
          
          if (firstLocation && !this.progress.unlockedLocations.includes(firstLocation.id)) {
            this.progress.unlockedLocations.push(firstLocation.id);
            console.log(`✅ Unlocked first location: ${firstLocation.name} (${firstLocation.id})`);
          }
        }
      } catch (error) {
        console.warn('Could not unlock first location:', error);
      }
      
      await LocalStorage.saveProgress(this.progress);
      return this.progress;
    } catch (error) {
      console.error('Error initializing progress:', error);
      // Return default progress
      this.progress = {
        userId: userId,
        unlockedLocations: [],
        completedLocations: [],
        heardStorySegments: [],
        storyProgress: {},
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
      try {
        await APIService.updateProgress(userId, this.progress);
      } catch (error) {
        console.warn('Could not sync progress with server:', error);
      }
      
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
      try {
        await APIService.updateProgress(userId, this.progress);
      } catch (error) {
        console.warn('Could not sync progress with server:', error);
      }
      
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
      
      try {
        await APIService.updateProgress(userId, this.progress);
      } catch (error) {
        console.warn('Could not sync progress with server:', error);
      }
      
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
        console.log(`✅ Unlocked next location: ${nextLocation.name}`);
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
