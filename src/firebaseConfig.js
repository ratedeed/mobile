// src/firebaseConfig.js

import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeAuth, getReactNativePersistence } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Firebase configuration details.
// IMPORTANT: For production applications, these sensitive keys should be loaded from
// environment variables (e.g., using Expo's `app.config.js` or `expo-constants`).
// This example uses hardcoded values for demonstration purposes as per task instructions.
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

// Initialize Firebase App:
// Checks if a Firebase app instance already exists to prevent re-initialization
// errors, which can occur in development with hot reloading.
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// Initialize Firebase Authentication:
// Configures Firebase Auth to use React Native's AsyncStorage for persistence.
// This ensures user sessions are maintained across app restarts.
console.log('firebaseConfig: Checking AsyncStorage availability for persistence:', typeof AsyncStorage);
const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});

// Export initialized Firebase services for use throughout the application.
// Add other services (e.g., getFirestore, getStorage) here as needed.
export { app, auth };