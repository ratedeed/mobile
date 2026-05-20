import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Modal,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { createQuoteFromChat } from '../../utils/apiClient';
import { SvgImage } from '../common/SvgImage';
import { getProfileImageUrl, isSvgUrl } from '../../utils/avatarUtils';

const CATEGORIES = ['Plumbers', 'Electricians', 'Painters', 'Landscapers', 'HVAC', 'Roofers', 'Carpenters', 'Cleaners', 'Handymen', 'Home Builders'];

const DURATIONS = ['1 day', '1-2 days', '2-3 days', '3-4 days', '4-5 days', '1 week', '1-2 weeks', '2-4 weeks'];

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
  const [duration, setDuration] = useState('3-4 days');
  const [laborCost, setLaborCost] = useState('2800');
  const [materialsCost, setMaterialsCost] = useState('3200');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const labor = parseFloat(laborCost) || 0;
  const materials = parseFloat(materialsCost) || 0;
  const sub = labor + materials;
  const platformFee = Math.round(sub * 0.05 * 100) / 100;
  const total = sub + platformFee;
  const isMilestone = total >= 5000;
  const deposit = Math.round((isMilestone ? total * 0.3 : total * 0.2) * 100) / 100;

  const isValid = projectName.trim() && description.trim();

  const handleSubmit = async () => {
    if (!isValid || submitting) return;
    setError('');
    setSubmitting(true);

    try {
      await createQuoteFromChat({
        conversationId,
        projectName: projectName.trim(),
        serviceType: cat,
        description: description.trim(),
        lineItems: [
          { description: 'Labor', amount: labor },
          { description: 'Materials & fixtures', amount: materials },
        ],
        estimatedStartDate: startDate,
        estimatedDuration: duration,
        estimatedCompletionDate: startDate,
        contractorNotes: notes.trim() || undefined,
      });
      setProjectName('');
      setCat(category || services[0] || 'Plumbers');
      setDescription('');
      setStartDate(new Date().toISOString().split('T')[0]);
      setDuration('3-4 days');
      setLaborCost('2800');
      setMaterialsCost('3200');
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

          <View className="mb-4">
            <Text className="text-[12px] font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">Description</Text>
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

          <View className="flex-row mb-4" style={{ gap: 10 }}>
            <View className="flex-1">
              <Text className="text-[12px] font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">Start date</Text>
              <TextInput
                value={startDate}
                onChangeText={setStartDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#a3a3a3"
                className="w-full border border-neutral-200 dark:border-neutral-700 rounded-xl px-3 py-2.5 text-[14px] text-neutral-900 dark:text-neutral-50 bg-white dark:bg-neutral-900"
              />
            </View>
            <View className="flex-1">
              <Text className="text-[12px] font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">Duration</Text>
              <View className="border border-neutral-200 dark:border-neutral-700 rounded-xl bg-white dark:bg-neutral-900 overflow-hidden">
                {DURATIONS.map((d) => (
                  <Pressable
                    key={d}
                    onPress={() => setDuration(d)}
                    className={`px-3 py-2 border-b border-neutral-100 dark:border-neutral-800 ${
                      duration === d ? 'bg-indigo-50 dark:bg-indigo-900/30' : ''
                    }`}
                  >
                    <Text className={`text-[14px] ${duration === d ? 'text-indigo-700 dark:text-indigo-300 font-semibold' : 'text-neutral-700 dark:text-neutral-300'}`}>
                      {d}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </View>

          <View className="border-t border-neutral-200 dark:border-neutral-800 mb-4" />

          <View className="mb-2">
            <Text className="text-[14px] font-semibold text-neutral-900 dark:text-neutral-50">Pricing</Text>
          </View>

          <View className="mb-4">
            <Text className="text-[12px] font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">Labor cost</Text>
            <View className="flex-row items-center border border-neutral-200 dark:border-neutral-700 rounded-xl bg-white dark:bg-neutral-900 px-3">
              <Text className="text-[14px] text-neutral-400 dark:text-neutral-500">$</Text>
              <TextInput
                value={laborCost}
                onChangeText={setLaborCost}
                placeholder="0"
                placeholderTextColor="#a3a3a3"
                keyboardType="decimal-pad"
                className="flex-1 py-2.5 text-[14px] font-semibold text-neutral-900 dark:text-neutral-50"
              />
            </View>
          </View>

          <View className="mb-4">
            <Text className="text-[12px] font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">Materials & fixtures</Text>
            <View className="flex-row items-center border border-neutral-200 dark:border-neutral-700 rounded-xl bg-white dark:bg-neutral-900 px-3">
              <Text className="text-[14px] text-neutral-400 dark:text-neutral-500">$</Text>
              <TextInput
                value={materialsCost}
                onChangeText={setMaterialsCost}
                placeholder="0"
                placeholderTextColor="#a3a3a3"
                keyboardType="decimal-pad"
                className="flex-1 py-2.5 text-[14px] font-semibold text-neutral-900 dark:text-neutral-50"
              />
            </View>
          </View>

          {sub > 0 && (
            <View className="mb-4 p-3 bg-neutral-50 dark:bg-neutral-900 rounded-xl border border-neutral-100 dark:border-neutral-800" style={{ gap: 4 }}>
              <View className="flex-row justify-between">
                <Text className="text-[12px] text-neutral-500 dark:text-neutral-400">Subtotal</Text>
                <Text className="text-[12px] font-medium text-neutral-700 dark:text-neutral-300">${sub.toLocaleString()}</Text>
              </View>
              <View className="flex-row justify-between">
                <Text className="text-[12px] text-neutral-500 dark:text-neutral-400">Platform fee (5%)</Text>
                <Text className="text-[12px] text-neutral-500 dark:text-neutral-400">${platformFee.toLocaleString()}</Text>
              </View>
              <View className="h-px bg-neutral-200 dark:bg-neutral-700 my-1" />
              <View className="flex-row justify-between">
                <Text className="text-[13px] font-bold text-neutral-900 dark:text-neutral-50">Client total</Text>
                <Text className="text-[14px] font-bold text-indigo-600">${total.toLocaleString()}</Text>
              </View>
            </View>
          )}

          {isMilestone && (
            <View className="mb-4 p-3 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800 rounded-xl">
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
                  <Text className="text-[12px] font-semibold text-indigo-900 dark:text-indigo-200">${Math.round(total * 0.3).toLocaleString()}</Text>
                </View>
                <View className="flex-row justify-between">
                  <Text className="text-[12px] text-indigo-600 dark:text-indigo-400">Midpoint (30%)</Text>
                  <Text className="text-[12px] font-semibold text-indigo-900 dark:text-indigo-200">${Math.round(total * 0.3).toLocaleString()}</Text>
                </View>
                <View className="flex-row justify-between">
                  <Text className="text-[12px] text-indigo-600 dark:text-indigo-400">Completion (40%)</Text>
                  <Text className="text-[12px] font-semibold text-indigo-900 dark:text-indigo-200">${Math.round(total * 0.4).toLocaleString()}</Text>
                </View>
              </View>
            </View>
          )}

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

          {error ? (
            <View className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-100 dark:border-red-800">
              <Text className="text-[12px] font-semibold text-red-700 dark:text-red-300">{error}</Text>
            </View>
          ) : null}

          <View className="h-6" />
        </ScrollView>

        <View className="flex-row border-t border-neutral-200 dark:border-neutral-800 px-5 py-3" style={{ gap: 10 }}>
          <Pressable
            onPress={onClose}
            className="flex-1 py-3.5 rounded-xl border border-neutral-300 dark:border-neutral-600 items-center justify-center"
          >
            <Text className="text-[14px] font-semibold text-neutral-900 dark:text-neutral-50">Cancel</Text>
          </Pressable>
          <Pressable
            onPress={handleSubmit}
            disabled={!isValid || submitting}
            className={`flex-1 py-3.5 rounded-xl flex-row items-center justify-center ${isValid && !submitting ? 'bg-indigo-600' : 'bg-neutral-200 dark:bg-neutral-700'}`}
            style={{ gap: 6 }}
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <FontAwesome5 name="paper-plane" size={12} color={isValid ? '#fff' : '#a3a3a3'} />
                <Text className={`text-[14px] font-bold ${isValid ? 'text-white' : 'text-neutral-400 dark:text-neutral-500'}`}>Send Quote</Text>
              </>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}