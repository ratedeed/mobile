import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AuthNavigator from './src/navigation/AuthNavigator';
import MainNavigator from './src/navigation/MainNavigator';
import LoadingScreen from './src/screens/LoadingScreen';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { ContractorProvider } from './src/context/ContractorContext';
import { NotificationsProvider } from './src/context/NotificationsContext';
import { registerSocket } from './src/utils/apiClient';
import ErrorBoundary from './src/components/ErrorBoundary';
import * as Sentry from '@sentry/react-native';
import { usePushNotifications } from './src/hooks/usePushNotifications';
import { EscrowTrustBanner } from './src/components/EscrowTrustBanner';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'nativewind';
import { getMessaging, setBackgroundMessageHandler } from '@react-native-firebase/messaging';
import * as Notifications from 'expo-notifications';

// Register background message handler — MUST be at top level, outside any component
setBackgroundMessageHandler(getMessaging(), async remoteMessage => {
  console.log('Background message received:', remoteMessage.messageId);
  // Show the notification via expo-notifications so it appears as a system banner
  await Notifications.scheduleNotificationAsync({
    content: {
      title: remoteMessage.notification?.title || 'New Notification',
      body: remoteMessage.notification?.body || 'You have a new message.',
      data: remoteMessage.data,
      sound: 'default',
    },
    trigger: null,
  });
});

Sentry.init({
  dsn: 'https://placeholder@sentry.io/1234567', // Replace with your actual Sentry DSN
  debug: false,
});

const linking = {
  prefixes: ['ratedeed://', 'https://ratedeed.com'],
  config: {
    screens: {
      Main: {
        screens: {
          Home: '',
          Search: 'search',
          Messages: 'messages',
          Profile: 'profile',
          Dashboard: 'dashboard',
        },
      },
      BusinessDetail: 'contractor/:slug',
      ChatScreen: 'chat/:recipientId',
      Notifications: 'notifications',
    },
  },
};

function AppNavigator() {
  const { isAuthenticated } = useAuth();
  const { colorScheme } = useColorScheme();
  usePushNotifications(); // Initialize push notification listeners inside NavigationContainer

  return (
    <>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
      {isAuthenticated ? (
        <>
          <MainNavigator />
          <EscrowTrustBanner />
        </>
      ) : (
        <AuthNavigator />
      )}
    </>
  );
}

function AppContent() {
  const { isAuthenticated, isLoading, userId } = useAuth();

  useEffect(() => {
    if (isAuthenticated && userId) {
      registerSocket(userId);
    }
  }, [isAuthenticated, userId]);

  if (isLoading) {
    return (
      <>
        <StatusBar style="auto" />
        <LoadingScreen />
      </>
    );
  }

  return (
    <NavigationContainer linking={linking}>
      <AppNavigator />
    </NavigationContainer>
  );
}

function App() {
  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <AuthProvider>
          <NotificationsProvider>
            <ContractorProvider>
              <AppContent />
            </ContractorProvider>
          </NotificationsProvider>
        </AuthProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}

export default Sentry.wrap(App);

