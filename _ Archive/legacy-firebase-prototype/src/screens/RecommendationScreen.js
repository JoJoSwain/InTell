import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import GPSService from '../services/GPSService';
import APIService from '../services/APIService';

export default function RecommendationScreen({ navigation, user }) {
  const [loading, setLoading] = useState(false);
  const [usingCurrentLocation, setUsingCurrentLocation] = useState(false);
  const [currentLocation, setCurrentLocation] = useState(null);

  // Form state
  const [locationName, setLocationName] = useState('');
  const [streetAddress, setStreetAddress] = useState('');
  const [locationDescription, setLocationDescription] = useState('');
  const [whatHappensHere, setWhatHappensHere] = useState('');
  const [storySegmentTitle, setStorySegmentTitle] = useState('');
  const [storySegmentDescription, setStorySegmentDescription] = useState('');
  const [navigationInstructions, setNavigationInstructions] = useState('');

  useEffect(() => {
    // Request GPS permissions when screen loads
    GPSService.requestPermissions();
  }, []);

  // Capture current location
  const captureCurrentLocation = async () => {
    try {
      setLoading(true);
      setUsingCurrentLocation(true);
      
      const location = await GPSService.getCurrentLocation();
      setCurrentLocation(location);
      
      // Set address as GPS coordinates (user can edit to add street address)
      setStreetAddress(`${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`);
      
      Alert.alert('Success', 'Current location captured! You can replace with a street address if you prefer.');
    } catch (error) {
      console.error('Error capturing location:', error);
      Alert.alert('Error', 'Could not capture current location. Please enter a street address manually.');
    } finally {
      setLoading(false);
      setUsingCurrentLocation(false);
    }
  };

  // Validate form
  const validateForm = () => {
    if (!locationName.trim()) {
      Alert.alert('Validation Error', 'Please enter a location name');
      return false;
    }
    if (!streetAddress.trim()) {
      Alert.alert('Validation Error', 'Please enter a street address or capture current location');
      return false;
    }
    if (!whatHappensHere.trim()) {
      Alert.alert('Validation Error', 'Please describe what happens at this location');
      return false;
    }
    return true;
  };

  // Submit recommendation
  const submitRecommendation = async () => {
    if (!validateForm()) {
      return;
    }

    try {
      setLoading(true);

      const recommendationData = {
        user_id: user.id,
        location_name: locationName.trim(),
        street_address: streetAddress.trim(),
        location_description: locationDescription.trim(),
        what_happens_here: whatHappensHere.trim(),
        story_segment_title: storySegmentTitle.trim(),
        story_segment_description: storySegmentDescription.trim(),
        navigation_instructions: navigationInstructions.trim(),
      };

      await APIService.submitLocationRecommendation(recommendationData);

      Alert.alert(
        'Success',
        'Your recommendation has been submitted! Thank you for contributing to ReplacePlace.',
        [
          {
            text: 'OK',
            onPress: () => {
              // Clear form
              setLocationName('');
              setStreetAddress('');
              setLocationDescription('');
              setWhatHappensHere('');
              setStorySegmentTitle('');
              setStorySegmentDescription('');
              setNavigationInstructions('');
              setCurrentLocation(null);
            },
          },
        ]
      );
    } catch (error) {
      console.error('Error submitting recommendation:', error);
      Alert.alert('Error', 'Could not submit recommendation. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Recommend a Location</Text>
        <Text style={styles.subtitle}>
          Help expand ReplacePlace by suggesting new GPS locations and story segments
        </Text>
      </View>

      {/* Location Address Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Location Address</Text>
        
        <TouchableOpacity
          style={[styles.button, styles.primaryButton]}
          onPress={captureCurrentLocation}
          disabled={loading || usingCurrentLocation}
        >
          {usingCurrentLocation ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>📍 Use Current Location</Text>
          )}
        </TouchableOpacity>

        <Text style={styles.orText}>OR</Text>

        <Text style={styles.label}>Street Address *</Text>
        <TextInput
          style={[styles.input, styles.addressInput]}
          value={streetAddress}
          onChangeText={setStreetAddress}
          placeholder="e.g., 123 Main Street, Salt Lake City, UT 84101"
          multiline
          numberOfLines={2}
          editable={!usingCurrentLocation}
        />

        <Text style={styles.helperText}>
          💡 You can enter coordinates (40.7704, -111.8922) or a full street address
        </Text>

        {currentLocation && (
          <Text style={styles.locationInfo}>
            ✅ Location captured: {currentLocation.latitude.toFixed(6)}, {currentLocation.longitude.toFixed(6)}
          </Text>
        )}
      </View>

      {/* Location Information Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Location Information</Text>

        <Text style={styles.label}>Location Name *</Text>
        <TextInput
          style={styles.input}
          value={locationName}
          onChangeText={setLocationName}
          placeholder="e.g., The Old Oak Tree"
        />

        <Text style={styles.label}>Location Description</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={locationDescription}
          onChangeText={setLocationDescription}
          placeholder="Describe the physical location, landmarks, environment..."
          multiline
          numberOfLines={3}
        />

        <Text style={styles.label}>What Happens Here? *</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={whatHappensHere}
          onChangeText={setWhatHappensHere}
          placeholder="Describe what story event or experience should happen at this location..."
          multiline
          numberOfLines={4}
        />
      </View>

      {/* Story Segment Information Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Story Segment Information</Text>

        <Text style={styles.label}>Story Segment Title</Text>
        <TextInput
          style={styles.input}
          value={storySegmentTitle}
          onChangeText={setStorySegmentTitle}
          placeholder="e.g., Chapter 5: The Discovery"
        />

        <Text style={styles.label}>Story Segment Description</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={storySegmentDescription}
          onChangeText={setStorySegmentDescription}
          placeholder="Describe the story content that should be at this location..."
          multiline
          numberOfLines={5}
        />

        <Text style={styles.label}>Navigation Instructions</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={navigationInstructions}
          onChangeText={setNavigationInstructions}
          placeholder="How should users find this location? What landmarks or directions should be in the audio?"
          multiline
          numberOfLines={3}
        />
      </View>

      {/* Submit Button */}
      <TouchableOpacity
        style={[styles.button, styles.submitButton]}
        onPress={submitRecommendation}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Submit Recommendation</Text>
        )}
      </TouchableOpacity>

      <Text style={styles.footerText}>
        * Required fields{'\n'}
        Your recommendations will be reviewed and may be added to the ReplacePlace experience.
      </Text>
      
      <View style={styles.spacing} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#fff',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
  },
  section: {
    backgroundColor: '#fff',
    margin: 10,
    padding: 15,
    borderRadius: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#333',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 10,
    marginBottom: 5,
    color: '#333',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
    marginBottom: 10,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  addressInput: {
    minHeight: 60,
    textAlignVertical: 'top',
  },
  helperText: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
    marginTop: -5,
    marginBottom: 10,
  },
  button: {
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 10,
  },
  primaryButton: {
    backgroundColor: '#2196f3',
  },
  submitButton: {
    backgroundColor: '#4caf50',
    margin: 10,
    marginTop: 20,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  orText: {
    textAlign: 'center',
    marginVertical: 10,
    color: '#666',
    fontSize: 14,
  },
  locationInfo: {
    marginTop: 10,
    padding: 10,
    backgroundColor: '#e8f5e9',
    borderRadius: 8,
    color: '#2e7d32',
    fontSize: 14,
  },
  footerText: {
    margin: 20,
    marginTop: 10,
    textAlign: 'center',
    color: '#666',
    fontSize: 12,
    lineHeight: 18,
  },
  spacing: {
    height: 20,
  },
});
