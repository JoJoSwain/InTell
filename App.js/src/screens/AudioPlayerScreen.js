import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import AudioService from '../services/AudioService';

export default function AudioPlayerScreen() {
  const [audioStatus, setAudioStatus] = useState(null);

  useEffect(() => {
    updateStatus();
    const interval = setInterval(updateStatus, 1000);
    return () => clearInterval(interval);
  }, []);

  const updateStatus = () => {
    const status = AudioService.getStatus();
    setAudioStatus(status);
  };

  const handlePause = () => {
    AudioService.pauseAudio();
    updateStatus();
  };

  const handleResume = () => {
    AudioService.resumeAudio();
    updateStatus();
  };

  const handleStop = () => {
    AudioService.stopAudio();
    updateStatus();
  };

  const handleStopBackground = () => {
    AudioService.stopBackgroundSoundtrack();
    updateStatus();
  };

  return (
    <View style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.title}>Audio Player</Text>

        <View style={styles.statusSection}>
          <Text style={styles.statusLabel}>Story Audio</Text>
          {audioStatus?.isPlaying ? (
            <View>
              <Text style={styles.statusText}>▶️ Playing</Text>
              <Text style={styles.statusDetails}>
                Audio ID: {audioStatus.currentAudioId || 'Unknown'}
              </Text>
            </View>
          ) : (
            <Text style={styles.statusText}>⏸️ No story audio playing</Text>
          )}
        </View>

        <View style={styles.statusSection}>
          <Text style={styles.statusLabel}>Background Soundtrack</Text>
          {audioStatus?.isBackgroundPlaying ? (
            <View>
              <Text style={styles.statusText}>🎵 Playing</Text>
              <Text style={styles.statusDetails}>
                Volume: {Math.round(audioStatus.backgroundVolume * 100)}%
              </Text>
            </View>
          ) : (
            <Text style={styles.statusText}>🔇 No background playing</Text>
          )}
        </View>

        {audioStatus?.isPlaying && (
          <View style={styles.controlsSection}>
            <Text style={styles.controlsLabel}>Story Audio Controls</Text>
            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={styles.controlButton}
                onPress={handlePause}
              >
                <Text style={styles.controlButtonText}>⏸️ Pause</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.controlButton}
                onPress={handleResume}
              >
                <Text style={styles.controlButtonText}>▶️ Resume</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.controlButton, styles.stopButton]}
                onPress={handleStop}
              >
                <Text style={styles.controlButtonText}>⏹️ Stop</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {audioStatus?.isBackgroundPlaying && (
          <View style={styles.controlsSection}>
            <Text style={styles.controlsLabel}>Background Controls</Text>
            <TouchableOpacity
              style={[styles.controlButton, styles.stopButton, { width: '100%' }]}
              onPress={handleStopBackground}
            >
              <Text style={styles.controlButtonText}>⏹️ Stop Background</Text>
            </TouchableOpacity>
          </View>
        )}

        {!audioStatus?.isPlaying && !audioStatus?.isBackgroundPlaying && (
          <View style={styles.infoSection}>
            <Text style={styles.infoText}>
              ℹ️ Audio will play automatically when you reach GPS locations.
            </Text>
            <Text style={styles.infoText}>
              Background soundtracks play when you enter geofenced areas.
            </Text>
          </View>
        )}
      </View>
    </View>
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
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#333',
  },
  statusSection: {
    marginBottom: 20,
    padding: 15,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
  },
  statusLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  statusText: {
    fontSize: 18,
    color: '#666',
    marginBottom: 5,
  },
  statusDetails: {
    fontSize: 14,
    color: '#999',
    marginTop: 5,
  },
  controlsSection: {
    marginBottom: 20,
  },
  controlsLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  controlButton: {
    backgroundColor: '#2196f3',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 5,
  },
  stopButton: {
    backgroundColor: '#f44336',
  },
  controlButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  infoSection: {
    marginTop: 20,
    padding: 15,
    backgroundColor: '#e3f2fd',
    borderRadius: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#1976d2',
    marginBottom: 10,
    lineHeight: 20,
  },
});
