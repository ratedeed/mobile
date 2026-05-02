import React, { useCallback, useState } from 'react';
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
import { useNotifications } from '../context/NotificationsContext';
import { useNavigation, useFocusEffect } from '@react-navigation/native';

const NotificationsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { 
    notifications, 
    unreadCount, 
    isLoading, 
    refreshNotifications, 
    markAsRead, 
    markAllAsRead, 
    deleteNotification 
  } = useNotifications();
  
  const [refreshing, setRefreshing] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  // Auto-refresh when the tab comes into focus
  useFocusEffect(
    useCallback(() => {
      let isMounted = true;
      refreshNotifications().finally(() => {
        if (isMounted) setIsInitialLoad(false);
      });
      return () => { isMounted = false; };
    }, [refreshNotifications])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshNotifications();
    setRefreshing(false);
  }, [refreshNotifications]);

  const handleNotificationPress = async (item: any) => {
    if (!item.read) {
      await markAsRead(item._id);
    }

    if (!item.link) return;

    if (item.link.startsWith('/messages/')) {
      const conversationId = item.link.split('/')[2];
      navigation.navigate('ChatScreen', { conversationId });
    } else if (item.link.startsWith('/leads/')) {
      navigation.navigate('ContractorDashboard');
    } else if (item.link.startsWith('/quotes/')) {
      navigation.navigate('Jobs');
    } else if (item.link.startsWith('/jobs/')) {
      navigation.navigate('Jobs');
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const mins = Math.floor(diff / 60000);
    
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getNotificationIcon = (type: string, message: string) => {
    const m = (message || '').toLowerCase();
    if (type === 'new_review' || m.includes('review')) return { name: 'star', color: '#f59e0b', bg: '#fef3c7' };
    if (type === 'new_message' || m.includes('message')) return { name: 'comment', color: '#3b82f6', bg: '#dbeafe' };
    if (m.includes('quote') || m.includes('payment')) return { name: 'dollar-sign', color: '#10b981', bg: '#d1fae5' };
    if (type === 'new_lead' || m.includes('lead') || m.includes('project')) return { name: 'briefcase', color: '#8b5cf6', bg: '#ede9fe' };
    return { name: 'bell', color: '#4F46E5', bg: '#eef2ff' };
  };

  const renderNotification = ({ item }: { item: any }) => {
    const icon = getNotificationIcon(item.type, item.message);
    return (
      <Pressable
        onPress={() => handleNotificationPress(item)}
        onLongPress={() => {
          Alert.alert('Notification Actions', '', [
            { text: 'Delete', style: 'destructive', onPress: () => deleteNotification(item._id) },
            { text: 'Cancel', style: 'cancel' },
          ]);
        }}
        className={`flex-row items-start px-4 py-4 ${!item.read ? 'bg-indigo-50/40 dark:bg-indigo-900/10' : 'bg-white dark:bg-neutral-950'} border-b border-neutral-100 dark:border-neutral-800`}
        style={{ gap: 14 }}
      >
        <View className="w-10 h-10 rounded-full items-center justify-center shrink-0 mt-0.5" style={{ backgroundColor: icon.bg }}>
          <FontAwesome5 name={icon.name as any} size={15} color={icon.color} />
        </View>
        <View className="flex-1">
          <Text className={`text-[14px] leading-5 ${!item.read ? 'font-bold text-neutral-900 dark:text-neutral-50' : 'text-neutral-700 dark:text-neutral-300'}`}>
            {item.message}
          </Text>
          <Text className="text-[12px] text-neutral-400 mt-1.5 font-medium">{formatDate(item.createdAt)}</Text>
        </View>
        {!item.read && <View className="w-2 h-2 rounded-full bg-indigo-500 shrink-0 mt-2" />}
      </Pressable>
    );
  };

  // Only show the full-screen spinner if we are loading AND have zero notifications to show (initial load)
  if (isLoading && isInitialLoad && notifications.length === 0) {
    return (
      <View className="flex-1 bg-white dark:bg-neutral-950 items-center justify-center">
        <ActivityIndicator size="small" color="#6366f1" />
        <Text className="text-sm text-neutral-400 mt-3 font-medium">Updating notifications...</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-white dark:bg-neutral-950">
      {/* Header */}
      <View className="px-5 pt-5 pb-3 flex-row items-center justify-between border-b border-neutral-50 dark:border-neutral-900">
        <View>
          <Text className="text-2xl font-bold text-neutral-900 dark:text-neutral-50">Notifications</Text>
          <Text className="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5 font-medium">
            {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up!'}
          </Text>
        </View>
        {unreadCount > 0 && (
          <Pressable 
            onPress={markAllAsRead}
            className="bg-indigo-50 dark:bg-indigo-900/30 px-3 py-1.5 rounded-full"
          >
            <Text className="text-xs font-bold text-indigo-600 dark:text-indigo-400">Mark all read</Text>
          </Pressable>
        )}
      </View>

      {notifications.length === 0 ? (
        <View className="flex-1 items-center justify-center px-10">
          <View className="w-20 h-20 bg-neutral-50 dark:bg-neutral-900 rounded-full items-center justify-center mb-6">
            <FontAwesome5 name="bell" size={32} color="#e5e5e5" />
          </View>
          <Text className="text-xl font-bold text-neutral-900 dark:text-neutral-50">Stay updated</Text>
          <Text className="text-sm text-neutral-500 dark:text-neutral-400 mt-2 text-center leading-5">
            When you receive messages, leads, or updates, they'll appear here for quick access.
          </Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          renderItem={renderNotification}
          keyExtractor={(item, index) => item._id || `notif-${index}`}
          contentContainerStyle={{ paddingBottom: 20 }}
          refreshControl={
            <RefreshControl 
              refreshing={refreshing} 
              onRefresh={onRefresh}
              tintColor="#6366f1"
              colors={['#6366f1']}
            />
          }
        />
      )}
    </View>
  );
};

export default NotificationsScreen;
