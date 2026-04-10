import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  ScrollView,
  Pressable,
  Image,
  Text,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { FontAwesome5 } from '@expo/vector-icons';
import { getTopRatedContractors, getNearbyTopRatedContractors } from '../utils/apiClient';
import { Contractor, RootStackParamList } from '../types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Category icon configuration from reference design
const catGradients: Record<string, { from: string; to: string; bg: string }> = {
  'th-large':   { from: '#1f2937', to: '#111827', bg: '#f3f4f6' },
  home:         { from: '#f59e0b', to: '#d97706', bg: '#fef3c7' },
  bath:         { from: '#3b82f6', to: '#2563eb', bg: '#dbeafe' },
  bolt:         { from: '#eab308', to: '#ca8a04', bg: '#fef9c3' },
  'paint-roller': { from: '#8b5cf6', to: '#7c3aed', bg: '#ede9fe' },
  tree:         { from: '#10b981', to: '#059669', bg: '#d1fae5' },
  tools:        { from: '#64748b', to: '#475569', bg: '#f1f5f9' },
  'house-damage': { from: '#f97316', to: '#ea580c', bg: '#ffedd5' },
  fan:          { from: '#06b6d4', to: '#0891b2', bg: '#cffafe' },
  hammer:       { from: '#71717a', to: '#52525b', bg: '#f4f4f5' },
  broom:        { from: '#ec4899', to: '#db2777', bg: '#fce7f3' },
};

const catActiveBg: Record<string, string> = {
  'th-large':   '#111827',
  home:         '#d97706',
  bath:         '#2563eb',
  bolt:         '#ca8a04',
  'paint-roller': '#7c3aed',
  tree:         '#059669',
  tools:        '#475569',
  'house-damage': '#ea580c',
  fan:          '#0891b2',
  hammer:       '#52525b',
  broom:        '#db2777',
};

const CATEGORIES = [
  { id: 'all', name: 'All', icon: 'th-large' },
  { id: 'builders', name: 'Home Builders', icon: 'home' },
  { id: 'plumbers', name: 'Plumbers', icon: 'bath' },
  { id: 'electricians', name: 'Electricians', icon: 'bolt' },
  { id: 'painters', name: 'Painters', icon: 'paint-roller' },
  { id: 'landscapers', name: 'Landscapers', icon: 'tree' },
  { id: 'handymen', name: 'Handymen', icon: 'tools' },
  { id: 'roofers', name: 'Roofers', icon: 'house-damage' },
  { id: 'hvac', name: 'HVAC', icon: 'fan' },
  { id: 'carpenters', name: 'Carpenters', icon: 'hammer' },
  { id: 'cleaners', name: 'Cleaners', icon: 'broom' },
];

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

function ListingCard({
  listing,
  isFavorite,
  onToggleFavorite,
  detectedZip,
  onPress
}: {
  listing: Contractor;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  detectedZip: string | null;
  onPress: () => void;
}) {
  return (
    <Pressable className="group mb-4" onPress={onPress}>
      <View className="relative rounded-xl overflow-hidden bg-neutral-100 aspect-square">
        <Image
          source={{ uri: listing.profilePicture || 'https://via.placeholder.com/200' }}
          className="absolute inset-0 w-full h-full object-cover"
        />
        {listing.isVerified && (
          <View className="absolute top-2 left-2 bg-white rounded-full px-2 py-0.5 shadow-sm flex-row items-center" style={{ gap: 4 }}>
            <FontAwesome5 name="shield-alt" size={10} color="#4F46E5" />
            <Text className="text-[10px] font-bold text-neutral-900">License Verified</Text>
          </View>
        )}
        <Pressable
          onPress={(e) => { e.stopPropagation(); onToggleFavorite(); }}
          className="absolute top-2 right-2"
        >
          <FontAwesome5 name="heart" solid={isFavorite} size={24} color={isFavorite ? 'rgba(225,29,72,1)' : 'rgba(0,0,0,0.5)'} />
        </Pressable>
      </View>
      <View className="mt-2">
        <View className="flex-row items-start justify-between" style={{ gap: 4 }}>
          <Text className="text-[13px] font-semibold text-neutral-900 leading-tight flex-1" numberOfLines={1}>
            {listing.contactInfo?.city || 'Local Area'}
          </Text>
          <View className="flex-row items-center shrink-0" style={{ gap: 2 }}>
            <FontAwesome5 name="star" solid size={12} color="#eab308" />
            <Text className="text-xs font-bold text-slate-600">
              {listing.averageRating?.toFixed(2) || '0.00'}
            </Text>
          </View>
        </View>
        <Text className="text-xs text-neutral-500 mt-0.5" numberOfLines={1}>
          {listing.companyName}
        </Text>
        <Text className="text-xs text-neutral-500" numberOfLines={1}>
          {listing.category || 'General Contractor'}
        </Text>
        {detectedZip && listing.zipCodesCovered?.includes(detectedZip) && (
          <View className="flex-row items-center mt-0.5" style={{ gap: 2 }}>
            <FontAwesome5 name="map-marker-alt" size={10} color="#059669" />
            <Text className="text-[10px] font-semibold text-emerald-700">Serves your area</Text>
          </View>
        )}
        {listing.pricing && (
          <Text className="text-[13px] font-semibold text-neutral-900 mt-0.5">
            From {listing.pricing.split('–')[0]?.trim()} <Text className="font-normal text-neutral-500">project</Text>
          </Text>
        )}
      </View>
    </Pressable>
  );
}

const HomeScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const [ipZipCode, setIpZipCode] = useState<string | null>(null);
  const [allContractors, setAllContractors] = useState<Contractor[]>([]);
  const [loadingFeatured, setLoadingFeatured] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    fetchLocationAndData();
  }, []);

  const fetchLocationAndData = async (): Promise<void> => {
    try {
      const response = await fetch('https://free.freeipapi.com/api/json');
      const data = await response.json();
      const detectedZip = data.zipCode;
      setIpZipCode(detectedZip);
      await loadFeaturedContractors(detectedZip);
    } catch (err) {
      console.error('Error fetching location:', err);
      setIpZipCode('10001');
      await loadFeaturedContractors('10001');
    }
  };

  const loadFeaturedContractors = async (zip: string | null): Promise<void> => {
    if (!zip) {
      setLoadingFeatured(false);
      return;
    }
    setLoadingFeatured(true);
    try {
      const data = await getTopRatedContractors(zip, 100); // Higher limit to group
      setAllContractors(data || []);
    } catch (err) {
      console.error('Error fetching featured contractors:', err);
      try {
        const nearbyData = await getNearbyTopRatedContractors(zip);
        setAllContractors(nearbyData || []);
      } catch (nearbyErr) {
        console.error('Error fetching nearby contractors:', nearbyErr);
        setAllContractors([]);
      }
    } finally {
      setLoadingFeatured(false);
    }
  };

  const onRefresh = useCallback(async (): Promise<void> => {
    setRefreshing(true);
    await fetchLocationAndData();
    setRefreshing(false);
  }, []);

  const toggleFav = (id: string) => {
    setFavorites(prev => {
      const n = new Set(prev);
      if (n.has(id)) { n.delete(id); } else { n.add(id); }
      return n;
    });
  };

  const handleContractorPress = (contractor: Contractor): void => {
    if (contractor.slug) {
      navigation.navigate('BusinessDetail', { id: contractor._id, slug: contractor.slug });
    } else {
      navigation.navigate('BusinessDetail', { id: contractor._id });
    }
  };

  const filtered = useMemo(() => {
    if (activeCategory === 'all') return allContractors;
    
    const cat = CATEGORIES.find(c => c.id === activeCategory);
    const searchTerm = activeCategory.toLowerCase();
    const singularSearch = searchTerm.endsWith('s') ? searchTerm.slice(0, -1) : searchTerm;
    const labelTerm = cat?.name.toLowerCase() || '';
    const singularLabel = labelTerm.endsWith('s') ? labelTerm.slice(0, -1) : labelTerm;

    return allContractors.filter(c => {
      const cCat = c.category?.toLowerCase() || '';
      return cCat.includes(searchTerm) || 
             searchTerm.includes(cCat) || 
             cCat.includes(singularSearch) ||
             cCat.includes(labelTerm) ||
             labelTerm.includes(cCat) ||
             cCat.includes(singularLabel);
    });
  }, [allContractors, activeCategory]);

  return (
    <View className="flex-1 bg-white">
      <ScrollView
        className="flex-1"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Search Bar */}
        <View className="px-4 pt-1 pb-1 w-full max-w-7xl mx-auto">
          <Pressable 
            onPress={() => navigation.navigate('Main', { screen: 'Search' } as any)} 
            className="w-full border border-neutral-200 rounded-full bg-white shadow-sm flex-row items-center"
          >
            <Text className="flex-1 text-left text-sm font-medium px-5 py-3 border-r border-neutral-200" numberOfLines={1}>
              {ipZipCode || 'Zip code'}
            </Text>
            <Text className="flex-1 text-left text-sm text-neutral-400 px-5 py-3" numberOfLines={1}>
              Contractor name...
            </Text>
            <View className="bg-indigo-600 rounded-full p-2.5 mr-1.5 shrink-0">
              <FontAwesome5 name="search" size={14} color="#ffffff" />
            </View>
          </Pressable>
        </View>

        {/* Category Bar */}
        <View className="relative mt-2 flex-row sm:justify-center">
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            className="flex-row overflow-visible px-4"
            contentContainerStyle={{ alignItems: 'center', gap: 16, paddingRight: 100 }}
          >
            {CATEGORIES.map((cat, i) => {
              const isActive = activeCategory === cat.id;
              const gradient = catGradients[cat.icon] || { bg: '#f3f4f6', from: '#9ca3af' };
              const activeBg = catActiveBg[cat.icon] || '#52525b';
              
              return (
                <Pressable
                  key={cat.id}
                  className="flex-col items-center shrink-0 pt-1.5 pb-1.5 min-w-[60px]"
                  style={{ gap: 6 }}
                  onPress={() => setActiveCategory(cat.id)}
                >
                  <View 
                    className="w-12 h-12 rounded-2xl items-center justify-center"
                    style={{ backgroundColor: isActive ? activeBg : gradient.bg }}
                  >
                    <FontAwesome5 
                      name={cat.icon} 
                      size={20} 
                      color={isActive ? '#FFFFFF' : gradient.from} 
                    />
                  </View>
                  <Text 
                    className={`text-[10px] font-semibold whitespace-nowrap ${isActive ? 'text-neutral-900' : 'text-neutral-500'}`}
                  >
                    {cat.name}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
          <Pressable 
            onPress={() => setShowFilters(!showFilters)}
            className="absolute right-4 top-2.5 border border-neutral-200 rounded-xl px-3 py-2 flex-row items-center bg-white/90 z-10 shadow-sm"
            style={{ elevation: 2, shadowColor: '#000', shadowOffset: {width: 0, height: 1}, shadowOpacity: 0.05, shadowRadius: 2, gap: 8 }}
          >
            <FontAwesome5 name="sliders-h" size={14} color="#737373" />
            <Text className="text-xs font-semibold text-neutral-900">Filters</Text>
          </Pressable>
        </View>

        <View className="h-[1px] bg-neutral-200 -mx-4 mt-2" />

        {/* Listings Content */}
        <View className="px-4 pt-4 pb-24 w-full max-w-7xl mx-auto">
          {loadingFeatured ? (
            <View className="flex-row flex-wrap justify-between">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <View key={i} className="w-[48%] mb-4">
                  <View className="aspect-square bg-neutral-100 rounded-xl mb-2" />
                  <View className="h-3 bg-neutral-100 rounded w-3/4 mb-1.5" />
                  <View className="h-3 bg-neutral-100 rounded w-1/2 mb-1.5" />
                  <View className="h-3 bg-neutral-100 rounded w-1/3" />
                </View>
              ))}
            </View>
          ) : activeCategory === 'all' ? (
            <View className="flex-col" style={{ gap: 40 }}>
              {CATEGORIES.filter(cat => cat.id !== 'all').map(cat => {
                const catContractors = allContractors.filter(c => {
                  const cCat = c.category?.toLowerCase() || '';
                  const searchTerm = cat.id.toLowerCase();
                  const singularSearch = searchTerm.endsWith('s') ? searchTerm.slice(0, -1) : searchTerm;
                  const labelTerm = cat.name.toLowerCase();
                  const singularLabel = labelTerm.endsWith('s') ? labelTerm.slice(0, -1) : labelTerm;
                  return cCat.includes(searchTerm) || cCat.includes(singularSearch) || cCat.includes(labelTerm) || cCat.includes(singularLabel);
                }).slice(0, 8);

                if (catContractors.length === 0) return null;

                return (
                  <View key={cat.id} className="flex-col" style={{ gap: 16 }}>
                    <View className="flex-row items-center justify-between">
                      <Text className="text-xl font-bold text-neutral-900">{cat.name}</Text>
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
            <View className="flex-row flex-wrap justify-between">
              {filtered.map((c) => (
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
              <Text className="text-lg font-medium text-neutral-500">No contractors found</Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Filter Modal Overlay */}
      {showFilters && (
        <View className="absolute inset-0 z-[60] justify-end" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <Pressable className="flex-1" onPress={() => setShowFilters(false)} />
          <View className="bg-white rounded-t-3xl w-full px-5 pt-4 pb-8">
            <View className="w-10 h-1 bg-neutral-300 rounded-full mx-auto mb-5" />
            <Text className="text-lg font-bold text-neutral-900 mb-4">Filters</Text>
            <View className="flex-col" style={{ gap: 16 }}>
              {['License Verified', 'Available This Week', 'Under $10,000', 'Top Rated (4.5+)', 'Has Portfolio'].map((f) => (
                <Pressable key={f} className="flex-row items-center" style={{ gap: 12, paddingVertical: 8 }}>
                  <View className="w-6 h-6 rounded-full border-2 border-neutral-900 items-center justify-center">
                    <View className="w-3 h-3 rounded-full bg-neutral-900" />
                  </View>
                  <Text className="text-sm font-medium text-neutral-900">{f}</Text>
                </Pressable>
              ))}
            </View>
            <View className="flex-row mt-6" style={{ gap: 12 }}>
              <Pressable 
                onPress={() => setShowFilters(false)} 
                className="flex-1 py-3 border border-neutral-900 rounded-xl items-center"
              >
                <Text className="text-sm font-semibold text-neutral-900">Clear all</Text>
              </Pressable>
              <Pressable 
                onPress={() => setShowFilters(false)} 
                className="flex-1 py-3 bg-neutral-900 rounded-xl items-center"
              >
                <Text className="text-sm font-semibold text-white">Show results</Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}
    </View>
  );
};

export default HomeScreen;