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
  KeyboardAvoidingView,
  Platform,
  useColorScheme,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { FontAwesome5 } from '@expo/vector-icons';
import { SvgImage } from '../components/common/SvgImage';
import { CategoryIcon } from '../components/common/CategoryIcon';
import { browseContractors } from '../api';
import { Contractor } from '../types';
import { getCoverImageUrl, isSvgUrl } from '../utils/avatarUtils';
import { getFavorites, addFavorite, removeFavorite } from '../utils/favoritesStore';
import { VerifiedBadge } from '../components/common/VerifiedBadge';

// Categories matching web version (same as HomeScreen)
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
  const coverImage = getCoverImageUrl(listing.companyName || listing.businessName || 'Contractor', rawImage, listing.category, 400, 400);
  const distance = (listing as any).distance;

  return (
    <Pressable className="mb-4" onPress={onPress} style={{ overflow: 'visible' }}>
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
        {/* Favorite heart - hidden until favorites feature is wired on search */}
        {/* <View className="absolute top-2 right-2">
          <FontAwesome5 name="heart" size={24} color="rgba(0,0,0,0.5)" />
        </View> */}
      </View>
      {listing.isVerified && (
        <View className="absolute top-2 left-2" style={{ zIndex: 60, overflow: 'visible' }}>
          <VerifiedBadge size="sm" variant="glass" animate={true} />
        </View>
      )}
      <View className="mt-2">
        <View className="flex-row items-start justify-between" style={{ gap: 4 }}>
          <Text className="text-[14px] font-bold text-neutral-900 dark:text-neutral-50 leading-tight flex-1" numberOfLines={1}>
            {listing.companyName || listing.businessName || 'Company'}
          </Text>
          {(listing.reviewCount || 0) > 0 ? (
            <View className="flex-row items-center shrink-0" style={{ gap: 2 }}>
              <FontAwesome5 name="star" solid size={12} color="#eab308" />
              <Text className="text-xs font-bold text-slate-600 dark:text-neutral-300">
                {(listing.averageRating || 0).toFixed(2)}
              </Text>
            </View>
          ) : (
            <Text className="text-xs font-bold text-neutral-400 dark:text-neutral-500 shrink-0">New</Text>
          )}
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
        <View className="flex-row items-center mt-1" style={{ gap: 4 }}>
          <FontAwesome5 name="lock" size={10} color="#16a34a" />
          <Text className="text-[12px] font-semibold text-neutral-700 dark:text-neutral-300">Escrow Protected</Text>
        </View>
        <Text className="text-xs font-bold text-neutral-900 dark:text-neutral-50 mt-1">
          {(() => {
            const clean = (price || '').trim();
            if (!clean || clean === '$0' || clean === '$0.00' || clean === '0' || clean.toLowerCase() === 'n/a' || clean.toLowerCase() === 'na') {
              return 'Contact for Quote';
            }
            if (/^\$+$/.test(clean)) {
              return `Price level: ${clean}`;
            }
            if (!/\d/.test(clean)) {
              return clean;
            }
            const formattedPrice = clean.startsWith('$') ? clean : `$${clean}`;
            if (clean.toLowerCase().includes('/hr') || clean.toLowerCase().includes('hr') || clean.toLowerCase().includes('hour')) {
              return `${formattedPrice} starting rate`;
            }
            return `${formattedPrice} project`;
          })()}
        </Text>
      </View>
    </Pressable>
  );
};

// ---- SEARCH SCREEN ----
const BusinessSearchScreen: React.FC = () => {
  const isDark = useColorScheme() === 'dark';
  const navigation = useNavigation<BusinessSearchScreenNavigationProp>();
  const route = useRoute<BusinessSearchScreenRouteProp>();
  const { query, searchType, name: routeName } = route.params || {};
  const insets = useSafeAreaInsets();

  const [searchZip, setSearchZip] = useState(query || '');
  const [searchName, setSearchName] = useState(routeName || '');
  const [activeCategory, setActiveCategory] = useState(
    searchType === 'category' ? (query || 'all') : 'all'
  );
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalResults, setTotalResults] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [nearbyLabel, setNearbyLabel] = useState('');
  const isFirstRender = useRef(true);

  // Debounced search states to prevent API spam
  const [debouncedZip, setDebouncedZip] = useState(query || '');
  const [debouncedName, setDebouncedName] = useState(routeName || '');

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedZip(searchZip);
      setDebouncedName(searchName);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchZip, searchName]);

  // Sync route params (deep links) to screen state
  useEffect(() => {
    if (query !== undefined) {
      setSearchZip(query);
      setDebouncedZip(query);
    }
    if (routeName !== undefined) {
      setSearchName(routeName);
      setDebouncedName(routeName);
    } else {
      setSearchName('');
      setDebouncedName('');
    }
    if (searchType === 'category') {
      setActiveCategory(query || 'all');
    }
  }, [query, routeName, searchType]);

  const fetchContractors = useCallback(async (zipOverride?: string, nameOverride?: string) => {
    try {
      setError(null);
      const zip = (zipOverride !== undefined ? zipOverride : debouncedZip) || '';
      const name = (nameOverride !== undefined ? nameOverride : debouncedName) || '';

      // 1. If all search fields are empty, clear results and return immediately.
      if (!zip.trim() && !name.trim() && activeCategory === 'all') {
        setContractors([]);
        setTotalResults(0);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      // 2. If zip code is partially typed (1-4 characters) and name is empty, don't trigger query.
      if (zip.trim() && zip.trim().length < 5 && !name.trim()) {
        return;
      }

      setLoading(true);

      const filters: any = { page: 1, limit: 500, sortBy: 'rating' };
      if (zip.trim()) {
        filters.zipCode = zip.trim();
      }
      
      if (name.trim()) {
        filters.name = name.trim();
      }

      if (activeCategory !== 'all') {
        const cat = CATEGORIES.find(c => c.id === activeCategory);
        if (cat) filters.type = cat.label;
      }

      const data: any = await browseContractors(filters);
      const list = data?.contractors || data?.data || (Array.isArray(data) ? data : []);

      setContractors(list);
      
      // Handle nearby label
      if (zip && data?.isExpanded) {
        if (data.expansionTier === 2) setNearbyLabel('Showing nearby cities');
        else if (data.expansionTier === 3) setNearbyLabel('Showing nearby cities & region');
      } else {
        setNearbyLabel('');
      }

      setTotalResults(data?.total || list.length);
    } catch (err: any) {
      // console.error('Error fetching contractors:', err);
      setError(err?.message || 'Failed to fetch contractors. Please try again.');
      setContractors([]);
      setTotalResults(0);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [debouncedZip, debouncedName, activeCategory]);

  const handleSearchSubmit = () => {
    setDebouncedZip(searchZip);
    setDebouncedName(searchName);
    fetchContractors(searchZip, searchName);
  };

  useEffect(() => {
    fetchContractors();
  }, [fetchContractors]);

  const onRefresh = () => { setRefreshing(true); fetchContractors(); };

  const handleCategorySelect = (catId: string) => {
    setActiveCategory(catId);
  };

  const renderCard = useCallback(({ item }: { item: Contractor }) => (
    <View className="w-[48%]">
      <ListingCard
        listing={item}
        searchZip={debouncedZip}
        onPress={() => {
          if (item.slug) navigation.navigate('BusinessDetail', { slug: item.slug });
          else if (item._id) navigation.navigate('BusinessDetail', { id: item._id });
        }}
      />
    </View>
  ), [navigation, debouncedZip]);

  const hasSearch = searchZip.trim().length > 0 || searchName.trim().length > 0 || activeCategory !== 'all';
  const displayResults = hasSearch ? contractors : [];

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 bg-white dark:bg-neutral-950">
      <View style={{ flex: 1, paddingTop: insets.top, paddingBottom: insets.bottom }} className="bg-white dark:bg-neutral-950">
      {/* Search Header */}
      <View className="bg-white dark:bg-neutral-950 border-b border-neutral-200 dark:border-neutral-700 px-4 py-3">
        <View className="flex-row items-center" style={{ gap: 8 }}>
          {/* Back Button */}
          <Pressable onPress={() => navigation.goBack()} className="w-8 h-8 items-center justify-center">
            <FontAwesome5 name="chevron-left" size={18} color={isDark ? '#ffffff' : '#171717'} />
          </Pressable>

          {/* Zip Code Input */}
          <View className="flex-1 relative">
            <FontAwesome5 name="map-marker-alt" size={14} color={isDark ? '#737373' : '#a3a3a3'} style={{ position: 'absolute', left: 12, top: 13, zIndex: 1 }} />
            <TextInput
              value={searchZip}
              onChangeText={text => { 
                const sanitized = text.replace(/[^0-9]/g, '');
                setSearchZip(sanitized.slice(0, 5)); 
                setActiveCategory('all'); 
              }}
              onSubmitEditing={handleSearchSubmit}
              placeholder="Zip code"
              placeholderTextColor="#a3a3a3"
              keyboardType="numeric"
              maxLength={5}
              className="bg-neutral-100 dark:bg-neutral-900 dark:text-neutral-50 rounded-full pl-10 pr-9 py-2.5 text-sm"
            />

            {searchZip ? (
              <Pressable onPress={() => setSearchZip('')} className="absolute right-3 top-3">
                <FontAwesome5 name="times" size={14} color={isDark ? '#737373' : '#a3a3a3'} />
              </Pressable>
            ) : null}
          </View>

          {/* Divider */}
          <View className="w-px h-6 bg-neutral-200 dark:bg-neutral-800" />

          {/* Name Input */}
          <View className="flex-1 relative">
            <FontAwesome5 name="building" size={14} color={isDark ? '#737373' : '#a3a3a3'} style={{ position: 'absolute', left: 12, top: 13, zIndex: 1 }} />
            <TextInput
              value={searchName}
              onChangeText={text => { setSearchName(text); setActiveCategory('all'); }}
              onSubmitEditing={handleSearchSubmit}
              placeholder="Contractor name..."
              placeholderTextColor="#a3a3a3"
              className="bg-neutral-100 dark:bg-neutral-900 dark:text-neutral-50 rounded-full pl-10 pr-9 py-2.5 text-sm"
            />

            {searchName ? (
              <Pressable onPress={() => setSearchName('')} className="absolute right-3 top-3">
                <FontAwesome5 name="times" size={14} color={isDark ? '#737373' : '#a3a3a3'} />
              </Pressable>
            ) : null}
          </View>

          {/* Search Button */}
          <Pressable
            onPress={() => fetchContractors()}
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
          contentContainerStyle={{ gap: 16, alignItems: 'center', paddingRight: 40, paddingVertical: 12 }}
        >
          {CATEGORIES.map((cat, i) => (
            <CategoryIcon 
              key={cat.id}
              name={cat.icon} 
              active={activeCategory === cat.id} 
              size={48} 
              label={cat.label}
              index={i}
              onClick={() => handleCategorySelect(cat.id)}
            />
          ))}
        </ScrollView>
      </View>

      <View className="h-px bg-neutral-200 dark:bg-neutral-800" />

      {/* Expansion Notice */}
      {nearbyLabel ? (
        <View className="px-4 py-2.5 bg-indigo-50/50 dark:bg-indigo-950/20 border-b border-indigo-100/50 dark:border-indigo-900/30 flex-row items-center" style={{ gap: 8 }}>
          <FontAwesome5 name="map-marker-alt" size={12} color="#4f46e5" />
          <Text className="text-xs font-semibold text-indigo-700 dark:text-indigo-400">{nearbyLabel}</Text>
        </View>
      ) : null}

      {/* Results Info */}
      <View className="px-4 py-2">
        <Text className="text-sm font-medium text-neutral-600 dark:text-neutral-400">
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
          <ActivityIndicator size="large" color={isDark ? '#a3a3a3' : '#737373'} />
          <Text className="text-sm text-neutral-500 dark:text-neutral-400 mt-3">Searching contractors...</Text>
        </View>
      ) : error ? (
        <View className="flex-1 items-center justify-center py-20 px-6">
          <FontAwesome5 name="exclamation-circle" size={48} color="#ef4444" />
          <Text className="font-semibold text-neutral-900 dark:text-neutral-50 mt-3 text-center">Failed to fetch contractors</Text>
          <Text className="text-sm text-neutral-500 dark:text-neutral-400 mt-1 text-center mb-6">{error}</Text>
          <Pressable
            onPress={() => fetchContractors()}
            className="bg-indigo-600 px-6 py-2.5 rounded-full"
          >
            <Text className="text-white font-semibold text-sm">Retry</Text>
          </Pressable>
        </View>
      ) : displayResults.length > 0 ? (
        <FlatList
          data={displayResults}
          renderItem={renderCard}
          keyExtractor={(item, index) => item._id || item.slug || index.toString()}
          numColumns={2}
          columnWrapperStyle={{ justifyContent: 'space-between' }}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        />
      ) : hasSearch ? (
        <View className="flex-1 items-center justify-center py-20">
          <FontAwesome5 name="search" size={48} color={isDark ? '#525252' : '#d4d4d4'} />
          <Text className="font-semibold text-neutral-900 dark:text-neutral-50 mt-3">No results found</Text>
          <Text className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">Try a different zip code, name, or category</Text>
        </View>
      ) : (
        <View className="flex-1 items-center justify-center py-20">
          <FontAwesome5 name="map-marker-alt" size={48} color={isDark ? '#525252' : '#d4d4d4'} />
          <Text className="text-neutral-500 dark:text-neutral-400 text-sm mt-3">Enter a zip code or contractor name to search</Text>
        </View>
      )}
      </View>
    </KeyboardAvoidingView>
  );
};

export default BusinessSearchScreen;
