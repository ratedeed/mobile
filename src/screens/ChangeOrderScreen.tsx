import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  Alert,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  useColorScheme,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { FontAwesome5 } from '@expo/vector-icons';
import { createChangeOrder } from '../api';

export default function ChangeOrderScreen() {
  const isDark = useColorScheme() === 'dark';
  const navigation = useNavigation();
  const route = useRoute();
  const { jobId, mode, changeOrderId } = (route.params || {}) as {
    jobId: string;
    mode: 'create' | 'review';
    changeOrderId?: string;
  };

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!title.trim()) {
      Alert.alert('Required', 'Please enter a title for the change order.');
      return;
    }

    if (!description.trim()) {
      Alert.alert('Required', 'Please describe the change.');
      return;
    }

    const parsedAmount = parseFloat(amount);
    if (!amount || isNaN(parsedAmount) || parsedAmount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount greater than $0.');
      return;
    }

    if (!jobId) {
      Alert.alert('Error', 'Missing job information.');
      return;
    }

    setSubmitting(true);
    try {
      await createChangeOrder(jobId, {
        title: title.trim(),
        description: description.trim(),
        amount: Math.round(parsedAmount * 100),
      });

      Alert.alert(
        'Change Order Submitted',
        'The change order has been submitted. The other party will be notified to review it.',
        [{ text: 'Done', onPress: () => navigation.goBack() }]
      );
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to submit change order. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const isValid =
    title.trim().length > 0 &&
    description.trim().length > 0 &&
    amount.length > 0 &&
    !isNaN(parseFloat(amount)) &&
    parseFloat(amount) > 0;

  const isCreate = mode === 'create';
return (
  <KeyboardAvoidingView
    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
    className="flex-1 bg-white dark:bg-neutral-950"
  >
    {/* Header */}
    <View className="border-b border-neutral-200 dark:border-neutral-700 px-4 py-3 flex-row items-center">
      <Pressable
        onPress={() => navigation.goBack()}
        className="w-8 h-8 items-center justify-center"
      >
        <FontAwesome5 name="chevron-left" size={18} color={isDark ? '#ffffff' : '#171717'} />
      </Pressable>
      <Text className="flex-1 text-sm font-bold text-neutral-900 dark:text-white text-center">
        {isCreate ? 'New Change Order' : 'Change Order Details'}
      </Text>
      <View className="w-8" />
    </View>

      <ScrollView
        className="flex-1 px-6"
        contentContainerStyle={{ paddingVertical: 24 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header Info */}
        <Text className="text-2xl font-bold text-neutral-900 dark:text-white mb-1">
          {isCreate ? 'Create Change Order' : 'Review Change Order'}
        </Text>
        <Text className="text-sm text-neutral-500 dark:text-neutral-400 mb-6">
          {isCreate
            ? 'Request a modification to the original job scope or cost'
            : 'Review the proposed changes to this job'}
        </Text>

        {/* Info Banner */}
        <View className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800 rounded-xl p-4 flex-row mb-6" style={{ gap: 12 }}>
          <FontAwesome5 name="file-contract" size={18} color="#4F46E5" />
          <View className="flex-1">
            <Text className="text-sm font-semibold text-indigo-900 dark:text-indigo-300">What is a Change Order?</Text>
            <Text className="text-xs text-indigo-700 dark:text-indigo-400 mt-1 leading-4">
              A change order documents any modification to the original job agreement, including scope changes, additional work, or cost adjustments.
            </Text>
          </View>
        </View>

        {isCreate ? (
          <>
            {/* Title Input */}
            <Text className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">Title *</Text>
            <TextInput
              placeholder="e.g., Additional bathroom tile work"
              value={title}
              onChangeText={setTitle}
              maxLength={150}
              className="border border-neutral-200 dark:border-neutral-700 rounded-xl px-4 py-3 text-sm bg-neutral-50 dark:bg-neutral-900 text-neutral-900 dark:text-white mb-5"
              placeholderTextColor={isDark ? "#9ca3af" : "#a3a3a3"}
            />

            {/* Description Input */}
            <Text className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">Description *</Text>
            <TextInput
              placeholder="Describe the change in detail, including scope and materials..."
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={5}
              maxLength={2000}
              className="border border-neutral-200 dark:border-neutral-700 rounded-xl px-4 py-3 text-sm bg-neutral-50 dark:bg-neutral-900 text-neutral-900 dark:text-white mb-2 min-h-[120px]"
              placeholderTextColor={isDark ? "#9ca3af" : "#a3a3a3"}
              style={{ textAlignVertical: 'top' }}
            />
            <View className="flex-row justify-end mb-5">
              <Text className="text-xs text-neutral-400 dark:text-neutral-500">
                {description.length}/2000
              </Text>
            </View>

            {/* Amount Input */}
            <Text className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">Amount *</Text>
            <View className="flex-row items-center border border-neutral-200 dark:border-neutral-700 rounded-xl bg-neutral-50 dark:bg-neutral-900 mb-8 px-4">
              <Text className="text-base font-bold text-neutral-500 dark:text-neutral-400 mr-2">$</Text>
              <TextInput
                placeholder="0.00"
                value={amount}
                onChangeText={setAmount}
                keyboardType="decimal-pad"
                className="flex-1 py-3 text-sm text-neutral-900 dark:text-white"
                placeholderTextColor={isDark ? "#9ca3af" : "#a3a3a3"}
              />
            </View>

            {/* Summary Preview */}
            {isValid && (
              <View className="bg-neutral-900 rounded-xl p-5 mb-6">
                <Text className="text-xs text-neutral-400 font-medium uppercase tracking-wider mb-2">
                  Change Order Summary
                </Text>
                <Text className="text-sm font-semibold text-white mb-1">{title.trim()}</Text>
                <Text className="text-xs text-neutral-400 mb-3" numberOfLines={2}>
                  {description.trim()}
                </Text>
                <View className="flex-row items-center justify-between pt-3 border-t border-neutral-700">
                  <Text className="text-xs text-neutral-400">Additional Amount</Text>
                  <Text className="text-xl font-bold text-white">
                    ${parseFloat(amount).toFixed(2)}
                  </Text>
                </View>
              </View>
            )}

            {/* Submit Button */}
            <Pressable
              onPress={handleSubmit}
              disabled={submitting || !isValid}
              className={`py-4 rounded-xl items-center shadow-lg ${
                submitting || !isValid
                  ? 'bg-neutral-300 dark:bg-neutral-700 shadow-none'
                  : 'bg-indigo-600 shadow-indigo-500/20'
              }`}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <View className="flex-row items-center" style={{ gap: 8 }}>
                  <FontAwesome5 name="paper-plane" size={14} color="#fff" />
                  <Text className="text-white font-bold text-base">Submit Change Order</Text>
                </View>
              )}
            </Pressable>

            <Text className="text-[10px] text-neutral-400 dark:text-neutral-500 text-center mt-4 leading-4 px-4">
              The other party will be notified and can accept or respond to this change order.
            </Text>
          </>
        ) : (
          /* Review Mode Placeholder */
          <View className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-700 p-8 items-center">
            <View className="w-16 h-16 rounded-full bg-indigo-50 dark:bg-indigo-900/20 items-center justify-center mb-4">
              <FontAwesome5 name="file-contract" size={24} color="#4F46E5" />
            </View>
            <Text className="text-base font-semibold text-neutral-900 dark:text-white mb-2">Change Order Review</Text>
            <Text className="text-sm text-neutral-500 dark:text-neutral-400 text-center leading-5">
              {changeOrderId
                ? `Reviewing change order #${changeOrderId}. The details and response options will appear here.`
                : 'Change order details will appear here once loaded.'}
            </Text>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
