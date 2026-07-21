import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  ScrollView,
  TextInput,
  Platform,
  useColorScheme,
} from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BouncingDotsLoader } from '../common';

export const REPORT_CATEGORIES = [
  'Harassment or bullying',
  'Hate speech',
  'Scam or fraud attempt',
  'Inappropriate content',
  'Spam or solicitation',
  'Threats of violence',
  'Other',
];

interface ReportModalProps {
  visible: boolean;
  onClose: () => void;
  userName: string;
  onReport: (category: string, details: string) => Promise<void>;
}

export const ReportModal: React.FC<ReportModalProps> = ({
  visible,
  onClose,
  userName,
  onReport,
}) => {
  const [selected, setSelected] = useState<string | null>(null);
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const insets = useSafeAreaInsets();

  const handleSubmit = async () => {
    if (!selected) return;
    setSubmitting(true);
    try {
      await onReport(selected, details);
      setSelected(null);
      setDetails('');
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View className="flex-1 bg-white dark:bg-neutral-950">
        <View
          style={{ paddingTop: Platform.OS === 'android' ? (insets.top || 16) : 12 }}
          className="px-5 pb-4 border-b border-neutral-100 dark:border-neutral-800 flex-row items-center justify-between"
        >
          <Text className="text-lg font-bold text-neutral-900 dark:text-white">Report</Text>
          <Pressable onPress={onClose} className="p-1">
            <FontAwesome5 name="times" size={18} color={isDark ? '#a3a3a3' : '#737373'} />
          </Pressable>
        </View>
        <Text className="px-5 pt-5 pb-2 text-sm text-neutral-500 dark:text-neutral-400">
          Why are you reporting {userName}?
        </Text>
        <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 40 }}>
          {REPORT_CATEGORIES.map((cat) => (
            <Pressable
              key={cat}
              onPress={() => setSelected(cat)}
              className="flex-row items-center px-5 py-4 border-b border-neutral-100 dark:border-neutral-800"
              style={{ gap: 12 }}
            >
              <View
                className={`w-5 h-5 rounded-full border-2 items-center justify-center ${
                  selected === cat ? 'border-red-500 bg-red-500' : 'border-neutral-300 dark:border-neutral-600'
                }`}
              >
                {selected === cat && <FontAwesome5 name="check" size={9} color="white" />}
              </View>
              <Text
                className={`text-[15px] ${
                  selected === cat ? 'text-neutral-900 dark:text-white font-semibold' : 'text-neutral-700 dark:text-neutral-300'
                }`}
              >
                {cat}
              </Text>
            </Pressable>
          ))}
          {selected && (
            <View className="px-5 pt-5">
              <Text className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-2">
                Additional details (optional)
              </Text>
              <TextInput
                className="bg-neutral-50 dark:bg-neutral-800 rounded-xl px-4 py-3 text-sm min-h-[80px] text-neutral-900 dark:text-white"
                placeholder="Tell us more..."
                placeholderTextColor={isDark ? '#9ca3af' : '#a3a3a3'}
                value={details}
                onChangeText={setDetails}
                multiline
                textAlignVertical="top"
              />
            </View>
          )}
        </ScrollView>
        {selected && (
          <View
            style={{ paddingBottom: Math.max(insets.bottom, 12) }}
            className="px-5 pt-3 border-t border-neutral-100 dark:border-neutral-800"
          >
            <Pressable
              onPress={handleSubmit}
              disabled={submitting}
              className={`py-4 rounded-xl items-center ${submitting ? 'bg-red-300 dark:bg-red-900/40' : 'bg-red-500'}`}
            >
              {submitting ? (
                <BouncingDotsLoader size="small" color="white" />
              ) : (
                <Text className="text-white font-bold text-[15px]">Submit Report</Text>
              )}
            </Pressable>
          </View>
        )}
      </View>
    </Modal>
  );
};

export default ReportModal;
