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
      let notifs = Array.isArray(data) ? data : [];

      try {
        const convos = await apiClient.fetchConversations();
        const unreadConvos = convos.filter((c: any) => c.unreadCount > 0);
        
        // Update unread messages count while we have the data
        const count = unreadConvos.reduce((sum: number, c: any) => sum + (c.unreadCount || 0), 0);
        setUnreadMessagesCount(count);

        // Synthesize notifications for unread conversations
        const syntheticNotifs = unreadConvos.map((c: any) => {
          const otherParticipant = c.participants.find((p: any) => p._id !== userId);
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

        console.log(`NotificationsContext: synthesized ${syntheticNotifs.length} notifications from unread convos`, JSON.stringify(syntheticNotifs));

        // Filter out any real notifications that might duplicate these (just in case backend does send them)
        notifs = notifs.filter(n => !(n.type === 'new_message' && n.link && syntheticNotifs.some(sn => sn.link === n.link)));
        
        // Combine and sort by date
        notifs = [...syntheticNotifs, ...notifs].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        console.log(`NotificationsContext: final notifications array length: ${notifs.length}`);
      } catch (convErr) {
        console.error('Error fetching conversations for notifications:', convErr);
      }

      setNotifications(notifs);
      const unread = notifs.filter((n: Notification) => !n.read).length;
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

      // Stable listener functions
      const handleNewNotification = (notification: Notification) => {
        console.log('NotificationsContext: Socket received newNotification:', notification);
        setNotifications(prev => {
          // Prevent duplicates
          if (prev.find(n => n._id === notification._id)) return prev;
          const newNotifications = [notification, ...prev].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          const newCount = newNotifications.filter((n: Notification) => !n.read).length;
          AsyncStorage.setItem('unreadNotifications', newCount.toString());
          return newNotifications;
        });
      };

      const handleNewMessage = (message: any) => {
        console.log('NotificationsContext: Socket received newMessage, refreshing notifications to synthesize bell items');
        refreshNotifications();
      };

      const setupSocketListeners = async () => {
        if (userId) {
          await apiClient.registerSocket(userId);
        }
        apiClient.onNewNotification(handleNewNotification);
        apiClient.onNewMessage(handleNewMessage);
      };

      setupSocketListeners();
    }

    return () => {
      apiClient.offNewNotification();
      apiClient.offNewMessage();
    };
  }, [isAuthenticated, userId]);

  const markAsRead = async (id: string) => {
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
    } catch (error) {
      console.error('Error marking notification read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await apiClient.markAllNotificationsRead();
      // We should also theoretically mark all conversations as read, but that's complex
      // For now, we'll optimistically update the UI
      setNotifications(prev => {
        const updated = prev.map(n => ({ ...n, read: true }));
        AsyncStorage.setItem('unreadNotifications', '0');
        return updated;
      });
      setUnreadMessagesCount(0);
    } catch (error) {
      console.error('Error marking all notifications read:', error);
    }
  };

  const deleteNotification = async (id: string) => {
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
