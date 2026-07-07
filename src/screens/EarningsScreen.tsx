import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, ScrollView, Pressable, FlatList, Alert } from 'react-native';
import { useColorScheme } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { FontAwesome5 } from '@expo/vector-icons';
import { getContractorEarnings } from '../api';
import { getPlatformFeePercent, requestPayout } from '../utils/apiClient';
import { SkeletonLoader } from '../components/common/SkeletonLoader';
import { BouncingDotsLoader, BouncingRefreshFlatList } from '../components/common';
import HapticFeedback from '../utils/haptics';

interface Transaction {
  _id: string;
  type: 'payment' | 'payout' | 'refund' | 'fee';
  amount: number;
  status: string;
  description?: string;
  createdAt: string;
  jobTitle?: string;
}

interface EarningsData {
  availableBalance: number;
  pendingPayouts: number;
  pendingAvailableAt?: string | null;
  totalEarned: number;
  transactions?: Transaction[];
}

function formatCurrency(amount: number) {
  return (
    '$' +
    Number(amount).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function getTransactionIcon(type: string) {
  switch (type) {
    case 'payment':
      return 'arrow-down';
    case 'payout':
      return 'arrow-up';
    case 'refund':
      return 'undo';
    case 'fee':
      return 'receipt';
    default:
      return 'circle';
  }
}

function getTransactionColor(type: string) {
  switch (type) {
    case 'payment':
      return '#059669';
    case 'payout':
      return '#4F46E5';
    case 'refund':
      return '#d97706';
    case 'fee':
      return '#ef4444';
    default:
      return '#737373';
  }
}

export default function EarningsScreen() {
  const isDark = useColorScheme() === 'dark';
  const navigation = useNavigation();
  const [earnings, setEarnings] = useState<EarningsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [feePercent, setFeePercent] = useState(5);

  const isMounted = useRef(true);
  useEffect(() => {
    (async () => {
      try {
        const res = await getPlatformFeePercent();
        if (res && res.platformFeePercent !== undefined && isMounted.current) {
          setFeePercent(res.platformFeePercent);
        }
      } catch {
        // Fallback to 5%
      }
    })();

    return () => {
      isMounted.current = false;
    };
  }, []);

  const loadData = useCallback(async () => {
    try {
      const data = await getContractorEarnings();
      if (isMounted.current) setEarnings(data as any);
    } catch {
      if (isMounted.current) setEarnings(null);
    } finally {
      if (isMounted.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  const [cashingOut, setCashingOut] = useState(false);

  const handleCashOut = useCallback(async () => {
    const balance = (earnings?.availableBalance || 0) / 100;
    if (cashingOut || balance <= 0) return;
    Alert.alert(
      'Withdraw Funds',
      `Transfer your available balance of ${formatCurrency(balance)} to your linked bank account? This may take 1-3 business days to settle via Stripe.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Withdraw',
          onPress: async () => {
            setCashingOut(true);
            try {
              const res = await requestPayout();
              HapticFeedback.success();
              let msg = res?.message || 'Your payout has been initiated.';
              if (res?.arrivalDate) {
                const d = new Date(res.arrivalDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                msg = `Payout initiated. Expected in your bank by ${d}.`;
              }
              Alert.alert('Withdrawal Initiated', msg);
              loadData();
            } catch (err: any) {
              HapticFeedback.error();
              Alert.alert('Withdrawal Failed', err?.message || 'We could not process your payout. Make sure your Stripe payout account is fully set up, then try again.');
            } finally {
              setCashingOut(false);
            }
          },
        },
      ]
    );
  }, [cashingOut, earnings, loadData]);

  const availableBalance = (earnings?.availableBalance || 0) / 100;
  const pendingPayouts = (earnings?.pendingPayouts || 0) / 100;
  const pendingAvailableAt = earnings?.pendingAvailableAt || null;
  const totalEarned = (earnings?.totalEarned || 0) / 100;
  const transactions: Transaction[] = earnings?.transactions || [];

  const renderTransaction = useCallback(
    ({ item }: { item: Transaction }) => {
      const iconColor = getTransactionColor(item.type);
      const isPositive = item.type === 'payment';
      const amount = item.amount / 100;

      return (
        <View
          className="bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 p-4 flex-row items-center mb-2.5"
          style={{ gap: 12 }}
        >
          {/* Icon */}
          <View
            className="w-10 h-10 rounded-lg items-center justify-center"
            style={{ backgroundColor: `${iconColor}15` }}
          >
            <FontAwesome5 name={getTransactionIcon(item.type) as any} size={14} color={iconColor} />
          </View>

          {/* Details */}
          <View className="flex-1">
            <Text className="text-sm font-semibold text-neutral-900 dark:text-white">
              {item.jobTitle || item.description || item.type.charAt(0).toUpperCase() + item.type.slice(1)}
            </Text>
            <View className="flex-row items-center mt-1" style={{ gap: 6 }}>
              <Text className="text-xs text-neutral-400 dark:text-neutral-500">{formatDate(item.createdAt)}</Text>
              {item.status && (
                <View className="bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 rounded-full">
                  <Text className="text-[10px] font-medium text-neutral-600 dark:text-neutral-300">{item.status}</Text>
                </View>
              )}
            </View>
            {item.type === 'payment' && (
              <View className="mt-1 flex-row flex-wrap" style={{ gap: 8 }}>
                <Text className="text-[10px] text-neutral-400 dark:text-neutral-500">Gross: {formatCurrency(amount)}</Text>
                <Text className="text-[10px] text-neutral-400 dark:text-neutral-500">Fee ({feePercent}%): {formatCurrency(amount * (feePercent / 100))}</Text>
                <Text className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">Net ({100 - feePercent}%): {formatCurrency(amount * (1 - feePercent / 100))}</Text>
              </View>
            )}
          </View>

          {/* Amount */}
          <Text
            className="text-sm font-bold"
            style={{ color: isPositive ? '#059669' : isDark ? '#f5f5f5' : '#171717' }}
          >
            {isPositive ? '+' : '-'}
            {formatCurrency(amount)}
          </Text>
        </View>
      );
    },
    [isDark, feePercent]
  );

  const renderHeader = useCallback(
    () => (
      <View className="py-6">
        {/* Available Balance Card */}
        <View className="bg-neutral-900 rounded-2xl p-6 mb-4">
          <View className="flex-row items-center justify-between mb-4">
            <View className="flex-row items-center" style={{ gap: 8 }}>
              <FontAwesome5 name="wallet" size={16} color="#a3a3a3" />
              <Text className="text-xs text-neutral-400 dark:text-neutral-500 font-medium uppercase tracking-wider">
                Available Balance
              </Text>
            </View>
            <View className="bg-emerald-50 dark:bg-emerald-950/20 px-2.5 py-1 rounded-full">
              <Text className="text-[10px] font-bold text-emerald-400">Available</Text>
            </View>
          </View>
          <Text className="text-4xl font-bold text-white">{formatCurrency(availableBalance)}</Text>
          <Pressable
            onPress={handleCashOut}
            disabled={cashingOut || availableBalance <= 0}
            className="mt-4 py-3 rounded-xl items-center justify-center flex-row"
            style={{ gap: 8, backgroundColor: (availableBalance > 0 && !cashingOut) ? '#4F46E5' : '#27272A' }}
          >
            {cashingOut ? (
              <BouncingDotsLoader size="small" color="#fff" />
            ) : (
              <>
                <FontAwesome5 name="arrow-up" size={13} color={(availableBalance > 0) ? '#fff' : '#737373'} />
                <Text className={`text-sm font-bold ${(availableBalance > 0) ? 'text-white' : 'text-neutral-500'}`}>
                  {availableBalance <= 0 ? 'No Funds to Withdraw' : 'Withdraw to Bank'}
                </Text>
              </>
            )}
          </Pressable>
          {availableBalance <= 0 && (
            <Text className="text-[11px] text-neutral-500 mt-3 leading-4">No withdrawable balance yet. After a homeowner releases escrow, funds take ~2 business days to settle via Stripe before they appear here. First-time payouts may take 7–14 days while Stripe verifies your account.</Text>
          )}
        </View>

        {/* When You'll Get Paid */}
        <View className="bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800 rounded-xl p-4 mb-4">
          <View className="flex-row items-center mb-2" style={{ gap: 8 }}>
            <FontAwesome5 name="clock" size={14} color="#d97706" />
            <Text className="text-sm font-semibold text-amber-900 dark:text-amber-200">When you'll get paid</Text>
          </View>
          <Text className="text-[12px] text-amber-800 dark:text-amber-300 leading-4 mb-2">
            After a homeowner releases escrow, your money moves through Stripe's settlement before it's withdrawable:
          </Text>
          <View style={{ gap: 5 }}>
            <Text className="text-[12px] text-amber-800 dark:text-amber-300 leading-4">• Released → Pending: ~2 business days (excludes weekends & holidays)</Text>
            <Text className="text-[12px] text-amber-800 dark:text-amber-300 leading-4">• Pending → Available: unlocks automatically on the date shown</Text>
            <Text className="text-[12px] text-amber-800 dark:text-amber-300 leading-4">• Available → Bank: 1–3 business days after you withdraw</Text>
          </View>
          <Text className="text-[11px] text-amber-700 dark:text-amber-400 leading-4 mt-2">
            First-time payouts may take 7–14 days while Stripe verifies your account. Missing info in your Stripe account can pause payouts — check your Stripe dashboard if anything is on hold.
          </Text>
        </View>

        {/* Stats Row */}
        <View className="flex-row mb-6" style={{ gap: 8 }}>
          <View className="flex-1 bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 p-4">
            <View className="flex-row items-center" style={{ gap: 4 }}>
              <FontAwesome5 name="clock" size={12} color="#d97706" />
              <Text className="text-xs text-neutral-500 dark:text-neutral-400 font-medium">Pending</Text>
            </View>
            <Text className="text-xl font-bold text-neutral-900 dark:text-white mt-1">
              {formatCurrency(pendingPayouts)}
            </Text>
            {pendingPayouts > 0 ? (
              <Text className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-0.5">
                {pendingAvailableAt
                  ? `Available ~${new Date(pendingAvailableAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · unlocks for withdrawal`
                  : 'Processing — available soon'}
              </Text>
            ) : (
              <Text className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-0.5">No funds pending</Text>
            )}
          </View>
          <View className="flex-1 bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 p-4">
            <View className="flex-row items-center" style={{ gap: 4 }}>
              <FontAwesome5 name="chart-line" size={12} color="#059669" />
              <Text className="text-xs text-neutral-500 dark:text-neutral-400 font-medium">Total Earned</Text>
            </View>
            <Text className="text-xl font-bold text-neutral-900 dark:text-white mt-1">
              {formatCurrency(totalEarned)}
            </Text>
          </View>
        </View>

        {/* Platform Fee Note */}
        <View
          className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 rounded-xl p-4 flex-row mb-6"
          style={{ gap: 12 }}
        >
          <FontAwesome5 name="info-circle" size={16} color="#4F46E5" />
          <View className="flex-1">
            <Text className="text-sm font-semibold text-indigo-900">Platform Fee</Text>
            <Text className="text-xs text-indigo-700 dark:text-indigo-300 mt-1 leading-4">
              A {feePercent}% platform fee is deducted from each payment to cover payment processing, escrow protection, and
              platform maintenance.
            </Text>
          </View>
        </View>

        {/* Completed Jobs (Released Escrow) Header */}
        <Text className="text-base font-bold text-neutral-900 dark:text-white mb-3">Completed Jobs (Released Escrow)</Text>
      </View>
    ),
    [availableBalance, pendingPayouts, pendingAvailableAt, totalEarned, feePercent, cashingOut, handleCashOut]
  );

  const renderEmpty = useCallback(
    () => (
      <View className="bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 p-8 items-center my-6">
        <FontAwesome5 name="receipt" size={32} color="#d4d4d4" />
        <Text className="text-sm font-semibold text-neutral-600 dark:text-neutral-300 mt-3">No transactions yet</Text>
        <Text className="text-xs text-neutral-400 dark:text-neutral-500 mt-1 text-center">
          Your payment history will appear here as you complete jobs
        </Text>
      </View>
    ),
    []
  );

  if (loading) {
    return (
      <View className="flex-1 bg-white dark:bg-neutral-900 p-6 pt-16">
        <SkeletonLoader type="list" count={4} />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-neutral-50 dark:bg-neutral-800">
      {/* Header */}
      <View className="bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-700 px-4 py-3 flex-row items-center">
        <Pressable onPress={() => navigation.goBack()} className="w-8 h-8 items-center justify-center">
          <FontAwesome5 name="chevron-left" size={18} color={isDark ? '#ffffff' : '#171717'} />
        </Pressable>
        <Text className="flex-1 text-sm font-bold text-neutral-900 dark:text-white text-center">Earnings</Text>
        <View className="w-8" />
      </View>

      <BouncingRefreshFlatList
        data={transactions}
        renderItem={renderTransaction}
        keyExtractor={(item) => item._id}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
        refreshing={refreshing}
        onRefresh={onRefresh}
        showsVerticalScrollIndicator={false}
        className="flex-1"
      />
    </View>
  );
}
