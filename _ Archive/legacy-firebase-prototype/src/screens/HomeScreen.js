import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Dimensions,
  ActivityIndicator,
  PermissionsAndroid,
  Platform,
} from 'react-native';
import MapView, { Marker, Circle, PROVIDER_DEFAULT } from 'react-native-maps';
import Geolocation from '@react-native-community/geolocation';
import ProgressService from '../services/ProgressService';
import APIService from '../services/APIService';

const { width, height } = Dimensions.get('window');

export default function HomeScreen({ navigation, user, onLogout }) {
  const [locations, setLocations] = useState([]);
  const [progress, setProgress] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userLocation, setUserLocation] = useState(null);
  const [mapReady, setMapReady] = useState(false);
  const mapRef = useRef(null);
  const watchIdRef = useRef(null);

  useEffect(() => {
    loadData();
    requestLocationPermission();
    
    return () => {
      // Cleanup: stop watching location
      if (watchIdRef.current !== null) {
        Geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  const requestLocationPermission = async () => {
    try {
      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: 'Location Permission',
            message: 'ReplacePlace needs access to your location to show nearby story locations.',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          }
        );
        
        if (granted === PermissionsAndroid.RESULTS.GRANTED) {
          console.log('✅ Location permission granted');
          startWatchingLocation();
        } else {
          console.log('❌ Location permission denied');
          // Use default location (Temple Square, Salt Lake City)
          setUserLocation({
            latitude: 40.7704,
            longitude: -111.8922,
          });
        }
      } else {
        // iOS permissions are handled via Info.plist
        startWatchingLocation();
      }
    } catch (err) {
      console.warn('Location permission error:', err);
      // Fallback to default location (Temple Square, Salt Lake City)
      setUserLocation({
        latitude: 40.7704,
        longitude: -111.8922,
      });
    }
  };

  const startWatchingLocation = () => {
    // Get current position first
    Geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy, altitude, speed } = position.coords;
        setUserLocation({ latitude, longitude });
        console.log('════════════════════════════════════════');
        console.log('📍 GPS LOCATION ACQUIRED');
        console.log('Latitude:', latitude);
        console.log('Longitude:', longitude);
        console.log('Accuracy:', accuracy, 'meters');
        console.log('Altitude:', altitude, 'meters');
        console.log('Speed:', speed, 'm/s');
        console.log('Timestamp:', new Date(position.timestamp).toLocaleTimeString());
        console.log('════════════════════════════════════════');
        
        // Center map on user
        if (mapRef.current && mapReady) {
          mapRef.current.animateToRegion({
            latitude,
            longitude,
            latitudeDelta: 0.05,
            longitudeDelta: 0.05,
          }, 1000);
        }
      },
      (error) => {
        console.error('════════════════════════════════════════');
        console.error('❌ GPS ERROR - USING FALLBACK');
        console.error('Error Code:', error.code);
        console.error('Error Message:', error.message);
        console.error('PERMISSION_DENIED = 1, POSITION_UNAVAILABLE = 2, TIMEOUT = 3');
        console.error('════════════════════════════════════════');
        console.warn('⚠️ FALLBACK: Setting location to Temple Square');
        // Use default location (Temple Square, Salt Lake City)
        setUserLocation({
          latitude: 40.7704,
          longitude: -111.8922,
        });
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 10000,
      }
    );

    // Watch for location changes
    watchIdRef.current = Geolocation.watchPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        setUserLocation({ latitude, longitude });
        console.log('🔄 GPS UPDATE:', latitude.toFixed(5), longitude.toFixed(5), `(±${accuracy.toFixed(0)}m)`);
      },
      (error) => {
        console.error('❌ Watch position error:', error.code, error.message);
      },
      {
        enableHighAccuracy: false,
        distanceFilter: 10, // Only update every 10 meters
        interval: 5000,
        fastestInterval: 2000,
      }
    );
  };

  const loadData = async () => {
    try {
      console.log('📍 Loading locations for map...');
      
      // Load locations
      const locationsData = await APIService.getLocations();
      
      // Load progress
      let userProgress = null;
      try {
        userProgress = await ProgressService.getProgress();
        setProgress(userProgress);
      } catch (err) {
        console.log('📦 Creating new progress');
      }

      // Add 'unlocked' property
      const enrichedLocations = locationsData.map(loc => ({
        ...loc,
        unlocked: userProgress 
          ? ProgressService.isLocationUnlocked(loc.id)
          : (loc.prerequisite_location_id === null || loc.prerequisite_location_id === undefined)
      }));
      
      setLocations(enrichedLocations);
      console.log(`✅ Loaded ${enrichedLocations.length} locations`);
    } catch (error) {
      console.error('❌ Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMapReady = () => {
    console.log('🗺️ Map is ready');
    setMapReady(true);
    
    // If we have user location, center on it
    if (userLocation && mapRef.current) {
      setTimeout(() => {
        mapRef.current.animateToRegion({
          latitude: userLocation.latitude,
          longitude: userLocation.longitude,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }, 1000);
      }, 500);
    }
  };

  const handleMarkerPress = (location) => {
    if (!location.unlocked) {
      Alert.alert(
        '🔒 Location Locked',
        'Complete previous locations to unlock this one.',
        [{ text: 'OK' }]
      );
      return;
    }
    // Pass user's current location to avoid re-requesting GPS
    navigation.navigate('Location', { 
      location,
      userCurrentLocation: userLocation 
    });
  };

  const centerOnUser = () => {
    if (!userLocation) {
      Alert.alert('Location Unavailable', 'Waiting for GPS signal...');
      return;
    }
    
    if (mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      }, 500);
    }
  };

  const exploredCount = locations.filter(loc => loc.unlocked).length;

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>ReplacePlace</Text>
        </View>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading map...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.title}>ReplacePlace</Text>
          <Text style={styles.subtitle}>
            {exploredCount} / {locations.length} Locations
          </Text>
          {userLocation && (
            <View style={styles.gpsIndicator}>
              <View style={[styles.gpsStatusDot, { backgroundColor: '#34C759' }]} />
              <Text style={styles.locationHint}>
                GPS: {userLocation.latitude.toFixed(4)}, {userLocation.longitude.toFixed(4)}
              </Text>
            </View>
          )}
          {!userLocation && (
            <View style={styles.gpsIndicator}>
              <View style={[styles.gpsStatusDot, { backgroundColor: '#FF9500' }]} />
              <Text style={[styles.locationHint, { color: '#FF9500' }]}>
                Getting GPS location...
              </Text>
            </View>
          )}
        </View>
        <TouchableOpacity onPress={onLogout} style={styles.logoutButton}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      {/* Map */}
      <MapView
        ref={mapRef}
        provider={PROVIDER_DEFAULT}
        style={styles.map}
        initialRegion={{
          latitude: userLocation?.latitude || 40.7704,
          longitude: userLocation?.longitude || -111.8922,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
        showsUserLocation={false}
        showsMyLocationButton={false}
        showsCompass={true}
        showsScale={true}
        onMapReady={handleMapReady}
        followsUserLocation={false}
      >
        {/* User Location - Blue Dot */}
        {userLocation && (
          <>
            <Circle
              center={userLocation}
              radius={30}
              fillColor="rgba(0, 122, 255, 0.15)"
              strokeColor="rgba(0, 122, 255, 0.5)"
              strokeWidth={1}
            />
            <Marker
              coordinate={userLocation}
              anchor={{ x: 0.5, y: 0.5 }}
            >
              <View style={[styles.dotMarker, { backgroundColor: '#007AFF' }]} />
            </Marker>
          </>
        )}

        {/* Story Location Markers */}
        {locations.map((location) => (
          <Marker
            key={location.id}
            coordinate={{
              latitude: parseFloat(location.latitude),
              longitude: parseFloat(location.longitude),
            }}
            onPress={() => handleMarkerPress(location)}
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <View style={[
              styles.dotMarker,
              { backgroundColor: location.unlocked ? '#34C759' : '#FF3B30' }
            ]} />
          </Marker>
        ))}
      </MapView>

      {/* Center on User Button */}
      {userLocation && (
        <TouchableOpacity
          style={styles.centerButton}
          onPress={centerOnUser}
        >
          <Text style={styles.centerButtonText}>📍</Text>
        </TouchableOpacity>
      )}

      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#007AFF' }]} />
          <Text style={styles.legendText}>You</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#34C759' }]} />
          <Text style={styles.legendText}>Unlocked</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#FF3B30' }]} />
          <Text style={styles.legendText}>Locked</Text>
        </View>
      </View>

      {/* Bottom Navigation */}
      <View style={styles.bottomNav}>
        <TouchableOpacity
          style={styles.navButton}
          onPress={centerOnUser}
        >
          <Text style={styles.navIcon}>📍</Text>
          <Text style={styles.navText}>My Location</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.navButton}
          onPress={() => navigation.navigate('Progress')}
        >
          <Text style={styles.navIcon}>📊</Text>
          <Text style={styles.navText}>Progress</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.navButton}
          onPress={() => navigation.navigate('Recommendation')}
        >
          <Text style={styles.navIcon}>💡</Text>
          <Text style={styles.navText}>Recommend</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    zIndex: 10,
  },
  headerLeft: {
    flex: 1,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
  },
  subtitle: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  gpsIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  gpsStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  locationHint: {
    fontSize: 10,
    color: '#007AFF',
    fontFamily: 'monospace',
    fontWeight: '600',
  },
  logoutButton: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: '#ff3b30',
    borderRadius: 6,
  },
  logoutText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  map: {
    flex: 1,
  },
  dotMarker: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 3,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
  },
  centerButton: {
    position: 'absolute',
    right: 16,
    bottom: 100,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  centerButtonText: {
    fontSize: 24,
  },
  legend: {
    position: 'absolute',
    top: 80,
    right: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 8,
    padding: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 3,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  legendText: {
    fontSize: 12,
    color: '#333',
    fontWeight: '500',
  },
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    paddingVertical: 6,
  },
  navButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6,
  },
  navIcon: {
    fontSize: 22,
    marginBottom: 2,
  },
  navText: {
    fontSize: 10,
    color: '#007AFF',
    fontWeight: '600',
  },
});
