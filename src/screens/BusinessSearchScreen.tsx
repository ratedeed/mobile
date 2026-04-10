import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  TextInput,
  RefreshControl,
  ListRenderItemInfo,
  StyleSheet,
  Text,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { FontAwesome5 } from '@expo/vector-icons';
import { browseContractors } from '../api/contractor';
import { Contractor } from '../types';
import { Spacing, Radii, Colors, Shadows } from '../constants/designTokens';
import Header from '../components/common/Header';
import Card from '../components/common/Card';
import Typography from '../components/common/Typography';
import { SkeletonLoader } from '../components/common/SkeletonLoader';
import { EmptyState } from '../components/common/EmptyState';
import { Badge } from '../components/common/Badge';

type RootStackParamList = {
  BusinessSearch: { query?: string; searchType?: string; name?: string };
  BusinessDetail: { contractorId?: string; slug?: string };
};

type BusinessSearchScreenRouteProp = RouteProp<RootStackParamList, 'BusinessSearch'>;
type BusinessSearchScreenNavigationProp = StackNavigationProp<RootStackParamList, 'BusinessSearch'>;

const CATEGORIES: string[] = [
  'All',
  'Home Builders',
  'Plumbers',
  'Electricians',
  'Painters',
  'Landscapers',
  'Handymen',
  'Roofers',
  'HVAC',
  'Carpenters',
  'Cleaners',
];

export interface SortOption {
  key: string;
  label: string;
}

const SORT_OPTIONS: SortOption[] = [
  { key: 'rating', label: 'Highest Rated' },
  { key: 'reviews', label: 'Most Reviews' },
  { key: 'distance', label: 'Nearest' },
];

const BusinessSearchScreen: React.FC = () => {
  const navigation = useNavigation<BusinessSearchScreenNavigationProp>();
  const route = useRoute<BusinessSearchScreenRouteProp>();
  const { query, searchType, name } = route.params || {};

  const [searchZip, setSearchZip] = useState<string>(query || '');
  const [searchName, setSearchName] = useState<string>(name || '');
  const [selectedCategory, setSelectedCategory] = useState<string>(
    searchType === 'category' ? (query || '') : ''
  );
  const [sortBy, setSortBy] = useState<string>('rating');
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [page, setPage] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [totalResults, setTotalResults] = useState<number>(0);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  const isFirstRender = useRef<boolean>(true);

  const fetchContractors = useCallback(
    async (pageNum: number = 1, append: boolean = false) => {
      try {
        if (pageNum === 1) {
          setLoading(true);
        } else {
          setLoadingMore(true);
        }

        const filters: any = {
          page: pageNum,
          limit: 20,
          sortBy: sortBy,
        };

        // Use zip code if provided, otherwise use name search
        if (searchZip && /^\d{5}$/.test(searchZip)) {
          filters.zip = searchZip;
        } else if (searchName) {
          filters.search = searchName;
        } else if (searchZip) {
          filters.search = searchZip;
        }

        if (selectedCategory && selectedCategory !== 'All') {
          filters.category = selectedCategory;
        }

        const data = await browseContractors(filters);

        if (append) {
          setContractors(prev => [...prev, ...(data.contractors || [])]);
        } else {
          setContractors(data.contractors || []);
        }

        setTotalResults(data.total || 0);
        setHasMore(data.page < data.pages);
        setPage(pageNum);
      } catch (error) {
        console.error('Error fetching contractors:', error);
        if (!append) {
          setContractors([]);
          setTotalResults(0);
        }
      } finally {
        setLoading(false);
        setLoadingMore(false);
        setRefreshing(false);
      }
    },
    [searchZip, searchName, selectedCategory, sortBy]
  );

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    fetchContractors(1, false);
  }, [selectedCategory, sortBy, fetchContractors]);

  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      if (!isFirstRender.current) {
        fetchContractors(1, false);
      }
    }, 500);
    return () => clearTimeout(debounceTimer);
  }, [searchZip, searchName, fetchContractors]);

  const handleSearch = () => {
    fetchContractors(1, false);
  };

  const handleLoadMore = () => {
    if (!loadingMore && hasMore) {
      fetchContractors(page + 1, true);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchContractors(1, false);
  };

  const handleCategorySelect = (category: string) => {
    setSelectedCategory(category === 'All' ? '' : category);
    setSearchZip('');
    setSearchName('');
  };

  const renderStarRating = (rating?: number) => {
    if (!rating) return null;
    const fullStars = Math.floor(rating);
    const hasHalf = rating % 1 >= 0.5;

    return (
      <View style={styles.starsContainer}>
        {[1, 2, 3, 4, 5].map((i) => (
          <FontAwesome5
            key={i}
            name={i <= fullStars ? 'star' : i === fullStars + 1 && hasHalf ? 'star-half-alt' : 'star'}
            solid={i <= fullStars}
            size={12}
            color="#f59e0b"
            style={styles.starIcon}
          />
        ))}
      </View>
    );
  };

  const renderContractorCard = ({ item }: ListRenderItemInfo<Contractor>) => (
    <TouchableOpacity
      style={styles.listingCard}
      onPress={() => {
        if (item._id) {
          navigation.navigate('BusinessDetail', { contractorId: item._id });
        } else if (item.slug) {
          navigation.navigate('BusinessDetail', { slug: item.slug });
        }
      }}
      activeOpacity={0.8}
    >
      <View style={styles.imageContainer}>
        <Image
          source={{ uri: item.profilePicture || 'https://via.placeholder.com/200' }}
          style={styles.contractorImage}
          resizeMode="cover"
        />
        {item.isVerified && (
          <View style={styles.verifiedBadge}>
            <FontAwesome5 name="shield-alt" size={10} color="#4F46E5" />
            <Text style={styles.verifiedText}>Verified</Text>
          </View>
        )}
        <TouchableOpacity style={styles.favoriteButton}>
          <FontAwesome5 name="heart" size={16} color="rgba(0,0,0,0.5)" />
        </TouchableOpacity>
      </View>
      <View style={styles.cardContent}>
        <View style={styles.cardHeader}>
          <Text style={styles.companyName} numberOfLines={1}>
            {item.companyName}
          </Text>
          <View style={styles.ratingContainer}>
            <FontAwesome5 name="star" size={10} color="#111827" />
            <Text style={styles.ratingText}>
              {item.averageRating?.toFixed(2) || '0.00'}
            </Text>
          </View>
        </View>
        <Text style={styles.categoryText}>
          {item.category || 'General Contractor'}
        </Text>
        <View style={styles.ratingRow}>
          {renderStarRating(item.averageRating)}
          <Text style={styles.reviewCount}>
            ({item.numReviews || 0})
          </Text>
        </View>
        {item.pricing && (
          <Text style={styles.pricingText}>{item.pricing}</Text>
        )}
        {item.contactInfo?.city && (
          <View style={styles.locationRow}>
            <FontAwesome5 name="map-marker-alt" size={10} color="#6b7280" />
            <Text style={styles.locationText}>
              {item.contactInfo.city}, {item.contactInfo.state}
            </Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  const renderFooter = () => {
    if (!loadingMore) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color="#4F46E5" />
      </View>
    );
  };

  const renderHeader = () => (
    <View style={styles.listHeader}>
      <Text style={styles.resultsCount}>
        {totalResults} contractor{totalResults !== 1 ? 's' : ''} found
      </Text>
      <View style={styles.sortContainer}>
        <Text style={styles.sortLabel}>Sort:</Text>
        {SORT_OPTIONS.map((option) => (
          <TouchableOpacity
            key={option.key}
            style={[
              styles.sortOption,
              sortBy === option.key && styles.sortOptionActive
            ]}
            onPress={() => setSortBy(option.key)}
          >
            <Text
              style={[
                styles.sortOptionText,
                sortBy === option.key && styles.sortOptionTextActive
              ]}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  if (loading && contractors.length === 0) {
    return (
      <View style={styles.container}>
        <Header title="Search Contractors" showBackButton />
        <View style={styles.loadingContainer}>
          <View style={styles.gridContainer}>
            {[1, 2, 3, 4].map((i) => (
              <View key={i} style={styles.skeletonCard}>
                <View style={styles.skeletonImage} />
                <View style={styles.skeletonText}>
                  <View style={styles.skeletonLine} />
                  <View style={styles.skeletonLineShort} />
                </View>
              </View>
            ))}
          </View>
        </View>
      </View>
    );
  }

  const categoryListData = [{ key: 'categories' }, ...CATEGORIES.map((c) => ({ key: c }))];

  return (
    <View style={styles.container}>
      <Header title="Search Contractors" showBackButton />

      {/* Split Search Bar - Design from reference */}
      <View style={styles.searchSection}>
        <TouchableOpacity 
          style={styles.searchButton}
          onPress={handleSearch}
        >
          <View style={styles.searchField}>
            <Text style={styles.searchFieldLabel}>Zip code</Text>
            <TextInput
              style={styles.searchFieldInput}
              placeholder="Enter zip"
              placeholderTextColor="#9ca3af"
              value={searchZip}
              onChangeText={setSearchZip}
              keyboardType="numeric"
              maxLength={5}
            />
          </View>
          <View style={styles.searchFieldDivider} />
          <View style={styles.searchFieldRight}>
            <Text style={styles.searchFieldLabel}>Name</Text>
            <TextInput
              style={styles.searchFieldInput}
              placeholder="Contractor name..."
              placeholderTextColor="#9ca3af"
              value={searchName}
              onChangeText={setSearchName}
            />
          </View>
          <View style={styles.searchIconContainer}>
            <FontAwesome5 name="search" size={14} color="#FFFFFF" />
          </View>
        </TouchableOpacity>
      </View>

      {/* Category Bar */}
      <FlatList
        data={categoryListData}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categoryScroll}
        keyExtractor={(item) => item.key}
        renderItem={({ item }) => {
          if (item.key === 'categories') {
            return null;
          }
          const isSelected = (selectedCategory === '' && item.key === 'All') || selectedCategory === item.key;
          return (
            <TouchableOpacity
              style={[
                styles.categoryChip,
                isSelected && styles.categoryChipActive
              ]}
              onPress={() => handleCategorySelect(item.key)}
            >
              <Text
                style={[
                  styles.categoryChipText,
                  isSelected && styles.categoryChipTextActive
                ]}
              >
                {item.key}
              </Text>
            </TouchableOpacity>
          );
        }}
      />

      <View style={styles.divider} />

      {/* Results List */}
      <FlatList
        data={contractors}
        renderItem={renderContractorCard}
        keyExtractor={(item) => item._id || item.slug || Math.random().toString()}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.listContainer}
        ListHeaderComponent={contractors.length > 0 ? renderHeader : null}
        ListEmptyComponent={
          <EmptyState
            title="No contractors found"
            message="Try adjusting your search or filters"
            icon="search"
          />
        }
        ListFooterComponent={renderFooter}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.3}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    padding: 16,
  },
  searchSection: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    backgroundColor: '#f9fafb',
  },
  searchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  searchField: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  searchFieldDivider: {
    width: 1,
    height: '100%',
    backgroundColor: '#e5e7eb',
  },
  searchFieldRight: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  searchFieldLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 2,
  },
  searchFieldInput: {
    fontSize: 14,
    color: '#111827',
    padding: 0,
  },
  searchIconContainer: {
    backgroundColor: '#4F46E5',
    borderRadius: 999,
    padding: 10,
    marginRight: 6,
  },
  categoryScroll: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  categoryChip: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    marginRight: 8,
  },
  categoryChipActive: {
    backgroundColor: '#4F46E5',
  },
  categoryChipText: {
    color: '#6b7280',
    fontWeight: '500',
    fontSize: 14,
  },
  categoryChipTextActive: {
    color: '#FFFFFF',
  },
  divider: {
    height: 1,
    backgroundColor: '#e5e7eb',
  },
  listContainer: {
    padding: 16,
    flexGrow: 1,
  },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    marginBottom: 12,
  },
  resultsCount: {
    color: '#6b7280',
    fontSize: 14,
  },
  sortContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sortLabel: {
    color: '#6b7280',
    fontSize: 12,
    marginRight: 4,
  },
  sortOption: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  sortOptionActive: {
    backgroundColor: 'rgba(79, 70, 229, 0.1)',
  },
  sortOptionText: {
    color: '#6b7280',
    fontSize: 12,
  },
  sortOptionTextActive: {
    color: '#4F46E5',
    fontWeight: '600',
  },
  row: {
    justifyContent: 'space-between',
  },
  // Listing Card styles from reference
  listingCard: {
    width: '48%',
    marginBottom: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  imageContainer: {
    position: 'relative',
    aspectRatio: 1,
    backgroundColor: '#f3f4f6',
  },
  contractorImage: {
    width: '100%',
    height: '100%',
  },
  verifiedBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 1,
  },
  verifiedText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#111827',
    marginLeft: 4,
  },
  favoriteButton: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  cardContent: {
    padding: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  companyName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  ratingText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#111827',
  },
  categoryText: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  starsContainer: {
    flexDirection: 'row',
  },
  starIcon: {
    marginRight: 2,
  },
  reviewCount: {
    fontSize: 10,
    color: '#6b7280',
    marginLeft: 4,
  },
  pricingText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#4F46E5',
    marginTop: 4,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 4,
  },
  locationText: {
    fontSize: 11,
    color: '#6b7280',
  },
  // Skeleton styles
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  skeletonCard: {
    width: '48%',
    marginBottom: 16,
  },
  skeletonImage: {
    aspectRatio: 1,
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
  },
  skeletonText: {
    padding: 10,
    gap: 6,
  },
  skeletonLine: {
    height: 12,
    backgroundColor: '#f3f4f6',
    borderRadius: 4,
    width: '75%',
  },
  skeletonLineShort: {
    height: 12,
    backgroundColor: '#f3f4f6',
    borderRadius: 4,
    width: '50%',
  },
  footerLoader: {
    paddingVertical: 16,
    alignItems: 'center',
  },
});

export default BusinessSearchScreen;
