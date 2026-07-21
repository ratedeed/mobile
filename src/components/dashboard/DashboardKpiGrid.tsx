import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';

interface DashboardKpiGridProps {
  activeJobsCount: number;
  unreadChatsCount: number;
  quotesCount: number;
  availableBalanceText: string;
  onPressActiveJobs: () => void;
  onPressUnreadChats: () => void;
  onPressQuotes: () => void;
  onPressBalance: () => void;
}

export const DashboardKpiGrid: React.FC<DashboardKpiGridProps> = ({
  activeJobsCount,
  unreadChatsCount,
  quotesCount,
  availableBalanceText,
  onPressActiveJobs,
  onPressUnreadChats,
  onPressQuotes,
  onPressBalance,
}) => {
  return (
    <View className="flex-row flex-wrap" style={{ marginHorizontal: -4 }}>
      <Pressable onPress={onPressActiveJobs} className="w-1/2 p-1">
        <View
          className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-4 flex-col justify-between"
          style={{ minHeight: 90 }}
        >
          <View className="flex-row items-center justify-between">
            <Text className="text-[10px] font-semibold text-neutral-500 uppercase">Active Jobs</Text>
            <FontAwesome5 name="briefcase" size={12} color="#6366f1" />
          </View>
          <Text className="text-2xl font-bold text-neutral-900 dark:text-white mt-2">
            {activeJobsCount}
          </Text>
        </View>
      </Pressable>

      <Pressable onPress={onPressUnreadChats} className="w-1/2 p-1">
        <View
          className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-4 flex-col justify-between"
          style={{ minHeight: 90 }}
        >
          <View className="flex-row items-center justify-between">
            <Text className="text-[10px] font-semibold text-neutral-500 uppercase">Unread Chats</Text>
            <FontAwesome5 name="comment-dots" size={12} color="#10b981" />
          </View>
          <Text className="text-2xl font-bold text-emerald-600 mt-2">
            {unreadChatsCount}
          </Text>
        </View>
      </Pressable>

      <Pressable onPress={onPressQuotes} className="w-1/2 p-1">
        <View
          className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-4 flex-col justify-between"
          style={{ minHeight: 90 }}
        >
          <View className="flex-row items-center justify-between">
            <Text className="text-[10px] font-semibold text-neutral-500 uppercase">Quotes Sent</Text>
            <FontAwesome5 name="file-invoice-dollar" size={12} color="#f59e0b" />
          </View>
          <Text className="text-2xl font-bold text-neutral-900 dark:text-white mt-2">
            {quotesCount}
          </Text>
        </View>
      </Pressable>

      <Pressable onPress={onPressBalance} className="w-1/2 p-1">
        <View
          className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-4 flex-col justify-between"
          style={{ minHeight: 90 }}
        >
          <View className="flex-row items-center justify-between">
            <Text className="text-[10px] font-semibold text-neutral-500 uppercase">Available</Text>
            <FontAwesome5 name="wallet" size={12} color="#3b82f6" />
          </View>
          <Text className="text-2xl font-bold text-neutral-900 dark:text-white mt-2">
            {availableBalanceText}
          </Text>
        </View>
      </Pressable>
    </View>
  );
};

export default DashboardKpiGrid;
