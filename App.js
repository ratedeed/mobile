import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, Platform } from 'react-native';
import { useColorScheme } from 'nativewind';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AnimatedSplashScreen from './src/components/AnimatedSplashScreen';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import MainNavigator from './src/navigation/MainNavigator';
import LoadingScreen from './src/screens/LoadingScreen';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { ContractorProvider } from './src/context/ContractorContext';
import { NotificationsProvider } from './src/context/NotificationsContext';
import { StripeProvider } from '@stripe/stripe-react-native';
import {
  registerSocket,
  startAppStateListener,
  startNetworkStatusListener,
  stopNetworkStatusListener,
  stopAppStateListener,
} from './src/utils/apiClient';
import ErrorBoundary from './src/components/ErrorBoundary';
import { usePushNotifications } from './src/hooks/usePushNotifications';
import { EscrowTrustBanner } from './src/components/EscrowTrustBanner';
import { useNetworkStatus } from './src/hooks/useNetworkStatus';
import { OfflineBanner } from './src/components/common/OfflineBanner';
import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';
import { requestTrackingPermissionsAsync } from 'expo-tracking-transparency';
import * as Linking from 'expo-linking';

const STRIPE_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY || 'pk_test_51TFxmH2K3vS58g5IdspNfgGbJGLkpqxlVSPpBQa2cp2nRWaAPz3RxPfgl4ozCOxsfj4xLc9oshL0xnSeNGduOXNT00Lv4ycEhh';

if (!process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY) {
  if (__DEV__) {
    console.warn('STRIPE_PUBLISHABLE_KEY is not set. Using safe fallback to prevent SDK crash.');
  } else {
    throw new Error('CRITICAL: EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY environment variable is not defined in production build!');
  }
}

Sentry.init({
  dsn: Constants.expoConfig?.extra?.sentryDsn || '',
  debug: false,
});

const linking = {
  prefixes: ['ratedeed://', 'https://ratedeed.com'],
  async getInitialURL() {
    const url = await Linking.getInitialURL();
    return url;
  },
  subscribe(listener) {
    const subscription = Linking.addEventListener('url', ({ url }) => {
      listener(url);
    });
    return () => {
      subscription.remove();
    };
  },
  config: {
    screens: {
      Main: {
        screens: {
          Explore: '',
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
      ContractorDashboard: 'contractor-dashboard',
      VerifyEmailChange: 'verify-email-change',
      ResetPassword: 'reset-password',
    },
  },
};

function AppNavigator({ splashComplete }) {
  const { isAuthenticated } = useAuth();
  const { colorScheme } = useColorScheme();

  useEffect(() => {
    (async () => {
      if (Platform.OS === 'ios') {
        const { status } = await requestTrackingPermissionsAsync();
        if (status === 'granted') {
          // Tracking enabled - analytics can use IDFA
        }
      }
    })();
  }, []);

  useEffect(() => {
    startAppStateListener();
    startNetworkStatusListener();
    return () => {
      stopAppStateListener();
      stopNetworkStatusListener();
    };
  }, []);

  usePushNotifications(); // Initialize push notification listeners inside NavigationContainer

  return (
    <View className="flex-1" style={{ backgroundColor: colorScheme === 'dark' ? '#0a0a0a' : '#ffffff' }}>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
      {/* Always show MainNavigator so guests can browse */}
      <MainNavigator />
      {splashComplete && <EscrowTrustBanner />}
    </View>
  );
}

function AppContent({ splashComplete }) {
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
      <AppNavigator splashComplete={splashComplete} />
    </NavigationContainer>
  );
}

function App() {
  const [splashComplete, setSplashComplete] = React.useState(false);
  const [themeLoaded, setThemeLoaded] = React.useState(false);
  const { isConnected } = useNetworkStatus();
  const { setColorScheme } = useColorScheme();

  useEffect(() => {
    AsyncStorage.getItem('theme_preference').then((pref) => {
      if (pref === 'dark' || pref === 'light') {
        setColorScheme(pref);
      } else {
        setColorScheme('light');
      }
      setThemeLoaded(true);
    });
  }, [setColorScheme]);

  if (!themeLoaded) {
    // Keep showing the native splash screen until we've decided light/dark
    return null;
  }

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <StripeProvider publishableKey={STRIPE_PUBLISHABLE_KEY || ''} merchantIdentifier="merchant.com.ratedeed.app">
          <AuthProvider>
            <NotificationsProvider>
              <ContractorProvider>
                <AppContent splashComplete={splashComplete} />
                <OfflineBanner isVisible={!isConnected} />
                {!splashComplete && (
                  <AnimatedSplashScreen onComplete={() => setSplashComplete(true)} minDuration={1500} />
                )}
              </ContractorProvider>
            </NotificationsProvider>
          </AuthProvider>
        </StripeProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}

export default Sentry.wrap(App);
