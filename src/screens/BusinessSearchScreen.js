import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  TextInput,
  RefreshControl,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { FontAwesome5 } from '@expo/vector-icons';
import { browseContractors, getContractorById } from '../api/contractor';
import { Spacing, Radii, Colors, Shadows } from '../constants/designTokens';
import Header from '../components/common/Header';
import Input from '../components/common/Input';
import Card from '../components/common/Card';
import Typography from '../components/common/Typography';
import { SkeletonLoader } from '../components/common/SkeletonLoader';
import { EmptyState } from '../components/common/EmptyState';
import { Badge } from '../components/common/Badge';

const CATEGORIES = [
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

const SORT_OPTIONS = [
  { key: 'rating', label: 'Highest Rated' },
  { key: 'reviews', label: 'Most Reviews' },
  { key: 'distance', label: 'Nearest' },
];

const BusinessSearchScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { query, searchType } = route.params || {};

  const [searchQuery, setSearchQuery] = useState(query || '');
  const [selectedCategory, setSelectedCategory] = useState(
    searchType === 'category' ? query : ''
  );
  const [sortBy, setSortBy] = useState('rating');
  const [contractors, setContractors] = useState([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [totalResults, setTotalResults] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const isFirstRender = useRef(true);

  const fetchContractors = useCallback(
    async (pageNum = 1, append = false) => {
      try {
        if (pageNum === 1) {
          setLoading(true);
        } else {
          setLoadingMore(true);
        }

        const filters = {
          page: pageNum,
          limit: 20,
          sortBy: sortBy,
        };

        if (searchQuery && /^\d{5}$/.test(searchQuery)) {
          filters.zip = searchQuery;
        } else if (searchQuery) {
          filters.search = searchQuery;
        }

        if (selectedCategory && selectedCategory !== 'All') {
          filters.category = selectedCategory;
        }

        const data = await browseContractors(filters);

        if (append) {
          setContractors(prev => [...prev, ...data.contractors]);
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
    [searchQuery, selectedCategory, sortBy]
  );

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    fetchContractors(1, false);
  }, [selectedCategory, sortBy]);

  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      fetchContractors(1, false);
    }, 500);
    return () => clearTimeout(debounceTimer);
  }, [searchQuery]);

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

  const handleCategorySelect = (category) => {
    setSelectedCategory(category === 'All' ? '' : category);
    setSearchQuery('');
  };

  const renderStarRating = (rating) => {
    if (!rating) return null;
    const fullStars = Math.floor(rating);
    const hasHalf = rating % 1 >= 0.5;

    return (
      <View style={styles.starContainer}>
        {[1, 2, 3, 4, 5].map((i) => (
          <FontAwesome5
            key={i}
            name={i <= fullStars ? 'star' : i === fullStars + 1 && hasHalf ? 'star-half-alt' : 'star'}
            solid={i <= fullStars}
            size={12}
            color={Colors.warning500}
            style={styles.starIcon}
          />
        ))}
      </View>
    );
  };

  const renderContractorCard = ({ item }) => (
    <Card style={styles.contractorCard}>
      <TouchableOpacity
        onPress={() => {
          if (item._id) {
            navigation.navigate('BusinessDetail', { contractorId: item._id });
          } else if (item.slug) {
            navigation.navigate('BusinessDetail', { slug: item.slug });
          }
        }}
        activeOpacity={0.8}
      >
        <Image
          source={{ uri: item.profilePicture || 'https://via.placeholder.com/300x200' }}
          style={styles.contractorImage}
        />
        <View style={styles.contractorInfo}>
          <View style={styles.nameRow}>
            <Typography variant="h6" style={styles.contractorName} numberOfLines={1}>
              {item.companyName}
            </Typography>
            {item.isVerified && (
              <Badge label="Verified" variant="success" size="sm" />
            )}
          </View>
          <Typography variant="caption" style={styles.contractorCategory}>
            {item.category || 'General Contractor'}
          </Typography>
          <View style={styles.ratingRow}>
            {renderStarRating(item.averageRating)}
            <Typography variant="caption" style={styles.ratingText}>
              {item.averageRating?.toFixed(1) || '0.0'} ({item.numReviews || 0})
            </Typography>
          </View>
          {item.pricing && (
            <Typography variant="caption" style={styles.pricing}>
              {item.pricing}
            </Typography>
          )}
          {item.contactInfo?.city && (
            <View style={styles.locationRow}>
              <FontAwesome5 name="map-marker-alt" size={10} color={Colors.neutral500} />
              <Typography variant="caption" style={styles.locationText}>
                {item.contactInfo.city}, {item.contactInfo.state}
              </Typography>
            </View>
          )}
        </View>
      </TouchableOpacity>
    </Card>
  );

  const renderFooter = () => {
    if (!loadingMore) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={Colors.primary500} />
      </View>
    );
  };

  const renderHeader = () => (
    <View style={styles.listHeader}>
      <Typography variant="caption" style={styles.resultsCount}>
        {totalResults} contractor{totalResults !== 1 ? 's' : ''} found
      </Typography>
      <View style={styles.sortContainer}>
        <Typography variant="caption" style={styles.sortLabel}>Sort:</Typography>
        {SORT_OPTIONS.map((option) => (
          <TouchableOpacity
            key={option.key}
            style={[styles.sortOption, sortBy === option.key && styles.sortOptionActive]}
            onPress={() => setSortBy(option.key)}
          >
            <Typography
              variant="caption"
              style={[styles.sortOptionText, sortBy === option.key && styles.sortOptionTextActive]}
            >
              {option.label}
            </Typography>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  if (loading && contractors.length === 0) {
    return (
      <View style={styles.fullScreenContainer}>
        <Header title="Search Contractors" showBackButton />
        <View style={styles.loadingContainer}>
          <SkeletonLoader type="card" count={4} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.fullScreenContainer}>
      <Header title="Search Contractors" showBackButton />

      <View style={styles.searchContainer}>
        <View style={styles.searchRow}>
          <View style={styles.searchInputContainer}>
            <FontAwesome5 name="search" size={16} color={Colors.neutral500} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by name, zip code..."
              placeholderTextColor={Colors.neutral500}
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={handleSearch}
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearButton}>
                <FontAwesome5 name="times-circle" size={16} color={Colors.neutral500} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        <FlatList
          data={[{ key: 'categories' }, ...CATEGORIES.map((c) => ({ key: c }))]}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryContainer}
          keyExtractor={(item) => item.key}
          renderItem={({ item }) => {
            if (item.key === 'categories') {
              return null;
            }
            const isSelected = (selectedCategory === '' && item.key === 'All') || selectedCategory === item.key;
            return (
              <TouchableOpacity
                style={[styles.categoryChip, isSelected && styles.categoryChipActive]}
                onPress={() => handleCategorySelect(item.key)}
              >
                <Typography
                  variant="caption"
                  style={[styles.categoryChipText, isSelected && styles.categoryChipTextActive]}
                >
                  {item.key}
                </Typography>
              </TouchableOpacity>
            );
          }}
        />
      </View>

      <FlatList
        data={contractors}
        renderItem={renderContractorCard}
        keyExtractor={(item) => item._id || item.slug}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.listContainer}
        ListHeaderComponent={contractors.length > 0 ? renderHeader : null}
        ListEmptyComponent={
          <EmptyState
            title="No contractors found"
            message="Try adjusting your search or filters"
            icon="🔍"
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
  fullScreenContainer: {
    flex: 1,
    backgroundColor: Colors.neutral100,
  },
  loadingContainer: {
    flex: 1,
    padding: Spacing.lg,
  },
  searchContainer: {
    backgroundColor: Colors.neutral50,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
    ...Shadows.sm,
  },
  searchRow: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.neutral100,
    borderRadius: Radii.md,
    paddingHorizontal: Spacing.md,
    height: 44,
  },
  searchIcon: {
    marginRight: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: Colors.neutral900,
  },
  clearButton: {
    padding: Spacing.xs,
  },
  categoryContainer: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
  },
  categoryChip: {
    backgroundColor: Colors.neutral200,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radii.full,
    marginRight: Spacing.sm,
  },
  categoryChipActive: {
    backgroundColor: Colors.primary500,
  },
  categoryChipText: {
    color: Colors.neutral700,
    fontWeight: '500',
  },
  categoryChipTextActive: {
    color: Colors.neutral50,
  },
  listContainer: {
    padding: Spacing.md,
    flexGrow: 1,
  },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  resultsCount: {
    color: Colors.neutral600,
  },
  sortContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sortLabel: {
    color: Colors.neutral500,
    marginRight: Spacing.xs,
  },
  sortOption: {
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
    borderRadius: Radii.sm,
  },
  sortOptionActive: {
    backgroundColor: Colors.primary100,
  },
  sortOptionText: {
    color: Colors.neutral600,
    fontSize: 11,
  },
  sortOptionTextActive: {
    color: Colors.primary600,
    fontWeight: '600',
  },
  row: {
    justifyContent: 'space-between',
  },
  contractorCard: {
    width: '48%',
    marginBottom: Spacing.md,
    padding: 0,
    overflow: 'hidden',
  },
  contractorImage: {
    width: '100%',
    height: 100,
    resizeMode: 'cover',
  },
  contractorInfo: {
    padding: Spacing.sm,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  contractorName: {
    flex: 1,
    color: Colors.neutral900,
    fontSize: 14,
    fontWeight: '600',
  },
  contractorCategory: {
    color: Colors.neutral600,
    fontSize: 11,
    marginBottom: 4,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  starContainer: {
    flexDirection: 'row',
    marginRight: 4,
  },
  starIcon: {
    marginRight: 1,
  },
  ratingText: {
    color: Colors.neutral600,
    fontSize: 10,
  },
  pricing: {
    color: Colors.primary600,
    fontSize: 11,
    fontWeight: '500',
    marginTop: 4,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  locationText: {
    color: Colors.neutral500,
    fontSize: 10,
    marginLeft: 4,
  },
  footerLoader: {
    paddingVertical: Spacing.lg,
    alignItems: 'center',
  },
});

export default BusinessSearchScreen;
