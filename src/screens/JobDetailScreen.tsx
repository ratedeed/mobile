import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Alert,
  Platform,
  Linking,
  TextInput,
  KeyboardAvoidingView,
  Image,
} from 'react-native';
import { useNavigation, useRoute, RouteProp, useFocusEffect } from '@react-navigation/native';
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
  uploadProgressPhoto,
  getPlatformFeePercent,
} from '../utils/apiClient';
import { useAuth } from '../context/AuthContext';
import HapticFeedback from '../utils/haptics';
import * as ImagePicker from 'expo-image-picker';
import { uploadToCloudinary, CLOUDINARY_FOLDERS } from '../utils/cloudinary';
import { requestPhotoLibraryPermission } from '../utils/permissions';
import { BouncingDotsLoader, BouncingRefreshScrollView } from '../components/common';

type RootStackParamList = {
  JobDetail: { jobId: string };
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  awaiting_payment: { label: 'Awaiting Payment', color: '#d97706', bg: '#fef3c7', icon: 'clock' },
  partially_funded: { label: 'Partially Funded', color: '#d97706', bg: '#fef3c7', icon: 'clock' },
  funded_in_progress: { label: 'In Progress', color: '#059669', bg: '#d1fae5', icon: 'hammer' },
  completed_pending_release: {
    label: 'Complete — Awaiting Payment Release',
    color: '#2563eb',
    bg: '#dbeafe',
    icon: 'check-circle',
  },
  completed_paid: { label: 'Paid', color: '#059669', bg: '#d1fae5', icon: 'check-double' },
  disputed: { label: 'Disputed', color: '#dc2626', bg: '#fee2e2', icon: 'exclamation-triangle' },
  refunded: { label: 'Refunded', color: '#6b7280', bg: '#f3f4f6', icon: 'undo' },
  cancelled: { label: 'Cancelled', color: '#6b7280', bg: '#f3f4f6', icon: 'times-circle' },
};

const JOB_FLOW = [
  { status: 'awaiting_payment', label: 'Accepted', icon: 'check-circle' },
  { status: 'funded_in_progress', label: 'Funded', icon: 'dollar-sign' },
  { status: 'completed_pending_release', label: 'Done', icon: 'hammer' },
  { status: 'completed_paid', label: 'Released', icon: 'unlock' },
  { status: 'reviewed', label: 'Reviewed', icon: 'star' },
];

const formatCurrency = (cents: number) => `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
const formatDate = (d: string) =>
  new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

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

  const insets = useSafeAreaInsets();
  const { userRole, userId } = useAuth();

  const [job, setJob] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [feePercent, setFeePercent] = useState(5);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const res = await getPlatformFeePercent();
        if (res && res.platformFeePercent !== undefined && isMounted) {
          setFeePercent(res.platformFeePercent);
        }
      } catch {
        // Fallback to 5%
      }
    })();
    return () => {
      isMounted = false;
    };
  }, []);
  const [showChangeOrder, setShowChangeOrder] = useState(false);
  const [coTitle, setCoTitle] = useState('');
  const [coDescription, setCoDescription] = useState('');
  const [coAmount, setCoAmount] = useState('');
  const [uploadProgressPhotoLoading, setUploadProgressPhotoLoading] = useState(false);

  const loadJob = useCallback(async () => {
    if (!jobId) return;
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

  useFocusEffect(
    useCallback(() => {
      loadJob();
    }, [loadJob])
  );

  if (!jobId) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: isDark ? '#09090b' : '#ffffff',
        }}
      >
        <Text style={{ fontSize: 16, fontWeight: 'bold', color: isDark ? '#ffffff' : '#171717' }}>
          Invalid Job Reference
        </Text>
        <Pressable
          onPress={() => navigation.goBack()}
          style={{
            marginTop: 16,
            paddingHorizontal: 16,
            paddingVertical: 8,
            backgroundColor: '#4f46e5',
            borderRadius: 8,
          }}
        >
          <Text style={{ color: 'white', fontWeight: 'bold' }}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const handleUploadProgressPhoto = async () => {
    const hasPermission = await requestPhotoLibraryPermission();
    if (!hasPermission) {
      Alert.alert('Permission Denied', 'Please grant photo library access to upload a progress photo.');
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
        allowsMultipleSelection: true,
        selectionLimit: 10,
      });

      if (result.canceled || !result.assets?.length) return;
      const assets = result.assets;

      for (const asset of assets) {
        if (asset.fileSize && asset.fileSize > 5 * 1024 * 1024) {
          Alert.alert('File too large', 'One or more selected images exceed 5MB and were skipped.');
        }
      }

      const validAssets = assets.filter((a) => !a.fileSize || a.fileSize <= 5 * 1024 * 1024);
      if (!validAssets.length) return;

      setUploadProgressPhotoLoading(true);
      let uploaded = 0;
      let firstError: string | null = null;
      for (const asset of validAssets) {
        try {
          const cloudinaryUrl = await uploadToCloudinary(asset.uri, CLOUDINARY_FOLDERS.CHAT);
          if (!cloudinaryUrl) {
            throw new Error('Upload failed — no URL returned from server');
          }
          await uploadProgressPhoto(jobId, cloudinaryUrl);
          uploaded++;
        } catch (err: any) {
          if (!firstError) firstError = err?.message || 'Failed to upload one or more photos';
        }
      }

      if (uploaded > 0) {
        HapticFeedback.success();
        Alert.alert(
          'Success',
          uploaded === 1
            ? 'Progress photo uploaded successfully!'
            : `${uploaded} progress photos uploaded successfully!` +
              (firstError ? `\n\nSome photos failed: ${firstError}` : '')
        );
        loadJob();
      } else if (firstError) {
        Alert.alert('Error', firstError);
      }
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to upload progress photo');
    } finally {
      setUploadProgressPhotoLoading(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadJob();
  }, [loadJob]);

  const handleAction = async (
    action: string,
    fn: () => Promise<any>,
    successMsg: string,
    extraWarning?: string
  ) => {
    if (actionLoading) return;
    setActionLoading(action);
    const body = extraWarning
      ? `Are you sure you want to ${action}?\n\n${extraWarning}`
      : `Are you sure you want to ${action}?`;
    Alert.alert('Confirm', body, [
      { 
        text: 'Cancel', 
        style: 'cancel',
        onPress: () => setActionLoading(null)
      },
      {
        text: 'Confirm',
        style: 'destructive',
        onPress: async () => {
          try {
            await fn();
            if (action.includes('cancel')) {
              HapticFeedback.warning();
            } else {
              HapticFeedback.success();
            }
            Alert.alert('Success', successMsg);
            loadJob();
          } catch (e: any) {
            HapticFeedback.error();
            Alert.alert('Error', e?.message || `Failed to ${action}`);
          } finally {
            setActionLoading(null);
          }
        },
      },
    ]);
  };

  const handleMarkComplete = () =>
    handleAction(
      'mark complete',
      () => markJobComplete(jobId, job?.completionNotes),
      'Job marked as complete. Awaiting payment release from the homeowner.'
    );
  const handleReleaseFunds = () =>
    handleAction('release payment', () => releaseFunds(jobId), 'Payment released to the contractor!');
  const handleReleaseMilestone = (milestoneId: string, milestoneName: string) => {
    Alert.alert(
      'Release Milestone',
      `Are you sure you want to release payment for "${milestoneName}" to the contractor? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Release',
          onPress: () => {
            handleAction(
              'release milestone',
              () => releaseFunds(jobId, milestoneId),
              `Payment for milestone "${milestoneName}" released!`
            );
          }
        }
      ]
    );
  };
  const handleCancelJob = () => {
    const isFunded = ['funded_in_progress', 'partially_funded'].includes(job?.status);
    let warning = undefined;
    if (isFunded) {
      if (isContractor) {
        warning = 'The homeowner will be fully refunded. This will count against your cancellation record on your public profile.';
      } else {
        warning = 'This will cancel the job and refund your payment from escrow.';
      }
    }
    return handleAction('cancel this job', () => cancelJob(jobId), 'Job cancelled successfully.', warning);
  };
  const handleAcceptChangeOrder = (coId: string) =>
    handleAction('accept change order', () => acceptChangeOrder(jobId, coId), 'Change order accepted!');
  const handleDeclineChangeOrder = (coId: string) =>
    handleAction('decline change order', () => declineChangeOrder(jobId, coId), 'Change order declined.');
  const handleCreateChangeOrder = async () => {
    if (!coTitle.trim() || !coAmount.trim()) {
      HapticFeedback.error();
      Alert.alert('Error', 'Title and amount are required.');
      return;
    }
    const parsedAmount = parseFloat(coAmount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      HapticFeedback.error();
      Alert.alert('Error', 'Please enter a valid amount greater than 0.');
      return;
    }
    setActionLoading('changeOrder');
    try {
      await createChangeOrder(jobId, {
        title: coTitle.trim(),
        description: coDescription.trim(),
        amount: Math.round(parsedAmount * 100),
      });
      HapticFeedback.success();
      Alert.alert('Success', 'Change order sent!');
      setShowChangeOrder(false);
      setCoTitle('');
      setCoDescription('');
      setCoAmount('');
      loadJob();
    } catch (e: any) {
      HapticFeedback.error();
      Alert.alert('Error', e?.message || 'Failed to create change order');
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <View className="flex-1 bg-neutral-50 dark:bg-neutral-950 items-center justify-center">
        <BouncingDotsLoader size="large" color="#4F46E5" />
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

  const currentStepIndex = (() => {
    if (job.status === 'completed_paid' && job.isReviewed) return 4;
    const idx = JOB_FLOW.findIndex(s => s.status === job.status);
    if (idx !== -1) return idx;
    if (['partially_funded'].includes(job.status)) return 1;
    if (['completed', 'paid'].includes(job.status)) return 3;
    return 0;
  })();

  return (
    <View className="flex-1 bg-neutral-50 dark:bg-neutral-950" style={{ paddingTop: Math.max(insets.top, 12) }}>
      <View className="flex-row items-center px-4 pb-3 border-b border-neutral-200 dark:border-neutral-800">
        <Pressable onPress={() => navigation.goBack()} className="w-10 h-10 items-center justify-center rounded-full">
          <FontAwesome5 name="arrow-left" size={16} color={isDark ? '#ffffff' : '#171717'} />
        </Pressable>
        <Text className="flex-1 text-[18px] font-bold text-neutral-900 dark:text-neutral-50 ml-2">Job Details</Text>
      </View>

      <BouncingRefreshScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        refreshing={refreshing}
        onRefresh={onRefresh}
        loaderColor="#4F46E5"
      >
        <View className="px-5 py-4" style={{ gap: 20 }}>
          <View className="p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-[16px] font-bold text-neutral-900 dark:text-neutral-50 flex-1 mr-3">
                {quote.description || quote.projectName || 'Project'}
              </Text>
              <View className="px-3 py-1 rounded-full shrink-0" style={{ backgroundColor: status.bg }}>
                <Text className="text-[11px] font-semibold" style={{ color: status.color }}>
                  {status.label}
                </Text>
              </View>
            </View>
            <View className="flex-row items-center" style={{ gap: 8 }}>
              <FontAwesome5 name={status.icon} size={12} color={status.color} />
              <Text className="text-[13px] text-neutral-500 dark:text-neutral-400">
                {isContractor
                  ? `Client: ${homeowner.firstName || ''} ${homeowner.lastName || ''}`
                  : `Contractor: ${contractor.companyName || 'Contractor'}`}
              </Text>
            </View>
            <Text className="text-[12px] text-neutral-400 dark:text-neutral-500 mt-1">
              Created {formatDate(job.createdAt)}
            </Text>
          </View>

          {/* Escrow Timeline */}
          {!['cancelled', 'refunded', 'disputed'].includes(job.status) ? (
            <View className="p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
              <Text className="text-[13px] font-bold text-neutral-950 dark:text-neutral-50 mb-4 uppercase tracking-wider text-center">
                Escrow Milestone Timeline
              </Text>
              
              <View className="flex-row items-center justify-between px-2 relative">
                {/* Horizontal track line in background */}
                <View className="absolute left-6 right-6 top-[15px] h-0.5 bg-neutral-200 dark:bg-neutral-800 z-0" />
                
                {/* Filled track line based on progress */}
                <View 
                  className="absolute left-6 top-[15px] h-0.5 bg-indigo-600 z-0" 
                  style={{ 
                    width: `${Math.max(0, (currentStepIndex / 4) * 100)}%`,
                    left: 24,
                    right: 24
                  }} 
                />

                {JOB_FLOW.map((flowStep, idx) => {
                  const isCompleted = idx < currentStepIndex;
                  const isCurrent = idx === currentStepIndex;

                  return (
                    <View key={flowStep.status} className="items-center z-10 flex-1">
                      <View 
                        className={`w-8 h-8 rounded-full items-center justify-center border-2 ${
                          isCompleted 
                            ? 'bg-indigo-600 border-indigo-600' 
                            : isCurrent 
                              ? 'bg-white dark:bg-neutral-900 border-indigo-600' 
                              : 'bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800'
                        }`}
                      >
                        <FontAwesome5 
                          name={flowStep.icon} 
                          size={11} 
                          color={isCompleted ? '#ffffff' : isCurrent ? '#4F46E5' : '#a3a3a3'} 
                        />
                      </View>
                      <Text 
                        className={`text-[9px] mt-1.5 font-semibold text-center ${
                          isCurrent 
                            ? 'text-indigo-600 font-bold' 
                            : isCompleted 
                              ? 'text-neutral-700 dark:text-neutral-300' 
                              : 'text-neutral-400 dark:text-neutral-500'
                        }`}
                        numberOfLines={1}
                      >
                        {flowStep.label}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>
          ) : job.status === 'disputed' ? (
            <View className="p-4 rounded-2xl border border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-900/50 flex-row items-center" style={{ gap: 12 }}>
              <View className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 items-center justify-center">
                <FontAwesome5 name="gavel" size={16} color="#DC2626" />
              </View>
              <View className="flex-1">
                <Text className="text-[14px] font-bold text-red-800 dark:text-red-300">Escrow Dispute Active</Text>
                <Text className="text-[12px] text-red-600 dark:text-red-400 mt-0.5">Escrow release has been halted until resolution.</Text>
              </View>
            </View>
          ) : (
            <View className="p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 flex-row items-center" style={{ gap: 12 }}>
              <View className="w-10 h-10 rounded-full bg-neutral-100 dark:bg-neutral-800 items-center justify-center">
                <FontAwesome5 name="times-circle" size={18} color="#737373" />
              </View>
              <View className="flex-1">
                <Text className="text-[14px] font-bold text-neutral-800 dark:text-neutral-200">Timeline Cancelled</Text>
                <Text className="text-[12px] text-neutral-500 dark:text-neutral-400 mt-0.5">This project has been cancelled or refunded.</Text>
              </View>
            </View>
          )}

          {quote.lineItems && quote.lineItems.length > 0 && (
            <View className="p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
              <Text className="text-[14px] font-bold text-neutral-900 dark:text-neutral-50 mb-3">Pricing</Text>
              {quote.lineItems.map((item: any, i: number) => (
                <View key={i} className="flex-row justify-between py-1.5">
                  <Text className="text-[13px] text-neutral-600 dark:text-neutral-400">
                    {item.description || item.label || `Item ${i + 1}`}
                  </Text>
                  <Text className="text-[13px] font-medium text-neutral-900 dark:text-neutral-50">
                    {formatCurrency(item.amount)}
                  </Text>
                </View>
              ))}
              <View className="h-px bg-neutral-200 dark:bg-neutral-700 my-2" />
              <View className="flex-row justify-between py-1">
                <Text className="text-[12px] text-neutral-500 dark:text-neutral-400">Subtotal</Text>
                <Text className="text-[12px] font-medium text-neutral-700 dark:text-neutral-300">
                  {formatCurrency(
                    quote.subtotal || quote.lineItems?.reduce((s: number, i: any) => s + (i.amount || 0), 0) || 0
                  )}
                </Text>
              </View>
              {(() => {
                const subtotalVal = quote.subtotal || quote.lineItems?.reduce((s: number, i: any) => s + (i.amount || 0), 0) || 0;
                const serviceFeeVal = quote.serviceFee || Math.round((quote.totalAmount || 0) * (feePercent / 100));
                const displayFeePercent = subtotalVal > 0 ? Math.round((serviceFeeVal / subtotalVal) * 100) : feePercent;
                return (
                  <View className="flex-row justify-between py-1">
                    <Text className="text-[12px] text-neutral-500 dark:text-neutral-400">Platform fee ({displayFeePercent}%)</Text>
                    <Text className="text-[12px] text-neutral-500 dark:text-neutral-400">
                      {formatCurrency(serviceFeeVal)}
                    </Text>
                  </View>
                );
              })()}
              <View className="h-px bg-neutral-200 dark:bg-neutral-700 my-2" />
              <View className="flex-row justify-between">
                <Text className="text-[14px] font-bold text-neutral-900 dark:text-neutral-50">Total</Text>
                <Text className="text-[14px] font-bold text-indigo-600">
                  {formatCurrency(quote.totalAmount || quote.total || 0)}
                </Text>
              </View>
              {job.isMilestone && (
                <View className="mt-3 p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl border border-indigo-100 dark:border-indigo-800">
                  <View className="flex-row items-center mb-2" style={{ gap: 6 }}>
                    <FontAwesome5 name="shield-alt" size={12} color="#4F46E5" />
                    <Text className="text-[12px] font-semibold text-indigo-900 dark:text-indigo-200">
                      Milestone Escrow
                    </Text>
                  </View>
                  {job.milestones &&
                    job.milestones.map((m: any, i: number) => (
                      <View key={i} className="flex-row items-center justify-between mt-2">
                        <View className="flex-1 pr-2">
                          <Text className="text-[12px] font-semibold text-indigo-900 dark:text-indigo-200">
                            {m.name}
                          </Text>
                          <Text className="text-[10px] text-indigo-700 dark:text-indigo-400 capitalize">
                            Status: {m.status || 'pending'}
                          </Text>
                        </View>
                        <View className="flex-row items-center" style={{ gap: 8 }}>
                          <Text className="text-[12px] font-bold text-indigo-900 dark:text-indigo-200">
                            {formatCurrency(m.amount)}
                          </Text>
                          {isUser && m.status === 'funded' && (
                            <Pressable
                              onPress={() => handleReleaseMilestone(m._id, m.name)}
                              disabled={actionLoading !== null}
                              className="px-2.5 py-1.5 bg-indigo-600 rounded-lg"
                            >
                              <Text className="text-[10px] font-bold text-white">Release</Text>
                            </Pressable>
                          )}
                        </View>
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
                  Start: {formatDate(quote.estimatedStartDate)}
                  {quote.startTime ? ` at ${quote.startTime}` : ''}
                </Text>
              </View>
              {quote.estimatedCompletionDate && (
                <View className="flex-row items-center mt-2" style={{ gap: 8 }}>
                  <FontAwesome5 name="flag-checkered" size={14} color="#6b7280" />
                  <Text className="text-[13px] text-neutral-600 dark:text-neutral-400">
                    End: {formatDate(quote.estimatedCompletionDate)}
                    {quote.endTime ? ` at ${quote.endTime}` : ''}
                  </Text>
                </View>
              )}
              {(quote.estimatedDuration || (quote.estimatedStartDate && quote.estimatedCompletionDate)) && (
                <View className="flex-row items-center mt-2" style={{ gap: 8 }}>
                  <FontAwesome5 name="clock" size={14} color="#6b7280" />
                  <Text className="text-[13px] text-neutral-600 dark:text-neutral-400">
                    Duration:{' '}
                    {quote.estimatedDuration ||
                      (() => {
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
                <View
                  key={co._id}
                  className="pb-3 mb-3 border-b border-neutral-100 dark:border-neutral-800 last:border-b-0 last:mb-0 last:pb-0"
                >
                  <View className="flex-row items-center justify-between">
                    <Text className="text-[13px] font-semibold text-neutral-900 dark:text-neutral-50">
                      {co.title || 'Change Order'}
                    </Text>
                    <View className="px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-900/30">
                      <Text className="text-[10px] font-semibold text-amber-700 dark:text-amber-300">
                        {co.status || 'pending'}
                      </Text>
                    </View>
                  </View>
                  {co.description ? (
                    <Text className="text-[12px] text-neutral-500 dark:text-neutral-400 mt-1">{co.description}</Text>
                  ) : null}
                  <Text className="text-[13px] font-semibold text-neutral-900 dark:text-neutral-50 mt-1">
                    {formatCurrency(co.amount)}
                  </Text>
                  {isUser && co.status === 'pending' && (
                    <View className="flex-row mt-2" style={{ gap: 8 }}>
                      <Pressable
                        onPress={() => handleAcceptChangeOrder(co._id)}
                        className="px-4 py-2 bg-emerald-600 rounded-lg"
                      >
                        <Text className="text-[12px] font-semibold text-white">Accept</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => handleDeclineChangeOrder(co._id)}
                        className="px-4 py-2 bg-red-500 rounded-lg"
                      >
                        <Text className="text-[12px] font-semibold text-white">Decline</Text>
                      </Pressable>
                    </View>
                  )}
                </View>
              ))}
            </View>
          )}

          {((job.progressPhotos && job.progressPhotos.length > 0) || isContractor) && (
            <View className="p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
              <View className="flex-row justify-between items-center mb-3">
                <Text className="text-[14px] font-bold text-neutral-900 dark:text-neutral-50">Progress Photos</Text>
                {isContractor && (
                  <Pressable
                    onPress={handleUploadProgressPhoto}
                    disabled={uploadProgressPhotoLoading}
                    className="flex-row items-center bg-indigo-50 dark:bg-indigo-950/40 px-3 py-1.5 rounded-lg border border-indigo-200 dark:border-indigo-900"
                    style={{ gap: 6 }}
                  >
                    {uploadProgressPhotoLoading ? (
                      <BouncingDotsLoader size="small" color="#4F46E5" />
                    ) : (
                      <>
                        <FontAwesome5 name="camera" size={12} color="#4F46E5" />
                        <Text className="text-[12px] font-semibold text-indigo-600 dark:text-indigo-400">Upload</Text>
                      </>
                    )}
                  </Pressable>
                )}
              </View>
              {job.progressPhotos && job.progressPhotos.length > 0 ? (
                <View className="flex-row flex-wrap" style={{ gap: 8 }}>
                  {job.progressPhotos.map((url: string, i: number) => (
                    <Pressable key={i} onPress={() => Linking.openURL(url)}>
                      <View className="w-20 h-20 rounded-lg bg-neutral-100 dark:bg-neutral-800 items-center justify-center overflow-hidden border border-neutral-200 dark:border-neutral-700">
                        <Image source={{ uri: url }} style={{ width: '100%', height: '100%', resizeMode: 'cover' }} />
                      </View>
                    </Pressable>
                  ))}
                </View>
              ) : (
                <Text className="text-[13px] text-neutral-400 dark:text-neutral-500">No progress photos uploaded yet.</Text>
              )}
            </View>
          )}

          {job.disputeStatus && (job.disputeStatus === 'pending' || job.disputeStatus === 'under_review') && (
            <View className="p-4 rounded-2xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20">
              <View className="flex-row items-center mb-2" style={{ gap: 8 }}>
                <FontAwesome5 name="exclamation-triangle" size={16} color="#dc2626" />
                <Text className="text-[14px] font-bold text-red-700 dark:text-red-300">Dispute Active</Text>
              </View>
              {job.disputeReason && (
                <Text className="text-[13px] text-red-600 dark:text-red-400">{job.disputeReason}</Text>
              )}
              {isUser && (
                <View className="mt-3" style={{ gap: 8 }}>
                  <Text className="text-[12px] text-red-600 dark:text-red-400">
                    Our team is reviewing your dispute. You can cancel it to resume the job, or wait for an admin to
                    resolve it.
                  </Text>
                  <Pressable
                    onPress={() =>
                      Alert.alert('Cancel Dispute', 'This will cancel your dispute and resume the job. Continue?', [
                        { text: 'No', style: 'cancel' },
                        {
                          text: 'Cancel Dispute',
                          style: 'destructive',
                          onPress: async () => {
                            setActionLoading('cancelDispute');
                            try {
                              await cancelDispute(jobId);
                              Alert.alert('Dispute Cancelled', 'Your dispute has been cancelled and the job resumed.');
                              loadJob();
                            } catch (e: any) {
                              Alert.alert('Error', e?.message || 'Failed to cancel dispute');
                            } finally {
                              setActionLoading(null);
                            }
                          },
                        },
                      ])
                    }
                    className="px-4 py-2.5 bg-white dark:bg-neutral-800 border border-red-300 dark:border-red-700 rounded-lg items-center"
                  >
                    <Text className="text-[13px] font-semibold text-red-700 dark:text-red-300">
                      Cancel Dispute & Resume Job
                    </Text>
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
                  Resolution Action:{' '}
                  {job.resolutionAction === 'release_all'
                    ? 'Funds released to contractor'
                    : job.resolutionAction === 'refund_all'
                      ? 'Funds refunded to homeowner'
                      : job.resolutionAction === 'split'
                        ? 'Funds split between contractor and homeowner'
                        : 'Job resumed'}
                </Text>
              )}
              {job.resolutionNotes && (
                <Text className="text-[13px] text-emerald-600 dark:text-emerald-400">{job.resolutionNotes}</Text>
              )}
            </View>
          )}

          <View className="p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
            <Text className="text-[14px] font-bold text-neutral-900 dark:text-neutral-50 mb-3">Actions</Text>
            <View style={{ gap: 10 }}>
              {isContractor && job.status === 'funded_in_progress' && (
                <Pressable
                  onPress={handleMarkComplete}
                  disabled={actionLoading !== null}
                  className="flex-row items-center justify-center py-3.5 bg-emerald-600 rounded-xl"
                  style={{ gap: 8 }}
                >
                  {actionLoading === 'mark complete' ? (
                      <BouncingDotsLoader size="small" color="#fff" />
                  ) : (
                    <FontAwesome5 name="check-circle" size={14} color="#fff" />
                  )}
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
                  onPress={() => {
                    // 1. Check if the contractor is fully set up on Stripe
                    if (!contractor || !contractor.stripeAccountId || !contractor.stripeAccountChargesEnabled) {
                      Alert.alert(
                        'Payment Not Available',
                        'This contractor is not fully set up to receive payments yet. Please contact the contractor to verify their Stripe account.'
                      );
                      return;
                    }

                    // 2. Check if the quote is rejected or expired
                    if (job.quote) {
                      if (job.quote.status === 'rejected') {
                        Alert.alert(
                          'Payment Blocked',
                          'This quote has been rejected or withdrawn. Payment cannot be processed.'
                        );
                        return;
                      }
                      if (job.quote.expiresAt && new Date(job.quote.expiresAt) < new Date()) {
                        Alert.alert(
                          'Quote Expired',
                          'This quote has expired. Please request a new quote from the contractor.'
                        );
                        return;
                      }
                    }

                    let paymentAmount = 0;
                    let milestoneId = undefined;
                    let paymentDescription = job.quote?.description || job.quote?.projectName || 'Project Payment';
                    if (job.isMilestone && job.milestones && job.milestones.length > 0) {
                      const nextMilestone = job.milestones.find((m: any) => m.status === 'pending');
                      if (nextMilestone) {
                        paymentAmount = nextMilestone.amount;
                        paymentDescription = `Milestone: ${nextMilestone.name}`;
                        milestoneId = nextMilestone._id || nextMilestone.id;
                      }
                    } else {
                      paymentAmount = Math.max(0, (job.quote?.totalAmount || job.quote?.total || 0) - (job.amountFunded || 0));
                    }

                    navigation.navigate('PaymentFlow', {
                      jobId: job._id,
                      quoteId: job.quote?._id,
                      milestoneId,
                      totalAmount: paymentAmount,
                      contractorName: contractor.companyName || contractor.businessName || 'Contractor',
                      description: paymentDescription,
                    });
                  }}
                  className="flex-row items-center justify-center py-3.5 bg-indigo-600 rounded-xl"
                  style={{ gap: 8 }}
                >
                  <FontAwesome5 name="credit-card" size={14} color="#fff" />
                  <Text className="text-[14px] font-bold text-white">Complete Payment</Text>
                </Pressable>
              )}
              {isUser && job.status === 'completed_pending_release' && (
                  <Pressable
                    onPress={handleReleaseFunds}
                    disabled={actionLoading !== null}
                    className="flex-row items-center justify-center py-3.5 bg-indigo-600 rounded-xl"
                    style={{ gap: 8 }}
                  >
                    {actionLoading === 'release payment' ? (
                    <BouncingDotsLoader size="small" color="#fff" />
                    ) : (
                      <FontAwesome5 name="dollar-sign" size={14} color="#fff" />
                    )}
                    <Text className="text-[14px] font-bold text-white">Release Payment</Text>
                  </Pressable>
                )}
              {isUser && job.status === 'funded_in_progress' && (
                <View className="flex-row items-center justify-center py-3 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900 rounded-xl" style={{ gap: 8 }}>
                  <FontAwesome5 name="shield-alt" size={14} color="#059669" />
                  <Text className="text-[14px] font-semibold text-emerald-800 dark:text-emerald-300">Payment secured in escrow</Text>
                </View>
              )}
              {isContractor && job.status === 'completed_pending_release' && (
                <View className="flex-row items-center justify-center py-3 bg-neutral-50 dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700" style={{ gap: 8 }}>
                  <FontAwesome5 name="clock" size={14} color={isDark ? "#a3a3a3" : "#737373"} />
                  <Text className="text-[14px] font-semibold text-neutral-600 dark:text-neutral-400">Awaiting homeowner approval to release payment</Text>
                </View>
              )}
              {(isUser || isContractor) && !['disputed', 'cancelled', 'refunded', 'completed_paid'].includes(job.status) && (
                <Pressable
                  onPress={() => navigation.navigate('DisputeScreen', {
                    jobId: job._id,
                    contractorName: contractor.companyName || contractor.businessName || 'Contractor',
                  })}
                  className="flex-row items-center justify-center py-3 rounded-xl border border-red-300 dark:border-red-800"
                  style={{ gap: 8 }}
                >
                  <FontAwesome5 name="flag" size={12} color="#dc2626" />
                  <Text className="text-[13px] font-semibold text-red-600 dark:text-red-400">Raise Dispute</Text>
                </Pressable>
              )}
              {isUser && job.status === 'completed_paid' && !job.hasReview && (
                <Pressable
                  onPress={() => navigation.navigate('ReviewScreen', {
                    quoteId: job.quote?._id || job.quote,
                    jobId: job._id,
                    contractorId: contractor._id || contractor.id || contractor,
                    contractorName: contractor.companyName || contractor.businessName || 'Contractor',
                  })}
                  className="flex-row items-center justify-center py-3.5 bg-amber-500 rounded-xl"
                  style={{ gap: 8 }}
                >
                  <FontAwesome5 name="star" size={14} color="#fff" />
                  <Text className="text-[14px] font-bold text-white">Leave a Review</Text>
                </Pressable>
              )}
              {['awaiting_payment', 'funded_in_progress', 'partially_funded'].includes(job.status) && (
                <Pressable
                  onPress={handleCancelJob}
                  disabled={actionLoading !== null}
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
      </BouncingRefreshScrollView>

      {showChangeOrder && (
        <View
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)' }}
        >
          <Pressable className="absolute inset-0" onPress={() => setShowChangeOrder(false)} />
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={{ flex: 1, justifyContent: 'flex-end' }}
          >
            <View
              className="bg-white dark:bg-neutral-950 rounded-t-2xl p-5"
              style={{ paddingBottom: insets.bottom + 20 }}
            >
              <View className="flex-row items-center justify-between mb-4">
                <Text className="text-[17px] font-bold text-neutral-900 dark:text-neutral-50">Change Order</Text>
                <Pressable
                  onPress={() => setShowChangeOrder(false)}
                  className="w-8 h-8 items-center justify-center rounded-full bg-neutral-100 dark:bg-neutral-800"
                >
                  <FontAwesome5 name="times" size={14} color="#737373" />
                </Pressable>
              </View>
              <View className="mb-3">
                <Text className="text-[12px] font-semibold text-neutral-500 dark:text-neutral-400 mb-1">Title</Text>
                <View className="border border-neutral-200 dark:border-neutral-700 rounded-xl px-3 py-2.5 bg-white dark:bg-neutral-900">
                  <TextInput
                    value={coTitle}
                    onChangeText={setCoTitle}
                    placeholder="e.g., Additional electrical work"
                    placeholderTextColor="#a3a3a3"
                    className="text-[14px] text-neutral-900 dark:text-neutral-50"
                  />
                </View>
              </View>
              <View className="mb-3">
                <Text className="text-[12px] font-semibold text-neutral-500 dark:text-neutral-400 mb-1">
                  Description
                </Text>
                <View className="border border-neutral-200 dark:border-neutral-700 rounded-xl px-3 py-2.5 bg-white dark:bg-neutral-900">
                  <TextInput
                    value={coDescription}
                    onChangeText={setCoDescription}
                    placeholder="Describe the additional work..."
                    placeholderTextColor="#a3a3a3"
                    className="text-[14px] text-neutral-900 dark:text-neutral-50"
                    multiline
                    numberOfLines={3}
                    style={{ minHeight: 60, textAlignVertical: 'top' }}
                  />
                </View>
              </View>
              <View className="mb-4">
                <Text className="text-[12px] font-semibold text-neutral-500 dark:text-neutral-400 mb-1">
                  Additional Amount ($)
                </Text>
                <View className="flex-row items-center border border-neutral-200 dark:border-neutral-700 rounded-xl px-3 bg-white dark:bg-neutral-900">
                  <Text className="text-[14px] text-neutral-400">$</Text>
                  <TextInput
                    value={coAmount}
                    onChangeText={(text) => setCoAmount(sanitizeAmount(text))}
                    placeholder="0"
                    placeholderTextColor="#a3a3a3"
                    keyboardType="decimal-pad"
                    className="flex-1 py-2.5 text-[14px] font-semibold text-neutral-900 dark:text-neutral-50"
                  />
                </View>
              </View>
              <Pressable
                onPress={handleCreateChangeOrder}
                disabled={!coTitle.trim() || !coAmount.trim() || actionLoading !== null}
                className={`w-full py-3.5 rounded-xl items-center justify-center flex-row ${coTitle.trim() && coAmount.trim() ? 'bg-amber-500' : 'bg-neutral-200 dark:bg-neutral-700'}`}
                style={{ gap: 8 }}
              >
                {actionLoading === 'changeOrder' ? (
                  <BouncingDotsLoader size="small" color="#fff" />
                ) : (
                  <FontAwesome5
                    name="paper-plane"
                    size={13}
                    color={coTitle.trim() && coAmount.trim() ? '#fff' : '#a3a3a3'}
                  />
                )}
                <Text
                  className={`text-[14px] font-bold ${coTitle.trim() && coAmount.trim() ? 'text-white' : 'text-neutral-400'}`}
                >
                  Send Change Order
                </Text>
              </Pressable>
            </View>
          </KeyboardAvoidingView>
        </View>
      )}
    </View>
  );
}
