import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc,
  query,
  where,
  orderBy,
  serverTimestamp
} from 'firebase/firestore';
import { getStorage, ref, getDownloadURL } from 'firebase/storage';
import { FIREBASE_CONFIG } from '../constants/config';

class FirebaseService {
  constructor() {
    this.app = null;
    this.auth = null;
    this.db = null;
    this.storage = null;
    this.initialized = false;
  }

  /**
   * Initialize Firebase
   */
  initialize() {
    try {
      if (this.initialized) {
        console.log('🔥 Firebase already initialized');
        return;
      }

      console.log('🔥 Initializing Firebase...');
      this.app = initializeApp(FIREBASE_CONFIG);
      this.auth = getAuth(this.app);
      this.db = getFirestore(this.app);
      this.storage = getStorage(this.app);
      this.initialized = true;
      console.log('✅ Firebase initialized successfully');
    } catch (error) {
      console.error('❌ Firebase initialization error:', error);
      throw error;
    }
  }

  // ==================== AUTHENTICATION ====================

  /**
   * Create a new user account
   */
  async signUp(email, password, displayName) {
    try {
      const userCredential = await createUserWithEmailAndPassword(
        this.auth,
        email,
        password
      );

      // Update profile with display name
      await updateProfile(userCredential.user, {
        displayName: displayName
      });

      // Create user document in Firestore
      await this.createUserDocument(userCredential.user.uid, {
        email,
        displayName,
        createdAt: serverTimestamp(),
      });

      console.log('✅ User created:', userCredential.user.uid);
      return {
        id: userCredential.user.uid,
        email: userCredential.user.email,
        name: displayName,
      };
    } catch (error) {
      console.error('❌ Sign up error:', error);
      throw this.handleAuthError(error);
    }
  }

  /**
   * Sign in existing user
   */
  async signIn(email, password) {
    try {
      const userCredential = await signInWithEmailAndPassword(
        this.auth,
        email,
        password
      );

      console.log('✅ User signed in:', userCredential.user.uid);
      return {
        id: userCredential.user.uid,
        email: userCredential.user.email,
        name: userCredential.user.displayName || 'User',
      };
    } catch (error) {
      console.error('❌ Sign in error:', error);
      throw this.handleAuthError(error);
    }
  }

  /**
   * Sign out current user
   */
  async signOutUser() {
    try {
      await signOut(this.auth);
      console.log('✅ User signed out');
    } catch (error) {
      console.error('❌ Sign out error:', error);
      throw error;
    }
  }

  /**
   * Get current user
   */
  getCurrentUser() {
    return this.auth.currentUser;
  }

  /**
   * Listen to auth state changes
   */
  onAuthStateChange(callback) {
    return onAuthStateChanged(this.auth, (user) => {
      if (user) {
        callback({
          id: user.uid,
          email: user.email,
          name: user.displayName || 'User',
        });
      } else {
        callback(null);
      }
    });
  }

  // ==================== FIRESTORE - USER ====================

  /**
   * Create user document in Firestore
   */
  async createUserDocument(userId, userData) {
    try {
      const userRef = doc(this.db, 'users', userId);
      await setDoc(userRef, {
        ...userData,
        updatedAt: serverTimestamp(),
      });
      console.log('✅ User document created');
    } catch (error) {
      console.error('❌ Create user document error:', error);
      throw error;
    }
  }

  /**
   * Get user document
   */
  async getUserDocument(userId) {
    try {
      const userRef = doc(this.db, 'users', userId);
      const userSnap = await getDoc(userRef);
      
      if (userSnap.exists()) {
        return { id: userSnap.id, ...userSnap.data() };
      }
      return null;
    } catch (error) {
      console.error('❌ Get user document error:', error);
      throw error;
    }
  }

  // ==================== FIRESTORE - LOCATIONS ====================

  /**
   * Get all story locations
   */
  async getLocations() {
    try {
      const locationsRef = collection(this.db, 'locations');
      const q = query(locationsRef, orderBy('story_chapter_number'));
      const querySnapshot = await getDocs(q);
      
      const locations = [];
      querySnapshot.forEach((doc) => {
        locations.push({ id: doc.id, ...doc.data() });
      });
      
      console.log(`✅ Loaded ${locations.length} locations from Firebase`);
      return locations;
    } catch (error) {
      console.error('❌ Get locations error:', error);
      throw error;
    }
  }

  /**
   * Add a new location to Firestore
   */
  async addLocation(locationData) {
    try {
      const locationsRef = collection(this.db, 'locations');
      const newLocationRef = doc(locationsRef);
      await setDoc(newLocationRef, {
        ...locationData,
        createdAt: serverTimestamp(),
      });
      console.log('✅ Location added:', newLocationRef.id);
      return newLocationRef.id;
    } catch (error) {
      console.error('❌ Add location error:', error);
      throw error;
    }
  }

  // ==================== FIRESTORE - USER PROGRESS ====================

  /**
   * Get user progress
   */
  async getUserProgress(userId) {
    try {
      const progressRef = doc(this.db, 'userProgress', userId);
      const progressSnap = await getDoc(progressRef);
      
      if (progressSnap.exists()) {
        console.log('✅ User progress loaded from Firebase');
        return progressSnap.data();
      }
      
      // Create new progress if doesn't exist
      const newProgress = {
        userId,
        unlockedLocations: [],
        completedStorySegments: [],
        visitedLocations: [],
        currentChapter: 1,
        totalDistance: 0,
        lastSynced: serverTimestamp(),
        createdAt: serverTimestamp(),
      };
      
      await setDoc(progressRef, newProgress);
      console.log('✅ New user progress created');
      return newProgress;
    } catch (error) {
      console.error('❌ Get user progress error:', error);
      throw error;
    }
  }

  /**
   * Update user progress
   */
  async updateUserProgress(userId, progressData) {
    try {
      const progressRef = doc(this.db, 'userProgress', userId);
      // Use setDoc with merge to create if doesn't exist, update if it does
      await setDoc(progressRef, {
        ...progressData,
        lastSynced: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }, { merge: true });
      console.log('✅ User progress synced to Firebase');
    } catch (error) {
      console.error('❌ Update user progress error:', error);
      throw error;
    }
  }

  /**
   * Unlock a location for user
   */
  async unlockLocation(userId, locationId) {
    try {
      const progressRef = doc(this.db, 'userProgress', userId);
      const progressSnap = await getDoc(progressRef);
      
      if (progressSnap.exists()) {
        const currentProgress = progressSnap.data();
        const unlockedLocations = currentProgress.unlockedLocations || [];
        
        if (!unlockedLocations.includes(locationId)) {
          unlockedLocations.push(locationId);
          await updateDoc(progressRef, {
            unlockedLocations,
            updatedAt: serverTimestamp(),
          });
          console.log('✅ Location unlocked:', locationId);
        }
      }
    } catch (error) {
      console.error('❌ Unlock location error:', error);
      throw error;
    }
  }

  // ==================== FIRESTORE - STORY SEGMENTS ====================

  /**
   * Get all story segments
   */
  async getStorySegments() {
    try {
      const segmentsRef = collection(this.db, 'storySegments');
      const q = query(segmentsRef, orderBy('chapter_number'));
      const querySnapshot = await getDocs(q);
      
      const segments = [];
      querySnapshot.forEach((doc) => {
        segments.push({ id: doc.id, ...doc.data() });
      });
      
      console.log(`✅ Loaded ${segments.length} story segments from Firebase`);
      return segments;
    } catch (error) {
      console.error('❌ Get story segments error:', error);
      throw error;
    }
  }

  // ==================== FIREBASE STORAGE ====================

  /**
   * Get download URL for audio file
   */
  async getAudioFileURL(fileName) {
    try {
      const audioRef = ref(this.storage, `audio/${fileName}`);
      const url = await getDownloadURL(audioRef);
      console.log('✅ Audio URL retrieved:', fileName);
      return url;
    } catch (error) {
      console.error('❌ Get audio URL error:', error);
      throw error;
    }
  }

  // ==================== ERROR HANDLING ====================

  /**
   * Handle Firebase Auth errors
   */
  handleAuthError(error) {
    const errorMessages = {
      'auth/email-already-in-use': 'This email is already registered.',
      'auth/invalid-email': 'Invalid email address.',
      'auth/operation-not-allowed': 'Operation not allowed.',
      'auth/weak-password': 'Password should be at least 6 characters.',
      'auth/user-disabled': 'This account has been disabled.',
      'auth/user-not-found': 'No account found with this email.',
      'auth/wrong-password': 'Incorrect password.',
      'auth/invalid-credential': 'Invalid email or password.',
      'auth/too-many-requests': 'Too many attempts. Please try again later.',
    };

    return new Error(errorMessages[error.code] || error.message);
  }
}

// Create singleton instance
const firebaseService = new FirebaseService();

export default firebaseService;
