import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { createQuoteFromChat } from '../../utils/apiClient';

interface LineItem {
  id: string;
  description: string;
  amount: string;
}

interface QuoteCreationSheetProps {
  visible: boolean;
  onClose: () => void;
  conversationId: string;
  recipientName: string;
  recipientPicture?: string;
  services?: string[];
  onCreated?: () => void;
}

export default function QuoteCreationSheet({
  visible,
  onClose,
  conversationId,
  recipientName,
  recipientPicture,
  services = [],
  onCreated,
}: QuoteCreationSheetProps) {
  const [serviceType, setServiceType] = useState('');
  const [description, setDescription] = useState('');
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { id: '1', description: '', amount: '' },
  ]);
  const [estCompletion, setEstCompletion] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const subtotal = useMemo(() => {
    return lineItems.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
  }, [lineItems]);

  const platformFee = Math.round(subtotal * 0.05 * 100) / 100;
  const total = subtotal;

  const isValid = useMemo(() => {
    const hasDescription = description.trim().length >= 10;
    const hasValidItems = lineItems.some(
      (i) => i.description.trim() && parseFloat(i.amount) > 0
    );
    return hasDescription && hasValidItems;
  }, [description, lineItems]);

  const updateLineItem = (id: string, field: 'description' | 'amount', value: string) => {
    setLineItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const addLineItem = () => {
    setLineItems((prev) => [
      ...prev,
      { id: `item-${Date.now()}`, description: '', amount: '' },
    ]);
  };

  const removeLineItem = (id: string) => {
    if (lineItems.length <= 1) return;
    setLineItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleSubmit = async () => {
    if (!isValid || submitting) return;

    const validItems = lineItems.filter(
      (i) => i.description.trim() && parseFloat(i.amount) > 0
    );
    if (validItems.length === 0) {
      setError('Add at least one line item with a description and amount');
      return;
    }

    setError('');
    setSubmitting(true);

    try {
      await createQuoteFromChat({
        conversationId,
        serviceType: serviceType.trim() || undefined,
        description: description.trim(),
        lineItems: validItems.map((item) => ({
          label: item.description.trim(),
          description: item.description.trim(),
          amount: parseFloat(item.amount) || 0,
        })),
        estimatedCompletionDate: estCompletion.trim() || '',
        contractorNotes: notes.trim() || undefined,
      });

      // Reset form
      setServiceType('');
      setDescription('');
      setLineItems([{ id: '1', description: '', amount: '' }]);
      setEstCompletion('');
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

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1 bg-white"
      >
        {/* Header */}
        <View className="flex-row items-center justify-between px-4 py-3 border-b border-neutral-100">
          <TouchableOpacity onPress={onClose} className="w-8 h-8 items-center justify-center rounded-full bg-neutral-100">
            <FontAwesome5 name="times" size={14} color="#171717" />
          </TouchableOpacity>
          <Text className="text-base font-bold text-neutral-900">Send Quote</Text>
          <View className="w-8" />
        </View>

        <ScrollView className="flex-1 px-4 py-4" showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {/* Recipient */}
          <View className="flex-row items-center mb-4 p-3 bg-neutral-50 rounded-xl">
            <View className="w-9 h-9 rounded-full bg-indigo-100 items-center justify-center">
              <FontAwesome5 name="user" size={14} color="#4F46E5" />
            </View>
            <View className="ml-2.5">
              <Text className="text-xs text-neutral-500">Sending quote to</Text>
              <Text className="text-sm font-semibold text-neutral-900">{recipientName}</Text>
            </View>
          </View>

          {/* Service Type */}
          {services.length > 0 && (
            <View className="mb-4">
              <Text className="text-xs font-semibold text-neutral-500 mb-1.5">Service Type</Text>
              <View className="flex-row flex-wrap" style={{ gap: 6 }}>
                {services.slice(0, 6).map((s) => (
                  <TouchableOpacity
                    key={s}
                    onPress={() => setServiceType(serviceType === s ? '' : s)}
                    className={`px-3 py-1.5 rounded-full border ${
                      serviceType === s
                        ? 'bg-indigo-50 border-indigo-300'
                        : 'bg-white border-neutral-200'
                    }`}
                  >
                    <Text
                      className={`text-xs font-medium ${
                        serviceType === s ? 'text-indigo-700' : 'text-neutral-600'
                      }`}
                    >
                      {s}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Description */}
          <View className="mb-4">
            <Text className="text-xs font-semibold text-neutral-500 mb-1.5">
              Project Description <Text className="text-red-400">*</Text>
            </Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Describe the project scope and deliverables..."
              multiline
              numberOfLines={3}
              className="w-full border border-neutral-200 rounded-xl px-3 py-2.5 text-sm bg-white"
              style={{ textAlignVertical: 'top', minHeight: 70 }}
            />
            <Text className="text-[10px] text-neutral-400 mt-1">
              {description.trim().length}/10 min characters
            </Text>
          </View>

          {/* Line Items */}
          <View className="mb-4">
            <Text className="text-xs font-semibold text-neutral-500 mb-1.5">
              Line Items <Text className="text-red-400">*</Text>
            </Text>
            <View style={{ gap: 8 }}>
              {lineItems.map((item, index) => (
                <View key={item.id} className="flex-row items-center" style={{ gap: 8 }}>
                  <TextInput
                    value={item.description}
                    onChangeText={(v) => updateLineItem(item.id, 'description', v)}
                    placeholder="Item description"
                    className="flex-1 border border-neutral-200 rounded-lg px-3 py-2 text-sm"
                  />
                  <View className="flex-row items-center border border-neutral-200 rounded-lg px-2" style={{ width: 100 }}>
                    <Text className="text-sm text-neutral-400">$</Text>
                    <TextInput
                      value={item.amount}
                      onChangeText={(v) => updateLineItem(item.id, 'amount', v)}
                      placeholder="0"
                      keyboardType="decimal-pad"
                      className="flex-1 py-2 text-sm font-semibold text-neutral-900"
                    />
                  </View>
                  {lineItems.length > 1 && (
                    <TouchableOpacity onPress={() => removeLineItem(item.id)} className="w-7 h-7 items-center justify-center">
                      <FontAwesome5 name="trash" size={10} color="#ef4444" />
                    </TouchableOpacity>
                  )}
                </View>
              ))}
            </View>
            <TouchableOpacity
              onPress={addLineItem}
              className="flex-row items-center mt-2 self-start px-3 py-1.5 rounded-lg bg-neutral-50"
              style={{ gap: 4 }}
            >
              <FontAwesome5 name="plus" size={9} color="#737373" />
              <Text className="text-xs font-medium text-neutral-500">Add Item</Text>
            </TouchableOpacity>

            {/* Totals */}
            {subtotal > 0 && (
              <View className="mt-3 p-3 bg-neutral-50 rounded-xl" style={{ gap: 4 }}>
                <View className="flex-row justify-between">
                  <Text className="text-xs text-neutral-500">Subtotal</Text>
                  <Text className="text-xs font-medium text-neutral-700">${subtotal.toFixed(2)}</Text>
                </View>
                <View className="flex-row justify-between">
                  <Text className="text-xs text-neutral-500">Platform fee (5%)</Text>
                  <Text className="text-xs font-medium text-neutral-700">${platformFee.toFixed(2)}</Text>
                </View>
                <View className="h-px bg-neutral-200 my-1" />
                <View className="flex-row justify-between">
                  <Text className="text-xs font-bold text-neutral-900">Customer pays</Text>
                  <Text className="text-sm font-bold text-indigo-600">${total.toFixed(2)}</Text>
                </View>
              </View>
            )}
          </View>

          {/* Estimated Completion */}
          <View className="mb-4">
            <Text className="text-xs font-semibold text-neutral-500 mb-1.5">
              Estimated Completion
            </Text>
            <TextInput
              value={estCompletion}
              onChangeText={setEstCompletion}
              placeholder="e.g. 2 weeks, March 15, 2025"
              className="w-full border border-neutral-200 rounded-xl px-3 py-2.5 text-sm"
            />
          </View>

          {/* Notes */}
          <View className="mb-4">
            <Text className="text-xs font-semibold text-neutral-500 mb-1.5">
              Additional Notes
            </Text>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder="Warranty info, payment terms, etc."
              multiline
              numberOfLines={2}
              className="w-full border border-neutral-200 rounded-xl px-3 py-2.5 text-sm"
              style={{ textAlignVertical: 'top', minHeight: 50 }}
            />
          </View>

          {/* Error */}
          {error ? (
            <View className="mb-4 p-3 bg-red-50 rounded-xl border border-red-100">
              <Text className="text-xs font-semibold text-red-700">{error}</Text>
            </View>
          ) : null}

          <View className="h-20" />
        </ScrollView>

        {/* Submit Button */}
        <View className="absolute bottom-0 left-0 right-0 bg-white border-t border-neutral-100 px-4 py-3">
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={!isValid || submitting}
            className={`w-full py-3.5 rounded-xl flex-row items-center justify-center ${
              isValid && !submitting ? 'bg-indigo-600' : 'bg-neutral-200'
            }`}
            style={{ gap: 8 }}
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <FontAwesome5 name="paper-plane" size={13} color={isValid ? '#fff' : '#a3a3a3'} />
                <Text
                  className={`text-sm font-bold ${
                    isValid ? 'text-white' : 'text-neutral-400'
                  }`}
                >
                  Send Quote
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
