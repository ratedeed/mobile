import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth as firebaseAuth } from '../firebaseConfig';
import AsyncStorage from '@react-native-async-storage/async-storage';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [backendToken, setBackendToken] = useState(null);
  const [isEmailVerified, setIsEmailVerified] = useState(false);
  const [loading, setLoading] = useState(true);

  // Derived state for overall authentication status
  const isAuthenticated = !!firebaseUser && isEmailVerified && !!backendToken;

  useEffect(() => {
    console.log('AuthContext: isAuthenticated dependencies changed.');
    console.log('AuthContext: firebaseUser status:', !!firebaseUser);
    console.log('AuthContext: isEmailVerified status:', isEmailVerified);
    console.log('AuthContext: backendToken status:', !!backendToken);
    console.log('AuthContext: Current isAuthenticated:', isAuthenticated);
  }, [firebaseUser, isEmailVerified, backendToken, isAuthenticated]);

  // Function to clear user session
  const logout = async () => {
    console.log('AuthContext: Initiating logout process.');
    try {
      await firebaseAuth.signOut(); // Sign out from Firebase
      await AsyncStorage.removeItem('userToken'); // Clear backend token
      setFirebaseUser(null); // Clear Firebase user state
      setBackendToken(null); // Clear backend token state
      setIsEmailVerified(false); // Reset email verification status
      console.log('AuthContext: User session cleared successfully.');
    } catch (error) {
      console.error('AuthContext: Error during logout:', error);
      throw new Error('Failed to log out: ' + error.message);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(firebaseAuth, async user => {
      console.log('AuthContext: onAuthStateChanged triggered. User:', user?.uid, user?.email);
      console.log('AuthContext: onAuthStateChanged - Initial user.emailVerified:', user?.emailVerified);
      if (user) {
        try {
          await user.reload(); // Reload to get the most up-to-date email verification status
          const reloadedUser = firebaseAuth.currentUser;
          setFirebaseUser(reloadedUser);
          setIsEmailVerified(reloadedUser?.emailVerified || false);
          console.log('AuthContext: onAuthStateChanged - After user.reload(), reloadedUser.emailVerified:', reloadedUser?.emailVerified);

          // Attempt to load backend token from AsyncStorage
          const storedToken = await AsyncStorage.getItem('userToken');
          setBackendToken(storedToken);
          console.log('AuthContext: Backend token loaded from AsyncStorage:', storedToken ? 'Yes' : 'No');

        } catch (error) {
          console.error("AuthContext: Error reloading Firebase user or loading backend token:", error);
          setFirebaseUser(user); // Fallback to original user if reload fails
          setIsEmailVerified(user?.emailVerified || false);
          setBackendToken(null); // Assume no backend token if error
        }
      } else {
        console.log('AuthContext: onAuthStateChanged - User logged out. Clearing all auth states.');
        setFirebaseUser(null);
        setBackendToken(null);
        setIsEmailVerified(false);
      }
      setLoading(false);
    });

    // Also check for backend token on initial load if Firebase user is already null
    const loadBackendTokenOnInitial = async () => {
      if (!firebaseAuth.currentUser) { // Only if Firebase user is not already set
        const storedToken = await AsyncStorage.getItem('userToken');
        setBackendToken(storedToken);
        console.log('AuthContext: Initial load - Backend token from AsyncStorage:', storedToken ? 'Yes' : 'No');
      }
    };

    loadBackendTokenOnInitial();

    return unsubscribe;
  }, []);

  // Function to update backend token and email verification status from LoginScreen
  const updateBackendToken = async (token, emailVerifiedStatus) => {
    await AsyncStorage.setItem('userToken', token);
    setBackendToken(token);
    setIsEmailVerified(emailVerifiedStatus); // Update isEmailVerified state
    console.log('AuthContext: Backend token and email verification status updated from LoginScreen.');
  };

  return (
    <AuthContext.Provider value={{ firebaseUser, backendToken, isEmailVerified, isAuthenticated, loading, logout, updateBackendToken }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  return useContext(AuthContext);
};