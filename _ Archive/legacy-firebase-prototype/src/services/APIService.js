import axios from 'axios';
import { MOCK_LOCATIONS, MOCK_GEOFENCES, MOCK_STORY_SEGMENTS } from './MockDataService';
import FirebaseService from './FirebaseService';

// Replace with your backend API URL
const API_BASE_URL = 'https://your-api-url.com/api';

class APIService {
  constructor() {
    this.useFirebase = true; // 🔥 Use Firebase by default
    this.useMockFallback = true; // Use mock data as final fallback
    
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

    // Add response interceptor for better error handling
    this.api.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND' || error.message?.includes('fetch failed')) {
          error.friendlyMessage = 'Cannot connect to server. Using offline mode.';
        }
        return Promise.reject(error);
      }
    );
  }

  // Store auth token (Firebase handles this automatically)
  setAuthToken(token) {
    // Not needed with Firebase - Firebase SDK manages tokens
  }

  getAuthToken() {
    // Not needed with Firebase - Firebase SDK manages tokens
    return null;
  }

  // User registration - handled by Firebase
  async register(userData) {
    if (this.useFirebase) {
      return await FirebaseService.signUp(
        userData.email,
        userData.password,
        userData.name
      );
    }
    
    try {
      const response = await this.api.post('/auth/register', userData);
      return response.data;
    } catch (error) {
      console.error('Registration error:', error);
      throw error;
    }
  }

  // User login - handled by Firebase
  async login(email, password) {
    if (this.useFirebase) {
      return await FirebaseService.signIn(email, password);
    }
    
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
      
      // 🔥 FIX: Return mock user for development when backend is unavailable
      if (__DEV__ && (error.message?.includes('fetch failed') || error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND')) {
        console.warn('⚠️ Backend unavailable - using mock login');
        return {
          user: {
            id: 'mock-user-1',
            email: email,
            name: email.split('@')[0] || 'Test User',
          },
          token: 'mock-token-12345',
        };
      }
      
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

  // Get all locations
  async getLocations() {
    // 🔥 Try Firebase first
    if (this.useFirebase) {
      try {
        const locations = await FirebaseService.getLocations();
        if (locations && locations.length > 0) {
          console.log('✅ Locations loaded from Firebase');
          return locations;
        }
      } catch (error) {
        console.warn('⚠️ Firebase locations error:', error.message);
      }
    }
    
    // Fall back to mock data
    if (this.useMockFallback) {
      console.warn('⚠️ Using mock locations data');
      return MOCK_LOCATIONS;
    }
    
    return [];
  }

  // Get user progress
  async getUserProgress(userId) {
    // 🔥 Try Firebase first
    if (this.useFirebase) {
      try {
        const progress = await FirebaseService.getUserProgress(userId);
        if (progress) {
          console.log('✅ User progress loaded from Firebase');
          return progress;
        }
      } catch (error) {
        console.warn('⚠️ Firebase progress error:', error.message);
      }
    }
    
    // Return null so local progress is used
    console.warn('⚠️ Progress will be stored locally only');
    return null;
  }

  // Update user progress
  async updateProgress(userId, progress) {
    // 🔥 Try Firebase first
    if (this.useFirebase) {
      try {
        await FirebaseService.updateUserProgress(userId, progress);
        console.log('✅ Progress synced to Firebase');
        return { success: true, synced: true };
      } catch (error) {
        console.warn('⚠️ Firebase sync error:', error.message);
      }
    }
    
    // Don't throw - progress is saved locally
    console.warn('⚠️ Progress saved locally only');
    return { success: true, local: true };
  }

  // Get all story segments
  async getStorySegments() {
    // 🔥 Try Firebase first
    if (this.useFirebase) {
      try {
        const segments = await FirebaseService.getStorySegments();
        if (segments && segments.length > 0) {
          console.log('✅ Story segments loaded from Firebase');
          return segments;
        }
      } catch (error) {
        console.warn('⚠️ Firebase story segments error:', error.message);
      }
    }
    
    // Fall back to mock data
    if (this.useMockFallback) {
      console.warn('⚠️ Using mock story segments data');
      return MOCK_STORY_SEGMENTS;
    }
    
    return [];
  }

  // Get all geofences
  async getGeofences() {
    // For now, always use mock geofences (not stored in Firebase yet)
    if (this.useMockFallback) {
      return MOCK_GEOFENCES;
    }
    
    return [];
  }

  // Submit location recommendation
  async submitLocationRecommendation(recommendationData) {
    try {
      const response = await this.api.post('/recommendations', recommendationData);
      return response.data;
    } catch (error) {
      console.error('Submit recommendation error:', error);
      
      // Mock success in dev mode
      if (__DEV__ && (error.message?.includes('fetch failed') || error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND')) {
        console.warn('⚠️ Backend unavailable - recommendation saved locally (not persisted)');
        return {
          success: true,
          message: 'Recommendation received (dev mode - not persisted)',
          id: `mock-rec-${Date.now()}`,
        };
      }
      
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
      
      // Return empty array in dev mode
      if (__DEV__ && (error.message?.includes('fetch failed') || error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND')) {
        console.warn('⚠️ Backend unavailable - no recommendations available');
        return [];
      }
      
      throw error;
    }
  }
}

export default new APIService();
