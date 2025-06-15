import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Image, ActivityIndicator, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { FontAwesome5 } from '@expo/vector-icons';
import { fetchFeaturedContractors, fetchContractorPosts } from '../api/contractor';
import Header from '../components/common/Header';
import Button from '../components/common/Button';
import Input from '../components/common/Input';
import Card from '../components/common/Card';
import Avatar from '../components/common/Avatar';
import Typography from '../components/common/Typography';
import { Spacing, Radii, Colors, Shadows } from '../constants/designTokens';

const HomeScreen = () => {
  const navigation = useNavigation();
  const [zipCode, setZipCode] = useState('');
  const [featuredContractors, setFeaturedContractors] = useState([]);
  const [feedPosts, setFeedPosts] = useState([]);
  const [loadingFeatured, setLoadingFeatured] = useState(true);
  const [loadingFeed, setLoadingFeed] = useState(true);

  useEffect(() => {
    loadFeaturedContractors();
    loadFeedPosts();
  }, []);

  const loadFeaturedContractors = async () => {
    try {
      const data = await fetchFeaturedContractors();
      console.log("Fetched featured contractors:", data); // Add this line
      setFeaturedContractors(data);
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to load featured contractors.');
      console.error('Error fetching featured contractors:', error);
    } finally {
      setLoadingFeatured(false);
    }
  };

  const loadFeedPosts = async () => {
    try {
      // Assuming a general endpoint for feed posts, or fetch posts from featured contractors
      // For simplicity, let's assume a general feed endpoint or aggregate from contractors
      const data = await fetchContractorPosts('all'); // You might need a specific API for a general feed
      setFeedPosts(data);
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to load feed posts.');
      console.error('Error fetching feed posts:', error);
    } finally {
      setLoadingFeed(false);
    }
  };

  const handleSearchByZipCode = () => {
    if (zipCode) {
      navigation.navigate('Main', { screen: 'Search', params: { query: zipCode, searchType: 'zipCode' } });
    } else {
      Alert.alert('Error', 'Please enter a zip code to search.');
    }
  };

  const handleCategoryPress = (category) => {
    navigation.navigate('Main', { screen: 'Search', params: { query: category, searchType: 'category' } });
  };

  const renderStarRating = (rating) => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <FontAwesome5
          key={i}
          name={rating >= i ? 'star' : (rating >= i - 0.5 ? 'star-half-alt' : 'star')}
          solid={rating >= i || rating >= i - 0.5}
          size={16}
          color={rating >= i ? Colors.warning : (rating >= i - 0.5 ? Colors.warning : Colors.neutral400)}
          style={styles.starIcon}
        />
      );
    }
    return <View style={styles.starRatingContainer}>{stars}</View>;
  };

  return (
    <ScrollView style={styles.container}>
      <Header title="Ratedeed" />

      {/* Search Bar - Airbnb style */}
      <View style={styles.searchBarWrapper}>
        <TouchableOpacity style={styles.searchBar} onPress={() => navigation.navigate('Main', { screen: 'Search' })}>
          <FontAwesome5 name="search" size={Spacing.md} color={Colors.neutral700} style={styles.searchIcon} />
          <View>
            <Typography variant="h6" style={styles.searchBarText}>Where are you looking?</Typography>
            <Typography variant="caption" style={styles.searchBarSubText}>Anywhere • Any Category</Typography>
          </View>
        </TouchableOpacity>
      </View>

      {/* Categories - Horizontal Scroll */}
      <View style={styles.categoriesSection}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoriesScrollContainer}>
          {[
            { name: 'Home Builders', icon: 'home' },
            { name: 'Plumbers', icon: 'bath' },
            { name: 'Electricians', icon: 'bolt' },
            { name: 'Painters', icon: 'paint-roller' },
            { name: 'Landscapers', icon: 'tree' },
            { name: 'Handymen', icon: 'tools' },
            { name: 'Roofers', icon: 'house-damage' },
            { name: 'HVAC', icon: 'fan' },
            { name: 'Carpenters', icon: 'hammer' },
            { name: 'Cleaners', icon: 'broom' },
          ].map((category, index) => (
            <TouchableOpacity key={index} style={styles.categoryItem} onPress={() => handleCategoryPress(category.name)}>
              <FontAwesome5 name={category.icon} size={Spacing.xl} color={Colors.primary500} />
              <Typography variant="caption" style={styles.categoryItemText}>{category.name}</Typography>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Featured Contractors - Grid Layout */}
      <View style={styles.section}>
        <Typography variant="h4" style={styles.sectionTitle}>Featured Contractors</Typography>
        {loadingFeatured ? (
          <ActivityIndicator size="large" color={Colors.primary500} style={styles.loadingIndicator} />
        ) : (
          <View style={styles.featuredContractorsGrid}>
            {featuredContractors.map(contractor => (
              <Card key={contractor._id} style={styles.contractorGridCard}>
                <TouchableOpacity
                  onPress={() => navigation.navigate('BusinessDetail', { id: contractor._id })}
                >
                  <Image source={{ uri: contractor.imageUrl || 'https://via.placeholder.com/150' }} style={styles.contractorGridImage} />
                  <View style={styles.contractorGridInfo}>
                    <Typography variant="h6" style={styles.contractorGridName}>{contractor.companyName}</Typography>
                    <Typography variant="subtitle2" style={styles.contractorGridCategory}>{contractor.category}</Typography>
                    <View style={styles.ratingContainer}>
                      {renderStarRating(contractor.averageRating)}
                      <Typography variant="caption" style={styles.ratingText}>
                        {contractor.averageRating != null ? contractor.averageRating.toFixed(1) : 'N/A'} ({contractor.numReviews})
                      </Typography>
                    </View>
                    {contractor.isVerified && (
                      <View style={styles.verifiedBadge}>
                        <Typography variant="caption" style={styles.badgeText}>LICENSE VERIFIED</Typography>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              </Card>
            ))}
          </View>
        )}
        <Button
          title="View All Featured Contractors"
          onPress={() => navigation.navigate('Main', { screen: 'Search', params: { searchType: 'featured' } })}
          style={styles.viewAllButton}
        />
      </View>

      {/* How It Works Section */}
      <View style={[styles.section, styles.howItWorksSection]}>
        <Typography variant="h3" style={styles.howItWorksTitle}>How Ratedeed Works</Typography>
        <View style={styles.howItWorksGrid}>
          <View style={styles.howItWorksItem}>
            <FontAwesome5 name="search" size={Spacing.xl} color={Colors.neutral50} style={styles.howItWorksIcon} />
            <Typography variant="h6" style={styles.howItWorksItemTitle}>Find Contractors</Typography>
            <Typography variant="caption" style={styles.howItWorksItemText}>Search by location, service type, or rating.</Typography>
          </View>
          <View style={styles.howItWorksItem}>
            <FontAwesome5 name="star" size={Spacing.xl} color={Colors.neutral50} style={styles.howItWorksIcon} />
            <Typography variant="h6" style={styles.howItWorksItemTitle}>Read Reviews</Typography>
            <Typography variant="caption" style={styles.howItWorksItemText}>Check detailed ratings and reviews.</Typography>
          </View>
          <View style={styles.howItWorksItem}>
            <FontAwesome5 name="handshake" size={Spacing.xl} color={Colors.neutral50} style={styles.howItWorksIcon} />
            <Typography variant="h6" style={styles.howItWorksItemTitle}>Hire with Confidence</Typography>
            <Typography variant="caption" style={styles.howItWorksItemText}>Connect directly with professionals.</Typography>
          </View>
        </View>
      </View>

      {/* For Contractors Section */}
      <View style={styles.section}>
        <Typography variant="h4" style={styles.sectionTitle}>Are You a Contractor?</Typography>
        <Typography variant="body" style={styles.contractorText}>Join Ratedeed to showcase your work and grow your business.</Typography>
        <Button
          title="Sign Up as Contractor"
          onPress={() => navigation.navigate('ContractorSignup')}
          style={styles.contractorButton}
        />
      </View>

      {/* Testimonials Section */}
      <View style={styles.section}>
        <Typography variant="h4" style={styles.sectionTitle}>What Our Users Say</Typography>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.testimonialsContainer}>
          <Card style={styles.testimonialCard}>
            {renderStarRating(5)}
            <Typography variant="body" style={styles.testimonialText}>"Found an amazing electrician through Ratedeed. The reviews were spot on and he did a fantastic job rewiring our home."</Typography>
            <View style={styles.testimonialAuthor}>
              <Avatar source={{ uri: 'https://randomuser.me/api/portraits/women/32.jpg' }} size={Spacing.xxl} />
              <View>
                <Typography variant="h6" style={styles.testimonialName}>Sarah Johnson</Typography>
                <Typography variant="caption" style={styles.testimonialRole}>Homeowner</Typography>
              </View>
            </View>
          </Card>
          <Card style={styles.testimonialCard}>
            {renderStarRating(4.5)}
            <Typography variant="body" style={styles.testimonialText}>"As a contractor, Ratedeed has helped me connect with so many new clients. The platform is easy to use and the verification badge gives me credibility."</Typography>
            <View style={styles.testimonialAuthor}>
              <Avatar source={{ uri: 'https://randomuser.me/api/portraits/men/45.jpg' }} size={Spacing.xxl} />
              <View>
                <Typography variant="h6" style={styles.testimonialName}>Michael Rodriguez</Typography>
                <Typography variant="caption" style={styles.testimonialRole}>General Contractor</Typography>
              </View>
            </View>
          </Card>
        </ScrollView>
      </View>

      {/* CTA Section */}
      <View style={[styles.section, styles.ctaSection]}>
        <Typography variant="h3" style={styles.ctaTitle}>Ready to Find Your Perfect Contractor?</Typography>
        <Typography variant="subtitle1" style={styles.ctaSubtitle}>Join thousands of satisfied customers who found reliable professionals through Ratedeed.</Typography>
        <Button
          title="Search Contractors"
          onPress={() => navigation.navigate('Main', { screen: 'Search' })}
          style={styles.ctaButton}
          textStyle={{ color: Colors.primary500 }} // Override button text color for this specific button
        />
      </View>

    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.neutral100,
  },
  searchBarWrapper: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.neutral50,
    ...Shadows.sm,
    marginBottom: Spacing.md,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.neutral100,
    borderRadius: Radii.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    ...Shadows.xs,
  },
  searchIcon: {
    marginRight: Spacing.sm,
  },
  searchBarText: {
    color: Colors.neutral800,
  },
  searchBarSubText: {
    color: Colors.neutral600,
    marginTop: Spacing.xxs,
  },
  categoriesSection: {
    paddingVertical: Spacing.md,
    backgroundColor: Colors.neutral50,
    ...Shadows.sm,
    marginBottom: Spacing.md,
  },
  categoriesScrollContainer: {
    paddingHorizontal: Spacing.lg,
  },
  categoryItem: {
    alignItems: 'center',
    marginRight: Spacing.xl,
  },
  categoryItemText: {
    color: Colors.neutral700,
    marginTop: Spacing.xs,
  },
  section: {
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.lg,
    backgroundColor: Colors.neutral50,
    marginTop: Spacing.md,
    borderRadius: Radii.lg,
    marginHorizontal: Spacing.md,
    ...Shadows.md,
  },
  sectionTitle: {
    color: Colors.neutral900,
    marginBottom: Spacing.lg,
  },
  loadingIndicator: {
    marginTop: Spacing.lg,
  },
  featuredContractorsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  contractorGridCard: {
    width: '48%', // Adjust for spacing
    marginBottom: Spacing.lg,
    padding: 0, // Card component already has padding, reset for image to fill
    overflow: 'hidden', // Ensure image corners are rounded
  },
  contractorGridImage: {
    width: '100%',
    height: 150,
    resizeMode: 'cover',
    borderTopLeftRadius: Radii.md,
    borderTopRightRadius: Radii.md,
  },
  contractorGridInfo: {
    padding: Spacing.md,
  },
  contractorGridName: {
    color: Colors.neutral900,
    marginBottom: Spacing.xxs,
  },
  contractorGridCategory: {
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
  verifiedBadge: {
    backgroundColor: Colors.success,
    paddingVertical: Spacing.xxs,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radii.sm,
    alignSelf: 'flex-start',
    marginTop: Spacing.sm,
  },
  badgeText: {
    fontSize: 11, // Keep small for badge
    fontWeight: '700',
    color: Colors.neutral50,
  },
  viewAllButton: {
    marginTop: Spacing.lg,
  },
  howItWorksSection: {
    backgroundColor: Colors.primary500,
    shadowColor: Colors.opacity20,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 10,
  },
  howItWorksTitle: {
    color: Colors.neutral50,
    textAlign: 'center',
    marginBottom: Spacing.xl,
  },
  howItWorksGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
  },
  howItWorksItem: {
    width: '30%',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  howItWorksIcon: {
    marginBottom: Spacing.sm,
  },
  howItWorksItemTitle: {
    color: Colors.neutral50,
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },
  howItWorksItemText: {
    color: Colors.primary100,
    textAlign: 'center',
  },
  contractorText: {
    color: Colors.neutral700,
    marginBottom: Spacing.lg,
    textAlign: 'center',
  },
  contractorButton: {
    alignSelf: 'center',
  },
  testimonialsContainer: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xs,
  },
  testimonialCard: {
    marginRight: Spacing.md,
    width: 320,
    padding: Spacing.lg,
  },
  testimonialText: {
    color: Colors.neutral700,
    marginBottom: Spacing.md,
  },
  testimonialAuthor: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  testimonialAvatar: {
    marginRight: Spacing.md,
    borderWidth: 2,
    borderColor: Colors.neutral200,
  },
  testimonialName: {
    color: Colors.neutral900,
  },
  testimonialRole: {
    color: Colors.neutral600,
    marginTop: Spacing.xxs,
  },
  ctaSection: {
    backgroundColor: Colors.primary500,
    shadowColor: Colors.opacity20,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 10,
  },
  ctaTitle: {
    color: Colors.neutral50,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  ctaSubtitle: {
    color: Colors.primary100,
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },
  ctaButton: {
    backgroundColor: Colors.neutral50,
  },
});

export default HomeScreen;