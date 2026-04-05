import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  RefreshControl,
  TextInput,
  Dimensions,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { FontAwesome5 } from '@expo/vector-icons';
import { getTopRatedContractors, getNearbyTopRatedContractors } from '../api/contractor';
import { getFeedPosts } from '../api/post';
import Header from '../components/common/Header';
import Button from '../components/common/Button';
import Card from '../components/common/Card';
import Avatar from '../components/common/Avatar';
import Typography from '../components/common/Typography';
import { Spacing, Radii, Colors, Shadows } from '../constants/designTokens';
import { SkeletonLoader } from '../components/common/SkeletonLoader';
import { EmptyState } from '../components/common/EmptyState';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const CATEGORIES = [
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
];

const TESTIMONIALS = [
  {
    name: 'Sarah Johnson',
    role: 'Homeowner',
    avatar: 'https://randomuser.me/api/portraits/women/32.jpg',
    rating: 5,
    text: 'Found an amazing electrician through Ratedeed. The reviews were spot on and he did a fantastic job rewiring our home.',
  },
  {
    name: 'Michael Rodriguez',
    role: 'General Contractor',
    avatar: 'https://randomuser.me/api/portraits/men/45.jpg',
    rating: 5,
    text: 'As a contractor, Ratedeed has helped me connect with so many new clients. The platform is easy to use.',
  },
  {
    name: 'Jennifer Lee',
    role: 'Homeowner',
    avatar: 'https://randomuser.me/api/portraits/women/44.jpg',
    rating: 4,
    text: 'Great platform for finding reliable contractors. The verification badge gives me peace of mind.',
  },
];

const HomeScreen = () => {
  const navigation = useNavigation();
  const [zipCode, setZipCode] = useState('');
  const [ipZipCode, setIpZipCode] = useState(null);
  const [featuredContractors, setFeaturedContractors] = useState([]);
  const [feedPosts, setFeedPosts] = useState([]);
  const [loadingFeatured, setLoadingFeatured] = useState(true);
  const [loadingFeed, setLoadingFeed] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchLocationAndData();
  }, []);

  const fetchLocationAndData = async () => {
    try {
      setError(null);
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

  const loadFeaturedContractors = async (zip) => {
    if (!zip) {
      setLoadingFeatured(false);
      return;
    }
    setLoadingFeatured(true);
    try {
      const data = await getTopRatedContractors(zip, 6);
      setFeaturedContractors(data || []);
    } catch (err) {
      console.error('Error fetching featured contractors:', err);
      try {
        const nearbyData = await getNearbyTopRatedContractors(zip);
        setFeaturedContractors(nearbyData || []);
      } catch (nearbyErr) {
        console.error('Error fetching nearby contractors:', nearbyErr);
        setFeaturedContractors([]);
      }
    } finally {
      setLoadingFeatured(false);
    }
  };

  const loadFeedPosts = async () => {
    setLoadingFeed(true);
    try {
      const data = await getFeedPosts(ipZipCode);
      setFeedPosts(data?.posts || []);
    } catch (err) {
      console.error('Error fetching feed posts:', err);
      setFeedPosts([]);
    } finally {
      setLoadingFeed(false);
    }
  };

  useEffect(() => {
    if (ipZipCode) {
      loadFeedPosts();
    }
  }, [ipZipCode]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchLocationAndData();
    await loadFeedPosts();
    setRefreshing(false);
  }, [ipZipCode]);

  const handleSearch = () => {
    const searchZip = zipCode.trim() || ipZipCode;
    navigation.navigate('Main', {
      screen: 'Search',
      params: { query: searchZip, searchType: 'zipCode' },
    });
  };

  const handleCategoryPress = (category) => {
    navigation.navigate('Main', {
      screen: 'Search',
      params: { query: category, searchType: 'category' },
    });
  };

  const handleContractorPress = (contractor) => {
    if (contractor.slug) {
      navigation.navigate('BusinessDetail', { slug: contractor.slug });
    } else {
      navigation.navigate('BusinessDetail', { contractorId: contractor._id });
    }
  };

  const renderStars = (rating, size = 12) => (
    <View style={styles.starsContainer}>
      {[1, 2, 3, 4, 5].map((i) => (
        <FontAwesome5
          key={i}
          name={i <= rating ? 'star' : 'star'}
          solid={i <= rating}
          size={size}
          color={Colors.warning500}
          style={styles.starIcon}
        />
      ))}
    </View>
  );

  const renderFeaturedContractors = () => {
    if (loadingFeatured) {
      return <SkeletonLoader type="card" count={4} />;
    }

    if (featuredContractors.length === 0) {
      return (
        <EmptyState
          title="No contractors found"
          message="Try a different zip code or check back later"
          icon="🔍"
        />
      );
    }

    return (
      <View style={styles.contractorsGrid}>
        {featuredContractors.map((contractor) => (
          <Card key={contractor._id} style={styles.contractorCard}>
            <TouchableOpacity onPress={() => handleContractorPress(contractor)} activeOpacity={0.8}>
              <Image
                source={{ uri: contractor.profilePicture || 'https://via.placeholder.com/200x150' }}
                style={styles.contractorImage}
              />
              <View style={styles.contractorInfo}>
                <View style={styles.nameRow}>
                  <Typography variant="h6" style={styles.contractorName} numberOfLines={1}>
                    {contractor.companyName}
                  </Typography>
                  {contractor.isVerified && (
                    <FontAwesome5 name="check-circle" size={14} color={Colors.success500} />
                  )}
                </View>
                <Typography variant="caption" style={styles.contractorCategory}>
                  {contractor.category || 'General Contractor'}
                </Typography>
                <View style={styles.ratingRow}>
                  {renderStars(Math.round(contractor.averageRating || 0))}
                  <Typography variant="caption" style={styles.ratingText}>
                    {contractor.averageRating?.toFixed(1) || '0.0'} ({contractor.numReviews || 0})
                  </Typography>
                </View>
                {contractor.pricing && (
                  <Typography variant="caption" style={styles.pricing}>
                    {contractor.pricing}
                  </Typography>
                )}
              </View>
            </TouchableOpacity>
          </Card>
        ))}
      </View>
    );
  };

  const renderFeedPosts = () => {
    if (loadingFeed) {
      return <SkeletonLoader type="post" count={2} />;
    }

    if (feedPosts.length === 0) {
      return null;
    }

    return (
      <View style={styles.feedSection}>
        <Typography variant="h5" style={styles.sectionTitle}>
          Community Updates
        </Typography>
        {feedPosts.slice(0, 3).map((post) => (
          <Card key={post._id} style={styles.postCard}>
            <View style={styles.postHeader}>
              <Avatar
                source={{ uri: post.contractor?.user?.profilePicture || 'https://via.placeholder.com/40' }}
                size={40}
              />
              <View style={styles.postHeaderInfo}>
                <Typography variant="body" style={styles.postAuthorName}>
                  {post.contractor?.user?.firstName} {post.contractor?.user?.lastName}
                </Typography>
                <Typography variant="caption" style={styles.postDate}>
                  {new Date(post.createdAt).toLocaleDateString()}
                </Typography>
              </View>
            </View>
            <TextInput
              style={styles.postCaption}
              value={post.caption}
              editable={false}
              multiline
            />
            {post.images?.length > 0 && (
              <ScrollView horizontal style={styles.postImages} showsHorizontalScrollIndicator={false}>
                {post.images.map((img, idx) => (
                  <Image key={idx} source={{ uri: img }} style={styles.postImage} />
                ))}
              </ScrollView>
            )}
            <View style={styles.postStats}>
              <TextInput style={styles.postStat}>❤️ {post.likes?.length || 0}</TextInput>
              <TextInput style={styles.postStat}>💬 {post.comments?.length || 0}</TextInput>
            </View>
          </Card>
        ))}
      </View>
    );
  };

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <FontAwesome5 name="search" size={18} color={Colors.neutral500} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name, zip code..."
            placeholderTextColor={Colors.neutral500}
            value={zipCode}
            onChangeText={setZipCode}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
          />
          {zipCode.length > 0 && (
            <TouchableOpacity onPress={() => setZipCode('')}>
              <FontAwesome5 name="times-circle" size={18} color={Colors.neutral500} />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity style={styles.searchButton} onPress={handleSearch}>
          <FontAwesome5 name="arrow-right" size={20} color={Colors.neutral50} />
        </TouchableOpacity>
      </View>

      <View style={styles.locationBanner}>
        <FontAwesome5 name="map-marker-alt" size={14} color={Colors.primary500} />
        <Typography variant="caption" style={styles.locationText}>
          {ipZipCode ? `Showing contractors near ${ipZipCode}` : 'Detecting location...'}
        </Typography>
      </View>

      <View style={styles.categoriesSection}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoriesContainer}>
          {CATEGORIES.map((category) => (
            <TouchableOpacity
              key={category.name}
              style={styles.categoryItem}
              onPress={() => handleCategoryPress(category.name)}
            >
              <View style={styles.categoryIcon}>
                <FontAwesome5 name={category.icon} size={20} color={Colors.primary500} />
              </View>
              <Typography variant="caption" style={styles.categoryText}>
                {category.name}
              </Typography>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Typography variant="h5">Featured Contractors</Typography>
          <TouchableOpacity onPress={() => navigation.navigate('Main', { screen: 'Search' })}>
            <Typography variant="body" style={styles.viewAllLink}>
              View All
            </Typography>
          </TouchableOpacity>
        </View>
        {renderFeaturedContractors()}
      </View>

      {renderFeedPosts()}

      <View style={styles.howItWorksSection}>
        <Typography variant="h5" style={styles.howItWorksTitle}>
          How Ratedeed Works
        </Typography>
        <View style={styles.stepsContainer}>
          <View style={styles.step}>
            <View style={styles.stepIcon}>
              <FontAwesome5 name="search" size={24} color={Colors.neutral50} />
            </View>
            <Typography variant="body" style={styles.stepTitle}>
              Find Contractors
            </Typography>
            <Typography variant="caption" style={styles.stepText}>
              Search by location, service, or rating
            </Typography>
          </View>
          <View style={styles.stepConnector}>
            <FontAwesome5 name="chevron-right" size={16} color={Colors.primary300} />
          </View>
          <View style={styles.step}>
            <View style={styles.stepIcon}>
              <FontAwesome5 name="star" size={24} color={Colors.neutral50} />
            </View>
            <Typography variant="body" style={styles.stepTitle}>
              Read Reviews
            </Typography>
            <Typography variant="caption" style={styles.stepText}>
              Check detailed ratings from real customers
            </Typography>
          </View>
          <View style={styles.stepConnector}>
            <FontAwesome5 name="chevron-right" size={16} color={Colors.primary300} />
          </View>
          <View style={styles.step}>
            <View style={styles.stepIcon}>
              <FontAwesome5 name="handshake" size={24} color={Colors.neutral50} />
            </View>
            <Typography variant="body" style={styles.stepTitle}>
              Hire with Confidence
            </Typography>
            <Typography variant="caption" style={styles.stepText}>
              Connect directly with verified professionals
            </Typography>
          </View>
        </View>
      </View>

      <View style={styles.contractorCTA}>
        <Typography variant="h5" style={styles.ctaTitle}>
          Are You a Contractor?
        </Typography>
        <Typography variant="body" style={styles.ctaText}>
          Join Ratedeed to showcase your work and grow your business.
        </Typography>
        <Button
          title="Sign Up as Contractor"
          onPress={() => navigation.navigate('ContractorSignup')}
          style={styles.ctaButton}
        />
      </View>

      <View style={styles.testimonialsSection}>
        <Typography variant="h5" style={styles.sectionHeaderTitle}>
          What Our Users Say
        </Typography>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.testimonialsContainer}>
          {TESTIMONIALS.map((testimonial, index) => (
            <Card key={index} style={styles.testimonialCard}>
              {renderStars(testimonial.rating, 14)}
              <Typography variant="body" style={styles.testimonialText}>
                "{testimonial.text}"
              </Typography>
              <View style={styles.testimonialAuthor}>
                <Avatar source={{ uri: testimonial.avatar }} size={40} />
                <View style={styles.testimonialAuthorInfo}>
                  <Typography variant="body" style={styles.testimonialName}>
                    {testimonial.name}
                  </Typography>
                  <Typography variant="caption" style={styles.testimonialRole}>
                    {testimonial.role}
                  </Typography>
                </View>
              </View>
            </Card>
          ))}
        </ScrollView>
      </View>

      <View style={styles.footer}>
        <Typography variant="h5" style={styles.footerTitle}>
          Ready to Find Your Perfect Contractor?
        </Typography>
        <Button
          title="Search Now"
          onPress={() => navigation.navigate('Main', { screen: 'Search' })}
          style={styles.footerButton}
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
  searchContainer: {
    flexDirection: 'row',
    padding: Spacing.lg,
    backgroundColor: Colors.neutral50,
    gap: Spacing.sm,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.neutral100,
    borderRadius: Radii.md,
    paddingHorizontal: Spacing.md,
    height: 48,
  },
  searchIcon: {
    marginRight: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: Colors.neutral900,
  },
  searchButton: {
    backgroundColor: Colors.primary500,
    width: 48,
    height: 48,
    borderRadius: Radii.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  locationBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xs,
    backgroundColor: Colors.primary50,
    gap: Spacing.xs,
  },
  locationText: {
    color: Colors.primary700,
  },
  categoriesSection: {
    paddingVertical: Spacing.md,
    backgroundColor: Colors.neutral50,
    marginBottom: Spacing.md,
  },
  categoriesContainer: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.lg,
  },
  categoryItem: {
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  categoryIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: Colors.primary100,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  categoryText: {
    color: Colors.neutral700,
    fontSize: 11,
    textAlign: 'center',
  },
  section: {
    padding: Spacing.lg,
    backgroundColor: Colors.neutral50,
    marginBottom: Spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  sectionHeaderTitle: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
  },
  viewAllLink: {
    color: Colors.primary500,
    fontWeight: '500',
  },
  contractorsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
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
  },
  contractorName: {
    color: Colors.neutral900,
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  contractorCategory: {
    color: Colors.neutral600,
    fontSize: 11,
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
    marginRight: 1,
  },
  ratingText: {
    color: Colors.neutral600,
    fontSize: 10,
    marginLeft: 4,
  },
  pricing: {
    color: Colors.primary600,
    fontSize: 11,
    fontWeight: '500',
    marginTop: 4,
  },
  feedSection: {
    padding: Spacing.lg,
    backgroundColor: Colors.neutral50,
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    marginBottom: Spacing.md,
  },
  postCard: {
    marginBottom: Spacing.md,
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  postHeaderInfo: {
    marginLeft: Spacing.sm,
  },
  postAuthorName: {
    color: Colors.neutral900,
    fontWeight: '600',
  },
  postDate: {
    color: Colors.neutral500,
  },
  postCaption: {
    color: Colors.neutral800,
    marginBottom: Spacing.sm,
    padding: 0,
  },
  postImages: {
    marginBottom: Spacing.sm,
  },
  postImage: {
    width: 200,
    height: 150,
    borderRadius: Radii.md,
    marginRight: Spacing.sm,
  },
  postStats: {
    flexDirection: 'row',
    gap: Spacing.lg,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.neutral200,
  },
  postStat: {
    color: Colors.neutral600,
    fontSize: 13,
  },
  howItWorksSection: {
    padding: Spacing.xl,
    backgroundColor: Colors.primary500,
    marginBottom: Spacing.md,
  },
  howItWorksTitle: {
    color: Colors.neutral50,
    textAlign: 'center',
    marginBottom: Spacing.xl,
  },
  stepsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  step: {
    alignItems: 'center',
    width: 100,
  },
  stepIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.primary600,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  stepTitle: {
    color: Colors.neutral50,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 2,
  },
  stepText: {
    color: Colors.primary100,
    textAlign: 'center',
    fontSize: 10,
  },
  stepConnector: {
    paddingHorizontal: Spacing.sm,
  },
  contractorCTA: {
    padding: Spacing.xl,
    backgroundColor: Colors.neutral50,
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  ctaTitle: {
    color: Colors.neutral900,
    marginBottom: Spacing.sm,
  },
  ctaText: {
    color: Colors.neutral600,
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },
  ctaButton: {},
  testimonialsSection: {
    paddingVertical: Spacing.lg,
    backgroundColor: Colors.neutral50,
    marginBottom: Spacing.md,
  },
  testimonialsContainer: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.md,
  },
  testimonialCard: {
    width: 280,
    marginRight: Spacing.md,
  },
  testimonialText: {
    color: Colors.neutral700,
    marginVertical: Spacing.md,
    fontStyle: 'italic',
  },
  testimonialAuthor: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  testimonialAuthorInfo: {
    marginLeft: Spacing.sm,
  },
  testimonialName: {
    color: Colors.neutral900,
    fontWeight: '600',
  },
  testimonialRole: {
    color: Colors.neutral500,
  },
  footer: {
    padding: Spacing.xl,
    backgroundColor: Colors.primary500,
    alignItems: 'center',
  },
  footerTitle: {
    color: Colors.neutral50,
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },
  footerButton: {
    backgroundColor: Colors.neutral50,
  },
});

export default HomeScreen;
