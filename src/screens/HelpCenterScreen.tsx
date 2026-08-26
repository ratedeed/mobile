import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { useColorScheme } from 'nativewind';
import { useNavigation } from '@react-navigation/native';
import { FontAwesome5 } from '@expo/vector-icons';
import { HELP_CATEGORIES, HELP_ARTICLES, MobileHelpCategory, MobileHelpArticle } from '../data/helpData';
import { useAuth } from '../context/AuthContext';
import { getUserJobs, getContractorJobs } from '../api';
import HapticFeedback from '../utils/haptics';

export default function HelpCenterScreen() {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const navigation = useNavigation<any>();
  const { isAuthenticated, userRole } = useAuth();

  const [viewMode, setViewMode] = useState<'home' | 'all-topics'>('home');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeJob, setActiveJob] = useState<any>(null);
  const [loadingActiveJob, setLoadingActiveJob] = useState(false);

  // Check for active in-progress job (Contextual Smart Rescue)
  useEffect(() => {
    let isMounted = true;
    const fetchActiveJob = async () => {
      try {
        setLoadingActiveJob(true);
        const fetcher = userRole === 'contractor' ? getContractorJobs : getUserJobs;
        const jobs = await fetcher();
        const active = jobs?.find(
          (j: any) =>
            j.status === 'in_progress' ||
            j.status === 'funded_in_progress' ||
            j.status === 'partially_funded' ||
            j.status === 'disputed'
        );
        if (isMounted && active) {
          setActiveJob(active);
        }
      } catch (err) {
        // Non-blocking contextual rescue
      } finally {
        if (isMounted) setLoadingActiveJob(false);
      }
    };

    if (isAuthenticated) {
      fetchActiveJob();
    }
    return () => {
      isMounted = false;
    };
  }, [isAuthenticated, userRole]);

  // Filter articles based on search query
  const searchResults = HELP_ARTICLES.filter((art) => {
    if (!searchQuery.trim()) return false;
    const q = searchQuery.toLowerCase();
    return (
      art.title.toLowerCase().includes(q) ||
      art.description.toLowerCase().includes(q) ||
      art.summary.toLowerCase().includes(q)
    );
  });

  // Top 6 primary curated articles for Option A
  const popularArticleSlugs = [
    'how-ratedeed-escrow-works',
    'what-happens-during-a-dispute',
    'stripe-connect-bank-payouts',
    'project-milestones-and-change-orders',
    'how-verified-reviews-work',
    'managing-your-profile-and-notifications',
  ];

  const popularArticles = popularArticleSlugs
    .map((slug) => HELP_ARTICLES.find((a) => a.slug === slug))
    .filter(Boolean) as MobileHelpArticle[];

  return (
    <SafeAreaView className="flex-1 bg-neutral-50 dark:bg-neutral-950">
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* ══ HEADER ══ */}
      <View className="px-5 pt-3 pb-3 bg-white dark:bg-neutral-900 border-b border-neutral-200/70 dark:border-neutral-800 flex-row items-center justify-between">
        <Pressable
          onPress={() => {
            HapticFeedback.light();
            if (viewMode === 'all-topics') {
              setViewMode('home');
            } else {
              navigation.goBack();
            }
          }}
          hitSlop={12}
          className="w-9 h-9 rounded-full bg-neutral-100 dark:bg-neutral-800 items-center justify-center"
        >
          <FontAwesome5 name="arrow-left" size={13} color={isDark ? '#e5e5e5' : '#171717'} />
        </Pressable>

        {viewMode === 'all-topics' ? (
          <Text className="text-sm font-bold text-neutral-900 dark:text-white">
            All Topics
          </Text>
        ) : (
          <View />
        )}

        <Pressable
          onPress={() => {
            HapticFeedback.light();
            navigation.navigate('MyTickets');
          }}
          hitSlop={10}
          className="px-3 py-1.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200/60 dark:border-indigo-800"
        >
          <Text className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400">
            My Tickets
          </Text>
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
        className="flex-1"
      >
        {/* ═══════════════════════════════════════════ */}
        {/* VIEW 1: ALL TOPICS BROWSER                  */}
        {/* ═══════════════════════════════════════════ */}
        {viewMode === 'all-topics' ? (
          <View className="px-5 pt-4">
            <Text className="text-xs text-neutral-500 dark:text-neutral-400 mb-3">
              {HELP_CATEGORIES.length} categories &middot; {HELP_ARTICLES.length} guides
            </Text>

            <View className="divide-y divide-neutral-200/70 dark:divide-neutral-800 bg-white dark:bg-neutral-900 rounded-3xl border border-neutral-200/80 dark:border-neutral-800 overflow-hidden">
              {HELP_CATEGORIES.map((cat) => {
                const count = HELP_ARTICLES.filter((a) => a.category === cat.slug).length;
                return (
                  <Pressable
                    key={cat.slug}
                    onPress={() => {
                      HapticFeedback.light();
                      const firstArt = HELP_ARTICLES.find((a) => a.category === cat.slug);
                      if (firstArt) {
                        navigation.navigate('HelpArticle', { slug: firstArt.slug });
                      }
                    }}
                    className="p-4 flex-row items-center justify-between active:bg-neutral-50 dark:active:bg-neutral-800/60"
                  >
                    <View className="flex-row items-center gap-3.5 flex-1 pr-3">
                      <View className={`w-9 h-9 rounded-2xl ${cat.iconBg} items-center justify-center`}>
                        <FontAwesome5 name={cat.icon} size={14} color={cat.iconColor} />
                      </View>
                      <View className="flex-1">
                        <Text className="text-[13px] font-bold text-neutral-900 dark:text-white">
                          {cat.title}
                        </Text>
                        <Text className="text-[11px] text-neutral-400 mt-0.5 line-clamp-1">
                          {cat.description}
                        </Text>
                      </View>
                    </View>
                    <View className="flex-row items-center gap-2">
                      <Text className="text-[10px] font-bold text-neutral-400 bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 rounded-full">
                        {count} {count === 1 ? 'guide' : 'guides'}
                      </Text>
                      <FontAwesome5 name="chevron-right" size={11} color="#9ca3af" />
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : (
          /* ═══════════════════════════════════════════ */
          /* VIEW 2: OPTION A "QUIET ANSWERS" HOME       */
          /* ═══════════════════════════════════════════ */
          <View className="px-5 pt-4">
            {/* Title & Subtitle */}
            <Text className="text-[26px] font-black text-neutral-900 dark:text-white tracking-tight">
              How can we help?
            </Text>
            <Text className="text-[12px] text-neutral-500 dark:text-neutral-400 mt-1 leading-relaxed">
              Answers about escrow, payouts, disputes, and accounts — in plain language.
            </Text>

            {/* Pill Search Input */}
            <View className="mt-5 flex-row items-center px-4 py-3 bg-neutral-100 dark:bg-neutral-800 rounded-full border border-neutral-200/70 dark:border-neutral-700/50">
              <FontAwesome5 name="search" size={13} color="#9ca3af" />
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Ask a question…"
                placeholderTextColor="#9ca3af"
                className="flex-1 ml-2.5 text-[12px] font-medium text-neutral-900 dark:text-white p-0"
              />
              {searchQuery.length > 0 && (
                <Pressable onPress={() => setSearchQuery('')} hitSlop={8}>
                  <FontAwesome5 name="times-circle" size={13} color="#9ca3af" />
                </Pressable>
              )}
            </View>

            {/* ══ SEARCH RESULTS ══ */}
            {searchQuery.trim().length > 0 ? (
              <View className="mt-6 space-y-3">
                <Text className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">
                  Search Results ({searchResults.length})
                </Text>

                {searchResults.length > 0 ? (
                  searchResults.map((art) => (
                    <Pressable
                      key={art.slug}
                      onPress={() => {
                        HapticFeedback.light();
                        navigation.navigate('HelpArticle', { slug: art.slug });
                      }}
                      className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 shadow-xs"
                    >
                      <View className="flex-row items-center justify-between mb-1">
                        <Text className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                          {art.category}
                        </Text>
                        <Text className="text-[10px] text-neutral-400 font-medium">
                          {art.readTime}
                        </Text>
                      </View>
                      <Text className="text-sm font-bold text-neutral-900 dark:text-white mb-1">
                        {art.title}
                      </Text>
                      <Text className="text-xs text-neutral-500 dark:text-neutral-400 line-clamp-2">
                        {art.description}
                      </Text>
                    </Pressable>
                  ))
                ) : (
                  <View className="p-8 text-center bg-white dark:bg-neutral-900 rounded-3xl border border-neutral-200 dark:border-neutral-800 items-center">
                    <FontAwesome5 name="search" size={22} color="#9ca3af" style={{ marginBottom: 10 }} />
                    <Text className="text-sm font-bold text-neutral-900 dark:text-white">
                      No matching guides
                    </Text>
                    <Text className="text-xs text-neutral-500 text-center mt-1 mb-4">
                      Try different keywords, or ask a support specialist directly.
                    </Text>
                    <Pressable
                      onPress={() => navigation.navigate('ContactSupport', { subject: searchQuery })}
                      className="px-5 py-2.5 rounded-xl bg-indigo-600"
                    >
                      <Text className="text-xs font-bold text-white">Ask a Specialist</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            ) : (
              /* ══ POPULAR RIGHT NOW LIST ══ */
              <>
                <Text className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 mt-7 mb-2.5">
                  Popular right now
                </Text>

                <View className="divide-y divide-neutral-100 dark:divide-neutral-800 bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200/80 dark:border-neutral-800 overflow-hidden">
                  {popularArticles.map((art) => (
                    <Pressable
                      key={art.slug}
                      onPress={() => {
                        HapticFeedback.light();
                        navigation.navigate('HelpArticle', { slug: art.slug });
                      }}
                      className="flex-row items-center justify-between py-3.5 px-4 active:bg-neutral-50 dark:active:bg-neutral-800/60"
                    >
                      <Text className="text-[13px] font-bold text-neutral-900 dark:text-white flex-1 pr-3">
                        {art.title}
                      </Text>
                      <FontAwesome5 name="chevron-right" size={12} color="#d1d5db" />
                    </Pressable>
                  ))}
                </View>

                {/* Browse all topics link */}
                <Pressable
                  onPress={() => {
                    HapticFeedback.selection();
                    setViewMode('all-topics');
                  }}
                  className="mt-3 py-2 w-full items-center justify-center"
                >
                  <Text className="text-[12px] font-bold text-indigo-600 dark:text-indigo-400">
                    Browse all topics &rarr;
                  </Text>
                </Pressable>

                {/* ══ CONTEXTUAL ACTIVE PROJECT CARD ══ */}
                {activeJob && (
                  <View className="mt-5 flex-row items-start gap-3 p-4 rounded-2xl border border-indigo-200/60 dark:border-indigo-900/50 bg-indigo-50/60 dark:bg-indigo-950/30">
                    <View className="w-8 h-8 rounded-xl bg-indigo-600/10 dark:bg-indigo-500/20 items-center justify-center flex-none">
                      <FontAwesome5 name="hammer" size={13} color={isDark ? '#818CF8' : '#4338CA'} />
                    </View>
                    <View className="flex-1">
                      <Text className="text-[11px] font-bold text-neutral-900 dark:text-white leading-tight">
                        {activeJob.title || 'Project'} &middot; Milestone in escrow
                      </Text>
                      <Pressable
                        onPress={() => {
                          HapticFeedback.light();
                          navigation.navigate('HelpArticle', { slug: 'project-milestones-and-change-orders' });
                        }}
                        className="mt-1"
                      >
                        <Text className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400">
                          Get help with this project &rarr;
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                )}

                {/* ══ STILL STUCK BOTTOM CARD ══ */}
                <View className="mt-6 flex-row items-center justify-between bg-neutral-900 dark:bg-neutral-800 rounded-2xl px-4 py-3.5 shadow-sm">
                  <View className="flex-1 pr-3">
                    <Text className="text-[12px] font-bold text-white">
                      Still stuck?
                    </Text>
                    <Text className="text-[10px] text-neutral-400 mt-0.5">
                      Specialists review and follow up promptly.
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => {
                      HapticFeedback.light();
                      navigation.navigate('ContactSupport');
                    }}
                    className="px-3.5 py-2 rounded-xl bg-white active:bg-neutral-100"
                  >
                    <Text className="text-[11px] font-bold text-neutral-900">
                      Contact us
                    </Text>
                  </Pressable>
                </View>
              </>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
