// ═══════════════════════════════════════════════════════════
// ReplacePlace - Configuration Template
// ═══════════════════════════════════════════════════════════
// 
// SETUP INSTRUCTIONS FOR NEW TEAM MEMBERS:
// 1. Copy this file and rename it to: config.js
// 2. Fill in your API keys and configuration
// 3. NEVER commit config.js to Git (it's in .gitignore)
//
// ═══════════════════════════════════════════════════════════

// API Configuration
export const API_BASE_URL = __DEV__
  ? 'http://localhost:3000/api'  // Development
  : 'https://your-production-url.com/api';  // Production

// Firebase Configuration
// Get these values from: Firebase Console → Project Settings → Your Apps
export const FIREBASE_CONFIG = {
  apiKey: "YOUR_FIREBASE_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.firebasestorage.app",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// App Configuration
export const APP_CONFIG = {
  name: 'ReplacePlace',
  version: '1.0.0',
  
  // GPS Settings
  gps: {
    highAccuracy: true,
    distanceFilter: 10, // meters
    updateInterval: 5000, // milliseconds
    defaultRadius: 50, // meters
    hapticTriggerMultiplier: 2, // 2x radius for haptic
  },
  
  // Audio Settings
  audio: {
    backgroundVolume: 0.3,
    foregroundVolume: 1.0,
    fadeInDuration: 10000, // milliseconds
    fadeOutDuration: 10000, // milliseconds
  },
  
  // Haptic Settings
  haptic: {
    enabled: true,
    cooldownPeriod: 2000, // milliseconds
  },
};

export default {
  API_BASE_URL,
  FIREBASE_CONFIG,
  APP_CONFIG,
};
