import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { FontAwesome5 } from '@expo/vector-icons';
import { verifyEmailChange } from '../api';

export default function VerifyEmailChangeScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { token } = (route.params || {}) as { token?: string };

  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('Invalid or missing verification token.');
      return;
    }

    let isMounted = true;

    async function verify() {
      try {
        const res = await verifyEmailChange(token as string);
        if (isMounted) {
          setStatus('success');
          setMessage(res?.message || 'Email changed successfully!');
        }
      } catch (err: any) {
        if (isMounted) {
          setStatus('error');
          setMessage(err?.message || 'Failed to verify email change. The link may have expired.');
        }
      }
    }

    verify();
    return () => { isMounted = false; };
  }, [token]);

  return (
    <View className="flex-1 bg-white items-center justify-center px-6">
      {status === 'verifying' && (
        <>
          <View className="w-16 h-16 bg-neutral-50 rounded-full items-center justify-center mb-4">
            <ActivityIndicator size="large" color="#4F46E5" />
          </View>
          <View className="items-center">
            <Text className="text-xl font-bold text-neutral-900 mb-1">Verifying Email</Text>
            <Text className="text-sm text-neutral-500 text-center">
              Please wait while we confirm your new email address...
            </Text>
          </View>
        </>
      )}

      {status === 'success' && (
        <>
          <View className="w-16 h-16 bg-emerald-50 rounded-full items-center justify-center mb-4">
            <FontAwesome5 name="check-circle" size={28} color="#059669" />
          </View>
          <View className="items-center">
            <Text className="text-xl font-bold text-neutral-900 mb-1">Email Verified</Text>
            <Text className="text-sm text-neutral-500 text-center mb-6">{message}</Text>
          </View>
          <Pressable
            onPress={() => navigation.navigate('Main' as never)}
            className="bg-indigo-600 px-8 py-3.5 rounded-xl w-full items-center"
          >
            <Text className="text-white font-bold text-sm">Return to App</Text>
          </Pressable>
        </>
      )}

      {status === 'error' && (
        <>
          <View className="w-16 h-16 bg-red-50 rounded-full items-center justify-center mb-4">
            <FontAwesome5 name="times-circle" size={28} color="#dc2626" />
          </View>
          <View className="items-center">
            <Text className="text-xl font-bold text-neutral-900 mb-1">Verification Failed</Text>
            <Text className="text-sm text-neutral-500 text-center mb-6 max-w-xs">{message}</Text>
          </View>
          <Pressable
            onPress={() => navigation.navigate('Main' as never)}
            className="border border-neutral-200 bg-white px-8 py-3.5 rounded-xl w-full items-center"
          >
            <Text className="text-neutral-900 font-bold text-sm">Back to App</Text>
          </Pressable>
        </>
      )}
    </View>
  );
}