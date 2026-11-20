import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import ProgressService from '../services/ProgressService';
import StoryService from '../services/StoryService';
import APIService from '../services/APIService';

export default function ProgressScreen({ user }) {
  const [progress, setProgress] = useState(null);
  const [storyProgress, setStoryProgress] = useState(null);
  const [locations, setLocations] = useState([]);

  useEffect(() => {
    loadProgress();
  }, []);

  const loadProgress = async () => {
    try {
      const userProgress = ProgressService.getProgress();
      setProgress(userProgress);

      const story = StoryService.getStoryProgressPercentage(user?.id);
      setStoryProgress(story);

      const locationsData = await APIService.getLocations();
      setLocations(locationsData);
    } catch (error) {
      console.error('Error loading progress:', error);
    }
  };

  const getProgressPercentage = () => {
    if (!progress || locations.length === 0) return 0;
    return Math.round(
      (progress.completedLocations.length / locations.length) * 100
    );
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.title}>Your Progress</Text>
        
        <View style={styles.statsContainer}>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{progress?.completedLocations.length || 0}</Text>
            <Text style={styles.statLabel}>Completed</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{progress?.unlockedLocations.length || 0}</Text>
            <Text style={styles.statLabel}>Unlocked</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{locations.length}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
        </View>

        <View style={styles.progressSection}>
          <Text style={styles.sectionTitle}>Location Progress</Text>
          <View style={styles.progressBarContainer}>
            <View
              style={[
                styles.progressBar,
                { width: `${getProgressPercentage()}%` },
              ]}
            />
          </View>
          <Text style={styles.progressText}>{getProgressPercentage()}% Complete</Text>
        </View>

        {storyProgress && storyProgress.totalCount > 0 && (
          <View style={styles.progressSection}>
            <Text style={styles.sectionTitle}>Story Progress</Text>
            <View style={styles.progressBarContainer}>
              <View
                style={[
                  styles.progressBar,
                  { width: `${storyProgress.percentage}%`, backgroundColor: '#9c27b0' },
                ]}
              />
            </View>
            <Text style={styles.progressText}>
              {storyProgress.percentage}% Complete
            </Text>
            <Text style={styles.progressDetails}>
              Chapter {StoryService.getCurrentChapter(user?.id) || 0} of {storyProgress.totalCount}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>All Locations</Text>
        {locations.map((location) => {
          const isUnlocked = ProgressService.isLocationUnlocked(location.id);
          const isCompleted = ProgressService.isLocationCompleted(location.id);

          return (
            <View
              key={location.id}
              style={[
                styles.locationCard,
                !isUnlocked && styles.locationCardLocked,
                isCompleted && styles.locationCardCompleted,
              ]}
            >
              <Text style={styles.locationName}>{location.name}</Text>
              {location.story_segment_title && (
                <Text style={styles.storySegmentTitle}>
                  Chapter {location.story_chapter_number}: {location.story_segment_title}
                </Text>
              )}
              <Text style={[
                styles.locationStatus,
                isCompleted && styles.locationStatusCompleted,
              ]}>
                {isCompleted
                  ? '✓ Completed'
                  : isUnlocked
                  ? '🔓 Unlocked'
                  : '🔒 Locked'}
              </Text>
            </View>
          );
        })}
      </View>

      <View style={styles.spacing} />
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
    padding: 15,
    borderRadius: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#333',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  statBox: {
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    minWidth: 100,
  },
  statNumber: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#2196f3',
  },
  statLabel: {
    fontSize: 14,
    color: '#666',
    marginTop: 5,
  },
  progressSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  progressBarContainer: {
    height: 20,
    backgroundColor: '#e0e0e0',
    borderRadius: 10,
    overflow: 'hidden',
    marginVertical: 10,
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#4caf50',
  },
  progressText: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 5,
    color: '#333',
  },
  progressDetails: {
    color: '#666',
    marginTop: 5,
    fontSize: 14,
  },
  locationCard: {
    backgroundColor: '#f0f0f0',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
  },
  locationCardLocked: {
    opacity: 0.5,
  },
  locationCardCompleted: {
    backgroundColor: '#e8f5e9',
    borderLeftWidth: 4,
    borderLeftColor: '#4caf50',
  },
  locationName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  storySegmentTitle: {
    marginTop: 5,
    fontSize: 14,
    color: '#9c27b0',
    fontStyle: 'italic',
  },
  locationStatus: {
    marginTop: 5,
    color: '#666',
    fontSize: 14,
  },
  locationStatusCompleted: {
    color: '#4caf50',
    fontWeight: '600',
  },
  spacing: {
    height: 20,
  },
});
