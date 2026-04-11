import React, { useState } from 'react';
import { View, ScrollView, Pressable, Text, TextInput, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { FontAwesome5 } from '@expo/vector-icons';
import { forgotPassword } from '../api';

const ForgotPasswordScreen = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const navigation = useNavigation();

  const handleResetPassword = async () => {
    if (!email) {
      Alert.alert('Error', 'Please enter your email address.');
      return;
    }
    setLoading(true);
    try {
      await forgotPassword(email);
      setSent(true);
    } catch (error) {
      Alert.alert('Reset Failed', error.message || 'Failed to send reset link.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 bg-white">
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24 }} keyboardShouldPersistTaps="handled">
        {/* Logo */}
        <View className="items-center mb-8">
          <FontAwesome5 name="hammer" size={48} color="#4F46E5" />
          <Text className="text-2xl font-bold text-indigo-600 mt-3">ratedeed</Text>
        </View>

        {sent ? (
          /* Success State */
          <View className="w-full max-w-sm mx-auto items-center" style={{ gap: 16 }}>
            <View className="w-14 h-14 bg-emerald-50 rounded-full items-center justify-center">
              <FontAwesome5 name="envelope" size={24} color="#10b981" />
            </View>
            <Text className="text-lg font-bold text-neutral-900 text-center">Check your email</Text>
            <Text className="text-sm text-neutral-500 text-center leading-5">
              We sent a password reset link to{'\n'}
              <Text className="font-semibold text-neutral-900">{email}</Text>
            </Text>
            <Pressable
              onPress={() => navigation.navigate('Login')}
              className="w-full py-3 rounded-xl items-center bg-indigo-600 mt-4"
            >
              <Text className="text-sm font-semibold text-white">Back to Log In</Text>
            </Pressable>
          </View>
        ) : (
          /* Form */
          <View className="w-full max-w-sm mx-auto" style={{ gap: 16 }}>
            <View className="items-center">
              <Text className="text-2xl font-bold text-neutral-900">Reset password</Text>
              <Text className="text-sm text-neutral-500 mt-1 text-center">
                Enter your email and we'll send you a link to reset your password.
              </Text>
            </View>

            <TextInput
              placeholder="Email"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              editable={!loading}
              className="w-full border border-neutral-300 rounded-xl px-4 py-3 text-sm bg-white"
              placeholderTextColor="#a3a3a3"
            />

            <Pressable
              onPress={handleResetPassword}
              disabled={loading}
              className="w-full py-3 rounded-xl items-center"
              style={{
                backgroundColor: loading ? '#818cf8' : '#4F46E5',
                shadowColor: '#4F46E5', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4,
              }}
            >
              {loading ? (
                <Text className="text-sm font-semibold text-white">Sending...</Text>
              ) : (
                <Text className="text-sm font-semibold text-white">Send Reset Link</Text>
              )}
            </Pressable>

            <Pressable onPress={() => navigation.navigate('Login')} className="items-center pt-2">
              <Text className="text-sm text-neutral-500">
                <Text className="font-semibold text-neutral-900 underline">Back to Log In</Text>
              </Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

export default ForgotPasswordScreen;
