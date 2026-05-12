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
  const { isAuthenticated, userId } = useAuth();
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
        const data = await apiClient.getNotifications();
        let notifs = Array.isArray(data) ? data : [];
        try {
          const convos = await apiClient.fetchConversations();
          const unreadConvos = (convos || []).filter((c: any) => c.unreadCount > 0);
          const count = unreadConvos.reduce((sum: number, c: any) => sum + (c.unreadCount || 0), 0);
          setUnreadMessagesCount(count);
          const syntheticNotifs = unreadConvos.map((c: any) => {
            const otherParticipant = (c.participants || []).find((p: any) => p._id !== userId);
            const name = otherParticipant ? (otherParticipant.businessName || otherParticipant.companyName || `${otherParticipant.firstName || ''} ${otherParticipant.lastName || ''}`.trim() || 'Someone') : 'Someone';
            return {
              _id: `msg-notif-${c.conversationId}`,
              type: 'new_message',
              message: `New message from ${name}`,
              read: false,
              createdAt: c.lastMessage?.createdAt || new Date().toISOString(),
              link: `/messages/${c.conversationId}`,
              sender: otherParticipant,
            } as any;
          });
          notifs = notifs.filter(n => !(n.type === 'new_message' && n.link && syntheticNotifs.some(sn => sn.link === n.link)));
          notifs = [...syntheticNotifs, ...notifs].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        } catch {
          }
        setNotifications(notifs);
        const unread = notifs.filter((n: Notification) => !n.read).length;
        await AsyncStorage.setItem('unreadNotifications', unread.toString());
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load notifications');
      } finally {
        setIsLoading(false);
      }
    };
  }, [isAuthenticated, userId]);

  // Auto-refresh on socket events
  useEffect(() => {
    if (!isAuthenticated) return;

    const handleNewNotification = () => {
      refreshRef.current?.();
    };
    const handleNewMessage = () => {
      refreshRef.current?.();
    };
    const handleMessageRead = () => {
      refreshRef.current?.();
    };

    apiClient.onNewNotification(handleNewNotification);
    apiClient.onNewMessage(handleNewMessage);
    apiClient.onMessageRead(handleMessageRead);

    return () => {
      apiClient.offNewNotification(handleNewNotification);
      apiClient.offNewMessage(handleNewMessage);
      apiClient.offMessageRead(handleMessageRead);
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
      if (!id.startsWith('msg-notif-')) {
        await apiClient.markNotificationRead(id);
      } else {
        // It's a synthetic message notification, mark the conversation as read
        const conversationId = id.replace('msg-notif-', '');
        await apiClient.markConversationAsRead(conversationId);
      }
      
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
      setUnreadMessagesCount(0);
    } catch {
      /* non-critical */
    }
  }, []);

  const toggleRead = useCallback(async (id: string) => {
    try {
      const notification = notifications.find(n => n._id === id);
      const newReadState = !(notification?.read ?? true);

      if (newReadState) {
        if (!id.startsWith('msg-notif-')) {
          await apiClient.markNotificationRead(id);
        } else {
          const conversationId = id.replace('msg-notif-', '');
          await apiClient.markConversationAsRead(conversationId);
        }
      } else {
        if (!id.startsWith('msg-notif-')) {
          await apiClient.markNotificationUnread?.(id);
        }
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
      if (!id.startsWith('msg-notif-')) {
        await apiClient.deleteNotification(id);
      }
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

  // Clear badge on logout
  useEffect(() => {
    if (!isAuthenticated) {
      Notifications.setBadgeCountAsync(0).catch(() => {});
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

export const useNotifications = () => {
  const context = useContext(NotificationsContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationsProvider');
  }
  return context;
};
