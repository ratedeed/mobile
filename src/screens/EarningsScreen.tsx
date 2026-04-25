import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { FontAwesome5 } from '@expo/vector-icons';
import { getContractorEarnings } from '../api';

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
  return '$' + Number(amount).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
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
  const navigation = useNavigation();
  const [earnings, setEarnings] = useState<EarningsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const data = await getContractorEarnings();
      setEarnings(data);
    } catch {
      setEarnings(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
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
      <View className="flex-1 bg-white items-center justify-center">
        <ActivityIndicator size="large" color="#4F46E5" />
      </View>
    );
  }

  const availableBalance = (earnings?.availableBalance || 0) / 100;
  const pendingPayouts = (earnings?.pendingPayouts || 0) / 100;
  const totalEarned = (earnings?.totalEarned || 0) / 100;
  const transactions: Transaction[] = earnings?.transactions || [];

  return (
    <View className="flex-1 bg-neutral-50">
      {/* Header */}
      <View className="bg-white border-b border-neutral-200 px-4 py-3 flex-row items-center">
        <Pressable
          onPress={() => navigation.goBack()}
          className="w-8 h-8 items-center justify-center"
        >
          <FontAwesome5 name="chevron-left" size={18} color="#171717" />
        </Pressable>
        <Text className="flex-1 text-sm font-bold text-neutral-900 text-center">Earnings</Text>
        <View className="w-8" />
      </View>

      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={{ paddingVertical: 24 }}
      >
        {/* Available Balance Card */}
        <View className="mx-4 bg-neutral-900 rounded-2xl p-6 mb-4">
          <View className="flex-row items-center justify-between mb-4">
            <View className="flex-row items-center" style={{ gap: 8 }}>
              <FontAwesome5 name="wallet" size={16} color="#a3a3a3" />
              <Text className="text-xs text-neutral-400 font-medium uppercase tracking-wider">
                Available Balance
              </Text>
            </View>
            <View className="bg-emerald-500/20 px-2.5 py-1 rounded-full">
              <Text className="text-[10px] font-bold text-emerald-400">Available</Text>
            </View>
          </View>
          <Text className="text-4xl font-bold text-white">
            {formatCurrency(availableBalance)}
          </Text>
        </View>

        {/* Stats Row */}
        <View className="mx-4 flex-row mb-6" style={{ gap: 8 }}>
          <View className="flex-1 bg-white rounded-xl border border-neutral-200 p-4">
            <View className="flex-row items-center" style={{ gap: 4 }}>
              <FontAwesome5 name="clock" size={12} color="#d97706" />
              <Text className="text-xs text-neutral-500 font-medium">Pending</Text>
            </View>
            <Text className="text-xl font-bold text-neutral-900 mt-1">
              {formatCurrency(pendingPayouts)}
            </Text>
          </View>
          <View className="flex-1 bg-white rounded-xl border border-neutral-200 p-4">
            <View className="flex-row items-center" style={{ gap: 4 }}>
              <FontAwesome5 name="chart-line" size={12} color="#059669" />
              <Text className="text-xs text-neutral-500 font-medium">Total Earned</Text>
            </View>
            <Text className="text-xl font-bold text-neutral-900 mt-1">
              {formatCurrency(totalEarned)}
            </Text>
          </View>
        </View>

        {/* Platform Fee Note */}
        <View className="mx-4 bg-indigo-50 border border-indigo-100 rounded-xl p-4 flex-row mb-6" style={{ gap: 12 }}>
          <FontAwesome5 name="info-circle" size={16} color="#4F46E5" />
          <View className="flex-1">
            <Text className="text-sm font-semibold text-indigo-900">Platform Fee</Text>
            <Text className="text-xs text-indigo-700 mt-1 leading-4">
              A 5% platform fee is deducted from each payment to cover payment processing, escrow protection, and platform maintenance.
            </Text>
          </View>
        </View>

        {/* Transaction History */}
        <View className="mx-4">
          <Text className="text-base font-bold text-neutral-900 mb-3">Transaction History</Text>

          {transactions.length === 0 ? (
            <View className="bg-white rounded-xl border border-neutral-200 p-8 items-center">
              <FontAwesome5 name="receipt" size={32} color="#d4d4d4" />
              <Text className="text-sm font-semibold text-neutral-600 mt-3">
                No transactions yet
              </Text>
              <Text className="text-xs text-neutral-400 mt-1 text-center">
                Your payment history will appear here as you complete jobs
              </Text>
            </View>
          ) : (
            <View style={{ gap: 10 }}>
              {transactions.map((txn) => {
                const iconColor = getTransactionColor(txn.type);
                const isPositive = txn.type === 'payment' || txn.type === 'refund';
                const amount = txn.amount / 100;

                return (
                  <View
                    key={txn._id}
                    className="bg-white rounded-xl border border-neutral-200 p-4 flex-row items-center"
                    style={{ gap: 12 }}
                  >
                    {/* Icon */}
                    <View
                      className="w-10 h-10 rounded-lg items-center justify-center"
                      style={{ backgroundColor: `${iconColor}15` }}
                    >
                      <FontAwesome5
                        name={getTransactionIcon(txn.type) as any}
                        size={14}
                        color={iconColor}
                      />
                    </View>

                    {/* Details */}
                    <View className="flex-1">
                      <Text className="text-sm font-semibold text-neutral-900">
                        {txn.jobTitle || txn.description || txn.type.charAt(0).toUpperCase() + txn.type.slice(1)}
                      </Text>
                      <View className="flex-row items-center mt-1" style={{ gap: 6 }}>
                        <Text className="text-xs text-neutral-400">
                          {formatDate(txn.createdAt)}
                        </Text>
                        {txn.status && (
                          <View className="bg-neutral-100 px-2 py-0.5 rounded-full">
                            <Text className="text-[10px] font-medium text-neutral-600">
                              {txn.status}
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>

                    {/* Amount */}
                    <Text
                      className="text-sm font-bold"
                      style={{ color: isPositive ? '#059669' : '#171717' }}
                    >
                      {isPositive ? '+' : '-'}{formatCurrency(amount)}
                    </Text>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        <View className="h-10" />
      </ScrollView>
    </View>
  );
}
