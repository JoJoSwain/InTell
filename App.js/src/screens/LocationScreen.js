import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Platform, PermissionsAndroid } from 'react-native';
import Geolocation from '@react-native-community/geolocation';
import RouteOptionsModal from '../components/RouteOptionsModal';
import RouteService from '../services/RouteService';

export default function LocationScreen({ route, navigation }) {
  const { location, userCurrentLocation } = route.params || {};
  const [userLocation, setUserLocation] = useState(userCurrentLocation || null);
  const [showRouteModal, setShowRouteModal] = useState(false);
  const [quickRoute, setQuickRoute] = useState(null);

  useEffect(() => {
    // Only request GPS if we don't have location from HomeScreen
    if (!userCurrentLocation) {
      console.log('⚠️ No location passed from HomeScreen, requesting GPS...');
      getUserLocation();
    } else {
      console.log('✅ Using location from HomeScreen:', userCurrentLocation);
    }
  }, []);

  useEffect(() => {
    if (userLocation && location) {
      loadQuickRoute();
    }
  }, [userLocation, location]);

  const getUserLocation = () => {
    console.log('🔍 Getting user location for routes...');
    
    // Request location permissions first
    if (Platform.OS === 'android') {
      PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
      ).then((granted) => {
        if (granted === PermissionsAndroid.RESULTS.GRANTED) {
          console.log('✅ Location permission granted');
          fetchLocation();
        } else {
          console.warn('❌ Location permission denied');
          Alert.alert('Permission Required', 'Location permission is needed for route recommendations');
        }
      });
    } else {
      fetchLocation();
    }
  };

  const fetchLocation = () => {
    Geolocation.getCurrentPosition(
      (position) => {
        const loc = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
        setUserLocation(loc);
        console.log('✅ User location obtained:', loc.latitude, loc.longitude);
        console.log('📍 GPS Accuracy:', position.coords.accuracy, 'meters');
      },
      (error) => {
        console.error('❌ GPS Error:', error.code, error.message);
        Alert.alert(
          'GPS Error', 
          `Could not get your location: ${error.message}\n\nPlease set GPS in emulator: ... → Location → Enter coordinates → Send`
        );
      },
      { 
        enableHighAccuracy: true, // Use high accuracy
        timeout: 10000,
        maximumAge: 5000
      }
    );
  };

  const loadQuickRoute = async () => {
    try {
      const summary = await RouteService.getQuickRouteSummary(
        userLocation,
        { latitude: location.latitude, longitude: location.longitude }
      );
      setQuickRoute(summary);
    } catch (error) {
      console.warn('Could not load quick route:', error);
    }
  };

  if (!location) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>No location data available</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.locationName}>{location.name}</Text>
        
        {/* CLEAR Location Indicators */}
        <View style={styles.locationIndicators}>
          {/* YOUR Location (Blue Dot) */}
          <View style={styles.indicatorBox}>
            <View style={[styles.indicatorDot, { backgroundColor: '#007AFF' }]} />
            <View style={styles.indicatorInfo}>
              <Text style={styles.indicatorLabel}>📍 YOUR LOCATION</Text>
              {userLocation ? (
                <Text style={styles.indicatorCoords}>
                  {userLocation.latitude.toFixed(5)}, {userLocation.longitude.toFixed(5)}
                </Text>
              ) : (
                <Text style={styles.indicatorCoords}>Getting GPS...</Text>
              )}
            </View>
          </View>
          
          {/* DESTINATION Location (Green Dot) */}
          <View style={styles.indicatorBox}>
            <View style={[styles.indicatorDot, { backgroundColor: '#34C759' }]} />
            <View style={styles.indicatorInfo}>
              <Text style={styles.indicatorLabel}>🎯 DESTINATION</Text>
              <Text style={styles.indicatorCoords}>
                {location.latitude.toFixed(5)}, {location.longitude.toFixed(5)}
              </Text>
              <Text style={styles.indicatorName}>{location.name}</Text>
            </View>
          </View>
        </View>

        {/* Quick Route Summary */}
        {quickRoute && (
          <View style={styles.quickRouteBox}>
            <Text style={styles.quickRouteIcon}>
              {RouteService.getModeIcon(quickRoute.mode)}
            </Text>
            <View style={styles.quickRouteInfo}>
              <Text style={styles.quickRouteText}>
                {quickRoute.duration} • {quickRoute.distance}
              </Text>
              <Text style={styles.quickRouteMode}>
                Fastest: {quickRoute.mode}
              </Text>
            </View>
          </View>
        )}
        
        {location.story_segment_title && (
          <View style={styles.storySection}>
            <Text style={styles.storyLabel}>Story Chapter</Text>
            <Text style={styles.storyTitle}>
              Chapter {location.story_chapter_number}: {location.story_segment_title}
            </Text>
            {location.story_segment_description && (
              <Text style={styles.storyDescription}>
                {location.story_segment_description}
              </Text>
            )}
          </View>
        )}

        <View style={styles.detailsSection}>
          <Text style={styles.detailLabel}>GPS Coordinates</Text>
          <Text style={styles.detailText}>
            📍 Latitude: {location.latitude.toFixed(6)}
          </Text>
          <Text style={styles.detailText}>
            📍 Longitude: {location.longitude.toFixed(6)}
          </Text>
          <Text style={styles.detailText}>
            🎯 Trigger Radius: {location.radius || 50} meters
          </Text>
        </View>

        {location.audio_file_url && (
          <View style={styles.audioSection}>
            <Text style={styles.detailLabel}>Audio</Text>
            <Text style={styles.audioText}>
              🎵 Audio will play when you reach this location
            </Text>
          </View>
        )}

        {/* Get Directions Button */}
        <TouchableOpacity
          style={[styles.button, styles.directionsButton]}
          onPress={() => {
            if (!userLocation) {
              console.log('⏳ User location not ready, fetching now...');
              getUserLocation();
              // Show modal anyway, it will show loading state
              setTimeout(() => setShowRouteModal(true), 1000);
              return;
            }
            setShowRouteModal(true);
          }}
        >
          <Text style={styles.buttonText}>
            {userLocation ? '🗺️ Get Directions' : '📍 Getting Location...'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.button}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.buttonText}>Back to Home</Text>
        </TouchableOpacity>
      </View>

      {/* Route Options Modal */}
      {userLocation && (
        <RouteOptionsModal
          visible={showRouteModal}
          onClose={() => setShowRouteModal(false)}
          origin={userLocation}
          destination={{
            latitude: location.latitude,
            longitude: location.longitude,
          }}
          destinationName={location.name}
          onRouteSelected={(selectedRoute) => {
            console.log('Route selected:', selectedRoute.mode);
            // You could navigate to a map view showing the route here
          }}
        />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  section: {
    backgroundColor: '#fff',
    margin: 10,
    padding: 20,
    borderRadius: 8,
  },
  locationName: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#333',
  },
  storySection: {
    marginBottom: 20,
    padding: 15,
    backgroundColor: '#f3e5f5',
    borderRadius: 8,
  },
  storyLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9c27b0',
    marginBottom: 5,
    textTransform: 'uppercase',
  },
  storyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#7b1fa2',
    marginBottom: 10,
  },
  storyDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  detailsSection: {
    marginBottom: 20,
  },
  detailLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  detailText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  audioSection: {
    marginBottom: 20,
    padding: 15,
    backgroundColor: '#e3f2fd',
    borderRadius: 8,
  },
  audioText: {
    fontSize: 14,
    color: '#1976d2',
  },
  button: {
    backgroundColor: '#2196f3',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  directionsButton: {
    backgroundColor: '#4CAF50',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  quickRouteBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e8f5e9',
    padding: 12,
    borderRadius: 8,
    marginBottom: 15,
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  quickRouteIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  quickRouteInfo: {
    flex: 1,
  },
  quickRouteText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2e7d32',
    marginBottom: 2,
  },
  quickRouteMode: {
    fontSize: 12,
    color: '#66bb6a',
    textTransform: 'capitalize',
  },
  debugBox: {
    backgroundColor: '#fff3cd',
    padding: 10,
    borderRadius: 8,
    marginBottom: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#ffc107',
  },
  debugText: {
    fontSize: 12,
    color: '#856404',
    fontFamily: 'monospace',
  },
  locationIndicators: {
    marginBottom: 20,
  },
  indicatorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    padding: 15,
    borderRadius: 10,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#e0e0e0',
  },
  indicatorDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 3,
    borderColor: '#fff',
    marginRight: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
  },
  indicatorInfo: {
    flex: 1,
  },
  indicatorLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#333',
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  indicatorCoords: {
    fontSize: 13,
    color: '#666',
    fontFamily: 'monospace',
    marginBottom: 2,
  },
  indicatorName: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '600',
    marginTop: 2,
  },
  errorText: {
    fontSize: 16,
    color: '#f44336',
    textAlign: 'center',
    padding: 20,
  },
});
