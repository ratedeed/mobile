import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  FlatList,
  ScrollView,
  Pressable,
  Image,
  ActivityIndicator,
  TextInput,
  RefreshControl,
  Text,
  SafeAreaView,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { FontAwesome5 } from '@expo/vector-icons';
import { SvgImage } from '../components/common/SvgImage';
import { CategoryIcon } from '../components/common/CategoryIcon';
import { browseContractors } from '../api';
import { Contractor } from '../types';
import { getCoverImageUrl, isSvgUrl } from '../utils/avatarUtils';
import { getFavorites, addFavorite, removeFavorite } from '../utils/favoritesStore';

// Categories matching web version (same as HomeScreen)
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

type RootStackParamList = {
  BusinessSearch: { query?: string; searchType?: string; name?: string };
  BusinessDetail: { id?: string; contractorId?: string; slug?: string };
};

type BusinessSearchScreenRouteProp = RouteProp<RootStackParamList, 'BusinessSearch'>;
type BusinessSearchScreenNavigationProp = StackNavigationProp<RootStackParamList, 'BusinessSearch'>;

// ---- Helpers ----
function deriveLocation(c: Contractor): string {
  const city = c.contactInfo?.city || (c as any).city || '';
  const state = c.contactInfo?.state || (c as any).state || '';
  if (city && state) return `${city}, ${state}`;
  if (city || state) return city || state;
  // Fallback: try location string or businessAddress
  const loc = (c as any).location;
  if (typeof loc === 'string' && loc.trim() && !loc.includes('{')) return loc.trim();
  const addr = (c as any).businessAddress || c.contact?.address;
  if (typeof addr === 'string' && addr.trim()) return addr.trim();
  return '';
}

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

// ---- Listing Card (matches web) ----
const ListingCard = ({
  listing,
  searchZip,
  onPress,
}: {
  listing: Contractor;
  searchZip: string;
  onPress: () => void;
}) => {
  const location = deriveLocation(listing);
  const price = derivePrice(listing);
  const rawImage = (listing as any).bannerUrl || listing.bannerImage || (listing as any).imageUrl || listing.profilePicture || '';
  const coverImage = getCoverImageUrl(listing.companyName || listing.businessName || 'Contractor', rawImage, listing.category);
  const distance = (listing as any).distance;

  return (
    <Pressable className="mb-4" onPress={onPress}>
      <View className="relative rounded-xl overflow-hidden bg-neutral-100 dark:bg-neutral-900 aspect-square">
        {isSvgUrl(coverImage) ? (
          <View className="absolute inset-0 w-full h-full">
            <SvgImage uri={coverImage} width="100%" height="100%" />
          </View>
        ) : coverImage ? (
          <Image
            source={{ uri: coverImage }}
            className="absolute inset-0 w-full h-full"
            resizeMode="cover"
          />
        ) : null}

        {listing.isVerified && (
          <View className="absolute top-2 left-2 bg-white dark:bg-neutral-950 rounded-full px-2 py-0.5 shadow-sm flex-row items-center" style={{ gap: 4 }}>
            <FontAwesome5 name="shield-alt" size={10} color="#4F46E5" />
            <Text className="text-[10px] font-bold text-neutral-900 dark:text-neutral-50">License Verified</Text>
          </View>
        )}
        <View className="absolute top-2 right-2">
          <FontAwesome5 name="heart" size={24} color="rgba(0,0,0,0.5)" />
        </View>
      </View>
      <View className="mt-2">
        <View className="flex-row items-start justify-between" style={{ gap: 4 }}>
          <Text className="text-[14px] font-bold text-neutral-900 dark:text-neutral-50 leading-tight flex-1" numberOfLines={1}>
            {listing.companyName || listing.businessName || 'Company'}
          </Text>
          <View className="flex-row items-center shrink-0" style={{ gap: 2 }}>
            <FontAwesome5 name="star" solid size={12} color="#eab308" />
            <Text className="text-xs font-bold text-slate-600">{(listing.averageRating || 0).toFixed(2)}</Text>
          </View>
        </View>
        {location ? (
          <Text className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5" numberOfLines={1}>
            {location}
          </Text>
        ) : null}
        {distance ? <Text className="text-[11px] text-neutral-400 dark:text-neutral-500 mt-0.5">{distance}</Text> : null}
        {searchZip && listing.zipCodesCovered?.includes(searchZip) && (
          <View className="flex-row items-center mt-0.5" style={{ gap: 2 }}>
            <FontAwesome5 name="map-marker-alt" size={10} color="#059669" />
            <Text className="text-[10px] font-semibold text-emerald-700">Serves your area</Text>
          </View>
        )}
        {price && (
          <Text className="text-[13px] font-semibold text-neutral-900 dark:text-neutral-50 mt-0.5">
            From {price} <Text className="font-normal text-neutral-500 dark:text-neutral-400">project</Text>
          </Text>
        )}
      </View>
    </Pressable>
  );
};

// ---- SEARCH SCREEN ----
const BusinessSearchScreen: React.FC = () => {
  const navigation = useNavigation<BusinessSearchScreenNavigationProp>();
  const route = useRoute<BusinessSearchScreenRouteProp>();
  const { query, searchType, name: routeName } = route.params || {};

  const [searchZip, setSearchZip] = useState(query || '');
  const [searchName, setSearchName] = useState(routeName || '');
  const [activeCategory, setActiveCategory] = useState(
    searchType === 'category' ? (query || 'all') : 'all'
  );
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [totalResults, setTotalResults] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const isFirstRender = useRef(true);

  const fetchContractors = useCallback(async (pageNum = 1, append = false) => {
    try {
      if (pageNum === 1) setLoading(true);
      else setLoadingMore(true);

      const filters: any = { page: pageNum, limit: 20, sortBy: 'rating' };

      if (searchZip) {
        filters.zipCode = searchZip;
      }
      
      if (searchName) {
        filters.name = searchName;
      }

      if (activeCategory !== 'all') {
        const cat = CATEGORIES.find(c => c.id === activeCategory);
        if (cat) filters.type = cat.label;
      }

      const data: any = await browseContractors(filters);
      const list = data?.contractors || data?.data || (Array.isArray(data) ? data : []);

      if (append) {
        setContractors(prev => [...prev, ...list]);
      } else {
        setContractors(list);
      }
      setTotalResults(data?.total || list.length);
      setHasMore(data?.page < (data?.pages || 1));
      setPage(pageNum);
    } catch (error) {
      console.error('Error fetching contractors:', error);
      if (!append) { setContractors([]); setTotalResults(0); }
    } finally {
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
    }
  }, [searchZip, searchName, activeCategory]);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      fetchContractors(1);
      return;
    }
    fetchContractors(1);
  }, [activeCategory, fetchContractors]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!isFirstRender.current) fetchContractors(1);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchZip, searchName, fetchContractors]);

  const handleLoadMore = () => {
    if (!loadingMore && hasMore) fetchContractors(page + 1, true);
  };

  const onRefresh = () => { setRefreshing(true); fetchContractors(1); };

  const handleCategorySelect = (catId: string) => {
    setActiveCategory(catId);
  };

  const renderCard = ({ item }: { item: Contractor }) => (
    <View className="w-[48%]">
      <ListingCard
        listing={item}
        searchZip={searchZip}
        onPress={() => {
          if (item.slug) navigation.navigate('BusinessDetail', { slug: item.slug });
          else if (item._id) navigation.navigate('BusinessDetail', { id: item._id });
        }}
      />
    </View>
  );

  const hasSearch = searchZip.trim().length > 0 || searchName.trim().length > 0 || activeCategory !== 'all';

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-neutral-950">
      {/* Search Header */}
      <View className="bg-white dark:bg-neutral-950 border-b border-neutral-200 dark:border-neutral-700 px-4 py-3">
        <View className="flex-row items-center" style={{ gap: 8 }}>
          {/* Back Button */}
          <Pressable onPress={() => navigation.goBack()} className="w-8 h-8 items-center justify-center">
            <FontAwesome5 name="chevron-left" size={18} color="#171717" />
          </Pressable>

          {/* Zip Code Input */}
          <View className="flex-1 relative">
            <FontAwesome5 name="map-marker-alt" size={14} color="#a3a3a3" style={{ position: 'absolute', left: 12, top: 13, zIndex: 1 }} />
            <TextInput
              value={searchZip}
              onChangeText={text => { setSearchZip(text); setActiveCategory('all'); }}
              onSubmitEditing={() => fetchContractors(1)}
              placeholder="Zip code"
              placeholderTextColor="#a3a3a3"
              keyboardType="numeric"
              maxLength={10}
              className="bg-neutral-100 dark:bg-neutral-900 dark:text-neutral-50 rounded-full pl-10 pr-9 py-2.5 text-sm"
            />

            {searchZip ? (
              <Pressable onPress={() => setSearchZip('')} className="absolute right-3 top-3">
                <FontAwesome5 name="times" size={14} color="#a3a3a3" />
              </Pressable>
            ) : null}
          </View>

          {/* Divider */}
          <View className="w-px h-6 bg-neutral-200 dark:bg-neutral-800" />

          {/* Name Input */}
          <View className="flex-1 relative">
            <FontAwesome5 name="building" size={14} color="#a3a3a3" style={{ position: 'absolute', left: 12, top: 13, zIndex: 1 }} />
            <TextInput
              value={searchName}
              onChangeText={text => { setSearchName(text); setActiveCategory('all'); }}
              onSubmitEditing={() => fetchContractors(1)}
              placeholder="Contractor name..."
              placeholderTextColor="#a3a3a3"
              className="bg-neutral-100 dark:bg-neutral-900 dark:text-neutral-50 rounded-full pl-10 pr-9 py-2.5 text-sm"
            />

            {searchName ? (
              <Pressable onPress={() => setSearchName('')} className="absolute right-3 top-3">
                <FontAwesome5 name="times" size={14} color="#a3a3a3" />
              </Pressable>
            ) : null}
          </View>

          {/* Search Button */}
          <Pressable
            onPress={() => fetchContractors(1)}
            className="bg-indigo-600 rounded-full p-2.5 shrink-0"
          >
            <FontAwesome5 name="search" size={14} color="#fff" />
          </Pressable>
        </View>
      </View>

      {/* Category Pills */}
      <View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="px-4 py-3"
          contentContainerStyle={{ gap: 16, alignItems: 'center', paddingRight: 40 }}
        >
          {CATEGORIES.map(cat => {
            const isActive = activeCategory === cat.id;

            return (
              <Pressable
                key={cat.id}
                onPress={() => handleCategorySelect(cat.id)}
                className="flex-col items-center shrink-0 pt-1.5 pb-1.5 min-w-[60px]"
                style={{ gap: 6 }}
              >
                <CategoryIcon name={cat.icon} active={isActive} size={48} />
                <Text className={`text-[10px] font-semibold whitespace-nowrap ${
                  isActive ? 'text-neutral-900 dark:text-neutral-50' : 'text-neutral-500 dark:text-neutral-400'
                }`}>
                  {cat.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <View className="h-px bg-neutral-200 dark:bg-neutral-800" />

      {/* Results Info */}
      <View className="px-4 py-2">
        <Text className="text-sm text-neutral-500 dark:text-neutral-400">
          {hasSearch
            ? loading && contractors.length === 0
              ? 'Searching...'
              : `${contractors.length} result${contractors.length !== 1 ? 's' : ''} found`
            : 'Search by zip code or contractor name'}
        </Text>
      </View>

      {/* Loading State */}
      {loading && contractors.length === 0 ? (
        <View className="flex-1 items-center justify-center py-20">
          <ActivityIndicator size="large" color="#a3a3a3" />
          <Text className="text-sm text-neutral-500 dark:text-neutral-400 mt-3">Searching contractors...</Text>
        </View>
      ) : contractors.length > 0 ? (
        <FlatList
          data={contractors}
          renderItem={renderCard}
          keyExtractor={item => item._id || item.slug || Math.random().toString()}
          numColumns={2}
          columnWrapperStyle={{ justifyContent: 'space-between' }}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}
          ListFooterComponent={
            hasMore ? (
              <View className="py-8 items-center">
                <Pressable
                  onPress={handleLoadMore}
                  disabled={loadingMore}
                  className="flex-row items-center px-6 py-3 border border-neutral-200 dark:border-neutral-700 rounded-xl"
                  style={{ gap: 8 }}
                >
                  {loadingMore ? (
                    <ActivityIndicator size="small" color="#171717" />
                  ) : (
                    <FontAwesome5 name="chevron-down" size={14} color="#171717" />
                  )}
                  <Text className="text-sm font-semibold text-neutral-900 dark:text-neutral-50">
                    {loadingMore ? 'Loading...' : 'Load More'}
                  </Text>
                </Pressable>
              </View>
            ) : null
          }
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.3}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        />
      ) : hasSearch ? (
        <View className="flex-1 items-center justify-center py-20">
          <FontAwesome5 name="search" size={48} color="#d4d4d4" />
          <Text className="font-semibold text-neutral-900 dark:text-neutral-50 mt-3">No results found</Text>
          <Text className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">Try a different zip code, name, or category</Text>
        </View>
      ) : (
        <View className="flex-1 items-center justify-center py-20">
          <FontAwesome5 name="map-marker-alt" size={48} color="#d4d4d4" />
          <Text className="text-neutral-500 dark:text-neutral-400 text-sm mt-3">Enter a zip code or contractor name to search</Text>
        </View>
      )}
    </SafeAreaView>
  );
};

export default BusinessSearchScreen;
