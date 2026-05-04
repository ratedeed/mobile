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
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { FontAwesome5 } from '@expo/vector-icons';
import { submitReview } from '../api';

const STARS = [1, 2, 3, 4, 5];

export default function ReviewScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { quoteId, contractorId, contractorName } = (route.params || {}) as {
    quoteId: string;
    contractorId?: string;
    contractorName?: string;
  };

  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [title, setTitle] = useState('');
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (rating === 0) {
      Alert.alert('Required', 'Please select a star rating.');
      return;
    }
    if (!comment.trim()) {
      Alert.alert('Required', 'Please write a review comment.');
      return;
    }
    if (!contractorId) {
      Alert.alert('Error', 'Missing contractor information.');
      return;
    }

    setSubmitting(true);
    try {
      await submitReview(contractorId, {
        rating,
        title: title.trim(),
        comment: comment.trim(),
        quoteId,
      } as any);
      Alert.alert('Thank you!', 'Your review has been submitted.', [
        { text: 'Done', onPress: () => navigation.goBack() },
      ]);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to submit review');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
      className="flex-1 bg-white"
    >
      <ScrollView
        className="flex-1 px-6"
        contentContainerStyle={{ paddingVertical: 24 }}
        keyboardShouldPersistTaps="handled"
      >
        <Text className="text-2xl font-bold text-neutral-900 mb-1">Leave a Review</Text>
        <Text className="text-sm text-neutral-500 mb-8">
          {contractorName ? `for ${contractorName}` : 'Share your experience'}
        </Text>

        {/* Star Rating */}
        <Text className="text-sm font-semibold text-neutral-700 mb-3">Rating *</Text>
        <View className="flex-row mb-6" style={{ gap: 8 }}>
          {STARS.map((star) => (
            <Pressable
              key={star}
              onPress={() => setRating(star)}
              onPressIn={() => setHoverRating(star)}
              onPressOut={() => setHoverRating(0)}
            >
              <FontAwesome5
                name="star"
                size={36}
                solid={star <= (hoverRating || rating)}
                color={star <= (hoverRating || rating) ? '#F59E0B' : '#D4D4D4'}
              />
            </Pressable>
          ))}
        </View>
        {rating > 0 && (
          <Text className="text-xs text-neutral-400 mb-4">
            {rating === 1 && 'Poor'}
            {rating === 2 && 'Fair'}
            {rating === 3 && 'Good'}
            {rating === 4 && 'Very Good'}
            {rating === 5 && 'Excellent'}
          </Text>
        )}

        {/* Title */}
        <Text className="text-sm font-semibold text-neutral-700 mb-1.5">Title</Text>
        <TextInput
          placeholder="Summarize your experience"
          value={title}
          onChangeText={setTitle}
          maxLength={100}
          className="border border-neutral-200 rounded-xl px-4 py-3 text-sm bg-neutral-50 mb-5"
          placeholderTextColor="#a3a3a3"
        />

        {/* Comment */}
        <Text className="text-sm font-semibold text-neutral-700 mb-1.5">Your Review *</Text>
        <TextInput
          placeholder="What was it like working with this contractor?"
          value={comment}
          onChangeText={setComment}
          multiline
          numberOfLines={5}
          maxLength={1000}
          className="border border-neutral-200 rounded-xl px-4 py-3 text-sm bg-neutral-50 mb-8 min-h-[120px]"
          placeholderTextColor="#a3a3a3"
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

        <Text className="text-[10px] text-neutral-400 text-center mt-4 leading-4 px-4">
          Your review will be public and tied to this job. Honest feedback helps the community.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
