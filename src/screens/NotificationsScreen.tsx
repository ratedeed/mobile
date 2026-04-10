import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Text,
  RefreshControl,
  Alert,
} from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { AppHeader } from '../components/layout/AppHeader';
import { SkeletonLoader } from '../components/common/SkeletonLoader';
import { EmptyState } from '../components/common/EmptyState';
import { ErrorState } from '../components/common/ErrorState';
import Typography from '../components/common/Typography';
import { Spacing, Colors, Radii } from '../constants/designTokens';
import { getNotifications, markNotificationRead, markAllNotificationsRead, deleteNotification } from '../api/notification';
import { Notification } from '../types';

const NotificationsScreen: React.FC = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadNotifications = useCallback(async () => {
    try {
      setError(null);
      const data = await getNotifications();
      setNotifications(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load notifications');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadNotifications();
  }, [loadNotifications]);

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      await markNotificationRead(notificationId);
      setNotifications(prev =>
        prev.map(n => (n._id === notificationId ? { ...n, read: true } : n))
      );
    } catch (err) {
      Alert.alert('Error', 'Failed to mark notification as read');
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await markAllNotificationsRead();
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    } catch (err) {
      Alert.alert('Error', 'Failed to mark all as read');
    }
  };

  const handleDelete = async (notificationId: string) => {
    try {
      await deleteNotification(notificationId);
      setNotifications(prev => prev.filter(n => n._id !== notificationId));
    } catch (err) {
      Alert.alert('Error', 'Failed to delete notification');
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getNotificationIcon = (message: string): { name: string; color: string } => {
    const lowerMsg = message.toLowerCase();
    if (lowerMsg.includes('review') || lowerMsg.includes('rating')) return { name: 'star', color: '#f59e0b' };
    if (lowerMsg.includes('message') || lowerMsg.includes('chat')) return { name: 'comment', color: '#3b82f6' };
    if (lowerMsg.includes('quote') || lowerMsg.includes('payment')) return { name: 'dollar-sign', color: '#10b981' };
    if (lowerMsg.includes('job') || lowerMsg.includes('project')) return { name: 'briefcase', color: '#8b5cf6' };
    if (lowerMsg.includes('follow')) return { name: 'user-plus', color: '#ec4899' };
    if (lowerMsg.includes('lead') || lowerMsg.includes('inquiry')) return { name: 'envelope', color: '#06b6d4' };
    return { name: 'bell', color: '#4F46E5' };
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  const renderNotification = ({ item }: { item: Notification }) => {
    const icon = getNotificationIcon(item.message);
    return (
      <TouchableOpacity
        style={[styles.notificationItem, !item.read && styles.unreadItem]}
        onPress={() => {
          if (!item.read) {
            handleMarkAsRead(item._id);
          }
        }}
        onLongPress={() => {
          Alert.alert('Notification Actions', '', [
            { text: 'Mark as Read', onPress: () => handleMarkAsRead(item._id) },
            { text: 'Delete', style: 'destructive', onPress: () => handleDelete(item._id) },
            { text: 'Cancel', style: 'cancel' },
          ]);
        }}
      >
        <View style={[styles.iconContainer, { backgroundColor: icon.color + '15' }]}>
          <FontAwesome5 name={icon.name as any} size={18} color={icon.color} />
        </View>
        <View style={styles.contentContainer}>
          <Text style={[styles.message, !item.read && styles.unreadMessage]} numberOfLines={2}>
            {item.message}
          </Text>
          <Text style={styles.timestamp}>{formatDate(item.createdAt)}</Text>
        </View>
        {!item.read && <View style={styles.unreadDot} />}
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.fullScreenContainer}>
        <AppHeader title="Notifications" showBack />
        <View style={styles.loadingContainer}>
          <SkeletonLoader type="list" count={5} />
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.fullScreenContainer}>
        <AppHeader title="Notifications" showBack />
        <ErrorState message={error} onRetry={loadNotifications} />
      </View>
    );
  }

  return (
    <View style={styles.fullScreenContainer}>
      <AppHeader
        title="Notifications"
        showBack
        rightComponent={
          unreadCount > 0 ? (
            <TouchableOpacity onPress={handleMarkAllAsRead}>
              <Text style={styles.markAllText}>Mark all read</Text>
            </TouchableOpacity>
          ) : null
        }
      />
      {notifications.length === 0 ? (
        <EmptyState
          title="No notifications"
          message="You're all caught up! We'll notify you when something new happens."
          icon="🔔"
        />
      ) : (
        <FlatList
          data={notifications}
          renderItem={renderNotification}
          keyExtractor={item => item._id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  fullScreenContainer: {
    flex: 1,
    backgroundColor: Colors.neutral50,
  },
  loadingContainer: {
    flex: 1,
    padding: Spacing.lg,
  },
  listContent: {
    flexGrow: 1,
  },
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.neutral50,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.neutral200,
  },
  unreadItem: {
    backgroundColor: '#f0f9ff',
    borderLeftWidth: 3,
    borderLeftColor: Colors.primary500,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: Radii.round,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  contentContainer: {
    flex: 1,
  },
  message: {
    color: Colors.neutral600,
    fontSize: 15,
    lineHeight: 22,
  },
  unreadMessage: {
    color: Colors.neutral900,
    fontWeight: '600',
  },
  timestamp: {
    color: Colors.neutral400,
    fontSize: 12,
    marginTop: Spacing.xs,
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.primary500,
    marginLeft: Spacing.sm,
  },
  separator: {
    height: 1,
    backgroundColor: Colors.neutral200,
  },
  markAllText: {
    color: Colors.primary500,
    fontSize: 14,
    fontWeight: '600',
  },
});

export default NotificationsScreen;
