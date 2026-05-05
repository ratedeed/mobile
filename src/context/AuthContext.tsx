import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { AuthInfo, UserRole } from '../types';
import { syncFavoritesWithServer } from '../utils/favoritesStore';

import { jwtDecode } from 'jwt-decode';

interface AuthContextType {
  firebaseUser: any;
  backendToken: string | null;
  userId: string | null;
  isEmailVerified: boolean;
  isLoading: boolean;
  isAuthenticated: boolean;
  userRole: UserRole | null;
  login: (email: string, password: string) => Promise<any>;
  logout: () => void;
  updateUser: (userData: Partial<AuthInfo>) => void;
  updateBackendToken: (token: string, emailVerifiedStatus: boolean, userData?: any) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const USER_DATA_KEY = 'ratedeed-user-data';

const saveUserData = async (data: Record<string, any>) => {
  await AsyncStorage.setItem(USER_DATA_KEY, JSON.stringify(data));
};

const loadUserData = async (): Promise<Record<string, any> | null> => {
  const raw = await AsyncStorage.getItem(USER_DATA_KEY);
  return raw ? JSON.parse(raw) : null;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<any>(null);
  const [backendToken, setBackendToken] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [isEmailVerified, setIsEmailVerified] = useState(false);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadStoredAuth();
  }, []);

  const loadStoredAuth = async () => {
    try {
      const token = await SecureStore.getItemAsync('auth_token');
      if (token) {
        setBackendToken(token);

        let decodedId = null;
        try {
          const decodedToken: any = jwtDecode(token);
          decodedId = decodedToken.id || decodedToken._id;
        } catch {
          /* token decode failure is non-critical */
        }

        const userData = await loadUserData();
        setUserId(userData?._id || userData?.id || decodedId || null);
        setIsEmailVerified(userData?.emailVerified || false);
        setUserRole(userData?.role || null);
        if (userData?.firstName) {
          setFirebaseUser({ email: userData.email });
        }

        syncFavoritesWithServer();
      }
    } catch {
      /* non-critical */
    } finally {
      setIsLoading(false);
    }
  };

  const login = useCallback(async (email: string, password: string) => {
    throw new Error('Use Firebase login flow');
  }, []);

  const logout = useCallback(async () => {
    await SecureStore.deleteItemAsync('auth_token');
    await SecureStore.deleteItemAsync('refresh_token');
    await AsyncStorage.removeItem(USER_DATA_KEY);
    await AsyncStorage.removeItem('ratedeed-current-user');
    setBackendToken(null);
    setUserId(null);
    setFirebaseUser(null);
    setIsEmailVerified(false);
    setUserRole(null);
  }, []);

  const updateUser = useCallback(async (userData: Partial<AuthInfo>) => {
    try {
      const current = await loadUserData() || {};
      const updated = { ...current, ...userData };
      await saveUserData(updated);

      if (userData.role) {
        setUserRole(userData.role as UserRole);
      }
      if (updated._id || updated.id) {
        setUserId(updated._id || updated.id || null);
      }
    } catch {
      /* non-critical */
    }
  }, []);

  const updateBackendToken = useCallback(async (token: string, emailVerifiedStatus: boolean, userData?: any) => {
    if (token) {
      await SecureStore.setItemAsync('auth_token', token);
    }

    const currentData = await loadUserData() || {};
    const mergedData = { ...currentData, ...userData, emailVerified: emailVerifiedStatus };

    if (userData?.refreshToken) {
      await SecureStore.setItemAsync('refresh_token', userData.refreshToken);
      delete mergedData.refreshToken;
    }
    delete mergedData.token;

    await saveUserData(mergedData);

    let decodedId = null;
    if (token) {
      try {
        const decodedToken: any = jwtDecode(token);
        decodedId = decodedToken.id || decodedToken._id;
      } catch {
        /* token decode failure is non-critical */
      }
    }

    setBackendToken(token);
    setIsEmailVerified(emailVerifiedStatus);
    if (mergedData._id || mergedData.id || decodedId) {
      setUserId((mergedData._id || mergedData.id || decodedId) ?? null);
    }
    if (mergedData.role) {
      setUserRole(mergedData.role as UserRole);
    }
    syncFavoritesWithServer();
  }, []);

  const isAuthenticated = !!backendToken;

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        backendToken,
        userId,
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