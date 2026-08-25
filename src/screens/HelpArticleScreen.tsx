import React, { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  SafeAreaView,
  StatusBar,
  Alert,
} from 'react-native';
import { useColorScheme } from 'nativewind';
import { useNavigation, useRoute } from '@react-navigation/native';
import { FontAwesome5 } from '@expo/vector-icons';
import { HELP_ARTICLES, HELP_CATEGORIES } from '../data/helpData';
import HapticFeedback from '../utils/haptics';

export default function HelpArticleScreen() {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { slug } = (route.params || {}) as { slug?: string };

  const [feedbackGiven, setFeedbackGiven] = useState<'yes' | 'no' | null>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const article = HELP_ARTICLES.find((a) => a.slug === slug) || HELP_ARTICLES[0];
  const category = HELP_CATEGORIES.find((c) => c.slug === article.category);

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-neutral-950">
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* Navigation Header */}
      <View className="px-5 py-3 border-b border-neutral-100 dark:border-neutral-800 flex-row items-center justify-between">
        <Pressable
          onPress={() => {
            HapticFeedback.light();
            navigation.goBack();
          }}
          hitSlop={12}
          className="w-10 h-10 rounded-full bg-neutral-100 dark:bg-neutral-800 items-center justify-center"
        >
          <FontAwesome5 name="arrow-left" size={14} color={isDark ? '#e5e5e5' : '#171717'} />
        </Pressable>

        <View className="flex-row items-center gap-1.5 px-3 py-1 bg-neutral-100 dark:bg-neutral-800 rounded-full">
          <FontAwesome5 name={category?.icon || 'book'} size={10} color={category?.iconColor || '#6366f1'} />
          <Text className="text-[11px] font-bold text-neutral-700 dark:text-neutral-300 capitalize">
            {category?.title || article.category}
          </Text>
        </View>

        <Pressable
          onPress={() => {
            HapticFeedback.light();
            navigation.navigate('ContactSupport', { articleSlug: article.slug });
          }}
          hitSlop={12}
          className="w-10 h-10 rounded-full bg-neutral-100 dark:bg-neutral-800 items-center justify-center"
        >
          <FontAwesome5 name="headset" size={13} color={isDark ? '#e5e5e5' : '#171717'} />
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 60 }}
        className="flex-1"
      >
        {/* Article Metadata */}
        <View className="flex-row items-center gap-3 mb-3">
          <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400">
            {article.readTime}
          </span>
          <Text className="text-[11px] text-neutral-400">&middot;</Text>
          <Text className="text-[11px] text-neutral-400">
            Updated August 2026
          </Text>
        </View>

        {/* Title */}
        <Text className="text-2xl font-black text-neutral-900 dark:text-white tracking-tight leading-8 mb-4">
          {article.title}
        </Text>

        {/* Summary Card */}
        <View className="p-4 rounded-2xl bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/60 mb-6">
          <Text className="text-xs text-indigo-950 dark:text-indigo-200 leading-relaxed font-medium">
            {article.summary}
          </Text>
        </View>

        {/* Formatted Sections */}
        <View className="space-y-6">
          {article.sections.map((sec, idx) => (
            <View key={idx} className="space-y-2.5">
              <Text className="text-base font-bold text-neutral-900 dark:text-white">
                {sec.heading}
              </Text>
              <Text className="text-xs text-neutral-600 dark:text-neutral-300 leading-relaxed">
                {sec.body}
              </Text>

              {sec.callout && (
                <View
                  className={`p-3.5 rounded-xl border mt-2 ${
                    sec.callout.type === 'success'
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800'
                      : sec.callout.type === 'warning'
                      ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800'
                      : 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800'
                  }`}
                >
                  <Text
                    className={`text-[11px] font-semibold leading-relaxed ${
                      sec.callout.type === 'success'
                        ? 'text-emerald-900 dark:text-emerald-200'
                        : sec.callout.type === 'warning'
                        ? 'text-amber-900 dark:text-amber-200'
                        : 'text-blue-900 dark:text-blue-200'
                    }`}
                  >
                    {sec.callout.text}
                  </Text>
                </View>
              )}
            </View>
          ))}
        </View>

        {/* FAQs Accordion if present */}
        {article.faqs && article.faqs.length > 0 && (
          <View className="mt-8 pt-6 border-t border-neutral-100 dark:border-neutral-800">
            <Text className="text-sm font-bold text-neutral-900 dark:text-white uppercase tracking-wider mb-3">
              Frequently Asked Questions
            </Text>

            <View className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {article.faqs.map((faq, i) => (
                <View key={i} className="py-3">
                  <Pressable
                    onPress={() => {
                      HapticFeedback.selection();
                      setOpenFaq(openFaq === i ? null : i);
                    }}
                    className="flex-row items-center justify-between"
                  >
                    <Text className="text-xs font-bold text-neutral-800 dark:text-neutral-200 flex-1 pr-2">
                      {faq.q}
                    </Text>
                    <FontAwesome5
                      name={openFaq === i ? 'chevron-up' : 'chevron-down'}
                      size={10}
                      color="#a3a3a3"
                    />
                  </Pressable>
                  {openFaq === i && (
                    <Text className="text-xs text-neutral-500 dark:text-neutral-400 mt-2 leading-relaxed">
                      {faq.a}
                    </Text>
                  )}
                </View>
              ))}
            </View>
          </View>
        )}

        {/* "Was this helpful?" Feedback Section */}
        <View className="mt-10 p-5 rounded-3xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200/60 dark:border-neutral-800 items-center text-center">
          <Text className="text-xs font-bold text-neutral-900 dark:text-white mb-1">
            Was this article helpful?
          </Text>
          <Text className="text-[11px] text-neutral-400 mb-3">
            Your feedback helps us improve our help documentation.
          </Text>

          {feedbackGiven ? (
            <View className="flex-row items-center gap-1.5 py-1.5 px-3 bg-emerald-50 dark:bg-emerald-950/60 rounded-full">
              <FontAwesome5 name="check" size={10} color="#059669" />
              <Text className="text-xs font-bold text-emerald-700 dark:text-emerald-300">
                Thank you for your feedback!
              </Text>
            </View>
          ) : (
            <View className="flex-row items-center gap-3">
              <Pressable
                onPress={() => {
                  HapticFeedback.success();
                  setFeedbackGiven('yes');
                }}
                className="px-4 py-2 rounded-xl bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 flex-row items-center gap-1.5"
              >
                <FontAwesome5 name="thumbs-up" size={11} color="#059669" />
                <Text className="text-xs font-bold text-neutral-700 dark:text-neutral-200">
                  Yes
                </Text>
              </Pressable>

              <Pressable
                onPress={() => {
                  HapticFeedback.light();
                  setFeedbackGiven('no');
                }}
                className="px-4 py-2 rounded-xl bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 flex-row items-center gap-1.5"
              >
                <FontAwesome5 name="thumbs-down" size={11} color="#e11d48" />
                <Text className="text-xs font-bold text-neutral-700 dark:text-neutral-200">
                  No
                </Text>
              </Pressable>
            </View>
          )}
        </View>

        {/* Support Escalation Footer */}
        <View className="mt-6 p-5 rounded-3xl bg-indigo-50/50 dark:bg-neutral-900 border border-indigo-100 dark:border-neutral-800 flex-row items-center justify-between">
          <View className="flex-1 pr-3">
            <Text className="text-xs font-bold text-neutral-900 dark:text-white">
              Still have questions?
            </Text>
            <Text className="text-[11px] text-neutral-400 mt-0.5">
              Submit a support ticket directly to our specialists.
            </Text>
          </View>

          <Pressable
            onPress={() => {
              HapticFeedback.light();
              navigation.navigate('ContactSupport', { articleSlug: article.slug });
            }}
            className="px-3.5 py-2 rounded-xl bg-indigo-600 active:bg-indigo-700"
          >
            <Text className="text-xs font-bold text-white">Contact Us</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
