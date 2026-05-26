import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Platform,
  Linking,
  TextInput,
  KeyboardAvoidingView,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColorScheme } from 'nativewind';
import { FontAwesome5 } from '@expo/vector-icons';
import {
  getJobById,
  markJobComplete,
  releaseFunds,
  cancelDispute,
  cancelJob,
  createChangeOrder,
  acceptChangeOrder,
  declineChangeOrder,
} from '../utils/apiClient';
import { useAuth } from '../context/AuthContext';

type RootStackParamList = {
  JobDetail: { jobId: string };
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  awaiting_payment: { label: 'Awaiting Payment', color: '#d97706', bg: '#fef3c7', icon: 'clock' },
  partially_funded: { label: 'Partially Funded', color: '#d97706', bg: '#fef3c7', icon: 'clock' },
  funded_in_progress: { label: 'In Progress', color: '#059669', bg: '#d1fae5', icon: 'hammer' },
  completed_pending_release: { label: 'Complete — Awaiting Payment Release', color: '#2563eb', bg: '#dbeafe', icon: 'check-circle' },
  completed_paid: { label: 'Paid', color: '#059669', bg: '#d1fae5', icon: 'check-double' },
  disputed: { label: 'Disputed', color: '#dc2626', bg: '#fee2e2', icon: 'exclamation-triangle' },
  refunded: { label: 'Refunded', color: '#6b7280', bg: '#f3f4f6', icon: 'undo' },
  cancelled: { label: 'Cancelled', color: '#6b7280', bg: '#f3f4f6', icon: 'times-circle' },
};

const formatCurrency = (cents: number) => `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
const formatDate = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

const sanitizeAmount = (text: string) => {
  let cleaned = text.replace(/[^0-9.]/g, '');
  const parts = cleaned.split('.');
  if (parts.length > 2) {
    cleaned = parts[0] + '.' + parts.slice(1).join('');
  }
  return cleaned;
};

export default function JobDetailScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RootStackParamList, 'JobDetail'>>();
  const { jobId } = route.params || {};
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  if (!jobId) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: isDark ? '#09090b' : '#ffffff' }}>
        <Text style={{ fontSize: 16, fontWeight: 'bold', color: isDark ? '#ffffff' : '#171717' }}>Invalid Job Reference</Text>
        <Pressable onPress={() => navigation.goBack()} style={{ marginTop: 16, paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#4f46e5', borderRadius: 8 }}>
          <Text style={{ color: 'white', fontWeight: 'bold' }}>Go Back</Text>
        </Pressable>
      </View>
    );
  }
  const insets = useSafeAreaInsets();
  const { userRole, userId } = useAuth();

  const [job, setJob] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showChangeOrder, setShowChangeOrder] = useState(false);
  const [coTitle, setCoTitle] = useState('');
  const [coDescription, setCoDescription] = useState('');
  const [coAmount, setCoAmount] = useState('');

  const loadJob = useCallback(async () => {
    try {
      const data = await getJobById(jobId);
      setJob(data);
    } catch (e) {
      Alert.alert('Error', 'Failed to load job details');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [jobId]);

  useEffect(() => { loadJob(); }, [loadJob]);

  const onRefresh = useCallback(() => { setRefreshing(true); loadJob(); }, [loadJob]);

  const handleAction = async (action: string, fn: () => Promise<any>, successMsg: string) => {
    Alert.alert('Confirm', `Are you sure you want to ${action}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Confirm', style: 'destructive', onPress: async () => {
          setActionLoading(action);
          try {
            await fn();
            Alert.alert('Success', successMsg);
            loadJob();
          } catch (e: any) {
            Alert.alert('Error', e?.message || `Failed to ${action}`);
          } finally {
            setActionLoading(null);
          }
        }
      }
    ]);
  };

  const handleMarkComplete = () => handleAction('mark complete', () => markJobComplete(jobId, job?.completionNotes), 'Job marked as complete. Awaiting payment release from the homeowner.');
  const handleReleaseFunds = () => handleAction('release payment', () => releaseFunds(jobId), 'Payment released to the contractor!');
  const handleCancelJob = () => handleAction('cancel this job', () => cancelJob(jobId), 'Job cancelled successfully.');
  const handleAcceptChangeOrder = (coId: string) => handleAction('accept change order', () => acceptChangeOrder(jobId, coId), 'Change order accepted!');
  const handleDeclineChangeOrder = (coId: string) => handleAction('decline change order', () => declineChangeOrder(jobId, coId), 'Change order declined.');
  const handleCreateChangeOrder = async () => {
    if (!coTitle.trim() || !coAmount.trim()) {
      Alert.alert('Error', 'Title and amount are required.');
      return;
    }
    const parsedAmount = parseFloat(coAmount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      Alert.alert('Error', 'Please enter a valid amount greater than 0.');
      return;
    }
    setActionLoading('changeOrder');
    try {
      await createChangeOrder(jobId, { title: coTitle.trim(), description: coDescription.trim(), amount: Math.round(parsedAmount * 100) });
      Alert.alert('Success', 'Change order sent!');
      setShowChangeOrder(false);
      setCoTitle('');
      setCoDescription('');
      setCoAmount('');
      loadJob();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to create change order');
    } finally {
      setActionLoading(null);
    }
  };


  if (loading) {
    return (
      <View className="flex-1 bg-neutral-50 dark:bg-neutral-950 items-center justify-center">
        <ActivityIndicator size="large" color="#4F46E5" />
      </View>
    );
  }

  if (!job) {
    return (
      <View className="flex-1 bg-neutral-50 dark:bg-neutral-950 items-center justify-center px-8">
        <FontAwesome5 name="exclamation-circle" size={48} color="#9ca3af" />
        <Text className="text-lg font-semibold text-neutral-900 dark:text-neutral-50 mt-4">Job not found</Text>
        <Pressable onPress={() => navigation.goBack()} className="mt-4 px-6 py-3 bg-indigo-600 rounded-xl">
          <Text className="text-white font-semibold">Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const status = STATUS_CONFIG[job.status] || STATUS_CONFIG.awaiting_payment;
  const quote = job.quote || {};
  const isContractor = userRole === 'contractor';
  const isUser = !isContractor;
  const contractor = job.contractor || {};
  const homeowner = job.user || {};
  const changeOrders = job.changeOrders || [];

  return (
    <View className="flex-1 bg-neutral-50 dark:bg-neutral-950" style={{ paddingTop: Math.max(insets.top, 12) }}>
      <View className="flex-row items-center px-4 pb-3 border-b border-neutral-200 dark:border-neutral-800">
        <Pressable onPress={() => navigation.goBack()} className="w-10 h-10 items-center justify-center rounded-full">
          <FontAwesome5 name="arrow-left" size={16} color={isDark ? '#ffffff' : '#171717'} />
        </Pressable>
        <Text className="flex-1 text-[18px] font-bold text-neutral-900 dark:text-neutral-50 ml-2">Job Details</Text>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#4F46E5" />}>
        <View className="px-5 py-4" style={{ gap: 20 }}>

          <View className="p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-[16px] font-bold text-neutral-900 dark:text-neutral-50">{quote.description || quote.projectName || 'Project'}</Text>
              <View className="px-3 py-1 rounded-full" style={{ backgroundColor: status.bg }}>
                <Text className="text-[11px] font-semibold" style={{ color: status.color }}>{status.label}</Text>
              </View>
            </View>
            <View className="flex-row items-center" style={{ gap: 8 }}>
              <FontAwesome5 name={status.icon} size={12} color={status.color} />
              <Text className="text-[13px] text-neutral-500 dark:text-neutral-400">
                {isContractor ? `Client: ${homeowner.firstName || ''} ${homeowner.lastName || ''}` : `Contractor: ${contractor.companyName || 'Contractor'}`}
              </Text>
            </View>
            <Text className="text-[12px] text-neutral-400 dark:text-neutral-500 mt-1">Created {formatDate(job.createdAt)}</Text>
          </View>

          {quote.lineItems && quote.lineItems.length > 0 && (
            <View className="p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
              <Text className="text-[14px] font-bold text-neutral-900 dark:text-neutral-50 mb-3">Pricing</Text>
              {quote.lineItems.map((item: any, i: number) => (
                <View key={i} className="flex-row justify-between py-1.5">
                  <Text className="text-[13px] text-neutral-600 dark:text-neutral-400">{item.description || item.label || `Item ${i + 1}`}</Text>
                  <Text className="text-[13px] font-medium text-neutral-900 dark:text-neutral-50">{formatCurrency(item.amount)}</Text>
                </View>
              ))}
              <View className="h-px bg-neutral-200 dark:bg-neutral-700 my-2" />
              <View className="flex-row justify-between py-1">
                <Text className="text-[12px] text-neutral-500 dark:text-neutral-400">Subtotal</Text>
                <Text className="text-[12px] font-medium text-neutral-700 dark:text-neutral-300">{formatCurrency(quote.subtotal || (quote.lineItems?.reduce((s: number, i: any) => s + (i.amount || 0), 0) || 0))}</Text>
              </View>
              <View className="flex-row justify-between py-1">
                <Text className="text-[12px] text-neutral-500 dark:text-neutral-400">Platform fee (5%)</Text>
                <Text className="text-[12px] text-neutral-500 dark:text-neutral-400">{formatCurrency(quote.serviceFee || Math.round((quote.totalAmount || 0) * 0.05))}</Text>
              </View>
              <View className="h-px bg-neutral-200 dark:bg-neutral-700 my-2" />
              <View className="flex-row justify-between">
                <Text className="text-[14px] font-bold text-neutral-900 dark:text-neutral-50">Total</Text>
                <Text className="text-[14px] font-bold text-indigo-600">{formatCurrency(quote.totalAmount || quote.total || 0)}</Text>
              </View>
              {job.isMilestone && (
                <View className="mt-3 p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl border border-indigo-100 dark:border-indigo-800">
                  <View className="flex-row items-center mb-2" style={{ gap: 6 }}>
                    <FontAwesome5 name="shield-alt" size={12} color="#4F46E5" />
                    <Text className="text-[12px] font-semibold text-indigo-900 dark:text-indigo-200">Milestone Escrow</Text>
                  </View>
                  {job.milestones && job.milestones.map((m: any, i: number) => (
                    <View key={i} className="flex-row justify-between mt-1">
                      <Text className="text-[11px] text-indigo-700 dark:text-indigo-300">{m.name} ({m.status || 'pending'})</Text>
                      <Text className="text-[11px] font-semibold text-indigo-900 dark:text-indigo-200">{formatCurrency(m.amount)}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          {quote.estimatedStartDate && (
            <View className="p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
              <Text className="text-[14px] font-bold text-neutral-900 dark:text-neutral-50 mb-2">Timeline</Text>
              <View className="flex-row items-center" style={{ gap: 8 }}>
                <FontAwesome5 name="calendar" size={14} color="#6b7280" />
                <Text className="text-[13px] text-neutral-600 dark:text-neutral-400">
                  Start: {formatDate(quote.estimatedStartDate)}{quote.startTime ? ` at ${quote.startTime}` : ''}
                </Text>
              </View>
              {quote.estimatedCompletionDate && (
                <View className="flex-row items-center mt-2" style={{ gap: 8 }}>
                  <FontAwesome5 name="flag-checkered" size={14} color="#6b7280" />
                  <Text className="text-[13px] text-neutral-600 dark:text-neutral-400">
                    End: {formatDate(quote.estimatedCompletionDate)}{quote.endTime ? ` at ${quote.endTime}` : ''}
                  </Text>
                </View>
              )}
              {(quote.estimatedDuration || (quote.estimatedStartDate && quote.estimatedCompletionDate)) && (
                <View className="flex-row items-center mt-2" style={{ gap: 8 }}>
                  <FontAwesome5 name="clock" size={14} color="#6b7280" />
                  <Text className="text-[13px] text-neutral-600 dark:text-neutral-400">
                    Duration: {quote.estimatedDuration || (() => {
                      const start = new Date(quote.estimatedStartDate);
                      const end = new Date(quote.estimatedCompletionDate);
                      const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
                      if (diffDays <= 1) return '1 day';
                      if (diffDays <= 7) return `${diffDays} days`;
                      const weeks = Math.round(diffDays / 7);
                      if (weeks === 1) return '1 week';
                      if (weeks < 4) return `${weeks} weeks`;
                      const months = Math.round(diffDays / 30);
                      return `${months} month${months > 1 ? 's' : ''}`;
                    })()}
                  </Text>
                </View>
              )}
            </View>
          )}

          {changeOrders.length > 0 && (
            <View className="p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
              <Text className="text-[14px] font-bold text-neutral-900 dark:text-neutral-50 mb-3">Change Orders</Text>
              {changeOrders.map((co: any) => (
                <View key={co._id} className="pb-3 mb-3 border-b border-neutral-100 dark:border-neutral-800 last:border-b-0 last:mb-0 last:pb-0">
                  <View className="flex-row items-center justify-between">
                    <Text className="text-[13px] font-semibold text-neutral-900 dark:text-neutral-50">{co.title || 'Change Order'}</Text>
                    <View className="px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-900/30">
                      <Text className="text-[10px] font-semibold text-amber-700 dark:text-amber-300">{co.status || 'pending'}</Text>
                    </View>
                  </View>
                  {co.description ? <Text className="text-[12px] text-neutral-500 dark:text-neutral-400 mt-1">{co.description}</Text> : null}
                  <Text className="text-[13px] font-semibold text-neutral-900 dark:text-neutral-50 mt-1">{formatCurrency(co.amount)}</Text>
                  {isUser && co.status === 'pending' && (
                    <View className="flex-row mt-2" style={{ gap: 8 }}>
                      <Pressable onPress={() => handleAcceptChangeOrder(co._id)} className="px-4 py-2 bg-emerald-600 rounded-lg">
                        <Text className="text-[12px] font-semibold text-white">Accept</Text>
                      </Pressable>
                      <Pressable onPress={() => handleDeclineChangeOrder(co._id)} className="px-4 py-2 bg-red-500 rounded-lg">
                        <Text className="text-[12px] font-semibold text-white">Decline</Text>
                      </Pressable>
                    </View>
                  )}
                </View>
              ))}
            </View>
          )}

          {job.progressPhotos && job.progressPhotos.length > 0 && (
            <View className="p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
              <Text className="text-[14px] font-bold text-neutral-900 dark:text-neutral-50 mb-3">Progress Photos</Text>
              <View className="flex-row flex-wrap" style={{ gap: 8 }}>
                {job.progressPhotos.map((url: string, i: number) => (
                  <Pressable key={i} onPress={() => Linking.openURL(url)}>
                    <View className="w-20 h-20 rounded-lg bg-neutral-200 dark:bg-neutral-700 items-center justify-center overflow-hidden">
                      <FontAwesome5 name="image" size={20} color="#9ca3af" />
                    </View>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          {job.disputeStatus && (job.disputeStatus === 'pending' || job.disputeStatus === 'under_review') && (
            <View className="p-4 rounded-2xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20">
              <View className="flex-row items-center mb-2" style={{ gap: 8 }}>
                <FontAwesome5 name="exclamation-triangle" size={16} color="#dc2626" />
                <Text className="text-[14px] font-bold text-red-700 dark:text-red-300">Dispute Active</Text>
              </View>
              {job.disputeReason && <Text className="text-[13px] text-red-600 dark:text-red-400">{job.disputeReason}</Text>}
              {isUser && (
                <View className="mt-3" style={{ gap: 8 }}>
                  <Text className="text-[12px] text-red-600 dark:text-red-400">Our team is reviewing your dispute. You can cancel it to resume the job, or wait for an admin to resolve it.</Text>
                  <Pressable
                    onPress={() => Alert.alert('Cancel Dispute', 'This will cancel your dispute and resume the job. Continue?', [
                      { text: 'No', style: 'cancel' },
                      { text: 'Cancel Dispute', style: 'destructive', onPress: async () => { setActionLoading('cancelDispute'); try { await cancelDispute(jobId); Alert.alert('Dispute Cancelled', 'Your dispute has been cancelled and the job resumed.'); loadJob(); } catch (e: any) { Alert.alert('Error', e?.message || 'Failed to cancel dispute'); } finally { setActionLoading(null); } },
                      },
                    ])}
                    className="px-4 py-2.5 bg-white dark:bg-neutral-800 border border-red-300 dark:border-red-700 rounded-lg items-center"
                  >
                    <Text className="text-[13px] font-semibold text-red-700 dark:text-red-300">Cancel Dispute & Resume Job</Text>
                  </Pressable>
                </View>
              )}
            </View>
          )}

          {job.disputeStatus === 'resolved' && (
            <View className="p-4 rounded-2xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20">
              <View className="flex-row items-center mb-2" style={{ gap: 8 }}>
                <FontAwesome5 name="check-circle" size={16} color="#059669" />
                <Text className="text-[14px] font-bold text-emerald-700 dark:text-emerald-300">Dispute Resolved</Text>
              </View>
              {job.resolutionAction && (
                <Text className="text-[13px] font-semibold text-emerald-800 dark:text-emerald-200 mb-1">
                  Resolution Action: {job.resolutionAction === 'release_all' ? 'Funds released to contractor' :
                                      job.resolutionAction === 'refund_all' ? 'Funds refunded to homeowner' :
                                      job.resolutionAction === 'split' ? 'Funds split between contractor and homeowner' :
                                      'Job resumed'}
                </Text>
              )}
              {job.resolutionNotes && <Text className="text-[13px] text-emerald-600 dark:text-emerald-400">{job.resolutionNotes}</Text>}
            </View>
          )}

          <View className="p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
            <Text className="text-[14px] font-bold text-neutral-900 dark:text-neutral-50 mb-3">Actions</Text>
            <View style={{ gap: 10 }}>
              {isContractor && job.status === 'funded_in_progress' && (
                <Pressable
                  onPress={handleMarkComplete}
                  disabled={actionLoading === 'mark complete'}
                  className="flex-row items-center justify-center py-3.5 bg-emerald-600 rounded-xl"
                  style={{ gap: 8 }}
                >
                  {actionLoading === 'mark complete' ? <ActivityIndicator size="small" color="#fff" /> : <FontAwesome5 name="check-circle" size={14} color="#fff" />}
                  <Text className="text-[14px] font-bold text-white">Mark Job Complete</Text>
                </Pressable>
              )}
              {isContractor && job.status === 'funded_in_progress' && (
                <Pressable
                  onPress={() => setShowChangeOrder(true)}
                  className="flex-row items-center justify-center py-3.5 bg-amber-500 rounded-xl"
                  style={{ gap: 8 }}
                >
                  <FontAwesome5 name="file-alt" size={14} color="#fff" />
                  <Text className="text-[14px] font-bold text-white">Create Change Order</Text>
                </Pressable>
              )}
              {isUser && ['awaiting_payment', 'partially_funded', 'accepted'].includes(job.status) && (
                <Pressable
                  onPress={() => navigation.navigate('PaymentFlow', {
                    jobId: job._id,
                    quoteId: job.quote?._id,
                    totalAmount: job.quote?.totalAmount || job.quote?.total || 0,
                    contractorName: contractor.companyName || contractor.businessName || 'Contractor',
                    description: job.quote?.description || job.quote?.projectName || 'Project Payment'
                  })}
                  className="flex-row items-center justify-center py-3.5 bg-indigo-600 rounded-xl"
                  style={{ gap: 8 }}
                >
                  <FontAwesome5 name="credit-card" size={14} color="#fff" />
                  <Text className="text-[14px] font-bold text-white">Complete Payment</Text>
                </Pressable>
              )}
              {isUser && (job.status === 'completed_pending_release' || (job.isMilestone && job.status === 'funded_in_progress')) && (
                <Pressable
                  onPress={handleReleaseFunds}
                  disabled={actionLoading === 'release payment'}
                  className="flex-row items-center justify-center py-3.5 bg-indigo-600 rounded-xl"
                  style={{ gap: 8 }}
                >
                  {actionLoading === 'release payment' ? <ActivityIndicator size="small" color="#fff" /> : <FontAwesome5 name="dollar-sign" size={14} color="#fff" />}
                  <Text className="text-[14px] font-bold text-white">Release Payment</Text>
                </Pressable>
              )}
              {isUser && !['disputed', 'cancelled', 'refunded', 'completed_paid'].includes(job.status) && (
                <Pressable
                  onPress={() => navigation.navigate('DisputeScreen', { jobId: job._id })}
                  className="flex-row items-center justify-center py-3 rounded-xl border border-red-300 dark:border-red-800"
                  style={{ gap: 8 }}
                >
                  <FontAwesome5 name="flag" size={12} color="#dc2626" />
                  <Text className="text-[13px] font-semibold text-red-600 dark:text-red-400">Raise Dispute</Text>
                </Pressable>
              )}
              {['awaiting_payment', 'funded_in_progress'].includes(job.status) && (
                <Pressable
                  onPress={handleCancelJob}
                  disabled={actionLoading === 'cancel this job'}
                  className="flex-row items-center justify-center py-3 rounded-xl border border-neutral-300 dark:border-neutral-600"
                  style={{ gap: 8 }}
                >
                  <FontAwesome5 name="times" size={12} color="#737373" />
                  <Text className="text-[13px] font-medium text-neutral-500 dark:text-neutral-400">Cancel Job</Text>
                </Pressable>
              )}
            </View>
          </View>

          <View className="h-8" />
        </View>
      </ScrollView>

      {showChangeOrder && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <Pressable className="absolute inset-0" onPress={() => setShowChangeOrder(false)} />
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={{ flex: 1, justifyContent: 'flex-end' }}
          >
            <View className="bg-white dark:bg-neutral-950 rounded-t-2xl p-5" style={{ paddingBottom: insets.bottom + 20 }}>
              <View className="flex-row items-center justify-between mb-4">
                <Text className="text-[17px] font-bold text-neutral-900 dark:text-neutral-50">Change Order</Text>
                <Pressable onPress={() => setShowChangeOrder(false)} className="w-8 h-8 items-center justify-center rounded-full bg-neutral-100 dark:bg-neutral-800">
                  <FontAwesome5 name="times" size={14} color="#737373" />
                </Pressable>
              </View>
              <View className="mb-3">
                <Text className="text-[12px] font-semibold text-neutral-500 dark:text-neutral-400 mb-1">Title</Text>
                <View className="border border-neutral-200 dark:border-neutral-700 rounded-xl px-3 py-2.5 bg-white dark:bg-neutral-900">
                  <TextInput value={coTitle} onChangeText={setCoTitle} placeholder="e.g., Additional electrical work" placeholderTextColor="#a3a3a3" className="text-[14px] text-neutral-900 dark:text-neutral-50" />
                </View>
              </View>
              <View className="mb-3">
                <Text className="text-[12px] font-semibold text-neutral-500 dark:text-neutral-400 mb-1">Description</Text>
                <View className="border border-neutral-200 dark:border-neutral-700 rounded-xl px-3 py-2.5 bg-white dark:bg-neutral-900">
                  <TextInput value={coDescription} onChangeText={setCoDescription} placeholder="Describe the additional work..." placeholderTextColor="#a3a3a3" className="text-[14px] text-neutral-900 dark:text-neutral-50" multiline numberOfLines={3} style={{ minHeight: 60, textAlignVertical: 'top' }} />
                </View>
              </View>
              <View className="mb-4">
                <Text className="text-[12px] font-semibold text-neutral-500 dark:text-neutral-400 mb-1">Additional Amount ($)</Text>
                <View className="flex-row items-center border border-neutral-200 dark:border-neutral-700 rounded-xl px-3 bg-white dark:bg-neutral-900">
                  <Text className="text-[14px] text-neutral-400">$</Text>
                  <TextInput value={coAmount} onChangeText={(text) => setCoAmount(sanitizeAmount(text))} placeholder="0" placeholderTextColor="#a3a3a3" keyboardType="decimal-pad" className="flex-1 py-2.5 text-[14px] font-semibold text-neutral-900 dark:text-neutral-50" />
                </View>
              </View>
              <Pressable
                onPress={handleCreateChangeOrder}
                disabled={!coTitle.trim() || !coAmount.trim() || actionLoading === 'changeOrder'}
                className={`w-full py-3.5 rounded-xl items-center justify-center flex-row ${coTitle.trim() && coAmount.trim() ? 'bg-amber-500' : 'bg-neutral-200 dark:bg-neutral-700'}`}
                style={{ gap: 8 }}
              >
                {actionLoading === 'changeOrder' ? <ActivityIndicator size="small" color="#fff" /> : <FontAwesome5 name="paper-plane" size={13} color={coTitle.trim() && coAmount.trim() ? '#fff' : '#a3a3a3'} />}
                <Text className={`text-[14px] font-bold ${coTitle.trim() && coAmount.trim() ? 'text-white' : 'text-neutral-400'}`}>Send Change Order</Text>
              </Pressable>
            </View>
          </KeyboardAvoidingView>
        </View>
      )}
    </View>
  );
}