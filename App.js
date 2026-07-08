import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
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

Sentry.init({
  dsn: Constants.expoConfig?.extra?.sentryDsn || '',
  debug: false,
  beforeSend(event) {
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const scrub = (val) => {
      if (typeof val === 'string') {
        let clean = val;
        clean = clean.replace(/bearer\s+[a-zA-Z0-9-_=]+\.[a-zA-Z0-9-_=]+\.?[a-zA-Z0-9-_.+/=]*/gi, '[Redacted JWT]');
        clean = clean.replace(emailRegex, '[Redacted Email]');
        return clean;
      }
      if (val && typeof val === 'object') {
        for (const key in val) {
          if (Object.prototype.hasOwnProperty.call(val, key)) {
            if (key.toLowerCase() === 'authorization' || key.toLowerCase() === 'jwt') {
              val[key] = '[Redacted]';
            } else {
              val[key] = scrub(val[key]);
            }
          }
        }
      }
      return val;
    };
    if (event.request && event.request.headers) {
      if (event.request.headers['Authorization']) event.request.headers['Authorization'] = '[Redacted]';
      if (event.request.headers['authorization']) event.request.headers['authorization'] = '[Redacted]';
    }
    return scrub(event);
  }
});

const STRIPE_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY || '';

if (!process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY) {
  if (__DEV__) {
    console.warn('EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY is not set. Please define it in your local .env file.');
  } else {
    throw new Error('CRITICAL: EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY environment variable is not defined in production build!');
  }
}

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
      ChatScreen: 'chat/:conversationId',
      Notifications: 'notifications',
      BusinessSearch: 'search',
      QuoteReview: 'quote-review/:quoteId',
      ContractorDashboard: 'contractor-dashboard',
      VerifyEmailChange: {
        path: 'verify-email-change',
        parse: {
          token: (token) => token,
        },
      },
      ResetPassword: {
        path: 'reset-password',
        parse: {
          token: (token) => token,
          oobCode: (oobCode) => oobCode,
        },
      },
      JobDetail: 'jobs/:jobId',
      PaymentFlow: 'payment/:quoteId',
      DisputeScreen: 'dispute/:jobId',
      ReviewScreen: 'review/:jobId',
      EarningsScreen: 'earnings',
      ChangeOrderScreen: 'change-order/:jobId',
      ContractorOnboarding: 'contractor-onboarding',
      ContractorEditProfile: 'contractor-edit-profile',
      Login: 'login',
      Register: 'register',
      ForgotPassword: 'forgot-password',
      ContractorSignup: 'contractor-signup',
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
    <View className="flex-1 bg-background">
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
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ErrorBoundary>
          <StripeProvider publishableKey={STRIPE_PUBLISHABLE_KEY || ''} merchantIdentifier="merchant.com.ratedeed.app">
            <AuthProvider>
              <NotificationsProvider>
                <ContractorProvider>
                  <AppContent splashComplete={splashComplete} />
                  <OfflineBanner isVisible={!isConnected} />
                  {!splashComplete && (
                    <AnimatedSplashScreen onComplete={() => setSplashComplete(true)} minDuration={800} />
                  )}
                </ContractorProvider>
              </NotificationsProvider>
            </AuthProvider>
          </StripeProvider>
        </ErrorBoundary>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export default Sentry.wrap(App);
