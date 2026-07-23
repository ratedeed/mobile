import React, { useState, useEffect, useCallback, useMemo, useRef, memo } from 'react';
import {
  View,
  ScrollView,
  Pressable,
  Image,
  Text,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  useColorScheme,
  FlatList,
  Dimensions,
  DeviceEventEmitter,
} from 'react-native';
import { useNavigation, useFocusEffect, useScrollToTop } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { FontAwesome5 } from '@expo/vector-icons';
import HapticFeedback from '../utils/haptics';
import { SvgImage } from '../components/common/SvgImage';
import { CategoryIcon } from '../components/common/CategoryIcon';
import { VerifiedBadge } from '../components/common/VerifiedBadge';
import { Skeleton } from '../components/common/SkeletonLoader';
import { BouncingDotsLoader, BouncingRefreshFlatList } from '../components/common';
import { browseContractors } from '../utils/apiClient';
import { Contractor, RootStackParamList } from '../types';
import { getCoverImageUrl, isSvgUrl } from '../utils/avatarUtils';
import { getFavorites, addFavorite, removeFavorite } from '../utils/favoritesStore';
import { useAuth } from '../context/AuthContext';
import GuestPrompt from '../components/GuestPrompt';
import AsyncStorage from '@react-native-async-storage/async-storage';

type Category = {
  id: string;
  label: string;
  icon: string;
};

const CATEGORIES: Category[] = [
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
type FlatListItem = Contractor | Category;
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH * 0.425;

// ---- In-Memory Cache Implementation ----
type CacheEntry = {
  data: Contractor[];
  timestamp: number;
  pages?: number;
  isExpanded?: boolean;
  expansionTier?: number;
};

const contractorCache = new Map<string, CacheEntry>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const extractList = (result: unknown): Contractor[] => {
  if (Array.isArray(result)) return result as Contractor[];
  if (typeof result === 'object' && result !== null) {
    if (Array.isArray((result as any).contractors)) return (result as any).contractors;
    if (Array.isArray((result as any).data)) return (result as any).data;
  }
  return [];
};

// --- Startup Prefetch (Parallelized with Auth/Splash) ---
let initialZipPromise: Promise<string | null> | null = null;
let cachedZipPromise: Promise<string | null> | null = null;
let prefetchPromise: Promise<{
  zip: string;
  data: Contractor[];
  pages: number;
  isExpanded: boolean;
  expansionTier: number;
} | null> | null = null;

const startPrefetch = () => {
  if (prefetchPromise) return prefetchPromise;

  // 1. Geolocation fetch in parallel
  initialZipPromise = (async () => {
    try {
      const response = await fetch('https://free.freeipapi.com/api/json');
      const data = await response.json();
      return data.zipCode || null;
    } catch {
      return null;
    }
  })();

  // 2. Cached ZIP fetch in parallel
  cachedZipPromise = AsyncStorage.getItem('ratedeed-detected-zip').catch(() => null);

  // 3. Prefetch browse request
  prefetchPromise = (async () => {
    try {
      const cachedZip = await cachedZipPromise;
      let zip = cachedZip;

      if (!zip) {
        const ipZip = await initialZipPromise;
        zip = ipZip || '10001';
      }

      const filters = { zip, page: 1, limit: 30 };
      const result: any = await browseContractors(filters);
      const list = extractList(result);

      const cacheKey = `${zip}_all_1`;
      contractorCache.set(cacheKey, {
        data: list,
        timestamp: Date.now(),
        pages: result?.pages || 1,
        isExpanded: result?.isExpanded,
        expansionTier: result?.expansionTier
      });

      if (initialZipPromise) {
        initialZipPromise.then((ipZip) => {
          if (ipZip && ipZip !== cachedZip) {
            AsyncStorage.setItem('ratedeed-detected-zip', ipZip).catch(() => {});
          }
        }).catch(() => {});
      }

      return {
        zip,
        data: list,
        pages: result?.pages || 1,
        isExpanded: result?.isExpanded,
        expansionTier: result?.expansionTier
      };
    } catch (err) {
      if (__DEV__) console.warn('Prefetch contractors failed:', err);
      return null;
    }
  })();

  return prefetchPromise;
};

// Start prefetching immediately upon module load
startPrefetch();


const deriveLocation = (c: Contractor): string => {
  const city = c.contactInfo?.city || '';
  const state = c.contactInfo?.state || '';
  if (city && state) return `${city}, ${state}`;
  if (city || state) return city || state;
  const loc = c.location;
  if (typeof loc === 'string' && loc.trim() && !loc.includes('{')) return loc.trim();
  const addr = c.businessAddress || c.contact?.address;
  if (typeof addr === 'string' && addr.trim()) return addr.trim();
  return '';
};

const getResponseTimeBadge = (hours: number) => {
  if (hours < 1) {
    return <Text className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 dark:bg-emerald-950/20 dark:text-emerald-400 px-1.5 py-0.5 rounded-full">⚡ Responds &lt;1h</Text>;
  }
  if (hours < 4) {
    return <Text className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 dark:bg-emerald-950/20 dark:text-emerald-400 px-1.5 py-0.5 rounded-full">⚡ Responds ~{Math.round(hours)}h</Text>;
  }
  if (hours < 24) {
    return <Text className="text-[10px] font-semibold text-amber-700 bg-amber-50 dark:bg-amber-950/20 dark:text-amber-400 px-1.5 py-0.5 rounded-full">⏱️ Responds ~{Math.round(hours)}h</Text>;
  }
  return <Text className="text-[10px] font-semibold text-neutral-500 bg-neutral-100 dark:bg-neutral-900/30 dark:text-neutral-400 px-1.5 py-0.5 rounded-full">🕐 Responds ~{Math.round(hours / 24)}d</Text>;
};

type ListingCardProps = {
  listing: Contractor;
  isFavorite: boolean;
  onToggleFavorite: (id: string) => void;
  detectedZip: string | null;
  onPress: (contractor: Contractor) => void;
};

const ListingCard = memo(({ listing, isFavorite, onToggleFavorite, detectedZip, onPress }: ListingCardProps) => {
  const location = deriveLocation(listing);
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
      onPress={() => onPress(listing)}
      accessibilityLabel={`View ${listing.companyName || listing.businessName || 'contractor'} details`}
      accessibilityRole="button"
      style={({ pressed }) => ({ overflow: 'visible', transform: [{ scale: pressed ? 0.98 : 1 }] })}
    >
      <View className="relative rounded-xl overflow-hidden bg-neutral-100 dark:bg-neutral-900 aspect-square">
        {isSvgUrl(coverImage) ? (
          <View className="absolute inset-0 w-full h-full">
            <SvgImage uri={coverImage} width="100%" height="100%" />
          </View>
        ) : coverImage ? (
          <Image source={{ uri: coverImage }} className="absolute inset-0 w-full h-full" resizeMode="cover" />
        ) : null}
        
        {/* Favorite Heart - Restored Original Look */}
        <Pressable
          onPress={() => onToggleFavorite(listing._id)}
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

      {listing.isVerified && (
        <View className="absolute top-2 left-2" style={{ zIndex: 60, overflow: 'visible' }}>
          <VerifiedBadge size="sm" animate={true} />
        </View>
      )}

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
          <View className="flex-row items-center mt-0.5">
            {getResponseTimeBadge(listing.avgResponseHours)}
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
  return (
    prevProps.listing._id === nextProps.listing._id &&
    prevProps.isFavorite === nextProps.isFavorite &&
    prevProps.detectedZip === nextProps.detectedZip
  );
});

type CategoryRowProps = {
  category: Category;
  zip: string | null;
  favorites: Set<string>;
  toggleFav: (id: string) => void;
  handleContractorPress: (contractor: Contractor) => void;
  onSeeAll: () => void;
  isDark: boolean;
};

const CategoryRow = memo(({ category, zip, favorites, toggleFav, handleContractorPress, onSeeAll, isDark }: CategoryRowProps) => {
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const loadRowData = async () => {
      setLoading(true);
      try {
        const filters: any = { zip: zip || undefined, page: 1, limit: 15, type: category.label };
        const result = await browseContractors(filters);
        const list = extractList(result);
        if (active) {
          setContractors(list);
        }
      } catch (err) {
        if (__DEV__) console.warn(`Failed to load category row ${category.label}:`, err);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };
    loadRowData();
    return () => {
      active = false;
    };
  }, [category.label, zip]);

  if (loading) {
    return (
      <View className="flex-col px-4 mb-10" style={{ gap: 16 }}>
        <View className="flex-row items-center justify-between">
          <Text className="text-xl font-bold text-neutral-900 dark:text-neutral-50">{category.label}</Text>
        </View>
        <View className="flex-row justify-between mt-3">
          {[0, 1].map(j => (
            <View key={j} style={{ width: CARD_WIDTH, marginRight: 12 }}>
              <Skeleton width="100%" height={150} borderRadius={12} />
              <View className="mt-2" style={{ gap: 6 }}>
                <Skeleton width="75%" height={14} />
                <Skeleton width="50%" height={12} />
              </View>
            </View>
          ))}
        </View>
      </View>
    );
  }

  if (contractors.length === 0) return null;

  return (
    <View className="flex-col px-4 mb-10" style={{ gap: 16 }}>
      <View className="flex-row items-center justify-between">
        <Text className="text-xl font-bold text-neutral-900 dark:text-neutral-50">{category.label}</Text>
        <Pressable
          onPress={onSeeAll}
          className="w-8 h-8 items-center justify-center rounded-full bg-neutral-100 dark:bg-neutral-800"
        >
          <FontAwesome5 name="arrow-right" size={12} color={isDark ? '#a3a3a3' : '#6b7280'} />
        </Pressable>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={CARD_WIDTH + 12}
        snapToAlignment="start"
        contentContainerStyle={{ paddingHorizontal: 16 }}
        className="-mx-4"
      >
        {contractors.map((c) => (
          <View key={c._id} style={{ width: CARD_WIDTH, marginRight: 12 }}>
            <ListingCard
              listing={c}
              isFavorite={favorites.has(c._id)}
              onToggleFavorite={toggleFav}
              detectedZip={zip}
              onPress={handleContractorPress}
            />
          </View>
        ))}
      </ScrollView>
    </View>
  );
});

const HomeScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const isDark = useColorScheme() === 'dark';
  const { isAuthenticated } = useAuth();
  
  const flatListRef = useRef<any>(null);
  useScrollToTop(flatListRef);
  
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
  const isUserEditedRef = useRef(false);

  // Load cached ZIP code instantly on mount to populate the search bar immediately
  useEffect(() => {
    let active = true;
    const loadCached = async () => {
      try {
        const cached = await AsyncStorage.getItem('ratedeed-detected-zip');
        if (cached && /^\d{5}$/.test(cached.trim()) && active && !isUserEditedRef.current) {
          const zip = cached.trim();
          setSearchZip(zip);
          setIpZipCode(zip);
        }
      } catch (err) {
        // ignore
      }
    };
    loadCached();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (ipZipCode && !isUserEditedRef.current) {
      setSearchZip((prev) => prev || ipZipCode);
    }
  }, [ipZipCode]);



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
          if (__DEV__) console.warn('Failed to sync favorites:', e);
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

  const loadContractors = useCallback(async (
    zip?: string | null,
    pageNum = 1,
    append = false,
    categoryId = 'all'
  ) => {
    if (isFetchingRef.current && append) return;
    isFetchingRef.current = true;

    const cacheKey = `${zip || 'all'}_${categoryId}_${pageNum}`;
    const cachedEntry = contractorCache.get(cacheKey);

    // 1. Handle Cache Hit (Stale-While-Revalidate)
    if (cachedEntry) {
      const isStale = Date.now() - cachedEntry.timestamp > CACHE_TTL;
      
      // If fresh, use cache and skip network
      if (!isStale) {
        if (mountedRef.current) {
          const list = cachedEntry.data;
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
          setHasMore(pageNum < (cachedEntry.pages || 1));
          setLoadError(false);
          
          if (zip && cachedEntry.isExpanded) {
            if (cachedEntry.expansionTier === 2) setNearbyLabel('Showing nearby cities');
            else if (cachedEntry.expansionTier === 3) setNearbyLabel('Showing nearby cities & region');
          } else {
            setNearbyLabel('');
          }
          
          setLoading(false);
          setLoadingMore(false);
          if (pageNum === 1 && !append && list.length > 0) {
            setTimeout(() => {
              DeviceEventEmitter.emit('show-escrow-banner');
            }, 300);
          }
        }
        isFetchingRef.current = false;
        return;
      }
      
      // If stale, render cached data immediately but continue to network fetch
      if (!append) {
        setAllContractors(cachedEntry.data);
        setLoading(false); // Hide loading spinner, show stale data
      }
    } else {
      // No cache found, show loading spinner
      if (pageNum === 1) {
        setAllContractors([]);
        setLoading(true);
      } else {
        setLoadingMore(true);
      }
    }
    
    setLoadError(false);

    // 2. Network Fetch
    try {
      const filters: Record<string, any> = { zip: zip || undefined, page: pageNum, limit: 30 };
      if (categoryId && categoryId !== 'all') {
        const cat = CATEGORIES.find(c => c.id === categoryId);
        if (cat) filters.type = cat.label;
      }

      const result: any = await browseContractors(filters);
      const list = extractList(result);

      // Save to cache
      contractorCache.set(cacheKey, {
        data: list,
        timestamp: Date.now(),
        pages: result?.pages || 1,
        isExpanded: result?.isExpanded,
        expansionTier: result?.expansionTier
      });

      // Persist ZIP code for subsequent app launches
      if (zip && /^\d{5}$/.test(zip.trim())) {
        AsyncStorage.setItem('ratedeed-detected-zip', zip.trim()).catch(() => {});
      }

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

        if (zip && result.isExpanded) {
          if (result.expansionTier === 2) setNearbyLabel('Showing nearby cities');
          else if (result.expansionTier === 3) setNearbyLabel('Showing nearby cities & region');
        } else {
          setNearbyLabel('');
        }
      }
    } catch (err) {
      if (mountedRef.current) {
        // Only show error if we have no cached data to fallback on
        if (!append && !cachedEntry) {
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
        if (pageNum === 1 && !append) {
          setTimeout(() => {
            DeviceEventEmitter.emit('show-escrow-banner');
          }, 300);
        }
      }
    }
  }, []);

  useEffect(() => {
    const unsubscribe = navigation.addListener('tabPress' as any, (e: any) => {
      if (activeCategory !== 'all') {
        e.preventDefault();
        setActiveCategory('all');
        loadContractors(searchZip || null, 1, false, 'all');
      }
    });
    return unsubscribe;
  }, [navigation, activeCategory, searchZip, loadContractors]);

  const fetchLocationAndData = useCallback(async () => {
    let zip: string | null = null;
    try {
      const cached = await AsyncStorage.getItem('ratedeed-detected-zip');
      if (cached && /^\d{5}$/.test(cached.trim())) {
        zip = cached.trim();
      } else {
        const ipZip = await initialZipPromise;
        zip = ipZip || null;
      }
      if (mountedRef.current) {
        setIpZipCode(zip || '10001');
        if (!isUserEditedRef.current) {
          setSearchZip(zip || '10001');
        }
      }
    } catch {
      if (mountedRef.current) {
        setIpZipCode('10001');
        if (!isUserEditedRef.current) {
          setSearchZip('10001');
        }
      }
      zip = '10001';
    }
    await loadContractors(zip || '10001', 1, false, 'all');
  }, [loadContractors]);

  useEffect(() => {
    let active = true;
    const initializeLocation = async () => {
      try {
        setLoading(true);
        const prefetched = await prefetchPromise;
        if (!active) return;

        if (prefetched) {
          const { zip, data, pages, isExpanded, expansionTier } = prefetched;
          if (!isUserEditedRef.current) {
            setSearchZip(zip);
          }
          setIpZipCode(zip);
          setAllContractors(data);
          setPage(1);
          setHasMore(1 < pages);
          setLoadError(false);
          
          if (isExpanded) {
            if (expansionTier === 2) setNearbyLabel('Showing nearby cities');
            else if (expansionTier === 3) setNearbyLabel('Showing nearby cities & region');
          } else {
            setNearbyLabel('');
          }
          setLoading(false);
          if (data && data.length > 0) {
            setTimeout(() => {
              DeviceEventEmitter.emit('show-escrow-banner');
            }, 300);
          }

          // Silently trigger background update if IP ZIP differs from what was cached/prefetched
          const cachedZip = await cachedZipPromise;
          const ipZip = await initialZipPromise;
          if (ipZip && ipZip !== zip) {
            if (active && !isUserEditedRef.current) {
              setIpZipCode(ipZip);
              setSearchZip(ipZip);
              await loadContractors(ipZip, 1, false, 'all');
            }
          }
        } else {
          await fetchLocationAndData();
        }
      } catch {
        if (active) {
          await fetchLocationAndData();
        }
      }
    };
    initializeLocation();
    return () => {
      active = false;
    };
  }, [fetchLocationAndData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    // Bypass cache on manual refresh
    contractorCache.clear(); 
    await fetchLocationAndData();
    if (mountedRef.current) setRefreshing(false);
  }, [fetchLocationAndData]);

  const toggleFav = useCallback(async (id: string) => {
    if (!isAuthenticated) {
      setShowGuestPrompt(true);
      return;
    }
    HapticFeedback.medium();

    setFavorites((prev) => {
      const isFav = prev.has(id);
      const next = new Set(prev);
      if (isFav) next.delete(id);
      else next.add(id);

      (async () => {
        try {
          if (isFav) await removeFavorite(id);
          else await addFavorite(id);
        } catch {
          setFavorites((current) => {
            const reverted = new Set(current);
            if (isFav) reverted.add(id);
            else reverted.delete(id);
            return reverted;
          });
        }
      })();

      return next;
    });
  }, [isAuthenticated]);

  const handleContractorPress = useCallback((contractor: Contractor) => {
    HapticFeedback.selection();
    if (contractor.slug) {
      navigation.navigate('BusinessDetail', { id: contractor._id, slug: contractor.slug });
    } else {
      navigation.navigate('BusinessDetail', { id: contractor._id });
    }
  }, [navigation]);

  const handleLoadMore = useCallback(() => {
    if (activeCategory === 'all') return;
    if (!loadingMore && hasMore && !loading && !isFetchingRef.current) {
      loadContractors(searchZip || null, page + 1, true, activeCategory);
    }
  }, [activeCategory, loadingMore, hasMore, loading, page, searchZip, loadContractors]);

  const renderListItem = useCallback(
    ({ item }: { item: FlatListItem }) => {
      if (activeCategory === 'all') {
        const cat = item as Category;
        return (
          <CategoryRow
            category={cat}
            zip={ipZipCode}
            favorites={favorites}
            toggleFav={toggleFav}
            handleContractorPress={handleContractorPress}
            onSeeAll={() => {
              HapticFeedback.selection();
              requestAnimationFrame(() => {
                setActiveCategory(cat.id);
                loadContractors(searchZip || null, 1, false, cat.id);
              });
            }}
            isDark={isDark}
          />
        );
      }

      const contractor = item as Contractor;
      return (
        <View className="w-[48%] mb-4">
          <ListingCard
            listing={contractor}
            isFavorite={favorites.has(contractor._id)}
            onToggleFavorite={toggleFav}
            detectedZip={ipZipCode}
            onPress={handleContractorPress}
          />
        </View>
      );
    },
    [activeCategory, favorites, ipZipCode, isDark, handleContractorPress, toggleFav, loadContractors, searchZip]
  );

  const renderHeader = useCallback(
    () => (
      <View>
        <View className="px-4 pt-1 pb-1 w-full max-w-7xl mx-auto">
          <View className="flex-row items-center bg-neutral-100 dark:bg-neutral-900 rounded-2xl">
            <View className="flex-1 flex-row items-center pl-4">
              <FontAwesome5 name="map-marker-alt" size={14} color="#a3a3a3" />
              <TextInput
                className="flex-1 text-sm text-neutral-900 dark:text-neutral-50 px-3 py-3"
                placeholder="Zip code"
                placeholderTextColor="#a3a3a3"
                value={searchZip}
                onChangeText={(text) => {
                  isUserEditedRef.current = true;
                  setSearchZip(text.replace(/[^0-9]/g, ''));
                }}
                onSubmitEditing={() => loadContractors(searchZip || null, 1, false, activeCategory)}
                keyboardType="numeric"
                maxLength={5}
              />
              {searchZip ? (
                <Pressable
                  onPress={() => {
                    isUserEditedRef.current = true;
                    setSearchZip('');
                  }}
                  className="p-2"
                  accessibilityLabel="Clear zip code"
                  accessibilityRole="button"
                >
                  <FontAwesome5 name="times-circle" size={14} color="#a3a3a3" />
                </Pressable>
              ) : null}
            </View>
            
            <View className="w-px h-6 bg-neutral-200 dark:bg-neutral-700" />
            
            <View className="flex-1 flex-row items-center pl-4">
              <FontAwesome5 name="building" size={14} color="#a3a3a3" />
              <TextInput
                className="flex-1 text-sm text-neutral-900 dark:text-neutral-50 px-3 py-3"
                placeholder="Contractor name..."
                placeholderTextColor="#a3a3a3"
                value={searchName}
                onChangeText={setSearchName}
                onSubmitEditing={() => loadContractors(searchZip || null, 1, false, activeCategory)}
              />
              {searchName ? (
                <Pressable
                  onPress={() => setSearchName('')}
                  className="p-2"
                  accessibilityLabel="Clear search"
                  accessibilityRole="button"
                >
                  <FontAwesome5 name="times-circle" size={14} color="#a3a3a3" />
                </Pressable>
              ) : null}
            </View>
            
            <Pressable
              onPress={() => loadContractors(searchZip || null, 1, false, activeCategory)}
              className="bg-indigo-600 rounded-2xl p-3 m-1"
              accessibilityLabel="Search contractors"
              accessibilityRole="button"
            >
              <FontAwesome5 name="search" size={14} color="#ffffff" />
            </Pressable>
          </View>
          
          {nearbyLabel ? (
            <View className="flex-row items-center mt-1.5 px-1" style={{ gap: 4 }}>
              <FontAwesome5 name="map-marker-alt" size={10} color="#6366f1" />
              <Text className="text-xs text-indigo-600 dark:text-indigo-400">{nearbyLabel}</Text>
            </View>
          ) : null}
        </View>

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
                  requestAnimationFrame(() => {
                    setActiveCategory(cat.id);
                    loadContractors(searchZip || null, 1, false, cat.id);
                  });
                }}
              />
            ))}
          </ScrollView>
        </View>

        <View className="h-[1px] bg-neutral-200 dark:bg-neutral-800 -mx-4 mt-2 mb-4" />
      </View>
    ),
    [searchZip, searchName, nearbyLabel, activeCategory, loadContractors]
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
            <BouncingDotsLoader size="small" color={isDark ? '#a3a3a3' : '#737373'} />
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
      return (
        <View className="px-4 pt-4">
          {activeCategory === 'all' ? (
            Array.from({ length: 4 }).map((_, i) => (
              <View key={i} className="mb-8">
                <Skeleton width="40%" height={24} borderRadius={6} />
                <View className="flex-row justify-between mt-3">
                  {[0, 1].map(j => (
                    <View key={j} className="w-[48%]">
                      <Skeleton width="100%" height={150} borderRadius={12} />
                      <View className="mt-2" style={{ gap: 6 }}>
                        <Skeleton width="75%" height={14} />
                        <Skeleton width="50%" height={12} />
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            ))
          ) : (
            <View className="flex-row flex-wrap justify-between">
              {Array.from({ length: 6 }).map((_, i) => (
                <View key={i} className="w-[48%] mb-4">
                  <Skeleton width="100%" height={150} borderRadius={12} />
                  <View className="mt-2" style={{ gap: 6 }}>
                    <Skeleton width="75%" height={14} />
                    <Skeleton width="50%" height={12} />
                  </View>
                </View>
              ))}
            </View>
          )}
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
    if (searchName.trim()) {
      const q = searchName.toLowerCase().trim();
      list = list.filter((c) => (c.companyName || c.businessName || '').toLowerCase().includes(q));
    }
    return list;
  }, [allContractors, searchName]);

  const data = useMemo((): FlatListItem[] => {
    if (activeCategory === 'all') {
      return allContractors.length === 0 ? [] : CATEGORIES.filter(cat => cat.id !== 'all');
    }
    return filtered;
  }, [activeCategory, allContractors.length, filtered]);

  const keyExtractor = (item: FlatListItem) => {
    if ('_id' in item) return item._id;
    return item.id;
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      className="flex-1 bg-white dark:bg-neutral-950"
    >
      <BouncingRefreshFlatList
        ref={flatListRef}
        key={activeCategory === 'all' ? 'single' : 'grid'}
        data={data}
        renderItem={renderListItem}
        keyExtractor={keyExtractor}
        numColumns={activeCategory === 'all' ? 1 : 2}
        columnWrapperStyle={
          activeCategory === 'all' ? undefined : { justifyContent: 'space-between', paddingHorizontal: 16 }
        }
        ListHeaderComponent={renderHeader()}
        ListFooterComponent={renderFooter()}
        ListEmptyComponent={renderEmptyList()}
        refreshing={refreshing}
        onRefresh={onRefresh}
        showsVerticalScrollIndicator={false}
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 20 }}
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