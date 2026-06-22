import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeAuth, getReactNativePersistence } from 'firebase/auth';
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';

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
  app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(ReactNativeAsyncStorage),
  });
} catch (error) {
  if (__DEV__) {
    console.warn("Firebase initialization error. Check EXPO_PUBLIC_ env variables.");
  }
  // Safe mock app object
  app = {
    name: '[MockApp]',
    options: {},
    automaticDataCollectionEnabled: false,
  };

  // Safe mock auth object with Proxy fallback for safety
  const mockAuth = {
    app,
    currentUser: null,
    onAuthStateChanged: (callback) => () => {},
    onIdTokenChanged: (callback) => () => {},
    signOut: () => Promise.resolve(),
    signInWithEmailAndPassword: () => Promise.reject(new Error("Firebase is not initialized.")),
    createUserWithEmailAndPassword: () => Promise.reject(new Error("Firebase is not initialized.")),
  };

  auth = new Proxy(mockAuth, {
    get(target, prop) {
      if (prop in target) {
        return target[prop];
      }
      if (prop === 'then') return undefined;
      // Return dummy functions for any other properties accessed as functions
      return () => {};
    }
  });
}

export { app, auth };