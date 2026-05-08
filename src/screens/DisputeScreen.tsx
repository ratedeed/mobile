import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  Alert,
  ActivityIndicator,
  ScrollView,
  Image,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { FontAwesome5 } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { raiseDispute } from '../api';
import { uploadToCloudinary, CLOUDINARY_FOLDERS } from '../utils/cloudinary';

const CATEGORIES = [
  { key: 'work_quality', label: 'Work Quality', icon: 'star-half-alt' },
  { key: 'communication', label: 'Communication', icon: 'comments' },
  { key: 'timeline', label: 'Timeline', icon: 'clock' },
  { key: 'billing', label: 'Billing', icon: 'file-invoice-dollar' },
  { key: 'safety', label: 'Safety', icon: 'shield-alt' },
  { key: 'other', label: 'Other', icon: 'ellipsis-h' },
];

const MIN_DESCRIPTION_LENGTH = 30;
const MAX_PHOTOS = 3;

export default function DisputeScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { jobId, contractorName } = (route.params || {}) as {
    jobId: string;
    contractorName?: string;
  };

  const [category, setCategory] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);

  const handlePickPhoto = async () => {
    if (photos.length >= MAX_PHOTOS) {
      Alert.alert('Limit Reached', `You can upload up to ${MAX_PHOTOS} photos.`);
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
        allowsMultipleSelection: false,
        base64: true,
      });

      if (result.canceled || !result.assets?.length) return;

      const uri = result.assets[0].uri;
      setPhotos((prev) => [...prev, uri]);
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to select photo');
    } finally {
      setUploading(false);
    }
  };

  const handleRemovePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!category) {
      Alert.alert('Required', 'Please select a dispute category.');
      return;
    }

    if (description.trim().length < MIN_DESCRIPTION_LENGTH) {
      Alert.alert(
        'Description Too Short',
        `Please provide at least ${MIN_DESCRIPTION_LENGTH} characters to help us understand the issue.`
      );
      return;
    }

    if (!jobId) {
      Alert.alert('Error', 'Missing job information.');
      return;
    }

    setSubmitting(true);
    try {
      const uploadedUrls = await Promise.all(
        photos.map(p => uploadToCloudinary(p, CLOUDINARY_FOLDERS.CHAT))
      );
      const reason = `[${category}] ${description.trim()}`;
      await raiseDispute(jobId, reason, undefined, uploadedUrls);

      Alert.alert(
        'Dispute Filed',
        'Your dispute has been submitted successfully. Our team will review it within 24-48 hours.',
        [{ text: 'Done', onPress: () => navigation.goBack() }]
      );
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to file dispute. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const isValid = category !== null && description.trim().length >= MIN_DESCRIPTION_LENGTH;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
      className="flex-1 bg-white"
    >
      <ScrollView
        className="flex-1 px-6"
        contentContainerStyle={{ paddingVertical: 24 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <Text className="text-2xl font-bold text-neutral-900 mb-1">File a Dispute</Text>
        <Text className="text-sm text-neutral-500 mb-8">
          {contractorName ? `for work by ${contractorName}` : 'Report an issue with a completed job'}
        </Text>

        {/* Info Banner */}
        <View className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 flex-row mb-6" style={{ gap: 12 }}>
          <FontAwesome5 name="info-circle" size={18} color="#4F46E5" />
          <View className="flex-1">
            <Text className="text-sm font-semibold text-indigo-900">Fair Resolution</Text>
            <Text className="text-xs text-indigo-700 mt-1 leading-4">
              Disputes are reviewed by our team. Funds in escrow will be held until the issue is resolved.
            </Text>
          </View>
        </View>

        {/* Category Picker */}
        <Text className="text-sm font-semibold text-neutral-700 mb-3">Category *</Text>
        <View className="flex-row flex-wrap mb-6" style={{ gap: 8 }}>
          {CATEGORIES.map((cat) => {
            const selected = category === cat.key;
            return (
              <Pressable
                key={cat.key}
                onPress={() => setCategory(cat.key)}
                className={`flex-row items-center px-4 py-2.5 rounded-xl border ${
                  selected
                    ? 'bg-indigo-600 border-indigo-600'
                    : 'bg-white border-neutral-200'
                }`}
                style={{ gap: 6 }}
              >
                <FontAwesome5
                  name={cat.icon as any}
                  size={12}
                  color={selected ? '#fff' : '#737373'}
                />
                <Text
                  className={`text-xs font-semibold ${
                    selected ? 'text-white' : 'text-neutral-600'
                  }`}
                >
                  {cat.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Description */}
        <Text className="text-sm font-semibold text-neutral-700 mb-1.5">Description *</Text>
        <TextInput
          placeholder={`Describe the issue in detail (min ${MIN_DESCRIPTION_LENGTH} characters)`}
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={6}
          maxLength={2000}
          className="border border-neutral-200 rounded-xl px-4 py-3 text-sm bg-neutral-50 mb-2 min-h-[140px]"
          placeholderTextColor="#a3a3a3"
          style={{ textAlignVertical: 'top' }}
        />
        <View className="flex-row justify-between mb-6">
          <Text
            className={`text-xs ${
              description.trim().length >= MIN_DESCRIPTION_LENGTH
                ? 'text-emerald-600'
                : 'text-neutral-400'
            }`}
          >
            {description.trim().length >= MIN_DESCRIPTION_LENGTH
              ? 'Description meets minimum length'
              : `${description.trim().length}/${MIN_DESCRIPTION_LENGTH} characters minimum`}
          </Text>
          <Text className="text-xs text-neutral-400">
            {description.length}/2000
          </Text>
        </View>

        {/* Photo Upload */}
        <Text className="text-sm font-semibold text-neutral-700 mb-3">
          Evidence Photos ({photos.length}/{MAX_PHOTOS})
        </Text>
        <View className="flex-row flex-wrap mb-6" style={{ gap: 10 }}>
          {photos.map((uri, idx) => (
            <View key={idx} className="w-24 h-24 rounded-xl overflow-hidden relative">
              <Image source={{ uri }} className="w-full h-full" resizeMode="cover" />
              <Pressable
                onPress={() => handleRemovePhoto(idx)}
                className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 items-center justify-center"
              >
                <FontAwesome5 name="times" size={10} color="#fff" />
              </Pressable>
            </View>
          ))}

          {photos.length < MAX_PHOTOS && (
            <Pressable
              onPress={handlePickPhoto}
              disabled={uploading}
              className="w-24 h-24 rounded-xl border-2 border-dashed border-neutral-300 items-center justify-center bg-neutral-50"
            >
              {uploading ? (
                <ActivityIndicator size="small" color="#4F46E5" />
              ) : (
                <View className="items-center" style={{ gap: 4 }}>
                  <FontAwesome5 name="camera" size={18} color="#a3a3a3" />
                  <Text className="text-[10px] text-neutral-400 font-medium">Add Photo</Text>
                </View>
              )}
            </Pressable>
          )}
        </View>

        {/* Submit Button */}
        <Pressable
          onPress={handleSubmit}
          disabled={submitting || !isValid}
          className={`py-4 rounded-xl items-center shadow-lg ${
            submitting || !isValid
              ? 'bg-neutral-300 shadow-none'
              : 'bg-indigo-600 shadow-indigo-500/20'
          }`}
        >
          {submitting ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <View className="flex-row items-center" style={{ gap: 8 }}>
              <FontAwesome5 name="gavel" size={14} color="#fff" />
              <Text className="text-white font-bold text-base">File Dispute</Text>
            </View>
          )}
        </Pressable>

        <Text className="text-[10px] text-neutral-400 text-center mt-4 leading-4 px-4">
          By filing a dispute, you confirm that the information provided is accurate. False claims may result in account action.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
