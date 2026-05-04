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

let app;
let auth;

try {
  // Initialize Firebase App:
  // Checks if a Firebase app instance already exists to prevent re-initialization
  // errors, which can occur in development with hot reloading.
  app = getApps().length ? getApp() : initializeApp(firebaseConfig);

  // Initialize Firebase Authentication:
  // Configures Firebase Auth to use React Native's AsyncStorage for persistence.
  // This ensures user sessions are maintained across app restarts.
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
} catch (error) {
  console.error("Firebase initialization error. Are your EXPO_PUBLIC_ variables set in EAS secrets?", error);
  // Provide empty fallback objects so the JS bundle doesn't instantly crash on load (causing a white screen).
  // The app will mount and ErrorBoundary can catch subsequent errors.
  app = {};
  auth = {};
}

// Export initialized Firebase services for use throughout the application.
// Add other services (e.g., getFirestore, getStorage) here as needed.
export { app, auth };