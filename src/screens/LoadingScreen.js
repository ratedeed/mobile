import React from 'react';
import { View, ActivityIndicator, Text } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';

const LoadingScreen = () => {
  return (
    <View className="flex-1 bg-white items-center justify-center">
      <FontAwesome5 name="hammer" size={40} color="#4F46E5" />
      <Text className="text-lg font-bold text-indigo-600 mt-3">ratedeed</Text>
      <ActivityIndicator size="small" color="#4F46E5" className="mt-4" />
      <Text className="text-sm text-neutral-400 mt-2">Loading...</Text>
    </View>
  );
};

export default LoadingScreen;
