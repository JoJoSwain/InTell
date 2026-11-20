import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Alert,
} from 'react-native';
import RouteService from '../services/RouteService';

export default function RouteOptionsModal({
  visible,
  onClose,
  origin,
  destination,
  destinationName,
  onRouteSelected,
}) {
  const [loading, setLoading] = useState(false);
  const [routes, setRoutes] = useState(null);
  const [selectedMode, setSelectedMode] = useState(null);
  const [showDirections, setShowDirections] = useState(false);

  useEffect(() => {
    if (visible && origin && destination) {
      loadRoutes();
    }
  }, [visible, origin, destination]);

  const loadRoutes = async () => {
    try {
      setLoading(true);
      const routeRecommendations = await RouteService.getRouteRecommendations(
        origin,
        destination
      );
      setRoutes(routeRecommendations);
    } catch (error) {
      console.error('Error loading routes:', error);
      Alert.alert('Error', 'Could not load route recommendations');
    } finally {
      setLoading(false);
    }
  };

  const handleRouteSelect = (mode) => {
    const route = routes[mode];
    if (!route) {
      Alert.alert('No Route', `No ${mode} route available for this location`);
      return;
    }

    setSelectedMode(mode);
    setShowDirections(true);
    
    if (onRouteSelected) {
      onRouteSelected(route);
    }
  };

  const renderRouteOption = (mode, route) => {
    if (!route) {
      return (
        <View key={mode} style={[styles.routeOption, styles.routeUnavailable]}>
          <Text style={styles.routeIcon}>{RouteService.getModeIcon(mode)}</Text>
          <View style={styles.routeInfo}>
            <Text style={styles.routeMode}>{mode.charAt(0).toUpperCase() + mode.slice(1)}</Text>
            <Text style={styles.routeUnavailableText}>Not available</Text>
          </View>
        </View>
      );
    }

    return (
      <TouchableOpacity
        key={mode}
        style={[
          styles.routeOption,
          selectedMode === mode && styles.routeOptionSelected,
        ]}
        onPress={() => handleRouteSelect(mode)}
      >
        <Text style={styles.routeIcon}>{RouteService.getModeIcon(mode)}</Text>
        <View style={styles.routeInfo}>
          <Text style={styles.routeMode}>
            {mode.charAt(0).toUpperCase() + mode.slice(1)}
          </Text>
          <Text style={styles.routeDuration}>{route.duration}</Text>
          <Text style={styles.routeDistance}>{route.distance}</Text>
          {route.transitDetails && (
            <Text style={styles.transitInfo}>
              {route.transitDetails.lines.map(l => l.name).join(', ')}
            </Text>
          )}
        </View>
        <Text style={styles.arrow}>→</Text>
      </TouchableOpacity>
    );
  };

  const renderDirections = () => {
    if (!selectedMode || !routes[selectedMode]) return null;

    const route = routes[selectedMode];

    return (
      <View style={styles.directionsContainer}>
        <View style={styles.directionsHeader}>
          <TouchableOpacity onPress={() => setShowDirections(false)}>
            <Text style={styles.backButton}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.directionsTitle}>
            {selectedMode.charAt(0).toUpperCase() + selectedMode.slice(1)} Directions
          </Text>
        </View>

        <View style={styles.routeSummary}>
          <Text style={styles.summaryText}>
            {route.duration} • {route.distance}
          </Text>
          {route.summary && (
            <Text style={styles.routeName}>via {route.summary}</Text>
          )}
        </View>

        <ScrollView style={styles.stepsList}>
          {route.steps.map((step, index) => (
            <View key={index} style={styles.step}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>{step.stepNumber}</Text>
              </View>
              <View style={styles.stepContent}>
                <Text style={styles.stepInstruction}>{step.instruction}</Text>
                <Text style={styles.stepDetails}>
                  {step.distance} • {step.duration}
                </Text>
                {step.transitInfo && (
                  <View style={styles.transitStep}>
                    <Text style={styles.transitLine}>
                      🚌 {step.transitInfo.line}
                    </Text>
                    <Text style={styles.transitStops}>
                      {step.transitInfo.stops} stops
                    </Text>
                    <Text style={styles.transitTime}>
                      {step.transitInfo.departureTime} → {step.transitInfo.arrivalTime}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          ))}
        </ScrollView>
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>
              How to get to {destinationName || 'location'}
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Loading State */}
          {loading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#007AFF" />
              <Text style={styles.loadingText}>Finding best routes...</Text>
            </View>
          )}

          {/* Route Options or Directions */}
          {!loading && routes && (
            showDirections ? renderDirections() : (
              <ScrollView style={styles.routesList}>
                {renderRouteOption('walking', routes.walking)}
                {renderRouteOption('bicycling', routes.biking)}
                {renderRouteOption('transit', routes.transit)}
              </ScrollView>
            )
          )}

          {/* Close Button */}
          {!showDirections && (
            <TouchableOpacity style={styles.bottomButton} onPress={onClose}>
              <Text style={styles.bottomButtonText}>Close</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    paddingBottom: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
  },
  closeButton: {
    padding: 5,
  },
  closeButtonText: {
    fontSize: 24,
    color: '#666',
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: '#666',
  },
  routesList: {
    padding: 15,
  },
  routeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  routeOptionSelected: {
    borderColor: '#007AFF',
    backgroundColor: '#e3f2fd',
  },
  routeUnavailable: {
    opacity: 0.5,
  },
  routeIcon: {
    fontSize: 32,
    marginRight: 15,
  },
  routeInfo: {
    flex: 1,
  },
  routeMode: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  routeDuration: {
    fontSize: 14,
    color: '#333',
    marginBottom: 2,
  },
  routeDistance: {
    fontSize: 12,
    color: '#666',
  },
  routeUnavailableText: {
    fontSize: 14,
    color: '#999',
  },
  transitInfo: {
    fontSize: 12,
    color: '#007AFF',
    marginTop: 4,
  },
  arrow: {
    fontSize: 20,
    color: '#007AFF',
  },
  directionsContainer: {
    flex: 1,
  },
  directionsHeader: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  backButton: {
    color: '#007AFF',
    fontSize: 16,
    marginBottom: 10,
  },
  directionsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  routeSummary: {
    padding: 15,
    backgroundColor: '#f9f9f9',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  summaryText: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  routeName: {
    fontSize: 14,
    color: '#666',
  },
  stepsList: {
    flex: 1,
  },
  step: {
    flexDirection: 'row',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  stepNumber: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  stepNumberText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  stepContent: {
    flex: 1,
  },
  stepInstruction: {
    fontSize: 14,
    marginBottom: 4,
  },
  stepDetails: {
    fontSize: 12,
    color: '#666',
  },
  transitStep: {
    marginTop: 8,
    padding: 10,
    backgroundColor: '#e3f2fd',
    borderRadius: 8,
  },
  transitLine: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  transitStops: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  transitTime: {
    fontSize: 12,
    color: '#007AFF',
  },
  bottomButton: {
    margin: 15,
    padding: 15,
    backgroundColor: '#007AFF',
    borderRadius: 10,
    alignItems: 'center',
  },
  bottomButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
