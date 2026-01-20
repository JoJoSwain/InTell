import 'react-native-gesture-handler'; // MUST be first import
import React, { useState, useEffect, useRef } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';

// Import screens
import HomeScreen from './src/screens/HomeScreen';
import RecommendationScreen from './src/screens/RecommendationScreen';
import AuthScreen from './src/screens/AuthScreen';
import LocationScreen from './src/screens/LocationScreen';
import ProgressScreen from './src/screens/ProgressScreen';
import AudioPlayerScreen from './src/screens/AudioPlayerScreen';

const Stack = createStackNavigator();

// Error Boundary Component
class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('App Error:', error);
    console.error('Error Info:', errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Something went wrong</Text>
          <Text style={styles.errorDetails}>
            {this.state.error?.toString() || 'Unknown error'}
          </Text>
          {this.state.errorInfo && (
            <Text style={styles.errorStack}>
              {this.state.errorInfo.componentStack?.split('\n').slice(0, 3).join('\n') || ''}
            </Text>
          )}
          <Text style={styles.errorHint}>
            Check the console for full error details
          </Text>
        </View>
      );
    }

    return this.props.children;
  }
}

export default function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [error, setError] = useState(null);
  const [currentLocation, setCurrentLocation] = useState(null);
  const gpsWatchIdRef = useRef(null);

  useEffect(() => {
    initializeApp().catch((err) => {
      console.error('Initialization error:', err);
      setError(err.message);
      setIsLoading(false);
    });
  }, []);

  const initializeApp = async () => {
    try {
      // 🔥 Initialize Firebase first
      const FirebaseService = require('./src/services/FirebaseService').default;
      FirebaseService.initialize();
      console.log('✅ Firebase initialized');
      
      // Dynamically import services to avoid module load errors
      const LocalStorage = require('./src/storage/LocalStorage').default;
      
      // Check if user is logged in (Firebase auth state)
      const currentUser = FirebaseService.getCurrentUser();
      if (currentUser) {
        const user = {
          id: currentUser.uid,
          email: currentUser.email,
          name: currentUser.displayName || 'User',
        };
        setUser(user);
        setIsAuthenticated(true);
        await LocalStorage.saveUser(user);
        await initializeServices(user);
        console.log('✅ Firebase user auto-login:', user.email);
      } else {
        // Check local storage as fallback
        let savedUser = null;
        try {
          savedUser = await LocalStorage.getUser();
        } catch (err) {
          console.warn('Error loading user from storage:', err);
        }
        
        if (savedUser) {
          setUser(savedUser);
          setIsAuthenticated(true);
          await initializeServices(savedUser);
        }
      }
    } catch (error) {
      console.error('App initialization error:', error);
      setError(error.message || 'Unknown error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const initializeServices = async (userData) => {
    try {
      // Dynamically import services
      const ProgressService = require('./src/services/ProgressService').default;
      const StoryService = require('./src/services/StoryService').default;
      const BackgroundSoundtrackService = require('./src/services/BackgroundSoundtrackService').default;
      const APIService = require('./src/services/APIService').default;
      const GPSService = require('./src/services/GPSService').default;
      const AudioNavigationService = require('./src/services/AudioNavigationService').default;
      
      // Initialize progress
      try {
        await ProgressService.initializeProgress(userData.id);
      } catch (err) {
        console.warn('Error initializing progress:', err);
      }
      
      // Initialize story service
      try {
        await StoryService.initialize(userData.id);
      } catch (err) {
        console.warn('Error initializing story service:', err);
      }
      
      // Initialize background soundtrack service
      try {
        await BackgroundSoundtrackService.initialize();
      } catch (err) {
        console.warn('Error initializing background soundtrack service:', err);
      }
      
      // Load locations
      try {
        const locationsData = await APIService.getLocations();
        console.log('Locations loaded:', locationsData?.length || 0);
      } catch (err) {
        console.warn('Error loading locations:', err);
      }
      
      // GPS tracking disabled for now to avoid crashes
      console.log('📍 GPS tracking disabled for stability');
      
      // Audio announcement
      try {
        await AudioNavigationService.queueAnnouncement(
          'ReplacePlace is ready. Begin your journey.'
        );
      } catch (err) {
        console.warn('Error queuing announcement:', err);
      }
    } catch (err) {
      console.error('Error initializing services:', err);
    }
  };

  const handleLogin = async (email, password, isMock = false) => {
    try {
      const LocalStorage = require('./src/storage/LocalStorage').default;
      
      let user;
      
      if (isMock) {
        // Mock login - skip API call
        console.log('🧪 Using mock login (no API call)');
        user = {
          id: 'mock-user-123',
          email: email,
          name: 'Test User',
        };
        await LocalStorage.saveUser(user);
      } else {
        // Real login - call API
        const APIService = require('./src/services/APIService').default;
        const response = await APIService.login(email, password);
        user = response.user;
        
        if (user) {
          // Save user locally
          try {
            await LocalStorage.saveUser(user);
          } catch (err) {
            console.warn('Error saving user:', err);
          }
        }
      }
      
      if (user) {
        setUser(user);
        setIsAuthenticated(true);
        
        // Initialize services
        await initializeServices(user);
      }
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  };

  const handleLogout = async () => {
    try {
      const GPSService = require('./src/services/GPSService').default;
      const AudioService = require('./src/services/AudioService').default;
      const LocalStorage = require('./src/storage/LocalStorage').default;
      const FirebaseService = require('./src/services/FirebaseService').default;
      
      // Stop GPS tracking
      try {
        if (gpsWatchIdRef.current) {
          GPSService.stopTracking();
          gpsWatchIdRef.current = null;
        }
      } catch (err) {
        console.warn('Error stopping GPS:', err);
      }
      
      // Stop audio
      try {
        AudioService.stopAudio();
        AudioService.stopBackgroundSoundtrack();
      } catch (err) {
        console.warn('Error stopping audio:', err);
      }
      
      // 🔥 Sign out from Firebase
      try {
        await FirebaseService.signOutUser();
        console.log('✅ Signed out from Firebase');
      } catch (err) {
        console.warn('Error signing out from Firebase:', err);
      }
      
      // Clear local storage
      try {
        await LocalStorage.removeUser();
        await LocalStorage.clearStorage();
      } catch (err) {
        console.warn('Error clearing storage:', err);
      }
    } catch (err) {
      console.warn('Error during logout:', err);
    }
    
    // Reset state
    setUser(null);
    setIsAuthenticated(false);
    setCurrentLocation(null);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Cleanup GPS tracking when app unmounts
      try {
        const GPSService = require('./src/services/GPSService').default;
        if (gpsWatchIdRef.current) {
          GPSService.stopTracking();
        }
      } catch (err) {
        console.warn('Error cleaning up GPS:', err);
      }
    };
  }, []);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2196f3" />
        <Text style={styles.loadingText}>Loading ReplacePlace...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Initialization Error</Text>
        <Text style={styles.errorDetails}>{error}</Text>
        <Text style={styles.errorHint}>
          Check console for details. App may continue with limited functionality.
        </Text>
      </View>
    );
  }

  return (
    <AppErrorBoundary>
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
              <Stack.Screen name="Location" options={{ title: 'Location Details' }}>
                {(props) => <LocationScreen {...props} />}
              </Stack.Screen>
              <Stack.Screen name="Progress" options={{ title: 'Your Progress' }}>
                {(props) => <ProgressScreen {...props} user={user} />}
              </Stack.Screen>
              <Stack.Screen name="AudioPlayer" options={{ title: 'Audio Player' }}>
                {(props) => <AudioPlayerScreen {...props} />}
              </Stack.Screen>
              <Stack.Screen name="Recommendation" options={{ title: 'Recommend a Location' }}>
                {(props) => (
                  <RecommendationScreen {...props} user={user} />
                )}
              </Stack.Screen>
            </>
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </AppErrorBoundary>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  loadingText: {
    marginTop: 15,
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
  },
  errorText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ff0000',
    marginBottom: 10,
  },
  errorDetails: {
    fontSize: 16,
    color: '#666',
    marginBottom: 10,
    textAlign: 'center',
  },
  errorStack: {
    fontSize: 12,
    color: '#999',
    marginBottom: 10,
    textAlign: 'center',
    fontFamily: 'monospace',
  },
  errorHint: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginTop: 10,
  },
});
