import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useAuth } from './AuthContext';
import { Notification } from '../types';
import * as apiClient from '../utils/apiClient';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface NotificationsContextType {
  notifications: Notification[];
  unreadCount: number;
  unreadMessagesCount: number;
  isLoading: boolean;
  error: string | null;
  refreshNotifications: () => Promise<void>;
  refreshUnreadMessagesCount: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  toggleRead: (id: string) => Promise<void>;
  deleteNotification: (id: string) => Promise<void>;
}

const NotificationsContext = createContext<NotificationsContextType | undefined>(undefined);

export const NotificationsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const refreshRef = useRef<(() => Promise<void>) | null>(null);

  // Keep refreshRef updated so socket callbacks always call the latest version
  useEffect(() => {
    refreshRef.current = async () => {
      if (!isAuthenticated) return;
      setIsLoading(true);
      setError(null);
      try {
        const [notifData, convos] = await Promise.all([
          apiClient.getNotifications().catch(() => []),
          apiClient.fetchConversations().catch(() => [])
        ]);

        const notifs: Notification[] = Array.isArray(notifData) ? notifData : ((notifData as any)?.notifications || []);
        const unreadConvos = (convos || []).filter((c: any) => c.unreadCount > 0);
        const msgCount = unreadConvos.reduce((sum: number, c: any) => sum + (c.unreadCount || 0), 0);
        
        setUnreadMessagesCount(msgCount);
        setNotifications(notifs);

        const unread = notifs.filter((n: Notification) => !n.read).length;
        await AsyncStorage.setItem('unreadNotifications', unread.toString());
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load notifications');
      } finally {
        setIsLoading(false);
      }
    };
  }, [isAuthenticated]);

  // Auto-refresh on socket events
  useEffect(() => {
    if (!isAuthenticated) return;

    const handleNewNotification = () => {
      refreshRef.current?.();
    };
    const handleNewMessage = () => {
      refreshUnreadMessagesCount();
    };
    const handleMessageRead = () => {
      refreshUnreadMessagesCount();
    };
    const handleNotificationRead = (data: { id: string }) => {
      if (data?.id) {
        setNotifications(prev => {
          const updated = prev.map(n => n._id === data.id ? { ...n, read: true } : n);
          const unread = updated.filter(n => !n.read).length;
          AsyncStorage.setItem('unreadNotifications', unread.toString());
          return updated;
        });
      }
    };
    const handleNotificationUnread = (data: { id: string }) => {
      if (data?.id) {
        setNotifications(prev => {
          const updated = prev.map(n => n._id === data.id ? { ...n, read: false } : n);
          const unread = updated.filter(n => !n.read).length;
          AsyncStorage.setItem('unreadNotifications', unread.toString());
          return updated;
        });
      }
    };
    const handleNotificationsAllRead = () => {
      setNotifications(prev => {
        const updated = prev.map(n => ({ ...n, read: true }));
        AsyncStorage.setItem('unreadNotifications', '0');
        return updated;
      });
    };
    const handleNotificationDeleted = (data: { id: string }) => {
      if (data?.id) {
        setNotifications(prev => {
          const updated = prev.filter(n => n._id !== data.id);
          const unread = updated.filter(n => !n.read).length;
          AsyncStorage.setItem('unreadNotifications', unread.toString());
          return updated;
        });
      }
    };

    apiClient.onNewNotification(handleNewNotification);
    apiClient.onNewMessage(handleNewMessage);
    apiClient.onMessageRead(handleMessageRead);
    apiClient.onNotificationRead(handleNotificationRead);
    apiClient.onNotificationUnread(handleNotificationUnread);
    apiClient.onNotificationsAllRead(handleNotificationsAllRead);
    apiClient.onNotificationDeleted(handleNotificationDeleted);

    return () => {
      apiClient.offNewNotification(handleNewNotification);
      apiClient.offNewMessage(handleNewMessage);
      apiClient.offMessageRead(handleMessageRead);
      apiClient.offNotificationRead(handleNotificationRead);
      apiClient.offNotificationUnread(handleNotificationUnread);
      apiClient.offNotificationsAllRead(handleNotificationsAllRead);
      apiClient.offNotificationDeleted(handleNotificationDeleted);
    };
  }, [isAuthenticated]);

  // Refresh notifications when app comes back to foreground
  useEffect(() => {
    if (!isAuthenticated) return;
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        refreshRef.current?.();
      }
    });
    return () => { subscription.remove(); };
  }, [isAuthenticated]);

  // Initial fetch when user authenticates
  useEffect(() => {
    if (isAuthenticated) {
      refreshRef.current?.();
    }
  }, [isAuthenticated]);

  const refreshNotifications = useCallback(async () => {
    return refreshRef.current?.();
  }, []);

  const refreshUnreadMessagesCount = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const convos = await apiClient.fetchConversations();
      const count = (convos || []).reduce((sum: number, c: any) => sum + (c.unreadCount || 0), 0);
      setUnreadMessagesCount(count);
    } catch {
      /* non-critical */
    }
  }, [isAuthenticated]);

  const markAsRead = useCallback(async (id: string) => {
    try {
      await apiClient.markNotificationRead(id);
      setNotifications(prev => {
        const updated = prev.map(n => n._id === id ? { ...n, read: true } : n);
        const unread = updated.filter((n: Notification) => !n.read).length;
        AsyncStorage.setItem('unreadNotifications', unread.toString());
        return updated;
      });
    } catch {
      /* non-critical */
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    try {
      await apiClient.markAllNotificationsRead();
      setNotifications(prev => {
        const updated = prev.map(n => ({ ...n, read: true }));
        AsyncStorage.setItem('unreadNotifications', '0');
        return updated;
      });
    } catch {
      /* non-critical */
    }
  }, []);

  const toggleRead = useCallback(async (id: string) => {
    try {
      const notification = notifications.find(n => n._id === id);
      const newReadState = !(notification?.read ?? true);

      if (newReadState) {
        await apiClient.markNotificationRead(id);
      } else {
        await apiClient.markNotificationUnread(id);
      }

      setNotifications(prev => {
        const updated = prev.map(n => n._id === id ? { ...n, read: newReadState } : n);
        const unread = updated.filter((n: Notification) => !n.read).length;
        AsyncStorage.setItem('unreadNotifications', unread.toString());
        return updated;
      });
    } catch {
      /* non-critical */
    }
  }, [notifications]);

  const deleteNotification = useCallback(async (id: string) => {
    try {
      await apiClient.deleteNotification(id);
      setNotifications(prev => {
        const updated = prev.filter(n => n._id !== id);
        const unread = updated.filter((n: Notification) => !n.read).length;
        AsyncStorage.setItem('unreadNotifications', unread.toString());
        return updated;
      });
    } catch {
      /* non-critical */
    }
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  // Sync app icon badge with unread count
  useEffect(() => {
    Notifications.setBadgeCountAsync(isAuthenticated ? unreadCount : 0).catch(() => {});
  }, [unreadCount, isAuthenticated]);

  // Clear badge and context state on logout
  useEffect(() => {
    if (!isAuthenticated) {
      Notifications.setBadgeCountAsync(0).catch(() => {});
      setNotifications([]);
      setUnreadMessagesCount(0);
      setIsLoading(false);
      setError(null);
    }
  }, [isAuthenticated]);

  return (
    <NotificationsContext.Provider
      value={{
        notifications,
        unreadCount,
        unreadMessagesCount,
        isLoading,
        error,
        refreshNotifications,
        refreshUnreadMessagesCount,
        markAsRead,
        markAllAsRead,
        toggleRead,
        deleteNotification,
      }}
    >
      {children}
    </NotificationsContext.Provider>
  );
};

export const useNotifications = (): NotificationsContextType => {
  const context = useContext(NotificationsContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationsProvider');
  }
  return context;
};
