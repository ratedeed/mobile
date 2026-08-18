import React, { useState, useCallback, useMemo } from 'react';
import { EmptyState } from '../components/common/EmptyState';
import { BouncingDotsLoader, BouncingRefreshFlatList } from '../components/common';

import {
  View,
  Text,
  SafeAreaView,
  ScrollView,
  Pressable,
  Image,
  useColorScheme,
  FlatList,
  Alert,
  Platform,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Heart, SquaresFour, Warning, Star } from 'phosphor-react-native';
import { SvgImage } from '../components/common/SvgImage';
import { browseContractors } from '../utils/apiClient';
import { Contractor, RootStackParamList } from '../types';
import { getCoverImageUrl, isSvgUrl } from '../utils/avatarUtils';
import { getFavorites, removeFavorite } from '../utils/favoritesStore';
import HapticFeedback from '../utils/haptics';
import { useAuth } from '../context/AuthContext';

import { CategoryIcon } from '../components/common/CategoryIcon';
import { VerifiedBadge } from '../components/common/VerifiedBadge';
import { formatPriceString } from '../utils/money';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const CATEGORIES = [
  { id: 'all', label: 'All', icon: 'grid' },
  { id: 'builders', label: 'Home Builders', icon: 'home' },
  { id: 'plumbers', label: 'Plumbers', icon: 'droplets' },
  { id: 'electricians', label: 'Electricians', icon: 'zap' },
  { id: 'painters', label: 'Painters', icon: 'paintbrush' },
  { id: 'landscape', label: 'Landscapers', icon: 'trees' },
  { id: 'hvac', label: 'HVAC', icon: 'wind' },
  { id: 'roofers', label: 'Roofers', icon: 'warehouse' },
  { id: 'carpenters', label: 'Carpenters', icon: 'hammer' },
  { id: 'cleaners', label: 'Cleaners', icon: 'sparkles' },
  { id: 'handyman', label: 'Handymen', icon: 'wrench' },
];

function derivePrice(c: Contractor): string | null {
  if (c.pricing) return c.pricing.split('–')[0]?.trim() || null;
  if (c.servicesOffered?.length) {
    const svc = c.servicesOffered[0];
    if (typeof svc === 'object' && svc !== null) {
      const range = (svc as any).priceEstimate || (svc as any).priceRange;
      if (range) return range.split('–')[0]?.trim();
    }
  }
  return null;
}

const SavedScreen = () => {
  const isDark = useColorScheme() === 'dark';
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const { isAuthenticated } = useAuth();
  const [allContractors, setAllContractors] = useState<Contractor[]>([]);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [activeCategory, setActiveCategory] = useState('all');

  const loadData = useCallback(async () => {
    try {
      setLoadError(false);
      const ids = await getFavorites();
      setSavedIds(ids);

      if (ids.length === 0) {
        setAllContractors([]);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      const result: any = await browseContractors({ ids: ids.join(','), limit: 100 });

      const list = Array.isArray(result)
        ? result
        : Array.isArray(result?.contractors)
          ? result.contractors
          : Array.isArray(result?.data)
            ? result.data
            : [];

      setAllContractors(list);
    } catch (error) {
      setLoadError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  const handleRemove = useCallback(async (id: string) => {
    HapticFeedback.selection();
    setSavedIds((prev) => prev.filter((sid) => sid !== id));
    try {
      await removeFavorite(id);
    } catch (err) {
      setSavedIds((prev) => [...prev, id]);
      Alert.alert('Error', 'Failed to remove favorite from server. Please try again.');
    }
  }, []);

  const savedContractors = useMemo(() => {
    // Robust matching for both _id and id
    return allContractors.filter((c) => {
      const cid = c._id || (c as any).id;
      return savedIds.includes(cid);
    });
  }, [allContractors, savedIds]);

  const availableCategories = useMemo(() => {
    const catsInSaved = new Set(savedContractors.map((c) => c.category?.toLowerCase()).filter(Boolean));
    return CATEGORIES.filter(
      (cat) => cat.id === 'all' || catsInSaved.has(cat.id.toLowerCase()) || catsInSaved.has(cat.label.toLowerCase())
    );
  }, [savedContractors]);

  const filtered = useMemo(() => {
    if (activeCategory === 'all') return savedContractors;
    const cat = CATEGORIES.find((c) => c.id === activeCategory);
    const label = cat?.label.toLowerCase();
    const id = cat?.id.toLowerCase();

    return savedContractors.filter((c) => {
      const cCat = c.category?.toLowerCase() || '';
      return cCat.includes(id || '') || cCat.includes(label || '');
    });
  }, [savedContractors, activeCategory]);

  const renderContractorItem = useCallback(
    ({ item }: { item: Contractor }) => {
      const rawImage =
        (item as any).bannerUrl || item.bannerImage || (item as any).imageUrl || item.profilePicture || '';
      const coverImage = getCoverImageUrl(
        item.companyName || item.businessName || 'Contractor',
        rawImage,
        item.category,
        400,
        400
      );
      const contractorId = item._id || (item as any).id;
      const price = derivePrice(item);

      return (
        <Pressable className="w-[48%] mb-6" onPress={() => navigation.navigate('BusinessDetail', { id: contractorId })}>
          <View className="relative aspect-square rounded-xl overflow-hidden bg-neutral-100 dark:bg-neutral-900">
            {isSvgUrl(coverImage) ? (
              <View className="absolute inset-0 w-full h-full">
                <SvgImage uri={coverImage} width="100%" height="100%" />
              </View>
            ) : (
              <Image source={{ uri: coverImage }} className="absolute inset-0 w-full h-full" resizeMode="cover" />
            )}

            <Pressable onPress={() => handleRemove(contractorId)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} className="absolute top-2 right-2 p-1">
              <Heart size={24} color="rgba(225,29,72,1)" weight="fill" />
            </Pressable>

            {((item as any).isVerified || (item as any).licenseVerified) && (
              <View className="absolute top-2 left-2" style={{ zIndex: 60, overflow: 'visible' }}>
                <VerifiedBadge size="sm" animate={false} />
              </View>
            )}
          </View>
          <View className="mt-2">
            <Text
              className="text-[14px] font-bold text-neutral-900 dark:text-neutral-50 leading-tight"
              numberOfLines={1}
            >
              {item.companyName || item.businessName || 'Company'}
            </Text>
            {(item.reviewCount || 0) > 0 ? (
              <View className="flex-row items-center mt-0.5" style={{ gap: 4 }}>
                <Star size={10} color="#eab308" weight="fill" />
                <Text className="text-xs font-bold text-slate-600 dark:text-neutral-300">
                  {(item.averageRating || 0).toFixed(2)}
                </Text>
              </View>
            ) : (
              <Text className="text-xs font-bold text-neutral-400 dark:text-neutral-500 mt-0.5">New</Text>
            )}
            <Text className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5" numberOfLines={1}>
              {item.contactInfo?.city || 'Local'}, {item.contactInfo?.state || 'Area'}
            </Text>
            <Text className="text-xs font-bold text-neutral-900 dark:text-neutral-50 mt-1">
              {formatPriceString(price)}
            </Text>
          </View>
        </Pressable>
      );
    },
    [navigation, handleRemove]
  );

  if (!isAuthenticated) {
    return (
      <View
        className="flex-1 bg-white dark:bg-neutral-950 items-center justify-center px-8"
        style={{ paddingTop: Math.max(insets.top, 16) }}
      >
        <View className="w-20 h-20 bg-indigo-50 dark:bg-indigo-900/20 rounded-full items-center justify-center mb-6">
          <Heart size={40} color="#4F46E5" weight="fill" />
        </View>
        <Text className="text-2xl font-bold text-neutral-900 dark:text-neutral-50 mb-2 text-center">
          Save Contractors
        </Text>
        <Text className="text-sm text-neutral-500 dark:text-neutral-400 text-center mb-8 leading-5">
          Sign in to save your favorite contractors and quickly find them later.
        </Text>
        <Pressable
          onPress={() => navigation.navigate('Login')}
          className="w-full py-4 bg-indigo-600 rounded-2xl items-center mb-3"
        >
          <Text className="text-white font-bold text-[15px]">Sign In or Create Account</Text>
        </Pressable>
      </View>
    );
  }

  if (loading && !refreshing) {
    return (
      <View className="flex-1 bg-white dark:bg-neutral-950 items-center justify-center">
        <BouncingDotsLoader size="large" color={isDark ? '#ffffff' : '#171717'} />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-white dark:bg-neutral-950" style={{ paddingTop: Math.max(insets.top, 16) }}>
      {/* Header */}
      <View className="px-4 pb-2">
        <Text className="text-2xl font-bold text-neutral-900 dark:text-neutral-50">Saved</Text>
        <Text className="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">
          {savedContractors.length} contractor{savedContractors.length !== 1 ? 's' : ''} saved
        </Text>
      </View>

      {loadError ? (
        <View className="flex-1 items-center justify-center px-8">
          <View className="w-16 h-16 bg-red-50 dark:bg-red-900/20 rounded-full items-center justify-center mb-4">
            <Warning size={28} color="#ef4444" weight="bold" />
          </View>
          <Text className="text-lg font-bold text-neutral-900 dark:text-neutral-50">Something went wrong</Text>
          <Text className="text-sm text-neutral-500 dark:text-neutral-400 mt-1 text-center">
            Could not load saved contractors. Pull down to retry.
          </Text>
        </View>
      ) : savedContractors.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <View className="w-16 h-16 bg-neutral-100 dark:bg-neutral-900 rounded-full items-center justify-center mb-4">
            <Heart size={32} color={isDark ? '#525252' : '#d4d4d4'} weight="bold" />
          </View>
          <EmptyState title="No saved contractors" message="Start exploring and save contractors you like." icon="" />
          <Pressable
            onPress={() => navigation.navigate('Explore' as any)}
            className="mt-6 bg-neutral-900 dark:bg-neutral-50 px-8 py-3 rounded-xl"
          >
            <Text className="text-white dark:text-neutral-950 font-bold">Explore</Text>
          </Pressable>
        </View>
      ) : (
        <View className="flex-1">
          {/* Category Bar (Matching Home/Search) */}
          <View className="mb-2">
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ alignItems: 'center', gap: 16, paddingHorizontal: 16, paddingVertical: 12 }}
              className="py-2"
            >
              {availableCategories.map((cat, i) => (
                <CategoryIcon
                  key={cat.id}
                  name={cat.icon}
                  active={activeCategory === cat.id}
                  size={48}
                  label={cat.label}
                  index={i}
                  onClick={() => setActiveCategory(cat.id)}
                />
              ))}
            </ScrollView>
          </View>

          <BouncingRefreshFlatList
            data={filtered}
            renderItem={renderContractorItem}
            keyExtractor={(item) => item._id || (item as any).id}
            numColumns={2}
            columnWrapperStyle={{ justifyContent: 'space-between' }}
            contentContainerStyle={{ paddingBottom: 80 }}
            className="flex-1 px-4"
            refreshing={refreshing}
            onRefresh={onRefresh}
            loaderColor={isDark ? '#ffffff' : '#171717'}
            showsVerticalScrollIndicator={false}
            windowSize={5}
            maxToRenderPerBatch={8}
            removeClippedSubviews={Platform.OS === 'android'}
          />
        </View>
      )}
    </View>
  );
};

export default SavedScreen;
