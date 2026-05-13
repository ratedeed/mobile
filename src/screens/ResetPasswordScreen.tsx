import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
  useColorScheme,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { FontAwesome5 } from '@expo/vector-icons';
import { confirmPasswordReset, Auth } from 'firebase/auth';
// @ts-ignore
import { auth } from '../firebaseConfig';

// @ts-ignore
const firebaseAuth: Auth = auth as unknown as Auth;

export default function ResetPasswordScreen() {
  const isDark = useColorScheme() === 'dark';
  const navigation = useNavigation();
  const route = useRoute();
  const { oobCode } = (route.params || {}) as { oobCode?: string };

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!oobCode) {
      setStatus('error');
      setMessage('Missing password reset code. Please request a new link.');
    }
  }, [oobCode]);

  const handleReset = async () => {
    if (!oobCode) return;

    if (newPassword !== confirmPassword) {
      setStatus('error');
      setMessage('Passwords do not match.');
      return;
    }

    if (newPassword.length < 6) {
      setStatus('error');
      setMessage('Password must be at least 6 characters long.');
      return;
    }

    setStatus('loading');
    setMessage(null);

    try {
      await confirmPasswordReset(firebaseAuth, oobCode, newPassword);
      setStatus('success');
      setMessage('Password reset successfully!');
      setTimeout(() => {
        navigation.navigate('Login' as never);
      }, 2000);
    } catch (error: any) {
      let errorMessage = 'Error resetting password. Please try again.';
      if (error.code === 'auth/expired-action-code') {
        errorMessage = 'The password reset link has expired. Please request a new one.';
      } else if (error.code === 'auth/invalid-action-code') {
        errorMessage = 'The password reset link is invalid. Please check the link or request a new one.';
      } else if (error.code === 'auth/user-disabled') {
        errorMessage = 'Your account has been disabled.';
      }
      setStatus('error');
      setMessage(errorMessage);
    }
  };

  if (status === 'success') {
    return (
      <View className="flex-1 bg-white dark:bg-neutral-950 items-center justify-center px-6">
        <View className="w-16 h-16 bg-emerald-50 dark:bg-emerald-900/20 rounded-full items-center justify-center mb-4">
          <FontAwesome5 name="check-circle" size={28} color="#059669" />
        </View>
        <Text className="text-xl font-bold text-neutral-900 dark:text-white mb-2">Password Reset!</Text>
        <Text className="text-sm text-neutral-500 dark:text-neutral-400 text-center mb-6">{message}</Text>
        <Pressable
          onPress={() => navigation.navigate('Login' as never)}
          className="bg-neutral-900 dark:bg-white px-8 py-3.5 rounded-xl"
        >
          <Text className="text-white dark:text-neutral-900 font-bold text-sm">Back to Login</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      className="flex-1 bg-white dark:bg-neutral-950"
    >
      <View className="flex-1 px-6 pt-12">
        <View className="items-center mb-8">
          <View className="w-14 h-14 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl items-center justify-center mb-3">
            <FontAwesome5 name="lock" size={24} color="#4F46E5" />
          </View>
          <Text className="text-2xl font-bold text-neutral-900 dark:text-white mb-1">Set New Password</Text>
          <Text className="text-sm text-neutral-500 dark:text-neutral-400 text-center">
            Enter your new password below.
          </Text>
        </View>

        {status === 'error' && message && (
          <View className="bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-xl p-4 flex-row items-center mb-6" style={{ gap: 10 }}>
            <FontAwesome5 name="exclamation-circle" size={16} color="#dc2626" />
            <Text className="text-sm text-red-700 dark:text-red-300 flex-1">{message}</Text>
          </View>
        )}

        <View className="mb-4">
          <Text className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">New Password</Text>
          <TextInput
            placeholder="Enter new password"
            value={newPassword}
            onChangeText={(text) => { setNewPassword(text); setStatus('idle'); setMessage(null); }}
            secureTextEntry
            className="border border-neutral-200 dark:border-neutral-700 rounded-xl px-4 py-3.5 text-sm bg-neutral-50 dark:bg-neutral-900 text-neutral-900 dark:text-white"
            placeholderTextColor={isDark ? "#9ca3af" : "#a3a3a3"}
            editable={status !== 'loading'}
          />
        </View>

        <View className="mb-6">
          <Text className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">Confirm Password</Text>
          <TextInput
            placeholder="Confirm new password"
            value={confirmPassword}
            onChangeText={(text) => { setConfirmPassword(text); setStatus('idle'); setMessage(null); }}
            secureTextEntry
            className="border border-neutral-200 dark:border-neutral-700 rounded-xl px-4 py-3.5 text-sm bg-neutral-50 dark:bg-neutral-900 text-neutral-900 dark:text-white"
            placeholderTextColor={isDark ? "#9ca3af" : "#a3a3a3"}
            editable={status !== 'loading'}
          />
        </View>

        <Pressable
          onPress={handleReset}
          disabled={status === 'loading' || !newPassword || !confirmPassword}
          className={`py-4 rounded-xl items-center ${
            status === 'loading' || !newPassword || !confirmPassword
              ? 'bg-neutral-300 dark:bg-neutral-700'
              : 'bg-indigo-600'
          }`}
        >
          {status === 'loading' ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text className="text-white font-bold text-base">Reset Password</Text>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}