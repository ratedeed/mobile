import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  useColorScheme,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { FontAwesome5 } from '@expo/vector-icons';
import { createChangeOrder, acceptChangeOrder, declineChangeOrder } from '../api';
import { useAuth } from '../context/AuthContext';
import { BouncingDotsLoader } from '../components/common';

const sanitizeAmount = (text: string) => {
  let cleaned = text.replace(/[^0-9.]/g, '');
  const parts = cleaned.split('.');
  if (parts.length > 2) {
    cleaned = parts[0] + '.' + parts.slice(1).join('');
  }
  return cleaned;
};

const formatCurrency = (cents: number) => `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

export default function ChangeOrderScreen() {
  const isDark = useColorScheme() === 'dark';
  const navigation = useNavigation();
  const route = useRoute();
  const { userRole } = useAuth();
  const isContractor = userRole === 'contractor';
  const isUser = !isContractor;

  const { jobId, mode, changeOrderId, changeOrder: initialChangeOrder } = (route.params || {}) as {
    jobId: string;
    mode: 'create' | 'review';
    changeOrderId?: string;
    changeOrder?: any;
  };

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [coType, setCoType] = useState<'addition' | 'deduction'>('addition');
  const [submitting, setSubmitting] = useState(false);
  const [changeOrderState, setChangeOrderState] = useState(initialChangeOrder);

  const handleSubmit = async () => {
    if (submitting) return;
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

    const finalAmount = coType === 'deduction' ? -Math.abs(parsedAmount) : Math.abs(parsedAmount);

    if (!jobId) {
      Alert.alert('Error', 'Missing job information.');
      return;
    }

    setSubmitting(true);
    try {
      await createChangeOrder(jobId, {
        title: title.trim(),
        description: description.trim(),
        amount: Math.round(finalAmount * 100),
      });

      Alert.alert(
        coType === 'deduction' ? 'Scope Reduction Submitted' : 'Change Order Submitted',
        `The ${coType === 'deduction' ? 'scope reduction' : 'change order'} has been submitted for client review.`,
        [{ text: 'Done', onPress: () => navigation.goBack() }]
      );
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to submit change order. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAccept = async () => {
    if (submitting) return;
    if (!jobId || !changeOrderState?._id) return;
    setSubmitting(true);
    try {
      await acceptChangeOrder(jobId, changeOrderState._id);
      setChangeOrderState((prev: any) => ({ ...prev, status: 'accepted' }));
      Alert.alert('Success', 'Change order accepted successfully.', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to accept change order.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDecline = async () => {
    if (submitting) return;
    if (!jobId || !changeOrderState?._id) return;
    setSubmitting(true);
    try {
      await declineChangeOrder(jobId, changeOrderState._id);
      setChangeOrderState((prev: any) => ({ ...prev, status: 'declined' }));
      Alert.alert('Success', 'Change order declined.', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to decline change order.');
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
            {/* Type Selector Pills */}
            <View className="flex-row bg-neutral-100 dark:bg-neutral-800 p-1.5 rounded-2xl mb-6" style={{ gap: 8 }}>
              <Pressable
                onPress={() => setCoType('addition')}
                className={`flex-1 py-3 rounded-xl items-center justify-center ${
                  coType === 'addition' ? 'bg-emerald-600' : 'bg-transparent'
                }`}
              >
                <Text className={`text-xs font-bold ${coType === 'addition' ? 'text-white' : 'text-neutral-600 dark:text-neutral-300'}`}>
                  ➕ Addition (+ Extra Work)
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setCoType('deduction')}
                className={`flex-1 py-3 rounded-xl items-center justify-center ${
                  coType === 'deduction' ? 'bg-rose-600' : 'bg-transparent'
                }`}
              >
                <Text className={`text-xs font-bold ${coType === 'deduction' ? 'text-white' : 'text-neutral-600 dark:text-neutral-300'}`}>
                  ➖ Deduction (- Scope Reduction)
                </Text>
              </Pressable>
            </View>

            {/* Title Input */}
            <Text className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">Title *</Text>
            <TextInput
              placeholder={coType === 'addition' ? "e.g., Additional bathroom tile work" : "e.g., Removed guest bathroom tile work"}
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
                onChangeText={(text) => setAmount(sanitizeAmount(text))}
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
                <BouncingDotsLoader size="small" color="#fff" />
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
          /* Review Mode Details */
          <View className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-700 p-6">
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-lg font-bold text-neutral-900 dark:text-white">
                {changeOrderState?.title || 'Change Order Details'}
              </Text>
              <View className={`px-2.5 py-0.5 rounded-full ${
                changeOrderState?.status === 'accepted'
                  ? 'bg-emerald-50 dark:bg-emerald-900/30'
                  : changeOrderState?.status === 'declined'
                  ? 'bg-red-50 dark:bg-red-900/30'
                  : 'bg-amber-50 dark:bg-amber-900/30'
              }`}>
                <Text className={`text-xs font-semibold ${
                  changeOrderState?.status === 'accepted'
                    ? 'text-emerald-700 dark:text-emerald-300'
                    : changeOrderState?.status === 'declined'
                    ? 'text-red-700 dark:text-red-300'
                    : 'text-amber-700 dark:text-amber-300'
                }`}>
                  {changeOrderState?.status || 'pending'}
                </Text>
              </View>
            </View>

            {changeOrderState?.description ? (
              <View className="mb-4">
                <Text className="text-xs text-neutral-400 dark:text-neutral-500 mb-1">Description</Text>
                <Text className="text-sm text-neutral-700 dark:text-neutral-300">
                  {changeOrderState.description}
                </Text>
              </View>
            ) : null}

            <View className="border-t border-neutral-100 dark:border-neutral-800 pt-4 mb-6">
              <View className="flex-row items-center justify-between">
                <Text className="text-sm font-medium text-neutral-500 dark:text-neutral-400">Additional Amount</Text>
                <Text className="text-xl font-bold text-neutral-900 dark:text-white">
                  {changeOrderState ? formatCurrency(changeOrderState.amount) : '$0.00'}
                </Text>
              </View>
            </View>

            {isUser && changeOrderState?.status === 'pending' ? (
              <View className="flex-row" style={{ gap: 12 }}>
                <Pressable
                  onPress={handleDecline}
                  disabled={submitting}
                  className="flex-1 py-3 border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10 rounded-xl items-center"
                >
                  {submitting ? (
                    <BouncingDotsLoader size="small" color="#ef4444" />
                  ) : (
                    <Text className="text-red-600 dark:text-red-400 font-bold text-sm">Decline</Text>
                  )}
                </Pressable>

                <Pressable
                  onPress={handleAccept}
                  disabled={submitting}
                  className="flex-1 py-3 bg-emerald-600 rounded-xl items-center"
                >
                  {submitting ? (
                    <BouncingDotsLoader size="small" color="#fff" />
                  ) : (
                    <Text className="text-white font-bold text-sm">Accept</Text>
                  )}
                </Pressable>
              </View>
            ) : (
              <Text className="text-xs text-neutral-400 dark:text-neutral-500 text-center leading-5 mt-2">
                {changeOrderState?.status === 'pending'
                  ? 'Awaiting response from the homeowner.'
                  : `This change order was ${changeOrderState?.status || 'processed'}.`}
              </Text>
            )}
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

