import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  ScrollView,
  Pressable,
  Image,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Heart, SquaresFour } from 'phosphor-react-native';
import { SvgImage } from '../components/common/SvgImage';
import { browseContractors } from '../utils/apiClient';
import { Contractor, RootStackParamList } from '../types';
import { getCoverImageUrl, isSvgUrl } from '../utils/avatarUtils';
import { getFavorites, removeFavorite } from '../utils/favoritesStore';

import { CategoryIcon } from '../components/common/CategoryIcon';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const CATEGORIES = [
  { id: 'all', label: 'All', icon: 'grid' },
  { id: 'builders', label: 'Builders', icon: 'home' },
  { id: 'plumbers', label: 'Plumbers', icon: 'droplets' },
  { id: 'electricians', label: 'Electricians', icon: 'zap' },
  { id: 'painters', label: 'Painters', icon: 'paintbrush' },
  { id: 'landscape', label: 'Landscape', icon: 'trees' },
  { id: 'hvac', label: 'HVAC', icon: 'wind' },
  { id: 'roofers', label: 'Roofers', icon: 'warehouse' },
  { id: 'cleaners', label: 'Cleaners', icon: 'sparkles' },
  { id: 'handyman', label: 'Handyman', icon: 'wrench' },
  { id: 'kitchen', label: 'Kitchens', icon: 'cooking-pot' },
  { id: 'bathroom', label: 'Bathrooms', icon: 'bath' },
];

const SavedScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const [allContractors, setAllContractors] = useState<Contractor[]>([]);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeCategory, setActiveCategory] = useState('all');

  const loadData = useCallback(async () => {
    try {
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
      console.error('Error loading saved contractors:', error);
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

  const handleRemove = async (id: string) => {
    await removeFavorite(id);
    setSavedIds(prev => prev.filter(sid => sid !== id));
  };

  const savedContractors = useMemo(() => {
    // Robust matching for both _id and id
    return allContractors.filter(c => {
      const cid = c._id || (c as any).id;
      return savedIds.includes(cid);
    });
  }, [allContractors, savedIds]);

  const availableCategories = useMemo(() => {
    const catsInSaved = new Set(savedContractors.map(c => c.category?.toLowerCase()).filter(Boolean));
    return CATEGORIES.filter(cat => cat.id === 'all' || catsInSaved.has(cat.id.toLowerCase()) || catsInSaved.has(cat.label.toLowerCase()));
  }, [savedContractors]);

  const filtered = useMemo(() => {
    if (activeCategory === 'all') return savedContractors;
    const cat = CATEGORIES.find(c => c.id === activeCategory);
    const label = cat?.label.toLowerCase();
    const id = cat?.id.toLowerCase();
    
    return savedContractors.filter(c => {
      const cCat = c.category?.toLowerCase() || '';
      return cCat.includes(id || '') || cCat.includes(label || '');
    });
  }, [savedContractors, activeCategory]);

  if (loading && !refreshing) {
    return (
      <View className="flex-1 bg-white dark:bg-neutral-950 items-center justify-center">
        <ActivityIndicator size="large" color="#171717" />
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

      {savedContractors.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <View className="w-16 h-16 bg-neutral-100 dark:bg-neutral-900 rounded-full items-center justify-center mb-4">
            <Heart size={32} color="#d4d4d4" weight="bold" />
          </View>
          <Text className="text-lg font-bold text-neutral-900 dark:text-neutral-50">No saved contractors</Text>
          <Text className="text-sm text-neutral-500 dark:text-neutral-400 mt-1 text-center">
            Start exploring and save contractors you like.
          </Text>
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
              contentContainerStyle={{ alignItems: 'center', gap: 16, paddingHorizontal: 16 }}
              className="py-2"
            >
              {availableCategories.map(cat => {
                const isActive = activeCategory === cat.id;

                return (
                  <Pressable
                    key={cat.id}
                    className="flex-col items-center shrink-0 min-w-[60px]"
                    style={{ gap: 6 }}
                    onPress={() => setActiveCategory(cat.id)}
                  >
                    <CategoryIcon name={cat.icon} active={isActive} size={48} />
                    <Text
                      className={`text-[10px] font-semibold whitespace-nowrap ${
                        isActive ? 'text-neutral-900 dark:text-neutral-50' : 'text-neutral-500'
                      }`}
                    >
                      {cat.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          <ScrollView 
            className="flex-1 px-4"
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#171717" />}
            showsVerticalScrollIndicator={false}
          >
            <View className="flex-row flex-wrap justify-between pt-2">
              {filtered.map(contractor => {
                const rawImage = (contractor as any).bannerUrl || contractor.bannerImage || (contractor as any).imageUrl || contractor.profilePicture || '';
                const coverImage = getCoverImageUrl(contractor.companyName || contractor.businessName || 'Contractor', rawImage, contractor.category);
                const contractorId = contractor._id || (contractor as any).id;

                return (
                  <Pressable 
                    key={contractorId} 
                    className="w-[48%] mb-6"
                    onPress={() => navigation.navigate('BusinessDetail', { id: contractorId })}
                  >
                    <View className="relative aspect-square rounded-xl overflow-hidden bg-neutral-100 dark:bg-neutral-900">
                      {isSvgUrl(coverImage) ? (
                        <View className="absolute inset-0 w-full h-full">
                          <SvgImage uri={coverImage} width="100%" height="100%" />
                        </View>
                      ) : (
                        <Image source={{ uri: coverImage }} className="absolute inset-0 w-full h-full" resizeMode="cover" />
                      )}

                      <Pressable 
                        onPress={() => handleRemove(contractorId)}
                        className="absolute top-2 right-2 p-1"
                      >
                        <Heart size={24} color="rgba(225,29,72,1)" weight="fill" />
                      </Pressable>
                    </View>
                    <View className="mt-2">
                      <Text className="text-[14px] font-bold text-neutral-900 dark:text-neutral-50 leading-tight" numberOfLines={1}>
                        {contractor.companyName || contractor.businessName || 'Company'}
                      </Text>
                      <View className="flex-row items-center mt-0.5" style={{ gap: 4 }}>
                        <Icon name="star" size={10} color="#eab308" weight="fill" />
                        <Text className="text-xs font-bold text-slate-600 dark:text-slate-400">{(contractor.averageRating || 0).toFixed(2)}</Text>
                      </View>
                      <Text className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5" numberOfLines={1}>
                        {contractor.contactInfo?.city || 'Local'}, {contractor.contactInfo?.state || 'Area'}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
            <View className="h-20" />
          </ScrollView>
        </View>
      )}
    </View>
  );
};

// Simple Icon helper for the star since FontAwesome isn't imported here
const Icon = ({ name, size, color, weight }: any) => {
  if (name === 'star') return <SquaresFour size={size} color={color} weight={weight} />; // Fallback
  return null;
};

export default SavedScreen;
