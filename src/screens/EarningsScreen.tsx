import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, ScrollView, RefreshControl, ActivityIndicator, Pressable, FlatList } from 'react-native';
import { useColorScheme } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { FontAwesome5 } from '@expo/vector-icons';
import { getContractorEarnings } from '../api';
import { getPlatformFeePercent } from '../utils/apiClient';

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

  if (loading) {
    return (
      <View className="flex-1 bg-white dark:bg-neutral-900 items-center justify-center">
        <ActivityIndicator size="large" color="#4F46E5" />
      </View>
    );
  }

  const availableBalance = (earnings?.availableBalance || 0) / 100;
  const pendingPayouts = (earnings?.pendingPayouts || 0) / 100;
  const totalEarned = (earnings?.totalEarned || 0) / 100;
  const transactions: Transaction[] = earnings?.transactions || [];

  const renderTransaction = useCallback(
    ({ item }: { item: Transaction }) => {
      const iconColor = getTransactionColor(item.type);
      const isPositive = item.type === 'payment' || item.type === 'refund';
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
    [isDark]
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

        {/* Transaction History Header */}
        <Text className="text-base font-bold text-neutral-900 dark:text-white mb-3">Transaction History</Text>
      </View>
    ),
    [availableBalance, pendingPayouts, totalEarned, feePercent]
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

      <FlatList
        data={transactions}
        renderItem={renderTransaction}
        keyExtractor={(item) => item._id}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
        className="flex-1"
      />
    </View>
  );
}
