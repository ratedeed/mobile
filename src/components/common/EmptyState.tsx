import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';

interface EmptyStateProps {
  title?: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title = 'Nothing here yet',
  message = 'There is no content to display at the moment.',
  actionLabel,
  onAction,
  icon = '📭',
}) => {
  const isEmoji = icon ? icon.length <= 2 : false;

  return (
    <View className="items-center justify-center px-6 py-8">
      {icon ? (
        isEmoji ? (
          <Text className="text-5xl mb-4">{icon}</Text>
        ) : (
          <FontAwesome5 name={icon} size={36} color="#a3a3a3" className="mb-4" />
        )
      ) : null}
      <Text className="text-sm font-semibold text-neutral-900 dark:text-neutral-50 mb-2 text-center">
        {title}
      </Text>
      <Text className="text-xs text-neutral-500 dark:text-neutral-400 text-center mb-6 leading-5">
        {message}
      </Text>
      {actionLabel && onAction && (
        <Pressable
          className="bg-indigo-600 dark:bg-indigo-500 px-6 py-3 rounded-lg"
          onPress={onAction}
        >
          <Text className="text-white text-sm font-semibold">{actionLabel}</Text>
        </Pressable>
      )}
    </View>
  );
};
