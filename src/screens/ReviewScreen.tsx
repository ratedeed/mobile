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
import { submitReview, getJobById, getQuote } from '../api';
import HapticFeedback from '../utils/haptics';

const STARS = [1, 2, 3, 4, 5];

export default function ReviewScreen() {
  const isDark = useColorScheme() === 'dark';
  const navigation = useNavigation();
  const route = useRoute();
  const { quoteId, contractorId, contractorName, jobId } = (route.params || {}) as {
    quoteId: string;
    contractorId?: string;
    contractorName?: string;
    jobId?: string;
  };

  const [resolvedContractorId, setResolvedContractorId] = useState(contractorId || '');
  const [resolvedContractorName, setResolvedContractorName] = useState(contractorName || '');
  const [loadingJob, setLoadingJob] = useState(false);

  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [title, setTitle] = useState('');
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  React.useEffect(() => {
    if (!jobId && !quoteId) {
      Alert.alert(
        'Access Denied',
        'You can only review contractors after hiring them for a job.',
        [{ text: 'Go Back', onPress: () => navigation.goBack() }]
      );
      return;
    }

    const fetchInfo = async () => {
      if (resolvedContractorId) return;
      try {
        setLoadingJob(true);
        if (jobId) {
          const job = await getJobById(jobId);
          if (job?.contractorId) {
            setResolvedContractorId(job.contractorId._id || job.contractorId.id || job.contractorId);
            setResolvedContractorName(job.contractorId.companyName || job.contractorId.businessName || 'Contractor');
          } else if (job?.contractor) {
            setResolvedContractorId(job.contractor._id || job.contractor.id || job.contractor);
            setResolvedContractorName(job.contractor.companyName || job.contractor.businessName || 'Contractor');
          }
        } else if (quoteId) {
          const quote = await getQuote(quoteId);
          if (quote?.contractorId) {
            setResolvedContractorId(quote.contractorId._id || quote.contractorId.id || quote.contractorId);
            setResolvedContractorName(quote.contractorId.companyName || quote.contractorId.businessName || 'Contractor');
          } else if (quote?.contractor) {
            setResolvedContractorId(quote.contractor._id || quote.contractor.id || quote.contractor);
            setResolvedContractorName(quote.contractor.companyName || quote.contractor.businessName || 'Contractor');
          }
        }
      } catch (err) {
        console.error('Failed to load job/quote details for review:', err);
      } finally {
        setLoadingJob(false);
      }
    };

    fetchInfo();
  }, [jobId, quoteId, resolvedContractorId, navigation]);

  const handleSubmit = async () => {
    if (submitting) return;
    if (rating === 0) {
      HapticFeedback.error();
      Alert.alert('Required', 'Please select a star rating.');
      return;
    }
    if (!comment.trim() || comment.trim().length < 10) {
      HapticFeedback.error();
      Alert.alert('Required', 'Please write a review comment (minimum 10 characters).');
      return;
    }
    if (!resolvedContractorId) {
      HapticFeedback.error();
      Alert.alert('Error', 'Missing contractor information.');
      return;
    }

    setSubmitting(true);
    try {
      await submitReview(resolvedContractorId, {
        rating,
        title: title.trim(),
        comment: comment.trim(),
        jobId: jobId || quoteId,
      } as any);
      HapticFeedback.success();
      Alert.alert('Thank you!', 'Your review has been submitted.', [
        { text: 'Done', onPress: () => navigation.goBack() },
      ]);
    } catch (err: any) {
      HapticFeedback.error();
      Alert.alert('Error', err.message || 'Failed to submit review');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
      className="flex-1 bg-white dark:bg-neutral-950"
    >
      <ScrollView
        className="flex-1 px-6"
        contentContainerStyle={{ paddingVertical: 24 }}
        keyboardShouldPersistTaps="handled"
      >
        {loadingJob && (
          <View className="mb-4 flex-row items-center">
            <ActivityIndicator size="small" color="#4F46E5" />
            <Text className="text-xs text-neutral-400 ml-2">Loading contractor info...</Text>
          </View>
        )}
        <Text className="text-2xl font-bold text-neutral-900 dark:text-white mb-1">Leave a Review</Text>
        <Text className="text-sm text-neutral-500 dark:text-neutral-400 mb-8">
          {resolvedContractorName || contractorName ? `for ${resolvedContractorName || contractorName}` : 'Share your experience'}
        </Text>

        {/* Star Rating */}
        <Text className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-3">Rating *</Text>
        <View className="flex-row mb-6" style={{ gap: 8 }}>
          {STARS.map((star) => (
            <Pressable
              key={star}
              onPress={() => { setRating(star); HapticFeedback.selection(); }}
              onPressIn={() => setHoverRating(star)}
              onPressOut={() => setHoverRating(0)}
            >
              <FontAwesome5
                name="star"
                size={36}
                solid={star <= (hoverRating || rating)}
                color={star <= (hoverRating || rating) ? '#F59E0B' : (isDark ? '#525252' : '#D4D4D4')}
              />
            </Pressable>
          ))}
        </View>
        {rating > 0 && (
          <Text className="text-xs text-neutral-400 dark:text-neutral-500 mb-4">
            {rating === 1 && 'Poor'}
            {rating === 2 && 'Fair'}
            {rating === 3 && 'Good'}
            {rating === 4 && 'Very Good'}
            {rating === 5 && 'Excellent'}
          </Text>
        )}

        {/* Title */}
        <Text className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">Title</Text>
        <TextInput
          placeholder="Summarize your experience"
          value={title}
          onChangeText={setTitle}
          maxLength={100}
          className="border border-neutral-200 dark:border-neutral-700 rounded-xl px-4 py-3 text-sm bg-neutral-50 dark:bg-neutral-900 text-neutral-900 dark:text-white mb-5"
          placeholderTextColor={isDark ? "#9ca3af" : "#a3a3a3"}
        />

        {/* Comment */}
        <Text className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">Your Review *</Text>
        <TextInput
          placeholder="What was it like working with this contractor?"
          value={comment}
          onChangeText={setComment}
          multiline
          numberOfLines={5}
          maxLength={1000}
          className="border border-neutral-200 dark:border-neutral-700 rounded-xl px-4 py-3 text-sm bg-neutral-50 dark:bg-neutral-900 text-neutral-900 dark:text-white mb-8 min-h-[120px]"
          placeholderTextColor={isDark ? "#9ca3af" : "#a3a3a3"}
          style={{ textAlignVertical: 'top' }}
        />

        <Pressable
          onPress={handleSubmit}
          disabled={submitting || rating === 0}
          className={`py-4 rounded-xl items-center shadow-lg ${
            submitting || rating === 0
              ? 'bg-neutral-300 shadow-none'
              : 'bg-indigo-600 shadow-indigo-500/20'
          }`}
        >
          {submitting ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text className="text-white font-bold text-base">Submit Review</Text>
          )}
        </Pressable>

        <Text className="text-[10px] text-neutral-400 dark:text-neutral-500 text-center mt-4 leading-4 px-4">
          Your review will be public and tied to this job. Honest feedback helps the community.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
