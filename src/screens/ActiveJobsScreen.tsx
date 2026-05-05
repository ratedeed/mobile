import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text, Pressable, ScrollView, Image, ActivityIndicator, SafeAreaView, RefreshControl, Alert } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FontAwesome5 } from '@expo/vector-icons';
import { SvgImage } from '../components/common/SvgImage';
import { getUserQuotes, cancelJob, resolveDispute, updateQuoteStatus } from '../utils/apiClient';
import { getProfileImageUrl, isSvgUrl } from '../utils/avatarUtils';

type TabFilter = 'all' | 'active' | 'completed';

const getStatusBadge = (status: string) => {
  const s = status.toLowerCase();
  if (s.includes('escrow') || s.includes('confirmed')) return { label: 'Paid — In Escrow', color: '#047857', bg: '#d1fae5' };
  if (s.includes('progress')) return { label: 'In Progress', color: '#7c3aed', bg: '#ede9fe' };
  if (s.includes('complete')) return { label: 'Completed', color: '#4b5563', bg: '#f3f4f6' };
  if (s.includes('pay')) return { label: 'Payment Pending', color: '#c2410c', bg: '#ffedd5' };
  if (s.includes('quote') || s === 'quoted') return { label: 'Quote Ready', color: '#1d4ed8', bg: '#dbeafe' };
  if (s === 'declined') return { label: 'Declined', color: '#6b7280', bg: '#f3f4f6' };
  if (s === 'disputed') return { label: 'Disputed', color: '#be123c', bg: '#ffe4e6' };
  if (s === 'refunded') return { label: 'Refunded', color: '#c2410c', bg: '#ffedd5' };
  if (s === 'cancelled') return { label: 'Cancelled', color: '#b91c1c', bg: '#fee2e2' };
  return { label: status.replace('_', ' '), color: '#b45309', bg: '#fef3c7' };
};

const formatDate = (dateStr: string) => {
  try {
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return dateStr;
  }
};

export default function ActiveJobsScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const [quotes, setQuotes] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<TabFilter>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadJobs = useCallback(async () => {
    try {
      setError(null);
      const data = await getUserQuotes();
      setQuotes(data || []);
    } catch {
      setError('Failed to load jobs. Pull down to retry.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadJobs();
    }, [loadJobs])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadJobs();
  };

  const handleAcceptQuote = async (quoteId: string) => {
    try {
      await updateQuoteStatus(quoteId, 'accepted');
      loadJobs();
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to accept quote.');
    }
  };

  const handleRejectQuote = async (quoteId: string) => {
    try {
      await updateQuoteStatus(quoteId, 'rejected');
      loadJobs();
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to decline quote.');
    }
  };

  const handleResolveDispute = async (jobId: string, action: 'resume_job' | 'refund') => {
    try {
      await resolveDispute(jobId, action);
      const actionLabel = action === 'refund' ? 'refund issued' : 'job resumed';
      Alert.alert('Dispute Resolved', `The dispute has been resolved and ${actionLabel}.`, [
        { text: 'OK', onPress: () => loadJobs() },
      ]);
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to resolve dispute.');
    }
  };

  const handleCancel = async (jobId: string) => {
    try {
      await cancelJob(jobId);
      loadJobs();
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to cancel job');
    }
  };

  const filteredQuotes = useMemo(() => {
    const sorted = [...quotes].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    switch (activeTab) {
      case 'active': return sorted.filter(q => !['completed', 'declined', 'cancelled'].includes(q.status.toLowerCase()));
      case 'completed': return sorted.filter(q => q.status.toLowerCase() === 'completed');
      default: return sorted;
    }
  }, [quotes, activeTab]);

  if (loading && !refreshing) {
    return (
      <View className="flex-1 bg-white dark:bg-neutral-950 items-center justify-center">
        <ActivityIndicator size="large" color="#171717" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-white dark:bg-neutral-950" style={{ paddingTop: Math.max(insets.top, 16) }}>
      {/* Header */}
      <View className="px-4 pb-2">
        <Text className="text-2xl font-bold text-neutral-900 dark:text-neutral-50">My Jobs</Text>
      </View>

      {/* Tabs */}
      <View className="flex-row px-4 pb-3 pt-1 border-b border-neutral-100 dark:border-neutral-800" style={{ gap: 8 }}>
        {[
          { key: 'all', label: 'All' },
          { key: 'active', label: 'Active' },
          { key: 'completed', label: 'Completed' },
        ].map(tab => (
          <Pressable
            key={tab.key}
            onPress={() => setActiveTab(tab.key as TabFilter)}
            className={`px-4 py-2 rounded-full ${activeTab === tab.key ? 'bg-neutral-900 dark:bg-neutral-50' : 'bg-neutral-100 dark:bg-neutral-900'}`}
          >
            <Text className={`text-sm font-semibold ${activeTab === tab.key ? 'text-white dark:text-neutral-900' : 'text-neutral-600 dark:text-neutral-400'}`}>
              {tab.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Escrow Banner */}
      <View className="mx-4 mt-4 bg-emerald-50 border border-emerald-100 rounded-xl p-3 flex-row items-center" style={{ gap: 12 }}>
        <View className="w-10 h-10 rounded-full bg-emerald-100 items-center justify-center">
          <FontAwesome5 name="shield-alt" size={18} color="#059669" />
        </View>
        <View className="flex-1">
          <Text className="text-sm font-bold text-emerald-900">Your money is safe in escrow</Text>
          <Text className="text-xs text-emerald-700 leading-4">Funds are only released to the contractor once you approve the work.</Text>
        </View>
      </View>

      <ScrollView
        className="flex-1 px-4 pt-2"
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#171717" />}
      >
        {error ? (
          <View className="items-center justify-center py-20 px-6">
            <View className="w-16 h-16 bg-red-50 dark:bg-red-900/20 rounded-full items-center justify-center mb-4">
              <FontAwesome5 name="exclamation-triangle" size={24} color="#ef4444" />
            </View>
            <Text className="text-sm text-neutral-500 dark:text-neutral-400 text-center">{error}</Text>
            <Pressable onPress={onRefresh} className="mt-4 bg-neutral-900 dark:bg-neutral-50 px-6 py-2.5 rounded-xl">
              <Text className="text-white dark:text-neutral-900 font-bold text-sm">Retry</Text>
            </Pressable>
          </View>
        ) : filteredQuotes.length === 0 ? (
          <View className="items-center justify-center py-20 px-6">
            <View className="w-16 h-16 bg-neutral-100 dark:bg-neutral-900 rounded-full items-center justify-center mb-4">
              <FontAwesome5 name="briefcase" size={28} color="#d4d4d4" />
            </View>
            <Text className="text-lg font-bold text-neutral-900 dark:text-neutral-50">No jobs yet</Text>
            <Text className="text-sm text-neutral-500 dark:text-neutral-400 mt-1 text-center">
              Browse contractors to find the perfect match for your home project.
            </Text>
            <Pressable
              onPress={() => navigation.navigate('Explore')}
              className="mt-6 bg-neutral-900 dark:bg-neutral-50 px-8 py-3 rounded-xl"
            >
              <Text className="text-white dark:text-neutral-900 font-bold">Explore</Text>
            </Pressable>
          </View>
        ) : (
          filteredQuotes.map(quote => {
            const badge = getStatusBadge(quote.status);
            const contractor = quote.contractorId || {};
            if (!contractor._id && !contractor.id) return null; // Skip if no contractor data
            const contractorName = contractor.companyName || contractor.businessName || 'Contractor';
            const contractorImage = getProfileImageUrl(contractorName, contractor.profilePicture || contractor.imageUrl || '', contractor.category);

            return (
              <Pressable 
                key={quote._id} 
                className="bg-white dark:bg-neutral-950 rounded-2xl border border-neutral-100 dark:border-neutral-800 p-4 mb-3 shadow-sm"
                onPress={() => navigation.navigate('PaymentFlow', {
                  quoteId: quote._id,
                  totalAmount: quote.totalAmount || quote.quoteTotal || 0,
                  contractorName: quote.contractorId?.companyName || quote.contractorId?.businessName || 'Contractor',
                  description: quote.description || quote.projectTitle || 'Home Project',
                })}
              >
                <View className="flex-row" style={{ gap: 12 }}>
                  <View className="w-12 h-12 rounded-xl bg-neutral-100 dark:bg-neutral-900 items-center justify-center shrink-0 overflow-hidden">
                    {isSvgUrl(contractorImage) ? (
                      <SvgImage uri={contractorImage} width="100%" height="100%" />
                    ) : (
                      <Image source={{ uri: contractorImage }} className="w-full h-full" />
                    )}
                  </View>
                  <View className="flex-1">
                    <View className="flex-row justify-between items-start">
                      <View className="flex-1 mr-2">
                        <Text className="text-sm font-bold text-neutral-900 dark:text-neutral-50" numberOfLines={1}>{contractorName}</Text>
                        <Text className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">{quote.projectTitle || 'Home Project'}</Text>
                      </View>
                      <Text className="text-sm font-bold text-neutral-900 dark:text-neutral-50">${(quote.totalAmount || quote.quoteTotal || 0).toLocaleString()}</Text>
                    </View>

                    <View className="flex-row items-center justify-between mt-3">
                      <View className="flex-row items-center px-2.5 py-1 rounded-full" style={{ backgroundColor: badge.bg, gap: 6 }}>
                        <View className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: badge.color }} />
                        <Text className="text-[11px] font-bold" style={{ color: badge.color }}>{badge.label}</Text>
                      </View>
                      <Text className="text-[11px] text-neutral-400 font-medium">{formatDate(quote.createdAt)}</Text>
                    </View>

                    {quote.status.toLowerCase() === 'completed' && !quote.hasReview && (
                      <Pressable
                        onPress={() => navigation.navigate('ReviewScreen', {
                          quoteId: quote._id,
                          contractorId: quote.contractorId?._id || quote.contractorId?.id || quote.contractorId,
                          contractorName: quote.contractorId?.companyName || quote.contractorId?.businessName || 'Contractor',
                        })}
                        className="flex-row items-center mt-3"
                        style={{ gap: 6 }}
                      >
                        <FontAwesome5 name="star" size={12} color="#d97706" />
                        <Text className="text-xs font-semibold text-amber-600">Leave a Review</Text>
                        <FontAwesome5 name="arrow-right" size={10} color="#d97706" />
                      </Pressable>
                    )}

                    {quote.status.toLowerCase() === 'pending_user_approval' && !quote.jobId && (
                      <View className="flex-row mt-3" style={{ gap: 8 }}>
                        <Pressable
                          onPress={() => handleAcceptQuote(quote._id)}
                          className="flex-1 py-2 rounded-lg bg-emerald-600 flex-row items-center justify-center"
                          style={{ gap: 4 }}
                        >
                          <FontAwesome5 name="check" size={10} color="#fff" />
                          <Text className="text-xs font-bold text-white">Accept Quote</Text>
                        </Pressable>
                        <Pressable
                          onPress={() => Alert.alert(
                            'Decline Quote',
                            'Are you sure you want to decline this quote?',
                            [
                              { text: 'Cancel', style: 'cancel' },
                              { text: 'Decline', style: 'destructive', onPress: () => handleRejectQuote(quote._id) },
                            ]
                          )}
                          className="flex-1 py-2 rounded-lg bg-white border border-neutral-300 flex-row items-center justify-center"
                          style={{ gap: 4 }}
                        >
                          <FontAwesome5 name="times" size={10} color="#737373" />
                          <Text className="text-xs font-bold text-neutral-600">Decline</Text>
                        </Pressable>
                      </View>
                    )}

                    {quote.status.toLowerCase() === 'disputed' && (
                      <View className="mt-3 bg-red-50 border border-red-100 rounded-xl p-3" style={{ gap: 8 }}>
                        <Text className="text-xs font-semibold text-red-800">Resolve Dispute</Text>
                        <Text className="text-xs text-red-600 leading-4">Choose how to resolve this dispute.</Text>
                        <View className="flex-row" style={{ gap: 8 }}>
                          <Pressable
                            onPress={() => Alert.alert(
                              'Resume Job',
                              'Release the escrowed funds to the contractor and mark the job as complete?',
                              [
                                { text: 'Cancel', style: 'cancel' },
                                { text: 'Resume', onPress: () => handleResolveDispute(quote._id, 'resume_job') },
                              ]
                            )}
                            className="flex-1 py-2 rounded-lg bg-white border border-red-200 items-center"
                          >
                            <Text className="text-xs font-semibold text-red-700">Resume Job</Text>
                          </Pressable>
                          <Pressable
                            onPress={() => Alert.alert(
                              'Issue Refund',
                              'Refund the escrowed payment back to you?',
                              [
                                { text: 'Cancel', style: 'cancel' },
                                { text: 'Refund', style: 'destructive', onPress: () => handleResolveDispute(quote._id, 'refund') },
                              ]
                            )}
                            className="flex-1 py-2 rounded-lg bg-red-600 items-center"
                          >
                            <Text className="text-xs font-semibold text-white">Issue Refund</Text>
                          </Pressable>
                        </View>
                      </View>
                    )}

                    {(quote.status.toLowerCase() === 'awaiting_payment' || quote.status.toLowerCase() === 'funded_in_progress' || quote.status.toLowerCase() === 'quoted' || quote.status.toLowerCase() === 'pending_user_approval') && (
                      <Pressable
                        onPress={() => Alert.alert(
                          'Cancel Job',
                          quote.status.toLowerCase() === 'funded_in_progress'
                            ? 'This will cancel the job and refund your payment from escrow. Continue?'
                            : 'This will cancel the job. Continue?',
                          [
                            { text: 'Keep Job', style: 'cancel' },
                            { text: 'Cancel Job', style: 'destructive', onPress: () => handleCancel(quote._id) }
                          ]
                        )}
                        className="flex-row items-center mt-3"
                        style={{ gap: 6 }}
                      >
                        <FontAwesome5 name="times-circle" size={12} color="#ef4444" />
                        <Text className="text-xs font-semibold text-red-500">Cancel Job</Text>
                      </Pressable>
                    )}

                    {quote.status.toLowerCase() === 'refunded' && (
                      <View className="flex-row items-center mt-3" style={{ gap: 6 }}>
                        <FontAwesome5 name="undo" size={12} color="#c2410c" />
                        <Text className="text-xs font-semibold text-orange-600">Refund Processed</Text>
                      </View>
                    )}

                    {quote.status.toLowerCase() === 'cancelled' && (
                      <View className="flex-row items-center mt-3" style={{ gap: 6 }}>
                        <FontAwesome5 name="ban" size={12} color="#b91c1c" />
                        <Text className="text-xs font-semibold text-red-600">Job Cancelled</Text>
                      </View>
                    )}
                  </View>
                </View>
              </Pressable>
            );
          })
        )}
        <View className="h-6" />
      </ScrollView>
    </View>
  );
}
