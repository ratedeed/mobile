import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  FlatList,
  Pressable,
  Text,
  RefreshControl,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { getNotifications, markNotificationRead, markAllNotificationsRead, deleteNotification } from '../api';

const NotificationsScreen: React.FC = () => {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadNotifications = useCallback(async () => {
    try {
      const data = await getNotifications();
      setNotifications(data || []);
    } catch (err) {
      console.error('Failed to load notifications:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadNotifications(); }, [loadNotifications]);

  const onRefresh = useCallback(() => { setRefreshing(true); loadNotifications(); }, [loadNotifications]);

  const handleMarkAsRead = async (id: string) => {
    try {
      await markNotificationRead(id);
      setNotifications(prev => prev.map(n => (n._id === id ? { ...n, read: true } : n)));
    } catch { Alert.alert('Error', 'Failed to mark as read'); }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await markAllNotificationsRead();
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    } catch { Alert.alert('Error', 'Failed to mark all as read'); }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteNotification(id);
      setNotifications(prev => prev.filter(n => n._id !== id));
    } catch { Alert.alert('Error', 'Failed to delete'); }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getNotificationIcon = (message: string) => {
    const m = message.toLowerCase();
    if (m.includes('review') || m.includes('rating')) return { name: 'star', color: '#f59e0b', bg: '#fef3c7' };
    if (m.includes('message') || m.includes('chat')) return { name: 'comment', color: '#3b82f6', bg: '#dbeafe' };
    if (m.includes('quote') || m.includes('payment')) return { name: 'dollar-sign', color: '#10b981', bg: '#d1fae5' };
    if (m.includes('job') || m.includes('project')) return { name: 'briefcase', color: '#8b5cf6', bg: '#ede9fe' };
    return { name: 'bell', color: '#4F46E5', bg: '#eef2ff' };
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  if (loading) {
    return (
      <View className="flex-1 bg-white dark:bg-neutral-950 items-center justify-center">
        <ActivityIndicator size="large" color="#a3a3a3" />
        <Text className="text-sm text-neutral-400 mt-3">Loading notifications...</Text>
      </View>
    );
  }

  const renderNotification = ({ item }: { item: any }) => {
    const icon = getNotificationIcon(item.message);
    return (
      <Pressable
        onPress={() => { if (!item.read) handleMarkAsRead(item._id); }}
        onLongPress={() => {
          Alert.alert('Actions', '', [
            { text: 'Mark as Read', onPress: () => handleMarkAsRead(item._id) },
            { text: 'Delete', style: 'destructive', onPress: () => handleDelete(item._id) },
            { text: 'Cancel', style: 'cancel' },
          ]);
        }}
        className={`flex-row items-center px-4 py-3.5 ${!item.read ? 'bg-sky-50 dark:bg-sky-950/40' : 'bg-white dark:bg-neutral-950'} border-b border-neutral-100 dark:border-neutral-800`}
        style={{ gap: 12 }}
      >
        <View className="w-11 h-11 rounded-full items-center justify-center shrink-0" style={{ backgroundColor: icon.bg }}>
          <FontAwesome5 name={icon.name as any} size={16} color={icon.color} />
        </View>
        <View className="flex-1">
          <Text className={`text-sm ${!item.read ? 'font-semibold text-neutral-900 dark:text-neutral-50' : 'text-neutral-600 dark:text-neutral-400'}`} numberOfLines={2}>
            {item.message}
          </Text>
          <Text className="text-xs text-neutral-400 mt-1">{formatDate(item.createdAt)}</Text>
        </View>
        {!item.read && <View className="w-2.5 h-2.5 rounded-full bg-indigo-500 shrink-0" />}
      </Pressable>
    );
  };

  return (
    <View className="flex-1 bg-white dark:bg-neutral-950">
      {/* Header */}
      <View className="px-4 pt-4 pb-2 flex-row items-center justify-between">
        <View>
          <Text className="text-2xl font-bold text-neutral-900 dark:text-neutral-50">Notifications</Text>
          <Text className="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">
            {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up!'}
          </Text>
        </View>
        {unreadCount > 0 && (
          <Pressable onPress={handleMarkAllAsRead}>
            <Text className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">Mark all read</Text>
          </Pressable>
        )}
      </View>

      {notifications.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <View className="w-16 h-16 bg-neutral-100 dark:bg-neutral-800 rounded-full items-center justify-center mb-4">
            <FontAwesome5 name="bell" size={28} color="#d4d4d4" />
          </View>
          <Text className="text-lg font-bold text-neutral-900 dark:text-neutral-50">No notifications</Text>
          <Text className="text-sm text-neutral-500 dark:text-neutral-400 mt-1 text-center">
            You're all caught up! We'll notify you when something new happens.
          </Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          renderItem={renderNotification}
          keyExtractor={item => item._id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        />
      )}
    </View>
  );
};

export default NotificationsScreen;
