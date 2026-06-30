import React, { useState, useEffect, useCallback, useMemo, useRef, memo } from 'react';
import {
  View,
  ScrollView,
  Pressable,
  Image,
  Text,
  TextInput,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  useColorScheme,
  FlatList,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { FontAwesome5 } from '@expo/vector-icons';
import HapticFeedback from '../utils/haptics';
import { SvgImage } from '../components/common/SvgImage';
import { CategoryIcon } from '../components/common/CategoryIcon';
import { VerifiedBadge } from '../components/common/VerifiedBadge';
import { Skeleton } from '../components/common/SkeletonLoader';
import { browseContractors } from '../utils/apiClient';
import { Contractor, RootStackParamList } from '../types';
import { getCoverImageUrl, isSvgUrl } from '../utils/avatarUtils';
import { getFavorites, addFavorite, removeFavorite } from '../utils/favoritesStore';
import { useAuth } from '../context/AuthContext';
import GuestPrompt from '../components/GuestPrompt';

// ---- Categories matching web version (constants.ts) ----
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

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

// ---- Helpers ----
function deriveLocation(c: Contractor): string {
  const city = c.contactInfo?.city || '';
  const state = c.contactInfo?.state || '';
  if (city && state) return `${city}, ${state}`;
  if (city || state) return city || state;
  const loc = c.location;
  if (typeof loc === 'string' && loc.trim() && !loc.includes('{')) return loc.trim();
  const addr = c.businessAddress || c.contact?.address;
  if (typeof addr === 'string' && addr.trim()) return addr.trim();
  return '';
}

function derivePrice(c: Contractor): string | null {
  if (c.pricing) return c.pricing.split('–')[0]?.trim() || null;
  if (c.servicesOffered?.length) {
    const svc = c.servicesOffered[0];
    if (typeof svc === 'object' && svc !== null) {
      const range = svc.priceEstimate || svc.priceRange;
      if (range) return range.split('–')[0]?.trim();
    }
  }
  return null;
}

// ---- Listing Card ----
const ListingCard = memo(({
  listing,
  isFavorite,
  onToggleFavorite,
  detectedZip,
  onPress,
}: {
  listing: Contractor;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  detectedZip: string | null;
  onPress: () => void;
}) => {
  const location = deriveLocation(listing);
  const price = derivePrice(listing);
  const rawImage = listing.bannerUrl || listing.bannerImage || listing.imageUrl || listing.profilePicture || '';
  const coverImage = getCoverImageUrl(
    listing.companyName || listing.businessName || 'Contractor',
    rawImage,
    listing.category,
    400,
    400
  );
  const serviceZips = listing.zipCodesCovered || [];
  const distance = listing.distance;

  return (
    <Pressable
      className="mb-4"
      onPress={onPress}
      accessibilityLabel={`View ${listing.companyName || listing.businessName || 'contractor'} details`}
      accessibilityRole="button"
      style={{ overflow: 'visible' }}
    >
      {/* Image Container */}
      <View className="relative rounded-xl overflow-hidden bg-neutral-100 dark:bg-neutral-900 aspect-square">
        {isSvgUrl(coverImage) ? (
          <View className="absolute inset-0 w-full h-full">
            <SvgImage uri={coverImage} width="100%" height="100%" />
          </View>
        ) : coverImage ? (
          <Image source={{ uri: coverImage }} className="absolute inset-0 w-full h-full" resizeMode="cover" />
        ) : null}
        {/* Favorite Heart */}
        <Pressable
          onPress={() => onToggleFavorite()}
          className="absolute top-2 right-2 w-11 h-11 items-center justify-center"
          accessibilityLabel={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          accessibilityRole="button"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <FontAwesome5
            name="heart"
            solid={isFavorite}
            size={24}
            color={isFavorite ? 'rgba(225,29,72,1)' : 'rgba(0,0,0,0.5)'}
          />
        </Pressable>
      </View>
      {/* Verified Badge */}
      {listing.isVerified && (
        <View className="absolute top-2 left-2" style={{ zIndex: 60, overflow: 'visible' }}>
          <VerifiedBadge size="sm" animate={true} />
        </View>
      )}

      {/* Card Info */}
      <View className="mt-2">
        <View className="flex-row items-start justify-between" style={{ gap: 4 }}>
          <Text
            className="text-[14px] font-bold text-neutral-900 dark:text-neutral-50 leading-tight flex-1"
            numberOfLines={1}
          >
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
        {distance ? (
          <Text className="text-[11px] text-neutral-400 dark:text-neutral-500 mt-0.5">{distance}</Text>
        ) : null}
        {detectedZip && serviceZips.includes(detectedZip) && (
          <View className="flex-row items-center mt-0.5" style={{ gap: 2 }}>
            <FontAwesome5 name="map-marker-alt" size={10} color="#059669" />
            <Text className="text-[10px] font-semibold text-emerald-700">Serves your area</Text>
          </View>
        )}
        {listing.avgResponseHours !== undefined && listing.avgResponseHours !== null && (
          <View className="flex-row items-center mt-0.5" style={{ gap: 4 }}>
            {listing.avgResponseHours < 1 ? (
              <Text className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 dark:bg-emerald-950/20 dark:text-emerald-400 px-1.5 py-0.5 rounded-full">⚡ Responds &lt;1h</Text>
            ) : listing.avgResponseHours < 4 ? (
              <Text className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 dark:bg-emerald-950/20 dark:text-emerald-400 px-1.5 py-0.5 rounded-full">⚡ Responds ~{Math.round(listing.avgResponseHours)}h</Text>
            ) : listing.avgResponseHours < 24 ? (
              <Text className="text-[10px] font-semibold text-amber-700 bg-amber-50 dark:bg-amber-950/20 dark:text-amber-400 px-1.5 py-0.5 rounded-full">⏱️ Responds ~{Math.round(listing.avgResponseHours)}h</Text>
            ) : (
              <Text className="text-[10px] font-semibold text-neutral-500 bg-neutral-100 dark:bg-neutral-900/30 dark:text-neutral-400 px-1.5 py-0.5 rounded-full">🕐 Responds ~{Math.round(listing.avgResponseHours / 24)}d</Text>
            )}
          </View>
        )}
        <View className="flex-row items-center mt-1" style={{ gap: 4 }}>
          <FontAwesome5 name="lock" size={10} color="#16a34a" />
          <Text className="text-[12px] font-semibold text-neutral-700 dark:text-neutral-300">Escrow Protected</Text>
        </View>
      </View>
    </Pressable>
  );
}, (prevProps, nextProps) => {
  return prevProps.listing._id === nextProps.listing._id &&
         prevProps.isFavorite === nextProps.isFavorite &&
         prevProps.detectedZip === nextProps.detectedZip;
});

// ---- Category matching logic (restored mapping) ----
const CATEGORY_KEYWORDS_MAP: Record<string, string[]> = {
  builders: ['builder', 'building', 'construction', 'general contractor', 'framing contractor', 'concrete', 'drywall', 'mason', 'insulation', 'subcontractor'],
  plumbers: ['plumber', 'plumbing'],
  electricians: ['electrician', 'electrical'],
  painters: ['painter', 'painting'],
  landscape: ['landscaper', 'landscaping', 'landscape', 'garden'],
  hvac: ['hvac', 'heating', 'cooling', 'air conditioning', 'furnace'],
  roofers: ['roofer', 'roofing', 'roof'],
  carpenters: ['carpenter', 'carpentry', 'woodwork'],
  cleaners: ['cleaner', 'cleaning', 'housekeeping'],
  handyman: ['handyman', 'handymen', 'maintenance']
};

function matchesCategory(contractor: Contractor, catId: string, catLabel: string): boolean {
  const cCat = (contractor.category || '').toLowerCase();
  const keywords = CATEGORY_KEYWORDS_MAP[catId] || [catId.toLowerCase(), catLabel.toLowerCase()];
  return keywords.some(keyword => cCat.includes(keyword) || keyword.includes(cCat));
}

// ---- HOME SCREEN ----
const HomeScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const isDark = useColorScheme() === 'dark';
  const { isAuthenticated } = useAuth();
  const [ipZipCode, setIpZipCode] = useState<string | null>(null);
  const [allContractors, setAllContractors] = useState<Contractor[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [activeCategory, setActiveCategory] = useState('all');
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [searchZip, setSearchZip] = useState('');
  const [searchName, setSearchName] = useState('');
  const [nearbyLabel, setNearbyLabel] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [showGuestPrompt, setShowGuestPrompt] = useState(false);
  const mountedRef = useRef(true);
  const isFetchingRef = useRef(false);

  // Sync searchZip when IP zip is detected
  useEffect(() => {
    if (ipZipCode && !searchZip) setSearchZip(ipZipCode);
  }, [ipZipCode]);

  // Sync favorites from store on focus
  useFocusEffect(
    useCallback(() => {
      const syncFavorites = async () => {
        try {
          const favs = await getFavorites();
          if (mountedRef.current) {
            setFavorites(prev => {
              if (prev.size !== favs.length) return new Set(favs);
              const changed = favs.some(f => !prev.has(f));
              return changed ? new Set(favs) : prev;
            });
          }
        } catch (e) {
          if (__DEV__) console.warn('syncFavorites failed:', e);
        }
      };
      syncFavorites();
    }, [])
  );

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Same as web: extract list from API response
  const extractList = (result: any): Contractor[] => {
    if (Array.isArray(result)) return result;
    if (Array.isArray(result?.contractors)) return result.contractors;
    if (Array.isArray(result?.data)) return result.data;
    return [];
  };

  // 3-tier zip expansion — same as web version (HomePage.tsx lines 112-172)
  const loadContractors = useCallback(async (zip?: string | null, pageNum = 1, append = false, categoryOverride?: string) => {
    if (isFetchingRef.current && append) {
      return;
    }
    isFetchingRef.current = true;

    if (pageNum === 1) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }
    setLoadError(false);
    try {
      const activeCat = categoryOverride !== undefined ? categoryOverride : activeCategory;
      const filters: any = { zip: zip || undefined, page: pageNum, limit: 500 };
      if (activeCat && activeCat !== 'all') {
        const cat = CATEGORIES.find(c => c.id === activeCat);
        if (cat) filters.type = cat.label;
      }

      const result: any = await browseContractors(filters);
      const list = extractList(result);

      if (mountedRef.current) {
        if (append) {
          setAllContractors((prev) => {
            const existingIds = new Set(prev.map(c => c._id));
            const uniqueList = list.filter(c => !existingIds.has(c._id));
            return [...prev, ...uniqueList];
          });
        } else {
          setAllContractors(list);
        }

        setPage(pageNum);
        setHasMore(pageNum < (result?.pages || 1));

        // Handle nearby label based on backend expansion flags
        if (zip && result.isExpanded) {
          if (result.expansionTier === 2) {
            setNearbyLabel('Showing nearby cities');
          } else if (result.expansionTier === 3) {
            setNearbyLabel('Showing nearby cities & region');
          }
        } else {
          setNearbyLabel('');
        }
      }
    } catch (err) {
      if (mountedRef.current) {
        if (!append) {
          setAllContractors([]);
          setNearbyLabel('');
          setLoadError(true);
        }
        setHasMore(false);
      }
    } finally {
      isFetchingRef.current = false;
      if (mountedRef.current) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, [activeCategory]);

  const fetchLocationAndData = useCallback(async () => {
    let zip: string | null = null;
    try {
      const response = await fetch('https://free.freeipapi.com/api/json');
      const data = await response.json();
      zip = data.zipCode || null;
      if (mountedRef.current) setIpZipCode(zip);
    } catch {
      if (mountedRef.current) setIpZipCode('10001');
      zip = '10001';
    }
    await loadContractors(zip);
  }, [loadContractors]);

  useEffect(() => {
    fetchLocationAndData();
  }, [fetchLocationAndData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchLocationAndData();
    if (mountedRef.current) setRefreshing(false);
  }, [fetchLocationAndData]);

  const toggleFav = useCallback(async (id: string) => {
    if (!isAuthenticated) {
      setShowGuestPrompt(true);
      return;
    }
    HapticFeedback.medium();
    const isFav = favorites.has(id);

    setFavorites((prev) => {
      const n = new Set(prev);
      if (isFav) n.delete(id);
      else n.add(id);
      return n;
    });

    try {
      if (isFav) {
        await removeFavorite(id);
      } else {
        await addFavorite(id);
      }
    } catch {
      setFavorites((prev) => {
        const n = new Set(prev);
        if (isFav) n.add(id);
        else n.delete(id);
        return n;
      });
    }
  }, [isAuthenticated, favorites]);

  const handleContractorPress = useCallback((contractor: Contractor) => {
    HapticFeedback.selection();
    if (contractor.slug) {
      navigation.navigate('BusinessDetail', { id: contractor._id, slug: contractor.slug });
    } else {
      navigation.navigate('BusinessDetail', { id: contractor._id });
    }
  }, [navigation]);

  const handleLoadMore = useCallback(() => {
    if (activeCategory === 'all') return; // Do not paginate in landing grouped view
    if (!loadingMore && hasMore && !loading && !isFetchingRef.current) {
      loadContractors(searchZip || null, page + 1, true);
    }
  }, [activeCategory, loadingMore, hasMore, loading, page, searchZip, loadContractors]);

  const renderListItem = useCallback(
    ({ item }: { item: any }) => {
      if (activeCategory === 'all') {
        // item is a category object
        const cat = item;
        const catContractors = allContractors
          .filter((c) => matchesCategory(c, cat.id, cat.label))
          .slice(0, 8);

        return (
          <View key={cat.id} className="flex-col px-4 mb-10" style={{ gap: 16 }}>
            <View className="flex-row items-center justify-between">
              <Text className="text-xl font-bold text-neutral-900 dark:text-neutral-50">{cat.label}</Text>
              <Pressable
                onPress={() => {
                  HapticFeedback.selection();
                  setActiveCategory(cat.id);
                  loadContractors(searchZip || null, 1, false, cat.id);
                }}
                className="w-8 h-8 items-center justify-center rounded-full bg-neutral-100 dark:bg-neutral-800"
              >
                <FontAwesome5 name="arrow-right" size={12} color={isDark ? '#a3a3a3' : '#6b7280'} />
              </Pressable>
            </View>
            {catContractors.length > 0 ? (
              <View className="flex-row flex-wrap justify-between">
                {catContractors.map((c) => (
                  <View key={c._id} className="w-[48%]">
                    <ListingCard
                      listing={c}
                      isFavorite={favorites.has(c._id)}
                      onToggleFavorite={() => toggleFav(c._id)}
                      detectedZip={ipZipCode}
                      onPress={() => handleContractorPress(c)}
                    />
                  </View>
                ))}
              </View>
            ) : (
              <View className="bg-neutral-50 dark:bg-neutral-900/50 rounded-2xl p-6 border border-dashed border-neutral-200 dark:border-neutral-800 items-center justify-center py-8">
                <Text className="text-sm font-medium text-neutral-400 dark:text-neutral-500">No local {cat.label.toLowerCase()} available</Text>
                <Pressable
                  onPress={() => {
                    HapticFeedback.selection();
                    setActiveCategory(cat.id);
                    loadContractors(searchZip || null, 1, false, cat.id);
                  }}
                  className="mt-2"
                >
                  <Text className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">Search wider area</Text>
                </Pressable>
              </View>
            )}
          </View>
        );
      } else {
        // item is a contractor object
        return (
          <View className="w-[48%] mb-4">
            <ListingCard
              listing={item}
              isFavorite={favorites.has(item._id)}
              onToggleFavorite={() => toggleFav(item._id)}
              detectedZip={ipZipCode}
              onPress={() => handleContractorPress(item)}
            />
          </View>
        );
      }
    },
    [activeCategory, allContractors, favorites, ipZipCode, isDark, handleContractorPress, toggleFav, loadContractors, searchZip]
  );

  const renderHeader = useCallback(
    () => (
      <View>
        {/* Search Bar */}
        <View className="px-4 pt-1 pb-1 w-full max-w-7xl mx-auto">
          <View className="flex-row items-center bg-neutral-100 dark:bg-neutral-900 rounded-full" style={{ gap: 0 }}>
            {/* Zip Code Input */}
            <View className="flex-1 relative flex-row items-center">
              <FontAwesome5 name="map-marker-alt" size={14} color="#a3a3a3" style={{ marginLeft: 14 }} />
              <TextInput
                className="flex-1 text-sm text-neutral-900 dark:text-neutral-50 px-3 py-3"
                placeholder="Zip code"
                placeholderTextColor="#a3a3a3"
                value={searchZip}
                onChangeText={(text) => setSearchZip(text.replace(/[^0-9]/g, ''))}
                onSubmitEditing={() => loadContractors(searchZip || null)}
                keyboardType="numeric"
                maxLength={5}
              />
              {searchZip ? (
                <Pressable
                  onPress={() => setSearchZip('')}
                  className="mr-3 w-11 h-11 items-center justify-center"
                  accessibilityLabel="Clear zip code"
                  accessibilityRole="button"
                >
                  <FontAwesome5 name="times-circle" size={14} color="#a3a3a3" />
                </Pressable>
              ) : null}
            </View>
            {/* Divider */}
            <View className="w-px h-6 bg-neutral-200 dark:bg-neutral-700" />
            {/* Name Input */}
            <View className="flex-1 relative flex-row items-center">
              <FontAwesome5 name="building" size={14} color="#a3a3a3" style={{ marginLeft: 14 }} />
              <TextInput
                className="flex-1 text-sm text-neutral-900 dark:text-neutral-50 px-3 py-3"
                placeholder="Contractor name..."
                placeholderTextColor="#a3a3a3"
                value={searchName}
                onChangeText={setSearchName}
                onSubmitEditing={() => loadContractors(searchZip || null)}
              />
              {searchName ? (
                <Pressable
                  onPress={() => setSearchName('')}
                  className="mr-3 w-11 h-11 items-center justify-center"
                  accessibilityLabel="Clear search"
                  accessibilityRole="button"
                >
                  <FontAwesome5 name="times-circle" size={14} color="#a3a3a3" />
                </Pressable>
              ) : null}
            </View>
            {/* Search Button */}
            <Pressable
              onPress={() => {
                loadContractors(searchZip || null);
              }}
              className="bg-indigo-600 rounded-full p-2.5 mr-1.5 shrink-0"
              accessibilityLabel="Search contractors"
              accessibilityRole="button"
            >
              <FontAwesome5 name="search" size={14} color="#ffffff" />
            </Pressable>
          </View>
          {/* Nearby cities label */}
          {nearbyLabel ? (
            <View className="flex-row items-center mt-1.5 px-1" style={{ gap: 4 }}>
              <FontAwesome5 name="map-marker-alt" size={10} color="#6366f1" />
              <Text className="text-xs text-indigo-600 dark:text-indigo-400">{nearbyLabel}</Text>
            </View>
          ) : null}
        </View>

        {/* Category Bar */}
        <View className="relative mt-2">
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{
              alignItems: 'center',
              gap: 16,
              paddingHorizontal: 16,
              paddingRight: 100,
              paddingVertical: 12,
            }}
          >
            {CATEGORIES.map((cat, i) => (
              <CategoryIcon
                key={cat.id}
                name={cat.icon}
                active={activeCategory === cat.id}
                size={48}
                label={cat.label}
                index={i}
                onClick={() => {
                  HapticFeedback.selection();
                  setActiveCategory(cat.id);
                  loadContractors(searchZip || null, 1, false, cat.id);
                }}
              />
            ))}
          </ScrollView>
        </View>

        <View className="h-[1px] bg-neutral-200 dark:bg-neutral-800 -mx-4 mt-2 mb-4" />
      </View>
    ),
    [
      searchZip,
      searchName,
      nearbyLabel,
      activeCategory,
      CATEGORIES,
      loadContractors,
    ]
  );

  const renderFooter = useCallback(() => {
    if (activeCategory === 'all') {
      return <View className="h-20" />;
    }
    if (allContractors.length === 0) return null;
    return (
      <View className="items-center py-6 mb-20">
        {loadingMore ? (
          <View className="flex-row items-center" style={{ gap: 8 }}>
            <ActivityIndicator size="small" color={isDark ? '#a3a3a3' : '#737373'} />
            <Text className="text-sm text-neutral-500 dark:text-neutral-400">Loading more...</Text>
          </View>
        ) : hasMore ? (
          <Pressable
            onPress={handleLoadMore}
            className="flex-row items-center px-6 py-3 border border-neutral-200 dark:border-neutral-700 rounded-xl"
            style={{ gap: 8 }}
          >
            <FontAwesome5 name="chevron-down" size={14} color={isDark ? '#d4d4d4' : '#171717'} />
            <Text className="text-sm font-semibold text-neutral-900 dark:text-neutral-50">Load More</Text>
          </Pressable>
        ) : (
          <Text className="text-xs text-neutral-400 dark:text-neutral-500">No more contractors</Text>
        )}
      </View>
    );
  }, [activeCategory, allContractors.length, loadingMore, hasMore, isDark, handleLoadMore]);

  const renderEmptyList = useCallback(() => {
    if (loading) {
      // Render skeletons
      const skeletonCount = activeCategory === 'all' ? 4 : 10;
      return (
        <View className="flex-row flex-wrap justify-between px-4">
          {Array.from({ length: skeletonCount }).map((_, i) => (
            <View key={i} className={activeCategory === 'all' ? "w-full mb-8" : "w-[48%] mb-4"}>
              {activeCategory === 'all' ? (
                <View style={{ gap: 12 }}>
                  <Skeleton width="40%" height={24} borderRadius={6} />
                  <View className="flex-row justify-between">
                    <View className="w-[48%]">
                      <Skeleton width="100%" height={150} borderRadius={12} />
                      <View className="mt-2" style={{ gap: 6 }}>
                        <Skeleton width="75%" height={14} />
                        <Skeleton width="50%" height={12} />
                      </View>
                    </View>
                    <View className="w-[48%]">
                      <Skeleton width="100%" height={150} borderRadius={12} />
                      <View className="mt-2" style={{ gap: 6 }}>
                        <Skeleton width="75%" height={14} />
                        <Skeleton width="50%" height={12} />
                      </View>
                    </View>
                  </View>
                </View>
              ) : (
                <View>
                  <Skeleton width="100%" height={150} borderRadius={12} />
                  <View className="mt-2" style={{ gap: 6 }}>
                    <Skeleton width="75%" height={14} />
                    <Skeleton width="50%" height={12} />
                    <Skeleton width="33%" height={12} />
                  </View>
                </View>
              )}
            </View>
          ))}
        </View>
      );
    }
    if (loadError) {
      return (
        <View className="items-center justify-center py-20 px-6">
          <View className="w-16 h-16 bg-red-50 dark:bg-red-900/20 rounded-full items-center justify-center mb-4">
            <FontAwesome5 name="exclamation-triangle" size={24} color="#ef4444" />
          </View>
          <Text className="text-lg font-bold text-neutral-900 dark:text-neutral-50">Something went wrong</Text>
          <Text className="text-sm text-neutral-500 dark:text-neutral-400 mt-1 text-center">
            Could not load contractors. Pull down to retry.
          </Text>
        </View>
      );
    }
    return (
      <View className="items-center justify-center py-20 px-4">
        <Text className="text-lg font-medium text-neutral-500 dark:text-neutral-400">No contractors found</Text>
        <Text className="text-sm text-neutral-400 dark:text-neutral-500 mt-2 text-center">
          Try adjusting your location or check back later.
        </Text>
      </View>
    );
  }, [activeCategory, loading, loadError]);

  const filtered = useMemo(() => {
    let list = allContractors;
    // Filter by name search
    if (searchName.trim()) {
      const q = searchName.toLowerCase().trim();
      list = list.filter((c) => (c.companyName || c.businessName || '').toLowerCase().includes(q));
    }
    // Filter by category
    if (activeCategory !== 'all') {
      const cat = CATEGORIES.find((c) => c.id === activeCategory);
      list = list.filter((c) => matchesCategory(c, activeCategory, cat?.label || ''));
    }
    return list;
  }, [allContractors, activeCategory, searchName]);

  const data = useMemo(() => {
    if (activeCategory === 'all') {
      return allContractors.length === 0 ? [] : CATEGORIES.filter(cat => cat.id !== 'all');
    }
    return filtered;
  }, [activeCategory, allContractors.length, filtered]);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      className="flex-1 bg-white dark:bg-neutral-950"
    >
      <FlatList
        key={activeCategory === 'all' ? 'single' : 'grid'}
        data={data}
        renderItem={renderListItem}
        keyExtractor={(item) => item.id || item._id}
        numColumns={activeCategory === 'all' ? 1 : 2}
        columnWrapperStyle={
          activeCategory === 'all' ? undefined : { justifyContent: 'space-between', paddingHorizontal: 16 }
        }
        ListHeaderComponent={renderHeader}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={renderEmptyList}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
        className="flex-1"
        windowSize={5}
        maxToRenderPerBatch={8}
        removeClippedSubviews={Platform.OS === 'android'}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.4}
      />

      <GuestPrompt
        visible={showGuestPrompt}
        onClose={() => setShowGuestPrompt(false)}
        onLogin={() => {
          setShowGuestPrompt(false);
          navigation.navigate('Login');
        }}
        action="save contractors"
      />
    </KeyboardAvoidingView>
  );
};

export default HomeScreen;
