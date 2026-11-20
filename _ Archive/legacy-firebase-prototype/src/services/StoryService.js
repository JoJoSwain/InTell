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
    
    if (totalSegments === 0) return { heardCount: 0, totalCount: 0, percentage: 0, segments: [] };
    
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

  // Initialize story service
  async initialize(userId) {
    await this.loadStorySegments();
    return this.storySegments;
  }
}

export default new StoryService();
