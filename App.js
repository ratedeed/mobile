import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AuthNavigator from './src/navigation/AuthNavigator';
import MainNavigator from './src/navigation/MainNavigator';
import LoadingScreen from './src/screens/LoadingScreen';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { ContractorProvider } from './src/context/ContractorContext';
import { NotificationsProvider } from './src/context/NotificationsContext';
import ErrorBoundary from './src/components/ErrorBoundary';
import * as Sentry from '@sentry/react-native';
import { usePushNotifications } from './src/hooks/usePushNotifications';

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

function AppContent() {
  const { isAuthenticated, isLoading } = useAuth();
  usePushNotifications(); // Initialize push notification listeners

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <NavigationContainer linking={linking}>
      {isAuthenticated ? <MainNavigator /> : <AuthNavigator />}
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

