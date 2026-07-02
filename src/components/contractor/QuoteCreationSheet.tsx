import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Image,
  Alert,
} from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { createQuoteFromChat, getStripeAccountStatus, getPlatformFeePercent } from '../../utils/apiClient';
import { SvgImage } from '../common/SvgImage';
import { BouncingDotsLoader } from '../common';
import DateTimePickerSheet from '../common/DateTimePickerSheet';
import { getProfileImageUrl, isSvgUrl } from '../../utils/avatarUtils';
import * as ImagePicker from 'expo-image-picker';
import { uploadToCloudinary, CLOUDINARY_FOLDERS } from '../../utils/cloudinary';
import { requestPhotoLibraryPermission } from '../../utils/permissions';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import HapticFeedback from '../../utils/haptics';

const CATEGORIES = ['Plumbers', 'Electricians', 'Painters', 'Landscapers', 'HVAC', 'Roofers', 'Carpenters', 'Cleaners', 'Handymen', 'Home Builders'];

function toISODateLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatDisplayDate(iso: string): string {
  if (!iso) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function SelectorField({
  label,
  value,
  placeholder,
  iconName,
  onPress,
}: {
  label: string;
  value: string;
  placeholder: string;
  iconName: string;
  onPress: () => void;
}) {
  return (
    <View>
      <Text className="text-[12px] font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">{label}</Text>
      <Pressable
        onPress={onPress}
        className="w-full flex-row items-center border border-neutral-200 dark:border-neutral-700 rounded-xl px-3 py-2.5 bg-white dark:bg-neutral-900"
        style={{ gap: 8 }}
      >
        <FontAwesome5 name={iconName} size={12} color="#a3a3a3" />
        <Text
          className={`flex-1 text-[14px] ${value ? 'text-neutral-900 dark:text-neutral-50' : 'text-[#a3a3a3]'}`}
          numberOfLines={1}
        >
          {value || placeholder}
        </Text>
        <FontAwesome5 name="chevron-down" size={10} color="#a3a3a3" />
      </Pressable>
    </View>
  );
}

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
  const [startDate, setStartDate] = useState(() => toISODateLocal(new Date()));
  const [startTime, setStartTime] = useState('');
  const [endDate, setEndDate] = useState('');
  const [endTime, setEndTime] = useState('');
  const [jobAddress, setJobAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [activePicker, setActivePicker] = useState<null | 'startDate' | 'startTime' | 'endDate' | 'endTime'>(null);
  const [pickerVisible, setPickerVisible] = useState(false);

  // Stripe Connection State
  const [stripeStatus, setStripeStatus] = useState<any>(null);
  const [stripeLoading, setStripeLoading] = useState(true);

  // Address Suggestions State
  const [addressSuggestions, setAddressSuggestions] = useState<any[]>([]);
  const [isSearchingAddress, setIsSearchingAddress] = useState(false);
  const addressSearchTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Photo Attachments State
  const [photos, setPhotos] = useState<string[]>([]);

  // Fee Percentage State
  const [feePercent, setFeePercent] = useState(5);

  // Dynamic Line Items State
  const [lineItems, setLineItems] = useState<{ description: string; amount: string }[]>([
    { description: '', amount: '' },
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

      (async () => {
        try {
          const res = await getPlatformFeePercent();
          if (res && res.platformFeePercent !== undefined) {
            setFeePercent(res.platformFeePercent);
          }
        } catch (e) {
          console.error(e);
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
    let finalValue = value;
    if (field === 'amount') {
      finalValue = value.replace(/[^0-9.]/g, '');
      const parts = finalValue.split('.');
      if (parts.length > 2) {
        finalValue = parts[0] + '.' + parts.slice(1).join('');
      }
    }
    setLineItems(prev => prev.map((item, i) => i === index ? { ...item, [field]: finalValue } : item));
  };

  const total = lineItems.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
  const platformFee = Math.round(total * (feePercent / 100) * 100) / 100;
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

  const openPicker = (which: 'startDate' | 'startTime' | 'endDate' | 'endTime') => {
    setActivePicker(which);
    setPickerVisible(true);
  };
  const closePicker = () => setPickerVisible(false);

  const handlePickerConfirm = (v: string) => {
    switch (activePicker) {
      case 'startDate':
        setStartDate(v);
        if (endDate && new Date(endDate) < new Date(v)) {
          setEndDate('');
          setEndTime('');
        }
        break;
      case 'endDate':
        setEndDate(v);
        break;
      case 'startTime':
        setStartTime(v);
        break;
      case 'endTime':
        setEndTime(v);
        break;
    }
  };

  const pickerProps: { mode: 'date' | 'time'; title: string; value?: string; minDate?: string } | null = activePicker
    ? {
        startDate: { mode: 'date' as const, title: 'Select start date', value: startDate },
        startTime: { mode: 'time' as const, title: 'Select start time', value: startTime },
        endDate: { mode: 'date' as const, title: 'Select end date', value: endDate, minDate: startDate },
        endTime: { mode: 'time' as const, title: 'Select end time', value: endTime },
      }[activePicker]
    : null;

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
    const hasPermission = await requestPhotoLibraryPermission();
    if (!hasPermission) return;

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
        // Cache uploaded Cloudinary URLs in state to prevent re-uploads if downstream API fails
        setPhotos(uploadedPhotoUrls);
      }

      // 2. Format line items (send in dollars as backend multiplies by 100 internally)
      const validItems = lineItems
        .filter(item => item.description.trim() && item.amount.trim() && parseFloat(item.amount) > 0)
        .map(item => ({
          label: item.description.trim(),
          description: item.description.trim(),
          amount: parseFloat(item.amount) || 0,
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
      setStartDate(toISODateLocal(new Date()));
      setStartTime('');
      setEndDate('');
      setEndTime('');
      setJobAddress('');
      setLineItems([
        { description: '', amount: '' },
      ]);
      setPhotos([]);
      setNotes('');
      setError('');
      HapticFeedback.success();
      onCreated?.();
      onClose();
    } catch (e: any) {
      HapticFeedback.error();
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

  const insets = useSafeAreaInsets();
  const avatarUrl = recipientPicture
    ? isSvgUrl(recipientPicture)
      ? recipientPicture
      : recipientPicture
    : getProfileImageUrl(recipientName || 'User', '');

  return (
    <>
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 bg-white dark:bg-neutral-950">
        {/* Header */}
        <View
          style={{ paddingTop: Platform.OS === 'android' ? (insets.top || 16) : 12 }}
          className="flex-row items-center justify-between px-4 pb-3 border-b border-neutral-200 dark:border-neutral-800"
        >
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
                <BouncingDotsLoader size="small" color="#4F46E5" />
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
                <SelectorField
                  label="Start date"
                  value={startDate ? formatDisplayDate(startDate) : ''}
                  placeholder="Select date"
                  iconName="calendar"
                  onPress={() => openPicker('startDate')}
                />
                <View className="h-2.5" />
                <SelectorField
                  label="Start time"
                  value={startTime}
                  placeholder="Select time"
                  iconName="clock"
                  onPress={() => openPicker('startTime')}
                />
              </View>
              <View className="flex-1">
                <SelectorField
                  label="End date"
                  value={endDate ? formatDisplayDate(endDate) : ''}
                  placeholder="Select date"
                  iconName="calendar-check"
                  onPress={() => openPicker('endDate')}
                />
                <View className="h-2.5" />
                <SelectorField
                  label="End time"
                  value={endTime}
                  placeholder="Select time"
                  iconName="clock"
                  onPress={() => openPicker('endTime')}
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
                <Text className="text-[12px] text-neutral-500 dark:text-neutral-400">Platform fee ({feePercent}%)</Text>
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
        <View
          style={{ paddingBottom: Math.max(insets.bottom, 12), gap: 10 }}
          className="flex-row border-t border-neutral-200 dark:border-neutral-800 px-5 pt-3"
        >
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
              <BouncingDotsLoader size="small" color="#fff" />
            ) : (
              <>
                <FontAwesome5 name="paper-plane" size={12} color={isValid && !stripeLoading && isStripeConnected ? '#fff' : '#a3a3a3'} />
                <Text className={`text-[14px] font-bold ${isValid && !stripeLoading && isStripeConnected ? 'text-white' : 'text-neutral-400 dark:text-neutral-500'}`}>Send Quote</Text>
              </>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      <DateTimePickerSheet
        visible={pickerVisible}
        onClose={closePicker}
        mode={pickerProps?.mode ?? 'date'}
        title={pickerProps?.title ?? ''}
        value={pickerProps?.value}
        onConfirm={handlePickerConfirm}
        minDate={pickerProps?.minDate}
      />
    </Modal>
    </>
  );
}
