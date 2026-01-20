import AudioService from './AudioService';

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
      // For now, log the announcement
      // In production, this would trigger TTS or play pre-recorded audio
      console.log('Audio Navigation:', announcement);
      
      // Simulate announcement duration
      await new Promise(resolve => setTimeout(resolve, 1000));
      
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

  // Clear announcement queue
  clearQueue() {
    this.announcementQueue = [];
    this.isAnnouncing = false;
  }
}

export default new AudioNavigationService();
