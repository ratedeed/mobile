import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { Notification } from '../types';
import * as apiClient from '../utils/apiClient';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface NotificationsContextType {
  notifications: Notification[];
  unreadCount: number;
  unreadMessagesCount: number;
  isLoading: boolean;
  refreshNotifications: () => Promise<void>;
  refreshUnreadMessagesCount: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (id: string) => Promise<void>;
}

const NotificationsContext = createContext<NotificationsContextType | undefined>(undefined);

export const NotificationsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { isAuthenticated, userId } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  const refreshNotifications = async () => {
    if (!isAuthenticated) return;
    setIsLoading(true);
    try {
      const data = await apiClient.getNotifications();
      setNotifications(data);
      const unread = data.filter((n: Notification) => !n.read).length;
      await AsyncStorage.setItem('unreadNotifications', unread.toString());
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshUnreadMessagesCount = async () => {
    if (!isAuthenticated) return;
    try {
      const convos = await apiClient.fetchConversations();
      const count = convos.reduce((sum: number, c: any) => sum + (c.unreadCount || 0), 0);
      setUnreadMessagesCount(count);
    } catch (error) {
      console.error('Error fetching unread messages count:', error);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      refreshNotifications();
      refreshUnreadMessagesCount();

      // Stable listener functions
      const handleNewNotification = (notification: Notification) => {
        console.log('NotificationsContext: Socket received newNotification:', notification);
        setNotifications(prev => {
          // Prevent duplicates
          if (prev.find(n => n._id === notification._id)) return prev;
          const newNotifications = [notification, ...prev];
          // Update AsyncStorage unread count for AppHeader badge
          const newCount = newNotifications.filter((n: Notification) => !n.read).length;
          AsyncStorage.setItem('unreadNotifications', newCount.toString());
          return newNotifications;
        });

        // If it's a message notification, refresh the unread messages count as well
        if (notification.type === 'new_message') {
          refreshUnreadMessagesCount();
        }
      };

      const handleNewMessage = (message: any) => {
        console.log('NotificationsContext: Socket received newMessage for badge update');
        refreshUnreadMessagesCount();
      };

      // Listen for real-time notifications via socket
      apiClient.onNewNotification(handleNewNotification);

      // Listen for real-time messages to update tab badge
      apiClient.onNewMessage(handleNewMessage);
    }

    return () => {
      console.log('NotificationsContext: Cleaning up socket listeners');
      apiClient.offNewNotification();
      apiClient.offNewMessage();
    };
  }, [isAuthenticated]);

  const markAsRead = async (id: string) => {
    try {
      await apiClient.markNotificationRead(id);
      setNotifications(prev => {
        const updated = prev.map(n => n._id === id ? { ...n, read: true } : n);
        const unread = updated.filter((n: Notification) => !n.read).length;
        AsyncStorage.setItem('unreadNotifications', unread.toString());
        return updated;
      });
    } catch (error) {
      console.error('Error marking notification read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await apiClient.markAllNotificationsRead();
      setNotifications(prev => {
        const updated = prev.map(n => ({ ...n, read: true }));
        AsyncStorage.setItem('unreadNotifications', '0');
        return updated;
      });
    } catch (error) {
      console.error('Error marking all notifications read:', error);
    }
  };

  const deleteNotification = async (id: string) => {
    try {
      await apiClient.deleteNotification(id);
      setNotifications(prev => {
        const updated = prev.filter(n => n._id !== id);
        const unread = updated.filter((n: Notification) => !n.read).length;
        AsyncStorage.setItem('unreadNotifications', unread.toString());
        return updated;
      });
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <NotificationsContext.Provider
      value={{
        notifications,
        unreadCount,
        unreadMessagesCount,
        isLoading,
        refreshNotifications,
        refreshUnreadMessagesCount,
        markAsRead,
        markAllAsRead,
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
