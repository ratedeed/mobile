import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  ScrollView,
  Pressable,
  Image,
  Text,
  TextInput,
  RefreshControl,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { FontAwesome5 } from '@expo/vector-icons';
import HapticFeedback from '../utils/haptics';
import { SvgImage } from '../components/common/SvgImage';
import { CategoryIcon } from '../components/common/CategoryIcon';
import { browseContractors } from '../utils/apiClient';
import { Contractor, RootStackParamList } from '../types';
import { getCoverImageUrl, isSvgUrl } from '../utils/avatarUtils';
import { getFavorites, addFavorite, removeFavorite } from '../utils/favoritesStore';

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

// ---- Listing Card ----
const ListingCard = ({
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
  const rawImage = (listing as any).bannerUrl || listing.bannerImage || (listing as any).imageUrl || listing.profilePicture || '';
  const coverImage = getCoverImageUrl(listing.companyName || listing.businessName || 'Contractor', rawImage, listing.category, 400, 400);
  const serviceZips = listing.zipCodesCovered || [];
  const distance = (listing as any).distance;

  return (
    <Pressable className="mb-4" onPress={onPress}>
      {/* Image Container */}
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
        {/* Verified Badge */}
        {listing.isVerified && (
          <View
            className="absolute top-2 left-2 bg-white dark:bg-neutral-950 rounded-full px-2 py-0.5 shadow-sm flex-row items-center"
            style={{ gap: 4 }}
          >
            <FontAwesome5 name="shield-alt" size={10} color="#4F46E5" />
            <Text className="text-[10px] font-bold text-neutral-900 dark:text-neutral-50">Verified</Text>
          </View>
        )}
        {/* Favorite Heart */}
        <Pressable
          onPress={() => onToggleFavorite()}
          className="absolute top-2 right-2"
        >
          <FontAwesome5
            name="heart"
            solid={isFavorite}
            size={24}
            color={isFavorite ? 'rgba(225,29,72,1)' : 'rgba(0,0,0,0.5)'}
          />
        </Pressable>
      </View>

      {/* Card Info */}
      <View className="mt-2">
        <View className="flex-row items-start justify-between" style={{ gap: 4 }}>
          <Text className="text-[14px] font-bold text-neutral-900 dark:text-neutral-50 leading-tight flex-1" numberOfLines={1}>
            {listing.companyName || listing.businessName || 'Company'}
          </Text>
          <View className="flex-row items-center shrink-0" style={{ gap: 2 }}>
            <FontAwesome5 name="star" solid size={12} color="#eab308" />
            <Text className="text-xs font-bold text-slate-600">
              {(listing.averageRating || 0).toFixed(2)}
            </Text>
          </View>
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
        {price && (
          <Text className="text-[13px] font-semibold text-neutral-900 dark:text-neutral-50 mt-0.5">
            From {price} <Text className="font-normal text-neutral-500 dark:text-neutral-400">project</Text>
          </Text>
        )}
      </View>
    </Pressable>
  );
};

// ---- Category matching logic (same as web) ----
function matchesCategory(contractor: Contractor, catId: string, catLabel: string): boolean {
  const cCat = (contractor.category || '').toLowerCase();
  const searchTerm = catId.toLowerCase();
  const singularSearch = searchTerm.endsWith('s') ? searchTerm.slice(0, -1) : searchTerm;
  const labelTerm = catLabel.toLowerCase();
  const singularLabel = labelTerm.endsWith('s') ? labelTerm.slice(0, -1) : labelTerm;
  return (
    cCat.includes(searchTerm) ||
    cCat.includes(singularSearch) ||
    cCat.includes(labelTerm) ||
    cCat.includes(singularLabel)
  );
}

// ---- HOME SCREEN ----
const HomeScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const [ipZipCode, setIpZipCode] = useState<string | null>(null);
  const [allContractors, setAllContractors] = useState<Contractor[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [activeCategory, setActiveCategory] = useState('all');
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(false);
  const [searchZip, setSearchZip] = useState('');
  const [searchName, setSearchName] = useState('');
  const [nearbyLabel, setNearbyLabel] = useState('');
  const mountedRef = useRef(true);

  // Sync searchZip when IP zip is detected
  useEffect(() => {
    if (ipZipCode && !searchZip) setSearchZip(ipZipCode);
  }, [ipZipCode]);

  // Sync favorites from store on focus
  useFocusEffect(
    useCallback(() => {
      const syncFavorites = async () => {
        const favs = await getFavorites();
        if (mountedRef.current) {
          setFavorites(new Set(favs));
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
  // Tier 1: exact zip match
  // Tier 2: 3-digit prefix (same local area) — checks serviceZipCodes
  // Tier 3: 2-digit prefix (wider region/state) — checks serviceZipCodes
  const MIN_RESULTS = 16;

  const loadContractors = useCallback(async (zip?: string | null) => {
    setLoading(true);
    setLoadError(false);
    try {
      const result: any = await browseContractors({ zip: zip || undefined, limit: 50 });
      const list = extractList(result);

      if (mountedRef.current) {
        setAllContractors(list);
        
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
        setAllContractors([]);
        setNearbyLabel('');
        setLoadError(true);
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

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

  const toggleFav = async (id: string) => {
    HapticFeedback.selection();
    const isFav = favorites.has(id);
    if (isFav) {
      await removeFavorite(id);
      setFavorites(prev => {
        const n = new Set(prev);
        n.delete(id);
        return n;
      });
    } else {
      await addFavorite(id);
      setFavorites(prev => {
        const n = new Set(prev);
        n.add(id);
        return n;
      });
    }
  };

  const handleContractorPress = (contractor: Contractor) => {
    if (contractor.slug) {
      navigation.navigate('BusinessDetail', { id: contractor._id, slug: contractor.slug });
    } else {
      navigation.navigate('BusinessDetail', { id: contractor._id });
    }
  };

  const filtered = useMemo(() => {
    let list = allContractors;
    // Filter by name search
    if (searchName.trim()) {
      const q = searchName.toLowerCase().trim();
      list = list.filter(c =>
        (c.companyName || c.businessName || '').toLowerCase().includes(q)
      );
    }
    // Filter by category
    if (activeCategory !== 'all') {
      const cat = CATEGORIES.find(c => c.id === activeCategory);
      list = list.filter(c =>
        matchesCategory(c, activeCategory, cat?.label || '')
      );
    }
    return list;
  }, [allContractors, activeCategory, searchName]);

  return (
    <View className="flex-1 bg-white dark:bg-neutral-950">
      <ScrollView
        className="flex-1"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
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
                onChangeText={setSearchZip}
                onSubmitEditing={() => loadContractors(searchZip || null)}
                keyboardType="numeric"
                maxLength={10}
              />
              {searchZip ? (
                <Pressable onPress={() => setSearchZip('')} className="mr-3">
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
                <Pressable onPress={() => setSearchName('')} className="mr-3">
                  <FontAwesome5 name="times-circle" size={14} color="#a3a3a3" />
                </Pressable>
              ) : null}
            </View>
            {/* Search Button */}
            <Pressable
              onPress={() => {
                // Refetch contractors with the entered zip (same as web)
                loadContractors(searchZip || null);
              }}
              className="bg-indigo-600 rounded-full p-2.5 mr-1.5 shrink-0"
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
            contentContainerStyle={{ alignItems: 'center', gap: 16, paddingHorizontal: 16, paddingRight: 100, paddingVertical: 12 }}
          >
            {CATEGORIES.map((cat, i) => (
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

          {/* Filters Button */}
          <Pressable
            onPress={() => setShowFilters(!showFilters)}
            className="absolute right-4 top-2.5 border border-neutral-200 dark:border-neutral-700 rounded-xl px-3 py-2 flex-row items-center bg-white dark:bg-neutral-950/90 z-10 shadow-sm"
            style={{
              elevation: 2,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.05,
              shadowRadius: 2,
              gap: 8,
            }}
          >
            <FontAwesome5 name="sliders-h" size={14} color="#737373" />
            <Text className="text-xs font-semibold text-neutral-900 dark:text-neutral-50">Filters</Text>
          </Pressable>
        </View>

        <View className="h-[1px] bg-neutral-200 dark:bg-neutral-800 -mx-4 mt-2" />

        {/* Listings Content */}
        <View className="px-4 pt-4 pb-24 w-full max-w-7xl mx-auto">
          {loading ? (
            /* Loading Skeletons */
            <View className="flex-row flex-wrap justify-between">
              {Array.from({ length: 10 }).map((_, i) => (
                <View key={i} className="w-[48%] mb-4">
                  <View className="aspect-square bg-neutral-100 dark:bg-neutral-900 rounded-xl" />
                  <View className="mt-2" style={{ gap: 6 }}>
                    <View className="h-3.5 bg-neutral-100 dark:bg-neutral-900 rounded w-3/4" />
                    <View className="h-3 bg-neutral-100 dark:bg-neutral-900 rounded w-1/2" />
                    <View className="h-3 bg-neutral-100 dark:bg-neutral-900 rounded w-1/3" />
                  </View>
                </View>
              ))}
            </View>
          ) : loadError ? (
            <View className="items-center justify-center py-20 px-6">
              <View className="w-16 h-16 bg-red-50 dark:bg-red-900/20 rounded-full items-center justify-center mb-4">
                <FontAwesome5 name="exclamation-triangle" size={24} color="#ef4444" />
              </View>
              <Text className="text-lg font-bold text-neutral-900 dark:text-neutral-50">Something went wrong</Text>
              <Text className="text-sm text-neutral-500 dark:text-neutral-400 mt-1 text-center">Could not load contractors. Pull down to retry.</Text>
            </View>
          ) : activeCategory === 'all' ? (
            /* Bunch by Category View */
            <View className="flex-col" style={{ gap: 40 }}>
              {CATEGORIES.filter(cat => cat.id !== 'all').map(cat => {
                const catContractors = allContractors
                  .filter(c => matchesCategory(c, cat.id, cat.label))
                  .slice(0, 8);

                if (catContractors.length === 0) return null;

                return (
                  <View key={cat.id} className="flex-col" style={{ gap: 16 }}>
                    <View className="flex-row items-center justify-between">
                      <Text className="text-xl font-bold text-neutral-900 dark:text-neutral-50">{cat.label}</Text>
                      <Pressable onPress={() => setActiveCategory(cat.id)}>
                        <Text className="text-sm font-semibold text-indigo-500">Show all</Text>
                      </Pressable>
                    </View>
                    <View className="flex-row flex-wrap justify-between">
                      {catContractors.map(c => (
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
                  </View>
                );
              })}
            </View>
          ) : filtered.length > 0 ? (
            /* Specific Category Grid View */
            <View className="flex-row flex-wrap justify-between">
              {filtered.map(c => (
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
            <View className="items-center justify-center py-20">
              <Text className="text-lg font-medium text-neutral-500 dark:text-neutral-400">No contractors found</Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Filter Modal */}
      {showFilters && (
        <View
          className="absolute inset-0 z-[60] justify-end"
          style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
        >
          <Pressable className="flex-1" onPress={() => setShowFilters(false)} />
          <View className="bg-white dark:bg-neutral-950 rounded-t-3xl w-full px-5 pt-4 pb-8">
            <View className="w-10 h-1 bg-neutral-300 rounded-full mx-auto mb-5" />
            <Text className="text-lg font-bold text-neutral-900 dark:text-neutral-50 mb-4">Filters</Text>
            <View className="flex-col" style={{ gap: 16 }}>
              {['Verified', 'Available This Week', 'Under $10,000', 'Top Rated (4.5+)', 'Has Portfolio'].map(f => (
                <Pressable
                  key={f}
                  className="flex-row items-center"
                  style={{ gap: 12, paddingVertical: 8 }}
                >
                  <View className="w-6 h-6 rounded-full border-2 border-neutral-900 items-center justify-center">
                    <View className="w-3 h-3 rounded-full bg-neutral-900 dark:bg-neutral-50" />
                  </View>
                  <Text className="text-sm font-medium text-neutral-900 dark:text-neutral-50">{f}</Text>
                </Pressable>
              ))}
            </View>
            <View className="flex-row mt-6" style={{ gap: 12 }}>
              <Pressable
                onPress={() => setShowFilters(false)}
                className="flex-1 py-3 border border-neutral-900 rounded-xl items-center"
              >
                <Text className="text-sm font-semibold text-neutral-900 dark:text-neutral-50">Clear all</Text>
              </Pressable>
              <Pressable
                onPress={() => setShowFilters(false)}
                className="flex-1 py-3 bg-neutral-900 dark:bg-neutral-50 rounded-xl items-center"
              >
                <Text className="text-sm font-semibold text-white dark:text-neutral-900">Show results</Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}
    </View>
  );
};

export default HomeScreen;
