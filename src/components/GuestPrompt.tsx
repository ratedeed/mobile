import React from 'react';
import {
  View,
  Text,
  Pressable,
  Modal,
  Dimensions,
} from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useColorScheme } from 'nativewind';

interface GuestPromptProps {
  visible: boolean;
  onClose: () => void;
  onLogin: () => void;
  action?: string;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function GuestPrompt({ visible, onClose, onLogin, action = 'do that' }: GuestPromptProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View className="flex-1 justify-end" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
        <Pressable className="flex-1" onPress={onClose} />
        <View 
          className="rounded-t-3xl px-6 pt-6 pb-10"
          style={{ backgroundColor: isDark ? '#18181b' : '#ffffff' }}
        >
          {/* Handle */}
          <View className="w-10 h-1 rounded-full bg-neutral-300 dark:bg-neutral-600 mx-auto mb-6" />
          
          {/* Icon */}
          <View className="w-16 h-16 rounded-full bg-indigo-50 dark:bg-indigo-900/30 items-center justify-center mx-auto mb-4">
            <FontAwesome5 name="lock" size={24} color="#4F46E5" />
          </View>

          <Text className="text-xl font-bold text-neutral-900 dark:text-neutral-50 text-center mb-2">
            Sign in to {action}
          </Text>
          <Text className="text-sm text-neutral-500 dark:text-neutral-400 text-center mb-6 leading-5">
            Create an account or sign in to access this feature and connect with contractors.
          </Text>

          <Pressable
            onPress={onLogin}
            className="w-full py-4 bg-indigo-600 rounded-2xl items-center mb-3"
          >
            <Text className="text-white font-bold text-[15px]">Sign In or Create Account</Text>
          </Pressable>

          <Pressable
            onPress={onClose}
            className="w-full py-4 rounded-2xl items-center"
          >
            <Text className="text-neutral-500 dark:text-neutral-400 font-semibold text-[15px]">
              Continue Browsing
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
