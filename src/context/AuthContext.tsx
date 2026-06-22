import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthInfo, UserRole } from '../types';
import { syncFavoritesWithServer } from '../utils/favoritesStore';
import { disconnectSocket, setAuthInvalidatedCallback, logout as apiLogout } from '../utils/apiClient';
import { jwtDecode } from 'jwt-decode';
import { getSecureItem, setSecureItem, removeSecureItem } from '../utils/secureStore';
import { auth } from '../firebaseConfig';
import { signOut, onIdTokenChanged } from 'firebase/auth';

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

const isTokenExpired = (token: string): boolean => {
  try {
    const decoded: any = jwtDecode(token);
    if (!decoded.exp) return false;
    const now = Date.now() / 1000;
    return decoded.exp < now;
  } catch {
    return true;
  }
};

const loadUserData = async (): Promise<any | null> => {
  try {
    const data = await AsyncStorage.getItem(USER_DATA_KEY);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
};

const saveUserData = async (data: any): Promise<void> => {
  try {
    await AsyncStorage.setItem(USER_DATA_KEY, JSON.stringify(data));
  } catch {}
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<any>(null);
  const [backendToken, setBackendToken] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [isEmailVerified, setIsEmailVerified] = useState(false);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadStoredAuth = async () => {
    try {
      const token = await getSecureItem('auth_token');
      if (token) {
        let activeToken = token;
        if (isTokenExpired(token)) {
          try {
            const { refreshTokenIfNeeded } = require('../utils/apiClient');
            await refreshTokenIfNeeded();
            const refreshedToken = await getSecureItem('auth_token');
            if (refreshedToken && !isTokenExpired(refreshedToken)) {
              activeToken = refreshedToken;
            } else {
              throw new Error('Refresh token failed');
            }
          } catch (err: any) {
            const errMsg = err?.message || '';
            if (errMsg.includes('Auth invalidated')) {
              await removeSecureItem('auth_token');
              await removeSecureItem('refresh_token');
              await AsyncStorage.removeItem(USER_DATA_KEY);
              activeToken = '';
            } else {
              activeToken = token;
            }
          }
        }

        if (activeToken) {
          setBackendToken(activeToken);

          let decodedId = null;
          let decodedRole = null;
          let decodedEmailVerified = null;
          try {
            const decodedToken: any = jwtDecode(activeToken);
            decodedId = decodedToken.id || decodedToken._id;
            decodedRole = decodedToken.role;
            decodedEmailVerified = decodedToken.emailVerified;
          } catch {}

          const userData = await loadUserData();
          const finalRole = decodedRole || userData?.role || null;
          const finalEmailVerified = decodedEmailVerified !== undefined && decodedEmailVerified !== null ? decodedEmailVerified : (userData?.emailVerified || false);

          setUserId(userData?._id || userData?.id || decodedId || null);
          setIsEmailVerified(finalEmailVerified);
          setUserRole(finalRole as UserRole);
          if (userData?.firstName) {
            setFirebaseUser({ email: userData.email });
          }

          if (userData && (userData.role !== finalRole || userData.emailVerified !== finalEmailVerified)) {
            await saveUserData({
              ...userData,
              role: finalRole,
              emailVerified: finalEmailVerified,
            });
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
      await apiLogout();
    } catch {}

    try {
      if (auth && auth.app) {
        await signOut(auth);
      }
    } catch (e) {
      if (__DEV__) console.warn('Firebase signOut failed:', e);
    }

    setBackendToken(null);
    setUserId(null);
    setFirebaseUser(null);
    setIsEmailVerified(false);
    setUserRole(null);
  }, []);

  const updateBackendToken = useCallback(async (token: string, emailVerifiedStatus: boolean, userData?: any) => {
    if (token) {
      await setSecureItem('auth_token', token);
      const { updateSocketToken } = require('../utils/apiClient');
      updateSocketToken(token);
    }

    const currentData = await loadUserData() || {};
    const mergedData = { ...currentData, ...userData, emailVerified: emailVerifiedStatus };

    if (userData?.refreshToken) {
      await setSecureItem('refresh_token', userData.refreshToken);
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

  useEffect(() => {
    loadStoredAuth();
    setAuthInvalidatedCallback(() => {
      logout();
    });
    const { setAuthTokenUpdatedCallback } = require('../utils/apiClient');
    setAuthTokenUpdatedCallback(async (newToken: string) => {
      setBackendToken(newToken);
      try {
        const decodedToken: any = jwtDecode(newToken);
        const decodedId = decodedToken.id || decodedToken._id;
        const decodedRole = decodedToken.role;
        const decodedEmailVerified = decodedToken.emailVerified;

        if (decodedId) setUserId(decodedId);
        if (decodedRole) setUserRole(decodedRole as UserRole);
        if (decodedEmailVerified !== undefined && decodedEmailVerified !== null) {
          setIsEmailVerified(decodedEmailVerified);
        }

        const current = await loadUserData();
        if (current) {
          const updated = {
            ...current,
            role: decodedRole || current.role,
            emailVerified: decodedEmailVerified !== undefined && decodedEmailVerified !== null ? decodedEmailVerified : current.emailVerified,
          };
          await saveUserData(updated);
        }
      } catch (err) {
        if (__DEV__) console.warn('Syncing token claims failed:', err);
      }
    });
  }, [logout]);

  // Listen for Firebase Auth changes to automatically sync email address changes on mobile
  useEffect(() => {
    if (!auth || !auth.app || auth.app.name === '[MockApp]') return;
    let hasReloadedFirebaseUser = false;
    const unsubscribe = onIdTokenChanged(auth, async (fUser) => {
      if (fUser) {
        // Force reload exactly once per session/listener setup to pull fresh status from Firebase servers
        if (!hasReloadedFirebaseUser) {
          hasReloadedFirebaseUser = true;
          try {
            await fUser.reload();
          } catch (e) {
            if (__DEV__) console.warn('Initial Firebase reload failed on mobile:', e);
          }
        }

        if (fUser.email) {
          setFirebaseUser(fUser);
          const currentData = await loadUserData();
          if (currentData) {
            const normalizedFirebaseEmail = fUser.email.toLowerCase().trim();
            const normalizedStoreEmail = currentData.email?.toLowerCase().trim();

            if (normalizedStoreEmail && normalizedStoreEmail !== normalizedFirebaseEmail) {
              if (__DEV__) console.log('Firebase email mismatch detected on mobile. Syncing with backend...');
              try {
                const idToken = await fUser.getIdToken(true);
                const { backendLoginFirebase } = require('../utils/apiClient');
                const syncRes = await backendLoginFirebase(idToken, fUser.email);
                if (syncRes && syncRes.token) {
                  const { token, refreshToken, socketToken, ...userData } = syncRes;
                  await updateBackendToken(syncRes.token, syncRes.emailVerified, userData);
                  if (__DEV__) console.log('Successfully synced mobile email updates to backend.');
                }
              } catch (syncErr) {
                if (__DEV__) console.warn('Failed to sync Firebase email update on mobile:', syncErr);
              }
            }
          }
        }
      } else {
        setFirebaseUser(null);
      }
    });

    return unsubscribe;
  }, [updateBackendToken]);

  // Reload Firebase Auth current user when app becomes active to catch email changes verified in background
  useEffect(() => {
    const handleAppStateChange = async (nextAppState: string) => {
      if (nextAppState === 'active') {
        try {
          if (auth && auth.currentUser) {
            if (__DEV__) console.log('App focused/active. Reloading Firebase Auth user profile...');
            await auth.currentUser.reload();
          }
        } catch (err) {
          if (__DEV__) console.warn('Failed to reload Firebase user on app focus:', err);
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    // Run once on load as well
    handleAppStateChange('active');

    return () => {
      subscription.remove();
    };
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