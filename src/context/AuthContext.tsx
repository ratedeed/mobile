import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthInfo, UserRole } from '../types';
import { syncFavoritesWithServer } from '../utils/favoritesStore';
import { disconnectSocket } from '../utils/apiClient';
import { jwtDecode } from 'jwt-decode';

const USER_DATA_KEY = 'ratedeed-user-data';

interface AuthContextType {
  firebaseUser: any;
  backendToken: string | null;
  userId: string | null;
  isEmailVerified: boolean;
  isLoading: boolean;
  isAuthenticated: boolean;
  userRole: UserRole | null;
  login: (email: string, password: string) => Promise<any>;
  logout: () => Promise<void>;
  updateUser: (userData: Partial<AuthInfo>) => void;
  updateBackendToken: (token: string, emailVerifiedStatus: boolean, userData?: any) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const saveUserData = async (data: Record<string, any>) => {
  await AsyncStorage.setItem(USER_DATA_KEY, JSON.stringify(data));
};

const loadUserData = async (): Promise<Record<string, any> | null> => {
  try {
    const raw = await AsyncStorage.getItem(USER_DATA_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const isTokenExpired = (token: string): boolean => {
  try {
    const decoded: any = jwtDecode(token);
    if (decoded.exp) {
      return Date.now() >= decoded.exp * 1000;
    }
    return false;
  } catch {
    return true;
  }
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
      const token = await AsyncStorage.getItem('auth_token');
      if (token) {
        if (isTokenExpired(token)) {
          await AsyncStorage.removeItem('auth_token');
          await AsyncStorage.removeItem('refresh_token');
          await AsyncStorage.removeItem(USER_DATA_KEY);
        } else {
          setBackendToken(token);

          let decodedId = null;
          try {
            const decodedToken: any = jwtDecode(token);
            decodedId = decodedToken.id || decodedToken._id;
          } catch {}

          const userData = await loadUserData();
          setUserId(userData?._id || userData?.id || decodedId || null);
          setIsEmailVerified(userData?.emailVerified || false);
          setUserRole(userData?.role || null);
          if (userData?.firstName) {
            setFirebaseUser({ email: userData.email });
          }

          syncFavoritesWithServer();
        }
      }
    } catch {
    } finally {
      setIsLoading(false);
    }
  };

  const login = useCallback(async (email: string, password: string) => {
    throw new Error('Use Firebase login flow');
  }, []);

  const logout = useCallback(async () => {
    try {
      disconnectSocket();
    } catch {}

    try {
      await AsyncStorage.removeItem('auth_token');
    } catch {}
    try {
      await AsyncStorage.removeItem('refresh_token');
    } catch {}
    try {
      await AsyncStorage.removeItem(USER_DATA_KEY);
    } catch {}

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
    } catch {}
  }, []);

  const updateBackendToken = useCallback(async (token: string, emailVerifiedStatus: boolean, userData?: any) => {
    if (token) {
      await AsyncStorage.setItem('auth_token', token);
    }

    const currentData = await loadUserData() || {};
    const mergedData = { ...currentData, ...userData, emailVerified: emailVerifiedStatus };

    if (userData?.refreshToken) {
      await AsyncStorage.setItem('refresh_token', userData.refreshToken);
      delete mergedData.refreshToken;
    }
    delete mergedData.token;

    await saveUserData(mergedData);

    let decodedId = null;
    if (token) {
      try {
        const decodedToken: any = jwtDecode(token);
        decodedId = decodedToken.id || decodedToken._id;
      } catch {}
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