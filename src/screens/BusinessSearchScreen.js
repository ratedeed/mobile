import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Image, ActivityIndicator, Alert } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { FontAwesome5 } from '@expo/vector-icons';
import { searchContractors } from '../api/contractor';
import Header from '../components/common/Header';
import Input from '../components/common/Input';
import Card from '../components/common/Card';
import Typography from '../components/common/Typography';
import { Spacing, Radii, Colors, Shadows } from '../constants/designTokens';

const BusinessSearchScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { query, searchType } = route.params || {}; // query can be zipCode or category
  
  const [searchQuery, setSearchQuery] = useState(query || '');
  const [selectedCategory, setSelectedCategory] = useState(searchType === 'category' ? query : '');
  const [contractors, setContractors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [numResults, setNumResults] = useState(0);

  useEffect(() => {
    const initialLoad = async () => {
      setLoading(true);
      try {
        let initialFilters = {};
        if (query) {
          if (searchType === 'zipCode') {
            initialFilters.zip = query;
          } else if (searchType === 'category') {
            initialFilters.type = query;
          } else {
            initialFilters.name = query;
          }
        }
        // Only perform search if there are actual filters
        if (Object.keys(initialFilters).length > 0) {
          const data = await searchContractors(initialFilters);
          setContractors(data);
          setNumResults(data.length);
        } else {
          // If no initial query, display no results initially or a message
          setContractors([]);
          setNumResults(0);
        }
      } catch (error) {
        // Check if the error is due to "No contractors found"
        if (error.message && error.message.includes("No contractors found for the given criteria")) {
          setContractors([]);
          setNumResults(0);
          console.warn('No contractors found for the given criteria, displaying empty results.');
        } else {
          Alert.alert('Error', error.message || 'Failed to load contractors.');
          console.error('Error fetching contractors:', error);
        }
      } finally {
        setLoading(false);
      }
    };
    initialLoad();
  }, [query, searchType]);

  useEffect(() => {
    performSearch();
  }, [searchQuery, selectedCategory]);

  const performSearch = async () => {
    setLoading(true);
    try {
      const filters = {};
      if (searchQuery) {
        // Determine if the search query is a zip code (5 digits)
        const isZipCode = /^\d{5}$/.test(searchQuery);
        if (isZipCode) {
          filters.zip = searchQuery;
        } else {
          // Otherwise, assume it's a name search
          filters.name = searchQuery;
        }
      }
      if (selectedCategory) {
        // If a category is selected, apply it
        filters.type = selectedCategory;
      }
      // Only perform search if there are actual filters
      if (Object.keys(filters).length > 0) {
        const data = await searchContractors(filters);
        setContractors(data);
        setNumResults(data.length);
      } else {
        // If no search query or category, display no results
        setContractors([]);
        setNumResults(0);
      }
    } catch (error) {
      // Check if the error is due to "No contractors found"
      if (error.message && error.message.includes("No contractors found for the given criteria")) {
        setContractors([]);
        setNumResults(0);
        console.warn('No contractors found for the given criteria, displaying empty results.');
      } else {
        Alert.alert('Error', error.message || 'Failed to load contractors.');
        console.error('Error fetching contractors:', error);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCategoryFilter = (category) => {
    setSelectedCategory(category);
    setSearchQuery(''); // Clear general search query when category is selected
  };

  const renderStarRating = (rating) => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <FontAwesome5
          key={i}
          name={rating >= i ? 'star' : (rating >= i - 0.5 ? 'star-half-alt' : 'star')}
          solid={rating >= i || rating >= i - 0.5}
          size={Spacing.md}
          color={Colors.warning}
          style={styles.starIcon}
        />
      );
    }
    return <View style={styles.starRatingContainer}>{stars}</View>;
  };

  return (
    <View style={styles.fullScreenContainer}>
      <Header title="Search Contractors" showBackButton={true} />
      <View style={styles.searchHeader}>
        <Input
          style={styles.searchInput}
          placeholder="Search contractors by name, category, or zip code"
          placeholderTextColor={Colors.neutral500}
          value={searchQuery}
          onChangeText={(text) => {
            setSearchQuery(text);
            setSelectedCategory(''); // Clear selected category when typing in general search
          }}
          onSubmitEditing={performSearch}
        />
        <TouchableOpacity style={styles.searchButton} onPress={performSearch}>
          <FontAwesome5 name="search" size={Spacing.lg} color={Colors.neutral50} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.container}>
        <View style={styles.mainContent}>
          <Typography variant="h4" style={styles.resultsTitle}>Contractors in <Typography variant="h4" style={styles.highlightText}>{searchQuery || 'Your Area'}</Typography></Typography>
          
          <View style={styles.filterSection}>
            <Typography variant="h5" style={styles.filterTitle}>Browse Contractor Categories</Typography>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryButtonsContainer}>
              <TouchableOpacity
                key="all-contractors"
                style={[styles.categoryButton, selectedCategory === '' && styles.categoryButtonActive]}
                onPress={() => handleCategoryFilter('')}
              >
                <Typography variant="body" style={[styles.categoryButtonText, selectedCategory === '' && styles.categoryButtonTextActive]}>All Contractors</Typography>
              </TouchableOpacity>
              {[
                'Home Builders', 'Plumbers', 'Electricians', 'Painters', 'Landscapers',
                'Handymen', 'Roofers', 'HVAC', 'Carpenters', 'Cleaners'
              ].map((category) => (
                <TouchableOpacity
                  key={category}
                  style={[styles.categoryButton, selectedCategory === category && styles.categoryButtonActive]}
                  onPress={() => handleCategoryFilter(category)}
                >
                  <Typography variant="body" style={[styles.categoryButtonText, selectedCategory === category && styles.categoryButtonTextActive]}>{category}</Typography>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <Typography variant="caption" style={styles.numResultsText}>{numResults} contractors found</Typography>

          {loading ? (
            <ActivityIndicator size="large" color={Colors.primary500} style={styles.loadingIndicator} />
          ) : (
            <View style={styles.contractorListings}>
              {contractors.length > 0 ? (
                contractors.map(contractor => (
                  <Card key={contractor._id} style={styles.contractorCard}>
                    <TouchableOpacity
                      onPress={() => {
                        if (contractor._id) {
                          navigation.navigate('BusinessDetail', { id: contractor._id });
                        } else {
                          Alert.alert('Error', 'Contractor ID is missing. Cannot view details.');
                        }
                      }}
                    >
                      <Image source={{ uri: contractor.licenseDocumentUrl || 'https://via.placeholder.com/150' }} style={styles.contractorImage} />
                      <View style={styles.contractorInfo}>
                        <Typography variant="h6" style={styles.contractorName}>{contractor.companyName}</Typography>
                        <Typography variant="subtitle2" style={styles.contractorCategory}>{contractor.category}</Typography>
                        <View style={styles.ratingContainer}>
                          {renderStarRating(contractor.averageRating)}
                          <Typography variant="caption" style={styles.ratingText}>
                            {contractor.averageRating != null ? contractor.averageRating.toFixed(1) : 'N/A'} ({contractor.numReviews})
                          </Typography>
                        </View>
                        <View style={styles.badgeContainer}>
                          {contractor.isVerified && (
                            <View style={styles.verifiedBadge}>
                              <Typography variant="caption" style={styles.badgeText}>LICENSE VERIFIED</Typography>
                            </View>
                          )}
                          {contractor.isPremium && (
                            <View style={styles.premiumBadge}>
                              <Typography variant="caption" style={styles.badgeText}>PREMIUM</Typography>
                            </View>
                          )}
                        </View>
                      </View>
                    </TouchableOpacity>
                  </Card>
                ))
              ) : (
                <Typography variant="body" style={styles.noResultsText}>No contractors found for your search criteria.</Typography>
              )}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  fullScreenContainer: {
    flex: 1,
    backgroundColor: Colors.neutral100,
  },
  container: {
    flex: 1,
    backgroundColor: Colors.neutral100,
  },
  searchHeader: {
    flexDirection: 'row',
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.lg,
    paddingRight: Spacing.lg,
    paddingLeft: Spacing.md, // Adjusted to move content slightly to the left
    backgroundColor: Colors.neutral50,
    alignItems: 'center',
    ...Shadows.sm,
    marginBottom: Spacing.md,
  },
  searchInput: {
    flex: 1,
    marginRight: Spacing.sm,
    height: 60, // Further increase height for a bigger search bar
  },
  searchButton: {
    backgroundColor: Colors.primary500,
    padding: Spacing.md, // Adjust padding to make it a square and ensure icon visibility
    borderRadius: Radii.md,
    justifyContent: 'center',
    alignItems: 'center',
    height: 60, // Make button height consistent with input height
    width: 60, // Make button a square
    ...Shadows.xs, // Consistent with Input component for a professional look
  },
  mainContent: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  resultsTitle: {
    color: Colors.neutral900,
    marginBottom: Spacing.md,
  },
  highlightText: {
    color: Colors.primary500,
  },
  filterSection: {
    marginBottom: Spacing.md,
  },
  filterTitle: {
    color: Colors.neutral900,
    marginBottom: Spacing.sm,
  },
  categoryButtonsContainer: {
    flexDirection: 'row',
    paddingVertical: Spacing.xs,
  },
  categoryButton: {
    backgroundColor: Colors.neutral200,
    padding: 18, // Custom padding to perfectly center the Spacing.lg icon in a 60x60 button
    borderRadius: Radii.xl,
    marginRight: Spacing.sm,
    ...Shadows.xs,
  },
  categoryButtonActive: {
    backgroundColor: Colors.primary500,
  },
  categoryButtonText: {
    color: Colors.neutral700,
  },
  categoryButtonTextActive: {
    color: Colors.neutral50,
  },
  numResultsText: {
    color: Colors.neutral600,
    marginBottom: Spacing.lg,
    textAlign: 'right',
  },
  loadingIndicator: {
    marginTop: Spacing.xxl,
  },
  contractorListings: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  contractorCard: {
    marginBottom: Spacing.md,
    width: '48%',
    padding: 0,
    overflow: 'hidden',
  },
  contractorImage: {
    width: '100%',
    height: 130,
    resizeMode: 'cover',
    borderTopLeftRadius: Radii.md,
    borderTopRightRadius: Radii.md,
  },
  contractorInfo: {
    padding: Spacing.md,
  },
  contractorName: {
    color: Colors.neutral900,
    marginBottom: Spacing.xxs,
  },
  contractorCategory: {
    color: Colors.neutral600,
    marginBottom: Spacing.xs,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  starRatingContainer: {
    flexDirection: 'row',
  },
  starIcon: {
    marginRight: Spacing.xxs,
  },
  ratingText: {
    color: Colors.neutral700,
    marginLeft: Spacing.xs,
  },
  badgeContainer: {
    flexDirection: 'row',
    marginTop: Spacing.xs,
  },
  verifiedBadge: {
    backgroundColor: Colors.success,
    paddingVertical: Spacing.xxs,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radii.xl,
    marginRight: Spacing.xs,
  },
  premiumBadge: {
    backgroundColor: Colors.warning,
    paddingVertical: Spacing.xxs,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radii.xl,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.neutral50,
  },
  noResultsText: {
    textAlign: 'center',
    color: Colors.neutral600,
    marginTop: Spacing.xxl,
    width: '100%',
  },
});

export default BusinessSearchScreen;