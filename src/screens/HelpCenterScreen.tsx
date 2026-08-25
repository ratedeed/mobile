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

  const [roleFilter, setRoleFilter] = useState<'both' | 'homeowners' | 'contractors'>('both');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeJob, setActiveJob] = useState<any>(null);
  const [loadingActiveJob, setLoadingActiveJob] = useState(false);

  // Check for active in-progress job (Signature Airbnb Contextual Help)
  useEffect(() => {
    let isMounted = true;
    const fetchActiveJob = async () => {
      try {
        setLoadingActiveJob(true);
        const fetcher = userRole === 'contractor' ? getContractorJobs : getUserJobs;
        const jobs = await fetcher();
        const active = jobs?.find((j: any) => j.status === 'in_progress' || j.status === 'funded' || j.status === 'disputed');
        if (isMounted && active) {
          setActiveJob(active);
        }
      } catch (err) {
        // Silent fail for non-blocking contextual banner
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

  // Filter categories by selected audience role
  const filteredCategories = HELP_CATEGORIES.filter((cat) => {
    if (roleFilter === 'both') return true;
    return cat.audience === 'both' || cat.audience === roleFilter;
  });

  // Filter articles based on search query or role
  const filteredArticles = HELP_ARTICLES.filter((art) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        art.title.toLowerCase().includes(q) ||
        art.description.toLowerCase().includes(q) ||
        art.summary.toLowerCase().includes(q)
      );
    }
    if (roleFilter === 'both') return true;
    return art.audience === 'both' || art.audience === roleFilter;
  });

  const popularArticles = HELP_ARTICLES.slice(0, 4);

  return (
    <SafeAreaView className="flex-1 bg-neutral-50 dark:bg-neutral-950">
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* Header */}
      <View className="px-5 pt-3 pb-4 bg-white dark:bg-neutral-900 border-b border-neutral-200/80 dark:border-neutral-800">
        <View className="flex-row items-center justify-between mb-3">
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

          <Pressable
            onPress={() => {
              HapticFeedback.light();
              navigation.navigate('ContactSupport');
            }}
            className="px-3.5 py-1.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200/60 dark:border-indigo-800"
          >
            <Text className="text-[12px] font-bold text-indigo-600 dark:text-indigo-400">
              Submit Ticket
            </Text>
          </Pressable>
        </View>

        <Text className="text-2xl font-black text-neutral-900 dark:text-white tracking-tight">
          How can we help?
        </Text>
        <Text className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
          Search escrow policies, dispute rules, and platform guides.
        </Text>

        {/* Search Bar */}
        <View className="mt-4 flex-row items-center px-3.5 py-2.5 bg-neutral-100 dark:bg-neutral-800 rounded-2xl border border-neutral-200/60 dark:border-neutral-700/50">
          <FontAwesome5 name="search" size={13} color="#9ca3af" />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search escrow, payouts, change orders..."
            placeholderTextColor="#9ca3af"
            className="flex-1 ml-2.5 text-xs text-neutral-900 dark:text-white font-medium p-0"
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery('')} hitSlop={8}>
              <FontAwesome5 name="times-circle" size={13} color="#9ca3af" />
            </Pressable>
          )}
        </View>

        {/* Suggestion Chips */}
        {!searchQuery && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="mt-3 -mx-5 px-5"
            contentContainerStyle={{ gap: 8 }}
          >
            {['Escrow Release', 'Diagnostic Fee', 'File Dispute', 'Stripe Payouts'].map((chip, idx) => (
              <Pressable
                key={idx}
                onPress={() => setSearchQuery(chip)}
                className="px-3 py-1.5 rounded-full bg-neutral-100 dark:bg-neutral-800/80 border border-neutral-200/60 dark:border-neutral-700/60"
              >
                <Text className="text-[11px] font-medium text-neutral-600 dark:text-neutral-300">
                  {chip}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        )}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
        className="flex-1"
      >
        {/* Contextual Active Job Smart Card (Signature Airbnb Feature) */}
        {activeJob && !searchQuery && (
          <View className="mx-5 mt-5 p-4 rounded-3xl bg-indigo-600 text-white shadow-lg shadow-indigo-500/20">
            <View className="flex-row items-center gap-2 mb-1.5">
              <View className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <Text className="text-[11px] font-black uppercase tracking-wider text-indigo-100">
                Active Project Support
              </Text>
            </View>

            <Text className="text-base font-bold text-white leading-tight">
              {activeJob.title || 'In-Progress Project'}
            </Text>
            <Text className="text-xs text-indigo-100 mt-1">
              Need help with milestone release, scope adjustments, or communication?
            </Text>

            <View className="flex-row items-center gap-2 mt-3 flex-wrap">
              <Pressable
                onPress={() => {
                  HapticFeedback.light();
                  navigation.navigate('HelpArticle', { slug: 'how-ratedeed-escrow-works' });
                }}
                className="px-3 py-1.5 rounded-xl bg-white/20 active:bg-white/30"
              >
                <Text className="text-[11px] font-bold text-white">Escrow Rules</Text>
              </Pressable>

              <Pressable
                onPress={() => {
                  HapticFeedback.light();
                  navigation.navigate('HelpArticle', { slug: 'project-milestones-and-change-orders' });
                }}
                className="px-3 py-1.5 rounded-xl bg-white/20 active:bg-white/30"
              >
                <Text className="text-[11px] font-bold text-white">Change Orders</Text>
              </Pressable>

              <Pressable
                onPress={() => {
                  HapticFeedback.light();
                  navigation.navigate('ContactSupport', { jobId: activeJob._id, isUrgent: true });
                }}
                className="px-3 py-1.5 rounded-xl bg-rose-500 active:bg-rose-600"
              >
                <Text className="text-[11px] font-bold text-white">Urgent Assistance</Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* Audience Segmented Toggle */}
        {!searchQuery && (
          <View className="mx-5 mt-5">
            <View className="flex-row p-1 bg-neutral-200/60 dark:bg-neutral-800 rounded-2xl">
              <Pressable
                onPress={() => {
                  HapticFeedback.selection();
                  setRoleFilter('both');
                }}
                className={`flex-1 py-2 rounded-xl items-center justify-center ${
                  roleFilter === 'both' ? 'bg-white dark:bg-neutral-700 shadow-xs' : ''
                }`}
              >
                <Text
                  className={`text-xs font-bold ${
                    roleFilter === 'both'
                      ? 'text-neutral-900 dark:text-white'
                      : 'text-neutral-500 dark:text-neutral-400'
                  }`}
                >
                  All Topics
                </Text>
              </Pressable>

              <Pressable
                onPress={() => {
                  HapticFeedback.selection();
                  setRoleFilter('homeowners');
                }}
                className={`flex-1 py-2 rounded-xl items-center justify-center ${
                  roleFilter === 'homeowners' ? 'bg-white dark:bg-neutral-700 shadow-xs' : ''
                }`}
              >
                <Text
                  className={`text-xs font-bold ${
                    roleFilter === 'homeowners'
                      ? 'text-neutral-900 dark:text-white'
                      : 'text-neutral-500 dark:text-neutral-400'
                  }`}
                >
                  Homeowners
                </Text>
              </Pressable>

              <Pressable
                onPress={() => {
                  HapticFeedback.selection();
                  setRoleFilter('contractors');
                }}
                className={`flex-1 py-2 rounded-xl items-center justify-center ${
                  roleFilter === 'contractors' ? 'bg-white dark:bg-neutral-700 shadow-xs' : ''
                }`}
              >
                <Text
                  className={`text-xs font-bold ${
                    roleFilter === 'contractors'
                      ? 'text-neutral-900 dark:text-white'
                      : 'text-neutral-500 dark:text-neutral-400'
                  }`}
                >
                  Contractors
                </Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* Search Results Mode */}
        {searchQuery.trim().length > 0 ? (
          <View className="mx-5 mt-5 space-y-3">
            <Text className="text-xs font-bold text-neutral-400 uppercase tracking-wider">
              Search Results ({filteredArticles.length})
            </Text>

            {filteredArticles.length > 0 ? (
              filteredArticles.map((art) => (
                <Pressable
                  key={art.slug}
                  onPress={() => {
                    HapticFeedback.light();
                    navigation.navigate('HelpArticle', { slug: art.slug });
                  }}
                  className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 shadow-xs"
                >
                  <View className="flex-row items-center justify-between mb-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                      {art.category}
                    </span>
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
                <FontAwesome5 name="search" size={24} color="#9ca3af" style={{ marginBottom: 12 }} />
                <Text className="text-sm font-bold text-neutral-900 dark:text-white">
                  No matching guides found
                </Text>
                <Text className="text-xs text-neutral-500 text-center mt-1 mb-4">
                  Need an answer to a specific situation? Our support team is here to help.
                </Text>
                <Pressable
                  onPress={() => navigation.navigate('ContactSupport', { subject: searchQuery })}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600"
                >
                  <Text className="text-xs font-bold text-white">Ask Support Specialist</Text>
                </Pressable>
              </View>
            )}
          </View>
        ) : (
          <>
            {/* Category 2-Column Grid */}
            <View className="mx-5 mt-6">
              <Text className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-3">
                Browse by Topic
              </Text>

              <View className="flex-row flex-wrap" style={{ marginHorizontal: -4 }}>
                {filteredCategories.map((cat) => (
                  <View key={cat.slug} className="w-1/2 p-1">
                    <Pressable
                      onPress={() => {
                        HapticFeedback.light();
                        // Find first article in this category
                        const art = HELP_ARTICLES.find((a) => a.category === cat.slug);
                        if (art) {
                          navigation.navigate('HelpArticle', { slug: art.slug });
                        }
                      }}
                      className="p-4 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 shadow-xs h-[135px] justify-between"
                    >
                      <View className={`w-9 h-9 rounded-2xl ${cat.iconBg} items-center justify-center`}>
                        <FontAwesome5 name={cat.icon} size={15} color={cat.iconColor} />
                      </View>

                      <View>
                        <Text className="text-xs font-bold text-neutral-900 dark:text-white leading-tight">
                          {cat.title}
                        </Text>
                        <Text className="text-[10px] text-neutral-400 mt-1 line-clamp-1">
                          {cat.description}
                        </Text>
                      </View>
                    </Pressable>
                  </View>
                ))}
              </View>
            </View>

            {/* Popular Guides */}
            <View className="mx-5 mt-6">
              <Text className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-3">
                Popular Guides
              </Text>

              <View className="bg-white dark:bg-neutral-900 rounded-3xl border border-neutral-200/80 dark:border-neutral-800 overflow-hidden divide-y divide-neutral-100 dark:divide-neutral-800 shadow-xs">
                {popularArticles.map((art) => (
                  <Pressable
                    key={art.slug}
                    onPress={() => {
                      HapticFeedback.light();
                      navigation.navigate('HelpArticle', { slug: art.slug });
                    }}
                    className="p-4 flex-row items-center justify-between active:bg-neutral-50 dark:active:bg-neutral-800"
                  >
                    <View className="flex-1 pr-3">
                      <Text className="text-xs font-bold text-neutral-900 dark:text-white mb-0.5">
                        {art.title}
                      </Text>
                      <Text className="text-[11px] text-neutral-400 line-clamp-1">
                        {art.description}
                      </Text>
                    </View>
                    <FontAwesome5 name="chevron-right" size={11} color="#9ca3af" />
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Still Need Help Escalation Card */}
            <View className="mx-5 mt-6 p-6 rounded-3xl bg-neutral-900 dark:bg-neutral-900 border border-neutral-800 shadow-xl">
              <View className="w-10 h-10 rounded-2xl bg-indigo-500/20 text-indigo-400 items-center justify-center mb-3">
                <FontAwesome5 name="headset" size={16} color="#818CF8" />
              </View>

              <Text className="text-base font-bold text-white">
                Can't find what you're looking for?
              </Text>
              <Text className="text-xs text-neutral-400 mt-1 leading-relaxed">
                Our support team prioritizes payment protection and project disputes. Submit a ticket for direct follow-up.
              </Text>

              <Pressable
                onPress={() => {
                  HapticFeedback.light();
                  navigation.navigate('ContactSupport');
                }}
                className="mt-4 w-full py-3 rounded-2xl bg-indigo-600 active:bg-indigo-700 items-center justify-center"
              >
                <Text className="text-xs font-bold text-white">
                  Contact Support Specialists
                </Text>
              </Pressable>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
