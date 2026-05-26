import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Image,
  Alert,
} from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { createQuoteFromChat, getStripeAccountStatus } from '../../utils/apiClient';
import { SvgImage } from '../common/SvgImage';
import { getProfileImageUrl, isSvgUrl } from '../../utils/avatarUtils';
import * as ImagePicker from 'expo-image-picker';
import { uploadToCloudinary, CLOUDINARY_FOLDERS } from '../../utils/cloudinary';

const CATEGORIES = ['Plumbers', 'Electricians', 'Painters', 'Landscapers', 'HVAC', 'Roofers', 'Carpenters', 'Cleaners', 'Handymen', 'Home Builders'];

interface QuoteCreationSheetProps {
  visible: boolean;
  onClose: () => void;
  conversationId: string;
  recipientName: string;
  recipientPicture?: string;
  services?: string[];
  category?: string;
  onCreated?: () => void;
}

export default function QuoteCreationSheet({
  visible,
  onClose,
  conversationId,
  recipientName,
  recipientPicture,
  services = [],
  category,
  onCreated,
}: QuoteCreationSheetProps) {
  const [projectName, setProjectName] = useState('');
  const [cat, setCat] = useState(category || services[0] || 'Plumbers');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [startTime, setStartTime] = useState('');
  const [endDate, setEndDate] = useState('');
  const [endTime, setEndTime] = useState('');
  const [jobAddress, setJobAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Stripe Connection State
  const [stripeStatus, setStripeStatus] = useState<any>(null);
  const [stripeLoading, setStripeLoading] = useState(true);

  // Address Suggestions State
  const [addressSuggestions, setAddressSuggestions] = useState<any[]>([]);
  const [isSearchingAddress, setIsSearchingAddress] = useState(false);
  const addressSearchTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Photo Attachments State
  const [photos, setPhotos] = useState<string[]>([]);

  // Dynamic Line Items State
  const [lineItems, setLineItems] = useState<{ description: string; amount: string }[]>([
    { description: 'Labor', amount: '2800' },
    { description: 'Materials & fixtures', amount: '3200' },
  ]);

  useEffect(() => {
    if (visible) {
      setStripeLoading(true);
      (async () => {
        try {
          const res = await getStripeAccountStatus();
          setStripeStatus(res);
        } catch (e) {
          console.error(e);
        } finally {
          setStripeLoading(false);
        }
      })();
    }
  }, [visible]);

  const isStripeConnected = !!stripeStatus?.chargesEnabled;

  const addLineItem = () => {
    setLineItems(prev => [...prev, { description: '', amount: '' }]);
  };

  const removeLineItem = (index: number) => {
    if (lineItems.length <= 1) return;
    setLineItems(prev => prev.filter((_, i) => i !== index));
  };

  const updateLineItem = (index: number, field: 'description' | 'amount', value: string) => {
    setLineItems(prev => prev.map((item, i) => i === index ? { ...item, [field]: value } : item));
  };

  const total = lineItems.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
  const platformFee = Math.round(total * 0.05 * 100) / 100;
  const subtotal = total - platformFee;
  const isMilestone = total >= 5000;

  const isValid = projectName.trim() && 
    description.trim().length >= 10 && 
    startDate.trim() && 
    endDate.trim() && 
    new Date(endDate) >= new Date(startDate) &&
    lineItems.some(item => item.description.trim() && item.amount.trim() && parseFloat(item.amount) > 0);

  function calculateDuration(startDateStr: string, endDateStr: string) {
    const start = new Date(startDateStr);
    const end = new Date(endDateStr);
    const diffTime = end.getTime() - start.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays <= 1) return '1 day';
    if (diffDays <= 7) return `${diffDays} days`;
    const weeks = Math.round(diffDays / 7);
    if (weeks === 1) return '1 week';
    if (weeks < 4) return `${weeks} weeks`;
    const months = Math.round(diffDays / 30);
    return `${months} month${months > 1 ? 's' : ''}`;
  }

  const estimatedDuration = React.useMemo(() => {
    if (startDate && endDate) {
      return calculateDuration(startDate, endDate);
    }
    return '';
  }, [startDate, endDate]);

  const searchAddress = (text: string) => {
    setJobAddress(text);
    if (addressSearchTimer.current) clearTimeout(addressSearchTimer.current);
    if (text.length < 3) {
      setAddressSuggestions([]);
      return;
    }
    addressSearchTimer.current = setTimeout(async () => {
      setIsSearchingAddress(true);
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(text)}&format=json&addressdetails=1&limit=5&countrycodes=us`,
          { headers: { 'User-Agent': 'RateDeedMobile/1.0' } }
        );
        const data = await response.json();
        setAddressSuggestions(data);
      } catch {
      } finally {
        setIsSearchingAddress(false);
      }
    }, 500);
  };

  const handleSelectAddress = (item: any) => {
    setJobAddress(item.display_name);
    setAddressSuggestions([]);
  };

  const handleAddPhoto = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.6,
        allowsMultipleSelection: true,
      });
      if (result.canceled || !result.assets?.length) return;
      const uris = result.assets.map(asset => asset.uri);
      setPhotos(prev => [...prev, ...uris]);
    } catch (e) {
      Alert.alert('Error', 'Failed to pick image.');
    }
  };

  const handleRemovePhoto = (index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!isValid || submitting || stripeLoading || !isStripeConnected) return;
    setError('');
    setSubmitting(true);

    try {
      // 1. Upload photos to Cloudinary if any
      let uploadedPhotoUrls: string[] = [];
      if (photos.length > 0) {
        uploadedPhotoUrls = await Promise.all(
          photos.map(uri => uploadToCloudinary(uri, CLOUDINARY_FOLDERS.CHAT))
        );
      }

      // 2. Format line items
      const validItems = lineItems
        .filter(item => item.description.trim() && item.amount.trim() && parseFloat(item.amount) > 0)
        .map(item => ({
          label: item.description.trim(),
          description: item.description.trim(),
          amount: Math.round((parseFloat(item.amount) || 0) * 100),
        }));

      await createQuoteFromChat({
        conversationId,
        projectName: projectName.trim(),
        serviceType: cat,
        description: description.trim(),
        lineItems: validItems,
        estimatedStartDate: startDate,
        estimatedCompletionDate: endDate,
        estimatedDuration,
        startTime: startTime.trim(),
        endTime: endTime.trim(),
        jobAddress: jobAddress.trim() || undefined,
        contractorNotes: notes.trim() || undefined,
        photos: uploadedPhotoUrls,
      });

      // Reset
      setProjectName('');
      setCat(category || services[0] || 'Plumbers');
      setDescription('');
      setStartDate(new Date().toISOString().split('T')[0]);
      setStartTime('');
      setEndDate('');
      setEndTime('');
      setJobAddress('');
      setLineItems([
        { description: 'Labor', amount: '2800' },
        { description: 'Materials & fixtures', amount: '3200' },
      ]);
      setPhotos([]);
      setNotes('');
      setError('');
      onCreated?.();
      onClose();
    } catch (e: any) {
      const msg = e?.message || 'Failed to send quote';
      if (msg.includes('Stripe') || msg.includes('connect')) {
        setError('Stripe account not connected. Complete Stripe setup in your dashboard first.');
      } else {
        setError(msg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const avatarUrl = recipientPicture
    ? isSvgUrl(recipientPicture)
      ? recipientPicture
      : recipientPicture
    : getProfileImageUrl(recipientName || 'User', '');

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 bg-white dark:bg-neutral-950">
        {/* Header */}
        <View className="flex-row items-center justify-between px-4 py-3 border-b border-neutral-200 dark:border-neutral-800">
          <View className="flex-row items-center" style={{ gap: 8 }}>
            <View className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 items-center justify-center">
              <FontAwesome5 name="tag" size={13} color="#4F46E5" />
            </View>
            <Text className="text-[17px] font-bold text-neutral-900 dark:text-neutral-50">Send Quote</Text>
          </View>
          <Pressable onPress={onClose} className="w-8 h-8 items-center justify-center rounded-full bg-neutral-100 dark:bg-neutral-800">
            <FontAwesome5 name="times" size={14} color="#737373" />
          </Pressable>
        </View>

        <ScrollView className="flex-1 px-5 py-4" showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {/* Recipient */}
          <View className="flex-row items-center mb-5 p-3 bg-neutral-50 dark:bg-neutral-900 rounded-xl" style={{ gap: 12 }}>
            {isSvgUrl(avatarUrl) ? (
              <View className="w-10 h-10 rounded-full overflow-hidden">
                <SvgImage uri={avatarUrl} width="100%" height="100%" />
              </View>
            ) : (
              <View className="w-10 h-10 rounded-full overflow-hidden bg-indigo-100 dark:bg-indigo-900/30 items-center justify-center">
                <FontAwesome5 name="user" size={16} color="#4F46E5" />
              </View>
            )}
            <View>
              <Text className="text-[14px] font-semibold text-neutral-900 dark:text-neutral-50">{recipientName}</Text>
              <Text className="text-[12px] text-neutral-500 dark:text-neutral-400">Sending project quote</Text>
            </View>
          </View>

          {/* Stripe Connection Warning */}
          {!stripeLoading && !isStripeConnected && (
            <View className="mb-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 rounded-2xl p-4 flex-row animate-in fade-in" style={{ gap: 12 }}>
              <View className="w-10 h-10 bg-amber-100 dark:bg-amber-900/40 rounded-xl items-center justify-center shrink-0">
                <FontAwesome5 name="credit-card" size={15} color="#d97706" />
              </View>
              <View className="flex-1">
                <Text className="text-sm font-bold text-amber-900 dark:text-amber-300">Stripe Connection Required</Text>
                <Text className="text-xs text-amber-700 dark:text-amber-400 mt-1 leading-relaxed">
                  You must complete your Stripe onboarding to send quotes and receive payments. Please complete Stripe setup in your dashboard.
                </Text>
              </View>
            </View>
          )}

          {/* Project Name */}
          <View className="mb-4">
            <Text className="text-[12px] font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">Project name</Text>
            <TextInput
              value={projectName}
              onChangeText={setProjectName}
              placeholder="e.g., Bathroom Shower Conversion"
              placeholderTextColor="#a3a3a3"
              className="w-full border border-neutral-200 dark:border-neutral-700 rounded-xl px-3 py-2.5 text-[14px] text-neutral-900 dark:text-neutral-50 bg-white dark:bg-neutral-900"
            />
          </View>

          {/* Category */}
          <View className="mb-4">
            <Text className="text-[12px] font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">Category</Text>
            <View className="flex-row flex-wrap" style={{ gap: 6 }}>
              {CATEGORIES.map((c) => (
                <Pressable
                  key={c}
                  onPress={() => setCat(c)}
                  className={`px-3 py-1.5 rounded-full border ${
                    cat === c
                      ? 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-300 dark:border-indigo-700'
                      : 'bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-700'
                  }`}
                >
                  <Text className={`text-[12px] font-medium ${cat === c ? 'text-indigo-700 dark:text-indigo-300' : 'text-neutral-600 dark:text-neutral-400'}`}>
                    {c}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Description */}
          <View className="mb-4">
            <Text className="text-[12px] font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">Description (min. 10 chars)</Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Scope of work..."
              placeholderTextColor="#a3a3a3"
              multiline
              numberOfLines={3}
              className="w-full border border-neutral-200 dark:border-neutral-700 rounded-xl px-3 py-2.5 text-[14px] text-neutral-900 dark:text-neutral-50 bg-white dark:bg-neutral-900"
              style={{ textAlignVertical: 'top', minHeight: 70 }}
            />
          </View>

          {/* Job Address */}
          <View className="mb-4 z-10">
            <Text className="text-[12px] font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">
              Job address
            </Text>
            <TextInput
              value={jobAddress}
              onChangeText={searchAddress}
              placeholder="Enter project address..."
              placeholderTextColor="#a3a3a3"
              className="w-full border border-neutral-200 dark:border-neutral-700 rounded-xl px-3 py-2.5 text-[14px] text-neutral-900 dark:text-neutral-50 bg-white dark:bg-neutral-900"
            />
            {isSearchingAddress && (
              <View className="absolute right-3 top-9">
                <ActivityIndicator size="small" color="#4F46E5" />
              </View>
            )}
            {addressSuggestions.length > 0 && (
              <View className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-xl mt-1 shadow-lg max-h-48 overflow-hidden z-50">
                <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled">
                  {addressSuggestions.map((item, idx) => (
                    <Pressable
                      key={idx}
                      onPress={() => handleSelectAddress(item)}
                      className="px-3 py-2.5 border-b border-neutral-100 dark:border-neutral-800 last:border-0 active:bg-neutral-50"
                    >
                      <Text className="text-[12px] text-neutral-800 dark:text-neutral-200" numberOfLines={1}>
                        {item.display_name}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            )}
          </View>

          {/* Project Photos */}
          <View className="mb-4">
            <View className="flex-row justify-between items-center mb-2">
              <Text className="text-[12px] font-semibold text-neutral-700 dark:text-neutral-300">Project Photos</Text>
              <Text className="text-[11px] text-neutral-400">{photos.length} added</Text>
            </View>
            
            <View className="flex-row flex-wrap" style={{ gap: 8 }}>
              {photos.map((uri, idx) => (
                <View key={idx} className="relative w-16 h-16 rounded-xl overflow-hidden border border-neutral-200 dark:border-neutral-700">
                  <Image source={{ uri }} className="w-full h-full" resizeMode="cover" />
                  <Pressable
                    onPress={() => handleRemovePhoto(idx)}
                    className="absolute top-1 right-1 w-5 h-5 bg-black/60 rounded-full items-center justify-center"
                  >
                    <FontAwesome5 name="times" size={8} color="#fff" />
                  </Pressable>
                </View>
              ))}
              <Pressable
                onPress={handleAddPhoto}
                className="w-16 h-16 rounded-xl border border-dashed border-neutral-300 dark:border-neutral-700 flex flex-col items-center justify-center bg-white dark:bg-neutral-900"
              >
                <FontAwesome5 name="camera" size={14} color="#a3a3a3" />
                <Text className="text-[9px] font-bold text-neutral-400 mt-1">Add Photo</Text>
              </Pressable>
            </View>
          </View>

          {/* Dates & Times */}
          <View className="mb-4">
            <View className="flex-row mb-3" style={{ gap: 10 }}>
              <View className="flex-1">
                <Text className="text-[12px] font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">Start date</Text>
                <TextInput
                  value={startDate}
                  onChangeText={setStartDate}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="#a3a3a3"
                  className="w-full border border-neutral-200 dark:border-neutral-700 rounded-xl px-3 py-2.5 text-[14px] text-neutral-900 dark:text-neutral-50 bg-white dark:bg-neutral-900"
                />
                <Text className="text-[12px] font-semibold text-neutral-700 dark:text-neutral-300 mt-2 mb-1.5">Start time</Text>
                <TextInput
                  value={startTime}
                  onChangeText={setStartTime}
                  placeholder="10:00 AM"
                  placeholderTextColor="#a3a3a3"
                  className="w-full border border-neutral-200 dark:border-neutral-700 rounded-xl px-3 py-2.5 text-[14px] text-neutral-900 dark:text-neutral-50 bg-white dark:bg-neutral-900"
                />
              </View>
              <View className="flex-1">
                <Text className="text-[12px] font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">End date</Text>
                <TextInput
                  value={endDate}
                  onChangeText={setEndDate}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="#a3a3a3"
                  className="w-full border border-neutral-200 dark:border-neutral-700 rounded-xl px-3 py-2.5 text-[14px] text-neutral-900 dark:text-neutral-50 bg-white dark:bg-neutral-900"
                />
                <Text className="text-[12px] font-semibold text-neutral-700 dark:text-neutral-300 mt-2 mb-1.5">End time</Text>
                <TextInput
                  value={endTime}
                  onChangeText={setEndTime}
                  placeholder="5:00 PM"
                  placeholderTextColor="#a3a3a3"
                  className="w-full border border-neutral-200 dark:border-neutral-700 rounded-xl px-3 py-2.5 text-[14px] text-neutral-900 dark:text-neutral-50 bg-white dark:bg-neutral-900"
                />
              </View>
            </View>

            {estimatedDuration ? (
              <View className="flex-row items-center justify-center gap-2 py-2.5 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl border border-indigo-100 dark:border-indigo-800">
                <FontAwesome5 name="clock" size={12} color="#4F46E5" />
                <Text className="text-[13px] font-semibold text-indigo-700 dark:text-indigo-300">Estimated Duration: {estimatedDuration}</Text>
              </View>
            ) : null}

            {startDate && endDate && new Date(endDate) < new Date(startDate) && (
              <Text className="text-[12px] text-red-500 text-center mt-2">End date must be on or after start date.</Text>
            )}
          </View>

          <View className="border-t border-neutral-200 dark:border-neutral-800 mb-4" />

          {/* Pricing & Dynamic Line Items */}
          <View className="mb-4">
            <View className="flex-row justify-between items-center mb-2">
              <Text className="text-[14px] font-bold text-neutral-900 dark:text-neutral-50">Pricing & Scope</Text>
              <Pressable
                onPress={addLineItem}
                className="flex-row items-center bg-indigo-50 dark:bg-indigo-900/30 px-2.5 py-1.5 rounded-lg"
              >
                <FontAwesome5 name="plus" size={10} color="#4F46E5" />
                <Text className="text-[11px] font-bold text-indigo-700 dark:text-indigo-300 ml-1">Add Item</Text>
              </Pressable>
            </View>

            {lineItems.map((item, index) => (
              <View key={index} className="flex-row items-center mb-3" style={{ gap: 8 }}>
                <View className="flex-1">
                  <TextInput
                    value={item.description}
                    onChangeText={text => updateLineItem(index, 'description', text)}
                    placeholder="e.g. Labor & Installation"
                    placeholderTextColor="#a3a3a3"
                    className="border border-neutral-200 dark:border-neutral-700 rounded-xl px-3 py-2 text-[13px] text-neutral-900 dark:text-neutral-50 bg-white dark:bg-neutral-900"
                  />
                </View>
                <View className="w-24 flex-row items-center border border-neutral-200 dark:border-neutral-700 rounded-xl bg-white dark:bg-neutral-900 px-2">
                  <Text className="text-[13px] text-neutral-400 dark:text-neutral-500">$</Text>
                  <TextInput
                    value={item.amount}
                    onChangeText={text => updateLineItem(index, 'amount', text)}
                    placeholder="0.00"
                    placeholderTextColor="#a3a3a3"
                    keyboardType="decimal-pad"
                    className="flex-1 py-2 text-[13px] font-semibold text-neutral-900 dark:text-neutral-50"
                  />
                </View>
                {lineItems.length > 1 && (
                  <Pressable
                    onPress={() => removeLineItem(index)}
                    className="w-9 h-9 items-center justify-center rounded-xl bg-red-50 dark:bg-red-950/20"
                  >
                    <FontAwesome5 name="trash-alt" size={12} color="#ef4444" />
                  </Pressable>
                )}
              </View>
            ))}
          </View>

          {/* Pricing Summary */}
          {total > 0 && (
            <View className="mb-4 p-3.5 bg-neutral-50 dark:bg-neutral-900 rounded-2xl border border-neutral-100 dark:border-neutral-800" style={{ gap: 6 }}>
              <View className="flex-row justify-between">
                <Text className="text-[12px] text-neutral-500 dark:text-neutral-400 font-medium">Customer Total</Text>
                <Text className="text-[13px] font-bold text-neutral-900 dark:text-neutral-50">${total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
              </View>
              <View className="flex-row justify-between">
                <Text className="text-[12px] text-neutral-500 dark:text-neutral-400">Platform fee (5%)</Text>
                <Text className="text-[12px] text-neutral-400">${platformFee.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
              </View>
              <View className="h-[1px] bg-neutral-200 dark:bg-neutral-700 my-1" />
              <View className="flex-row justify-between items-baseline">
                <Text className="text-[12px] font-bold text-neutral-700 dark:text-neutral-300">Contractor Payout</Text>
                <Text className="text-[15px] font-black text-indigo-600">${subtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
              </View>
            </View>
          )}

          {/* Milestone Notice */}
          {isMilestone && (
            <View className="mb-4 p-3 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800 rounded-xl animate-in fade-in">
              <View className="flex-row items-center mb-2" style={{ gap: 6 }}>
                <FontAwesome5 name="shield-alt" size={14} color="#4F46E5" />
                <Text className="text-[13px] font-semibold text-indigo-900 dark:text-indigo-200">Milestone Payments Required</Text>
              </View>
              <Text className="text-[12px] text-indigo-700 dark:text-indigo-300 mb-2 leading-4">
                Because this project is over $5,000, it automatically qualifies for milestone escrow to protect both parties.
              </Text>
              <View style={{ gap: 4 }}>
                <View className="flex-row justify-between">
                  <Text className="text-[12px] text-indigo-600 dark:text-indigo-400">Deposit (30%)</Text>
                  <Text className="text-[12px] font-semibold text-indigo-900 dark:text-indigo-200">${Math.round(total * 0.3).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
                </View>
                <View className="flex-row justify-between">
                  <Text className="text-[12px] text-indigo-600 dark:text-indigo-400">Midpoint (30%)</Text>
                  <Text className="text-[12px] font-semibold text-indigo-900 dark:text-indigo-200">${Math.round(total * 0.3).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
                </View>
                <View className="flex-row justify-between">
                  <Text className="text-[12px] text-indigo-600 dark:text-indigo-400">Completion (40%)</Text>
                  <Text className="text-[12px] font-semibold text-indigo-900 dark:text-indigo-200">${Math.round(total * 0.4).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
                </View>
              </View>
            </View>
          )}

          {/* Notes */}
          <View className="mb-4">
            <Text className="text-[12px] font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">
              Note to client <Text className="font-normal text-neutral-400 dark:text-neutral-500">(optional)</Text>
            </Text>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder="Warranty info, timeline notes..."
              placeholderTextColor="#a3a3a3"
              multiline
              numberOfLines={2}
              className="w-full border border-neutral-200 dark:border-neutral-700 rounded-xl px-3 py-2.5 text-[14px] text-neutral-900 dark:text-neutral-50 bg-white dark:bg-neutral-900"
              style={{ textAlignVertical: 'top', minHeight: 50 }}
            />
          </View>

          {/* Error */}
          {error ? (
            <View className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-100 dark:border-red-800">
              <Text className="text-[12px] font-semibold text-red-700 dark:text-red-300">{error}</Text>
            </View>
          ) : null}

          <View className="h-6" />
        </ScrollView>

        {/* Footer Actions */}
        <View className="flex-row border-t border-neutral-200 dark:border-neutral-800 px-5 py-3" style={{ gap: 10 }}>
          <Pressable
            onPress={onClose}
            className="flex-1 py-3.5 rounded-xl border border-neutral-300 dark:border-neutral-600 items-center justify-center"
          >
            <Text className="text-[14px] font-semibold text-neutral-900 dark:text-neutral-50">Cancel</Text>
          </Pressable>
          <Pressable
            onPress={handleSubmit}
            disabled={!isValid || submitting || stripeLoading || !isStripeConnected}
            className={`flex-1 py-3.5 rounded-xl flex-row items-center justify-center ${isValid && !submitting && !stripeLoading && isStripeConnected ? 'bg-indigo-600' : 'bg-neutral-200 dark:bg-neutral-700'}`}
            style={{ gap: 6 }}
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <FontAwesome5 name="paper-plane" size={12} color={isValid && !stripeLoading && isStripeConnected ? '#fff' : '#a3a3a3'} />
                <Text className={`text-[14px] font-bold ${isValid && !stripeLoading && isStripeConnected ? 'text-white' : 'text-neutral-400 dark:text-neutral-500'}`}>Send Quote</Text>
              </>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
