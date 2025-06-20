import { NavigationContainer } from '@react-navigation/native';
import AuthNavigator from './src/navigation/AuthNavigator';
import MainNavigator from './src/navigation/MainNavigator';
import LoadingScreen from './src/screens/LoadingScreen';
import { auth } from './src/firebaseConfig';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { useEffect } from 'react';

function AppContent() {
  const { isAuthenticated, loading } = useAuth();
  console.log('AppContent: loading state from useAuth():', loading);
  console.log('AppContent: isAuthenticated state from useAuth():', isAuthenticated);

  // Use the loading state from AuthContext
  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <NavigationContainer>
      {isAuthenticated ? <MainNavigator /> : <AuthNavigator />}
    </NavigationContainer>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
