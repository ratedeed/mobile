import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Switch,
} from 'react-native';
import { useColorScheme } from 'nativewind';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FontAwesome5 } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { submitHelpTicket } from '../api';
import { HELP_ARTICLES } from '../data/helpData';
import HapticFeedback from '../utils/haptics';
import { BouncingDotsLoader } from '../components/common';

const TOPICS = [
  { id: 'payments', label: 'Payments & Escrow' },
  { id: 'disputes', label: 'Disputes & Claims' },
  { id: 'verification', label: 'License Verification' },
  { id: 'contractor', label: 'Contractor Growth' },
  { id: 'account', label: 'Account & Security' },
  { id: 'general', label: 'General Question' },
];

export default function ContactSupportScreen() {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const route = useRoute<any>();
  const { jobId, subject: initialSubject, isUrgent: initialUrgent, articleSlug } = (route.params || {}) as {
    jobId?: string;
    subject?: string;
    isUrgent?: boolean;
    articleSlug?: string;
  };

  const { firebaseUser } = useAuth();

  const [name, setName] = useState(firebaseUser?.displayName || '');
  const [email, setEmail] = useState(firebaseUser?.email || '');
  const [topic, setTopic] = useState('payments');
  const [isUrgent, setIsUrgent] = useState(!!initialUrgent);
  const [subject, setSubject] = useState(initialSubject || '');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [submittedTicketId, setSubmittedTicketId] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!name.trim()) {
      Alert.alert('Required Field', 'Please enter your full name.');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      Alert.alert('Invalid Email', 'Please provide a valid email address.');
      return;
    }
    if (!subject.trim()) {
      Alert.alert('Required Field', 'Please provide a short subject summary.');
      return;
    }
    if (!message.trim() || message.trim().length < 15) {
      Alert.alert('More Detail Needed', 'Please provide at least 15 characters describing your inquiry.');
      return;
    }

    try {
      setLoading(true);
      HapticFeedback.light();

      const res = await submitHelpTicket({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        topic,
        isUrgent,
        subject: subject.trim(),
        message: message.trim(),
        jobId: jobId || undefined,
        articleSlug: articleSlug || undefined,
      });

      HapticFeedback.success();
      setSubmittedTicketId(res.ticketId || 'TIK-RECEIVED');
    } catch (err: any) {
      HapticFeedback.error();
      Alert.alert(
        'Submission Notice',
        err?.message || 'Failed to submit ticket. You can also email support@ratedeed.com directly.'
      );
    } finally {
      setLoading(false);
    }
  };

  // Post-submission success screen
  if (submittedTicketId) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: isDark ? '#0a0a0a' : '#ffffff',
          paddingTop: Math.max(insets.top, 12),
        }}
      >
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
        <View className="flex-1 px-6 justify-center items-center text-center">
          <View className="w-16 h-16 rounded-full bg-emerald-50 dark:bg-emerald-950/60 items-center justify-center mb-4">
            <FontAwesome5 name="check-circle" size={32} color="#059669" />
          </View>

          <View className="px-3.5 py-1 bg-neutral-100 dark:bg-neutral-800 rounded-full mb-3">
            <Text className="font-mono text-xs font-bold text-neutral-700 dark:text-neutral-300">
              Ticket #{submittedTicketId}
            </Text>
          </View>

          <Text className="text-xl font-black text-neutral-900 dark:text-white mb-2">
            Support Inquiry Received
          </Text>

          <Text className="text-xs text-neutral-500 dark:text-neutral-400 text-center leading-relaxed max-w-xs mb-8">
            Your inquiry has been routed to our support specialists. An email confirmation was sent to <Text className="font-bold text-neutral-700 dark:text-neutral-300">{email}</Text>.
          </Text>

          <View className="w-full space-y-2.5">
            <Pressable
              onPress={() => {
                HapticFeedback.light();
                navigation.navigate('MyTickets');
              }}
              className="w-full py-3.5 rounded-2xl bg-indigo-600 active:bg-indigo-700 items-center justify-center"
            >
              <Text className="text-xs font-bold text-white">
                Track Ticket in My Tickets
              </Text>
            </Pressable>

            <Pressable
              onPress={() => {
                HapticFeedback.light();
                navigation.navigate('Main', { screen: 'Explore' });
              }}
              className="w-full py-3.5 rounded-2xl bg-neutral-900 dark:bg-white active:opacity-90 items-center justify-center"
            >
              <Text className="text-xs font-bold text-white dark:text-neutral-900">
                Return to Home
              </Text>
            </Pressable>

            <Pressable
              onPress={() => {
                HapticFeedback.light();
                navigation.navigate('HelpCenter');
              }}
              className="w-full py-2.5 items-center justify-center"
            >
              <Text className="text-xs font-bold text-neutral-500 dark:text-neutral-400">
                Back to Help Center
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: isDark ? '#0a0a0a' : '#ffffff',
        paddingTop: Math.max(insets.top, 12),
      }}
    >
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* Header */}
      <View className="px-5 py-3 border-b border-neutral-100 dark:border-neutral-800 flex-row items-center justify-between">
        <Pressable
          onPress={() => {
            HapticFeedback.light();
            if (navigation.canGoBack()) {
              navigation.goBack();
            } else {
              navigation.navigate('HelpCenter');
            }
          }}
          hitSlop={12}
          className="w-10 h-10 rounded-full bg-neutral-100 dark:bg-neutral-800 items-center justify-center"
        >
          <FontAwesome5 name="arrow-left" size={14} color={isDark ? '#e5e5e5' : '#171717'} />
        </Pressable>

        <Text className="text-sm font-bold text-neutral-900 dark:text-white">
          Submit Support Ticket
        </Text>

        <View className="w-10" />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}
        className="flex-1"
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 24 }}
          className="flex-1"
        >
          <Text className="text-xl font-black text-neutral-900 dark:text-white mb-1">
            How can our team help?
          </Text>
          <Text className="text-xs text-neutral-500 dark:text-neutral-400 mb-6">
            We respond promptly to project issues, dispute inquiries, and payout assistance.
          </Text>

          {/* Form Fields */}
          <View className="space-y-4">
            {/* Topic Picker */}
            <View>
              <Text className="text-xs font-bold uppercase tracking-wider text-neutral-400 mb-2">
                Select Topic
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-5 px-5" contentContainerStyle={{ gap: 8 }}>
                {TOPICS.map((t) => (
                  <Pressable
                    key={t.id}
                    onPress={() => {
                      HapticFeedback.selection();
                      setTopic(t.id);
                    }}
                    className={`px-3.5 py-2 rounded-xl border ${
                      topic === t.id
                        ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-500'
                        : 'bg-neutral-50 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700'
                    }`}
                  >
                    <Text
                      className={`text-xs font-bold ${
                        topic === t.id
                          ? 'text-indigo-600 dark:text-indigo-400'
                          : 'text-neutral-700 dark:text-neutral-300'
                      }`}
                    >
                      {t.label}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>

            {/* Guide Deflection Suggestions */}
            {(() => {
              const suggested = HELP_ARTICLES.filter((a) => a.category === topic || (topic === 'payments' && a.category === 'payments') || (topic === 'disputes' && a.category === 'disputes')).slice(0, 2);
              if (suggested.length === 0) return null;

              return (
                <View className="p-3.5 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/60 space-y-2">
                  <Text className="text-[11px] font-bold text-indigo-950 dark:text-indigo-200">
                    💡 Suggested Solution Guides:
                  </Text>
                  {suggested.map((art) => (
                    <Pressable
                      key={art.slug}
                      onPress={() => {
                        HapticFeedback.light();
                        navigation.navigate('HelpArticle', { slug: art.slug });
                      }}
                      className="p-2.5 rounded-xl bg-white dark:bg-neutral-900 border border-indigo-100 dark:border-indigo-900/80 flex-row items-center justify-between"
                    >
                      <View className="flex-1 pr-2">
                        <Text className="text-xs font-bold text-neutral-900 dark:text-white" numberOfLines={1}>
                          {art.title}
                        </Text>
                        <Text className="text-[10px] text-neutral-400" numberOfLines={1}>
                          {art.description}
                        </Text>
                      </View>
                      <FontAwesome5 name="arrow-right" size={10} color="#6366f1" />
                    </Pressable>
                  ))}
                </View>
              );
            })()}

            {/* Urgency Switch */}
            <View className="p-3.5 rounded-2xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 flex-row items-center justify-between">
              <View className="flex-1 pr-3">
                <Text className="text-xs font-bold text-neutral-900 dark:text-white">
                  Mark as Urgent
                </Text>
                <Text className="text-[11px] text-neutral-400">
                  Active dispute, stalled milestone, or stuck payment
                </Text>
              </View>
              <Switch
                value={isUrgent}
                onValueChange={(val) => {
                  HapticFeedback.selection();
                  setIsUrgent(val);
                }}
                trackColor={{ false: '#d1d5db', true: '#f43f5e' }}
                thumbColor="#ffffff"
              />
            </View>

            {/* Name Input */}
            <View>
              <Text className="text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                Your Name
              </Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Full name"
                placeholderTextColor="#9ca3af"
                className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200/80 dark:border-neutral-700 text-xs text-neutral-900 dark:text-white"
              />
            </View>

            {/* Email Input */}
            <View>
              <Text className="text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                Email Address
              </Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                placeholder="your@email.com"
                placeholderTextColor="#9ca3af"
                className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200/80 dark:border-neutral-700 text-xs text-neutral-900 dark:text-white"
              />
            </View>

            {/* Subject Input */}
            <View>
              <Text className="text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                Subject
              </Text>
              <TextInput
                value={subject}
                onChangeText={setSubject}
                placeholder="Brief summary of your issue"
                placeholderTextColor="#9ca3af"
                className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200/80 dark:border-neutral-700 text-xs text-neutral-900 dark:text-white"
              />
            </View>

            {/* Message Input */}
            <View>
              <Text className="text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                Description
              </Text>
              <TextInput
                value={message}
                onChangeText={setMessage}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                placeholder="Please describe what happened and how we can assist you..."
                placeholderTextColor="#9ca3af"
                className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200/80 dark:border-neutral-700 text-xs text-neutral-900 dark:text-white min-h-[90px]"
              />
            </View>
          </View>
        </ScrollView>

        {/* Pinned Submit Button Footer (Always visible & moves above keyboard) */}
        <View
          style={{
            paddingBottom: Math.max(insets.bottom, 14),
          }}
          className="px-5 pt-3 border-t border-neutral-100 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-sm"
        >
          <Pressable
            onPress={handleSubmit}
            disabled={loading}
            className={`w-full py-3.5 rounded-2xl items-center justify-center ${
              isUrgent ? 'bg-rose-600 active:bg-rose-700' : 'bg-indigo-600 active:bg-indigo-700'
            }`}
          >
            {loading ? (
              <BouncingDotsLoader size="small" color="#ffffff" />
            ) : (
              <Text className="text-xs font-bold text-white">
                {isUrgent ? 'Submit Urgent Ticket' : 'Submit Support Ticket'}
              </Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
