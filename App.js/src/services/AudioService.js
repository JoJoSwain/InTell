import Sound from 'react-native-sound';

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

    // Enable playback in silence mode and background playback (iOS)
    try {
      Sound.setCategory('Playback', true);
    } catch (error) {
      console.warn('Could not set audio category:', error);
    }
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
}

export default new AudioService();
