import React, { useEffect } from 'react';
import AnimatedSplashScreen from './src/components/AnimatedSplashScreen';
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
  const [splashComplete, setSplashComplete] = React.useState(false);

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <AuthProvider>
          <NotificationsProvider>
            <ContractorProvider>
              <AppContent />
              {!splashComplete && <AnimatedSplashScreen onComplete={() => setSplashComplete(true)} minDuration={2800} />}
            </ContractorProvider>
          </NotificationsProvider>
        </AuthProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}

export default Sentry.wrap(App);
