import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'nativewind';
import AnimatedSplashScreen from './src/components/AnimatedSplashScreen';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AuthNavigator from './src/navigation/AuthNavigator';
import MainNavigator from './src/navigation/MainNavigator';
import LoadingScreen from './src/screens/LoadingScreen';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { ContractorProvider } from './src/context/ContractorContext';
import { NotificationsProvider } from './src/context/NotificationsContext';
import { StripeProvider } from '@stripe/stripe-react-native';
import { registerSocket } from './src/utils/apiClient';
import ErrorBoundary from './src/components/ErrorBoundary';
import { usePushNotifications } from './src/hooks/usePushNotifications';
import { EscrowTrustBanner } from './src/components/EscrowTrustBanner';
import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';

// TODO: Replace with your actual Stripe Publishable Key
const STRIPE_PUBLISHABLE_KEY = 'pk_test_your_key_here';

Sentry.init({
  dsn: Constants.expoConfig?.extra?.sentryDsn || '',
  debug: false,
});

const linking = {
  prefixes: ['ratedeed://', 'https://ratedeed.com'],
  config: {
    screens: {
      Main: {
        screens: {
          Explore: '',
          Search: 'search',
          Saved: 'saved',
          Jobs: 'jobs',
          Messages: 'messages',
          Profile: 'profile',
        },
      },
      BusinessDetail: 'contractor/:slug',
      ChatScreen: 'chat/:recipientId',
      Notifications: 'notifications',
      BusinessSearch: 'search',
      QuoteReview: 'quote-review/:quoteId',
      VerifyEmailChange: 'verify-email-change',
      ResetPassword: 'reset-password',
    },
  },
};

function AppNavigator() {
  const { isAuthenticated } = useAuth();
  const { colorScheme, setColorScheme } = useColorScheme();
  
  useEffect(() => {
    setColorScheme('light');
  }, [setColorScheme]);

  usePushNotifications(); // Initialize push notification listeners inside NavigationContainer

  return (
    <>
      <StatusBar style="dark" />
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
        <StripeProvider
          publishableKey={STRIPE_PUBLISHABLE_KEY}
          merchantIdentifier="merchant.com.ratedeed.app"
        >
          <AuthProvider>
            <NotificationsProvider>
              <ContractorProvider>
                <AppContent />
                {!splashComplete && <AnimatedSplashScreen onComplete={() => setSplashComplete(true)} minDuration={2800} />}
              </ContractorProvider>
            </NotificationsProvider>
          </AuthProvider>
        </StripeProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}

export default Sentry.wrap(App);
