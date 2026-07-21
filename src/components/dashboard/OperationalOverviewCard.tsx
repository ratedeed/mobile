import React from 'react';
import { View, Text } from 'react-native';
import ScaleButton from '../common/ScaleButton';

interface OperationalOverviewCardProps {
  contractorName: string;
  activeJobsCount: number;
  unreadConversationsCount: number;
  onViewSchedule: () => void;
  onViewEarnings: () => void;
}

export const OperationalOverviewCard: React.FC<OperationalOverviewCardProps> = ({
  contractorName,
  activeJobsCount,
  unreadConversationsCount,
  onViewSchedule,
  onViewEarnings,
}) => {
  return (
    <View className="bg-neutral-900 dark:bg-neutral-950 rounded-2xl p-5 overflow-hidden relative shadow-sm">
      <Text className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Operational Overview</Text>
      <Text className="text-xl font-bold text-white mt-1">Hello, {contractorName || 'Pro'} 👋</Text>
      <Text className="text-xs text-neutral-300 mt-2 leading-relaxed">
        You have {activeJobsCount} active jobs and {unreadConversationsCount} unread conversations.
      </Text>
      <View className="flex-row mt-4" style={{ gap: 8 }}>
        <ScaleButton onPress={onViewSchedule} className="bg-indigo-600 px-4 py-2 rounded-lg">
          <Text className="text-xs font-bold text-white">View Schedule</Text>
        </ScaleButton>
        <ScaleButton onPress={onViewEarnings} className="bg-white/10 border border-white/20 px-4 py-2 rounded-lg">
          <Text className="text-xs font-bold text-white">Earnings</Text>
        </ScaleButton>
      </View>
    </View>
  );
};

export default OperationalOverviewCard;
