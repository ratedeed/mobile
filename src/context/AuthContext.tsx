import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthInfo, UserRole } from '../types';

interface AuthContextType {
  firebaseUser: any;
  backendToken: string | null;
  isEmailVerified: boolean;
  isLoading: boolean;
  isAuthenticated: boolean;
  userRole: UserRole | null;
  login: (email: string, password: string) => Promise<any>;
  logout: () => void;
  updateUser: (userData: Partial<AuthInfo>) => void;
  updateBackendToken: (token: string, emailVerifiedStatus: boolean) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<any>(null);
  const [backendToken, setBackendToken] = useState<string | null>(null);
  const [isEmailVerified, setIsEmailVerified] = useState(false);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadStoredAuth();
  }, []);

  const loadStoredAuth = async () => {
    try {
      const storedUserInfo = await AsyncStorage.getItem('userInfo');
      if (storedUserInfo) {
        const parsed = JSON.parse(storedUserInfo);
        setBackendToken(parsed.token || null);
        setIsEmailVerified(parsed.emailVerified || false);
        setUserRole(parsed.role || null);
        if (parsed.firstName) {
          setFirebaseUser({ email: parsed.email });
        }
      }
    } catch (error) {
      console.error('Error loading stored auth:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const login = useCallback(async (email: string, password: string) => {
    // This is handled by LoginScreen through Firebase + backend
    // This function is for non-Firebase login if needed
    throw new Error('Use Firebase login flow');
  }, []);

  const logout = useCallback(async () => {
    await AsyncStorage.removeItem('userInfo');
    setBackendToken(null);
    setFirebaseUser(null);
    setIsEmailVerified(false);
    setUserRole(null);
  }, []);

  const updateUser = useCallback(async (userData: Partial<AuthInfo>) => {
    try {
      const currentUserInfo = await AsyncStorage.getItem('userInfo');
      const userInfo = currentUserInfo ? JSON.parse(currentUserInfo) : {};
      const updated = { ...userInfo, ...userData };
      await AsyncStorage.setItem('userInfo', JSON.stringify(updated));
      
      if (userData.role) {
        setUserRole(userData.role as UserRole);
      }
    } catch (error) {
      console.error('Error updating user info in AsyncStorage:', error);
    }
  }, []);

  const updateBackendToken = useCallback(async (token: string, emailVerifiedStatus: boolean) => {
    const currentUserInfo = await AsyncStorage.getItem('userInfo');
    const userInfo = currentUserInfo ? JSON.parse(currentUserInfo) : {};
    userInfo.token = token;
    userInfo.emailVerified = emailVerifiedStatus;
    await AsyncStorage.setItem('userInfo', JSON.stringify(userInfo));
    setBackendToken(token);
    setIsEmailVerified(emailVerifiedStatus);
    if (userInfo.role) {
      setUserRole(userInfo.role as UserRole);
    }
  }, []);

  const isAuthenticated = !!backendToken;

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        backendToken,
        isEmailVerified,
        isLoading,
        isAuthenticated,
        userRole,
        login,
        logout,
        updateUser,
        updateBackendToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
