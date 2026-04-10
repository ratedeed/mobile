import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Share,
  Linking,
  Platform,
  StyleSheet,
  Text,
  Dimensions,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { FontAwesome5 } from '@expo/vector-icons';
import { fetchContractorDetails, submitReview, fetchContractorPosts, createLead } from '../api';
import { fetchContractorReviews } from '../api/review';
import { Tabs, TabPanel } from '../components/common/Tabs';
import { Modal } from '../components/common/Modal';
import Input from '../components/common/Input';
import Button from '../components/common/Button';
import Header from '../components/common/Header';
import Card from '../components/common/Card';
import Avatar from '../components/common/Avatar';
import Typography from '../components/common/Typography';
import ReportButton from '../components/ReportButton';
import { Contractor, Post, Review } from '../types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const TABS = [
  { key: 'about', label: 'About' },
  { key: 'services', label: 'Services' },
  { key: 'portfolio', label: 'Portfolio' },
  { key: 'posts', label: 'Posts' },
  { key: 'reviews', label: 'Reviews' },
];

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'BusinessDetail'>;

const BusinessDetailScreen: React.FC = () => {
  const route = useRoute();
  const navigation = useNavigation<NavigationProp>();
  const { id } = route.params as { id: string };
  const [contractor, setContractor] = useState<Contractor | null>(null);
  const [contractorPosts, setContractorPosts] = useState<Post[]>([]);
  const [contractorReviews, setContractorReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('about');
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewTitle, setReviewTitle] = useState('');
  const [reviewComment, setReviewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [isQuoteModalVisible, setIsQuoteModalVisible] = useState(false);
  const [quoteProjectTitle, setQuoteProjectTitle] = useState('');
  const [quoteDescription, setQuoteDescription] = useState('');
  const [quoteContactPreference, setQuoteContactPreference] = useState('email');
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    if (id) {
      loadContractorDetails();
    } else {
      Alert.alert('Error', 'No contractor ID provided');
      setLoading(false);
    }
  }, [id]);

  const loadContractorDetails = async () => {
    try {
      setLoading(true);
      const data = await fetchContractorDetails(id);
      setContractor(data);

      // Load posts and reviews in parallel
      const [postsData, reviewsData] = await Promise.all([
        fetchContractorPosts(id),
        fetchContractorReviews(id),
      ]);
      setContractorPosts(postsData?.posts || []);
      setContractorReviews(reviewsData || []);
    } catch (error) {
      console.error('Error loading contractor details:', error);
      Alert.alert('Error', 'Failed to load contractor details');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadContractorDetails().finally(() => setRefreshing(false));
  }, [id]);

  const handleCall = () => {
    const phone = contractor?.contactInfo?.phoneNumber;
    if (phone) Linking.openURL(`tel:${phone}`);
    else Alert.alert('Notice', 'Phone number not available');
  };

  const handleDirections = () => {
    const address = [contractor?.contactInfo?.address, contractor?.contactInfo?.city, contractor?.contactInfo?.state, contractor?.contactInfo?.zipCode].filter(Boolean).join(', ');
    if (address) {
      const url = Platform.select({
        ios: `maps:0,0?q=${encodeURIComponent(address)}`,
        android: `geo:0,0?q=${encodeURIComponent(address)}`
      });
      Linking.openURL(url as string);
    } else {
      Alert.alert('Notice', 'Address not available');
    }
  };

  const handleWebsite = () => {
    const website = contractor?.contact?.website;
    if (website) {
      const url = website.startsWith('http') ? website : `https://${website}`;
      Linking.openURL(url);
    } else {
      Alert.alert('Notice', 'Website not available');
    }
  };

  const handleShare = async () => {
    try {
      const result = await Share.share({
        message: `Check out ${contractor?.companyName} on RateDeed!`,
        title: contractor?.companyName,
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const handleRequestQuote = async () => {
    if (!quoteProjectTitle.trim() || !quoteDescription.trim()) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    try {
      await createLead({
        contractorId: id,
        projectTitle: quoteProjectTitle,
        description: quoteDescription,
        contactPreference: quoteContactPreference,
      });
      Alert.alert('Success', 'Quote request sent successfully!');
      setIsQuoteModalVisible(false);
      setQuoteProjectTitle('');
      setQuoteDescription('');
    } catch (error) {
      console.error('Error requesting quote:', error);
      Alert.alert('Error', 'Failed to send quote request');
    }
  };

  const handleReviewSubmit = async () => {
    if (reviewRating === 0) {
      Alert.alert('Error', 'Please select a rating');
      return;
    }
    if (!reviewComment.trim()) {
      Alert.alert('Error', 'Please write a review');
      return;
    }

    setSubmittingReview(true);
    try {
      await submitReview(id, {
        rating: reviewRating,
        title: reviewTitle,
        comment: reviewComment,
      });
      Alert.alert('Success', 'Review submitted successfully!');
      setReviewRating(0);
      setReviewTitle('');
      setReviewComment('');
      // Reload reviews
      const reviewsData = await fetchContractorReviews(id);
      setContractorReviews(reviewsData || []);
    } catch (error) {
      console.error('Error submitting review:', error);
      Alert.alert('Error', 'Failed to submit review');
    } finally {
      setSubmittingReview(false);
    }
  };

  const getAssetUrl = (filename: string | undefined, fallback: string = 'https://via.placeholder.com/150'): string => {
    if (!filename) return fallback;
    if (filename.startsWith('http')) return filename;
    return `${filename}`;
  };

  const getUserProfilePictureUrl = (profilePicture: string | undefined, fullName: string): string => {
    if (profilePicture) {
      return profilePicture.startsWith('http') ? profilePicture : profilePicture;
    }
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&background=random`;
  };

  const renderStarRating = (rating: number, size: number = 12) => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <FontAwesome5
          key={i}
          name="star"
          solid={rating >= i}
          size={size}
          color={rating >= i ? "#f59e0b" : "#d4d4d8"}
          style={styles.starIcon}
        />
      );
    }
    return <View style={styles.starsContainer}>{stars}</View>;
  };

  const renderHeader = () => (
    <View style={styles.headerSection}>
      {/* Floating Action Buttons */}
      <View style={styles.floatingActions}>
        <TouchableOpacity style={styles.floatingButton} onPress={() => navigation.goBack()}>
          <FontAwesome5 name="chevron-left" size={20} color="#374151" />
        </TouchableOpacity>
        <View style={styles.floatingActionsRight}>
          <TouchableOpacity 
            style={styles.floatingButton}
            onPress={() => navigation.navigate('ChatScreen', {
              recipientId: contractor?.user?._id,
              recipientName: contractor?.companyName,
            })}
          >
            <FontAwesome5 name="comment" size={16} color="#374151" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.floatingButton} onPress={handleShare}>
            <FontAwesome5 name="share" size={16} color="#374151" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.floatingButton} onPress={() => setIsSaved(!isSaved)}>
            <FontAwesome5 name="heart" size={16} color={isSaved ? "#f43f5e" : "#374151"} solid={isSaved} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Hero Banner Image */}
      <View style={styles.heroBanner}>
        <Image
          source={{ uri: getAssetUrl(contractor?.bannerImage, 'https://via.placeholder.com/600x337?text=No+Banner') }}
          style={styles.heroImage}
          resizeMode="cover"
        />
      </View>

      {/* Content */}
      <View style={styles.contentContainer}>
        {/* Company Info */}
        <View style={styles.companyInfo}>
          <Text style={styles.companyName}>{contractor?.companyName}</Text>
          <View style={styles.ratingRow}>
            {renderStarRating(contractor?.averageRating || 0, 14)}
            <Text style={styles.ratingText}>
              {contractor?.averageRating?.toFixed(2) || 'N/A'} ({contractor?.numReviews || 0} reviews)
            </Text>
          </View>
          {contractor?.isVerified && (
            <View style={styles.verifiedBadge}>
              <FontAwesome5 name="shield-alt" size={10} color="#4F46E5" />
              <Text style={styles.verifiedBadgeText}>License Verified</Text>
            </View>
          )}
        </View>

        {/* Location & Distance */}
        <View style={styles.locationRow}>
          <FontAwesome5 name="map-marker-alt" size={14} color="#6b7280" />
          <Text style={styles.locationText}>
            {contractor?.contactInfo?.city}, {contractor?.contactInfo?.state}
          </Text>
          <Text style={styles.locationDivider}>·</Text>
          <Text style={styles.locationText}>{contractor?.category || 'General Contractor'}</Text>
        </View>

        {/* Stats Section */}
        <View style={styles.statsSection}>
          <View style={styles.statItem}>
            <FontAwesome5 name="award" size={20} color="#111827" />
            <Text style={styles.statValue}>{contractor?.yearsInBusiness || contractor?.numReviews || 'N/A'}</Text>
            <Text style={styles.statLabel}>Years Exp.</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <FontAwesome5 name="star" size={20} color="#111827" />
            <Text style={styles.statValue}>{contractor?.numReviews || 0}</Text>
            <Text style={styles.statLabel}>Reviews</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <FontAwesome5 name="clock" size={20} color="#111827" />
            <Text style={styles.statValue}>{contractor?.businessHours ? 'Available' : 'N/A'}</Text>
            <Text style={styles.statLabel}>Response</Text>
          </View>
        </View>
      </View>
    </View>
  );

  const renderAboutSection = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>About Us</Text>
      <Text style={styles.aboutText}>{contractor?.description || 'No description available.'}</Text>
      
      <View style={styles.infoList}>
        {contractor?.licenseNumber && (
          <View style={styles.infoRow}>
            <FontAwesome5 name="shield-alt" size={16} color="#059669" />
            <Text style={styles.infoText}><Text style={styles.infoLabel}>License:</Text> {contractor.licenseNumber}</Text>
          </View>
        )}
        {contractor?.pricing && (
          <View style={styles.infoRow}>
            <FontAwesome5 name="dollar-sign" size={16} color="#059669" />
            <Text style={styles.infoText}><Text style={styles.infoLabel}>Pricing:</Text> {contractor.pricing}</Text>
          </View>
        )}
        {contractor?.contactInfo?.address && (
          <View style={styles.infoRow}>
            <FontAwesome5 name="map-marker-alt" size={16} color="#059669" />
            <Text style={styles.infoText}><Text style={styles.infoLabel}>Service Area:</Text> {contractor.contactInfo.city}, {contractor.contactInfo.state}</Text>
          </View>
        )}
      </View>
    </View>
  );

  const renderServicesSection = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Services</Text>
      {contractor?.servicesOffered && contractor.servicesOffered.length > 0 ? (
        contractor.servicesOffered.map((service, index) => (
          <View key={index} style={styles.serviceCard}>
            <View style={styles.serviceInfo}>
              <Text style={styles.serviceName}>
                {typeof service === 'string' ? service : service.name}
              </Text>
            </View>
          </View>
        ))
      ) : (
        <Text style={styles.emptyText}>No services listed</Text>
      )}
    </View>
  );

  const renderPortfolioSection = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Portfolio</Text>
      {contractor?.portfolio && contractor.portfolio.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.portfolioScroll}>
          {contractor.portfolio.map((item, index) => (
            <View key={index} style={styles.portfolioItem}>
              <Image
                source={{ uri: item.imageUrl || 'https://via.placeholder.com/180x135' }}
                style={styles.portfolioImage}
                resizeMode="cover"
              />
              {item.caption && (
                <Text style={styles.portfolioCaption} numberOfLines={2}>{item.caption}</Text>
              )}
            </View>
          ))}
        </ScrollView>
      ) : (
        <Text style={styles.emptyText}>No portfolio items</Text>
      )}
    </View>
  );

  const renderPostsSection = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Posts</Text>
      {contractorPosts.length > 0 ? (
        contractorPosts.map((post, index) => (
          <Card key={post._id || index} style={styles.postCard}>
            <View style={styles.postHeader}>
              <Avatar
                source={{ uri: getUserProfilePictureUrl(
                  post.contractor?.user?.profilePicture, 
                  `${post.contractor?.user?.firstName || ''} ${post.contractor?.user?.lastName || ''}`
                )}}
                size={40}
              />
              <View style={styles.postHeaderText}>
                <Text style={styles.postAuthor}>
                  {post.contractor?.user?.firstName} {post.contractor?.user?.lastName}
                </Text>
                <Text style={styles.postDate}>
                  {new Date(post.createdAt).toLocaleDateString()}
                </Text>
              </View>
              <ReportButton
                reportedItemId={post._id || `post-${index}`}
                onModel="Post"
                renderTrigger={({ onPress }) => (
                  <TouchableOpacity onPress={onPress} style={styles.reportButton}>
                    <FontAwesome5 name="flag" size={12} color="#a3a3a3" />
                  </TouchableOpacity>
                )}
              />
            </View>
            <Text style={styles.postCaption}>{post.caption}</Text>
            {post.images && post.images.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.postImages}>
                {post.images.map((image, imgIndex) => (
                  <Image 
                    key={imgIndex} 
                    source={{ uri: getAssetUrl(image) }} 
                    style={styles.postImage}
                  />
                ))}
              </ScrollView>
            )}
            <View style={styles.postFooter}>
              <View style={styles.postStat}>
                <FontAwesome5 name="heart" solid size={14} color="#525252" />
                <Text style={styles.postStatText}>{post.likes?.length || 0} Likes</Text>
              </View>
              <View style={styles.postStat}>
                <FontAwesome5 name="comment" solid size={14} color="#525252" />
                <Text style={styles.postStatText}>{post.comments?.length || 0} Comments</Text>
              </View>
            </View>
          </Card>
        ))
      ) : (
        <Text style={styles.emptyText}>No posts yet</Text>
      )}
    </View>
  );

  const renderReviewsSection = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Reviews</Text>
      {contractorReviews.length > 0 ? (
        contractorReviews.map((review, index) => (
          <Card key={review._id || index} style={styles.reviewCard}>
            <View style={styles.reviewHeader}>
              <Avatar
                source={{ uri: getUserProfilePictureUrl(
                  review.user?.profilePicture,
                  review.user?.firstName && review.user?.lastName 
                    ? `${review.user.firstName} ${review.user.lastName}` 
                    : 'Anonymous'
                )}}
                size={40}
              />
              <View style={styles.reviewHeaderText}>
                <Text style={styles.reviewAuthor}>
                  {review.user?.firstName} {review.user?.lastName}
                </Text>
                <View style={styles.reviewRatingRow}>
                  {renderStarRating(review.rating, 12)}
                  <Text style={styles.reviewDate}>
                    {new Date(review.createdAt).toLocaleDateString()}
                  </Text>
                </View>
              </View>
            </View>
            {review.title && <Text style={styles.reviewTitle}>{review.title}</Text>}
            <Text style={styles.reviewComment}>{review.comment}</Text>
          </Card>
        ))
      ) : (
        <Text style={styles.emptyText}>No reviews yet</Text>
      )}

      {/* Write Review Section */}
      <Card style={styles.writeReviewCard}>
        <Text style={styles.writeReviewTitle}>Write a Review</Text>
        <View style={styles.ratingInputRow}>
          {[1, 2, 3, 4, 5].map((star) => (
            <TouchableOpacity key={star} onPress={() => setReviewRating(star)}>
              <FontAwesome5
                name="star"
                solid={star <= reviewRating}
                size={24}
                color="#f59e0b"
                style={styles.ratingStar}
              />
            </TouchableOpacity>
          ))}
        </View>
        <Input
          placeholder="Review title (optional)"
          value={reviewTitle}
          onChangeText={setReviewTitle}
          style={styles.reviewInput}
        />
        <Input
          placeholder="Write your review..."
          value={reviewComment}
          onChangeText={setReviewComment}
          multiline
          numberOfLines={4}
          style={styles.reviewInput}
        />
        <Button
          title={submittingReview ? "Submitting..." : "Submit Review"}
          onPress={handleReviewSubmit}
          disabled={submittingReview}
        />
      </Card>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4F46E5" />
      </View>
    );
  }

  if (!contractor) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Contractor not found</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header title="" showBackButton />
      
      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {renderHeader()}

        {/* Action Buttons Row */}
        <View style={styles.actionButtonsRow}>
          <TouchableOpacity style={styles.actionButton} onPress={handleCall}>
            <View style={styles.actionIconContainer}>
              <FontAwesome5 name="phone" size={16} color="#0284c7" />
            </View>
            <Text style={styles.actionButtonText}>Call</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={handleDirections}>
            <View style={styles.actionIconContainer}>
              <FontAwesome5 name="directions" size={16} color="#0284c7" />
            </View>
            <Text style={styles.actionButtonText}>Directions</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={handleWebsite}>
            <View style={styles.actionIconContainer}>
              <FontAwesome5 name="globe" size={16} color="#0284c7" />
            </View>
            <Text style={styles.actionButtonText}>Website</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={handleShare}>
            <View style={styles.actionIconContainer}>
              <FontAwesome5 name="share" size={16} color="#0284c7" />
            </View>
            <Text style={styles.actionButtonText}>Share</Text>
          </TouchableOpacity>
        </View>

        {/* Tab Navigation */}
        <View style={styles.tabContainer}>
          <Tabs tabs={TABS} activeTab={activeTab} onTabChange={setActiveTab} />
        </View>

        {/* Tab Content */}
        <View style={styles.tabContent}>
          {activeTab === 'about' && renderAboutSection()}
          {activeTab === 'services' && renderServicesSection()}
          {activeTab === 'portfolio' && renderPortfolioSection()}
          {activeTab === 'posts' && renderPostsSection()}
          {activeTab === 'reviews' && renderReviewsSection()}
        </View>
      </ScrollView>

      {/* Bottom Action Bar */}
      <View style={styles.bottomActionBar}>
        <Button
          title="Message"
          variant="outline"
          onPress={() => navigation.navigate('ChatScreen', {
            recipientId: contractor?.user?._id,
            recipientName: contractor?.companyName,
          })}
          style={styles.bottomActionButton}
        />
        <Button
          title="Request Quote"
          onPress={() => setIsQuoteModalVisible(true)}
          style={styles.bottomActionButtonPrimary}
        />
      </View>

      {/* Quote Request Modal */}
      <Modal
        visible={isQuoteModalVisible}
        onClose={() => setIsQuoteModalVisible(false)}
        title="Request a Quote"
      >
        <Input
          placeholder="Project title"
          value={quoteProjectTitle}
          onChangeText={setQuoteProjectTitle}
          style={styles.modalInput}
        />
        <Input
          placeholder="Describe your project..."
          value={quoteDescription}
          onChangeText={setQuoteDescription}
          multiline
          numberOfLines={4}
          style={styles.modalInput}
        />
        <View style={styles.contactPreferenceRow}>
          <TouchableOpacity
            style={[styles.preferenceButton, quoteContactPreference === 'email' && styles.preferenceButtonActive]}
            onPress={() => setQuoteContactPreference('email')}
          >
            <Text style={[styles.preferenceText, quoteContactPreference === 'email' && styles.preferenceTextActive]}>Email</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.preferenceButton, quoteContactPreference === 'phone' && styles.preferenceButtonActive]}
            onPress={() => setQuoteContactPreference('phone')}
          >
            <Text style={[styles.preferenceText, quoteContactPreference === 'phone' && styles.preferenceTextActive]}>Phone</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.preferenceButton, quoteContactPreference === 'either' && styles.preferenceButtonActive]}
            onPress={() => setQuoteContactPreference('either')}
          >
            <Text style={[styles.preferenceText, quoteContactPreference === 'either' && styles.preferenceTextActive]}>Either</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.modalButtons}>
          <Button
            title="Cancel"
            variant="outline"
            onPress={() => setIsQuoteModalVisible(false)}
            style={styles.modalButton}
          />
          <Button
            title="Send Request"
            onPress={handleRequestQuote}
            style={styles.modalButton}
          />
        </View>
      </Modal>
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
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#6b7280',
  },
  scrollView: {
    flex: 1,
  },
  // Header Section
  headerSection: {
    backgroundColor: '#FFFFFF',
  },
  floatingActions: {
    position: 'absolute',
    top: 8,
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  floatingButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  floatingActionsRight: {
    flexDirection: 'row',
    gap: 8,
  },
  heroBanner: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#f3f4f6',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  contentContainer: {
    paddingHorizontal: 16,
  },
  companyInfo: {
    marginTop: 12,
  },
  companyName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 6,
  },
  starsContainer: {
    flexDirection: 'row',
  },
  starIcon: {
    marginRight: 2,
  },
  ratingText: {
    fontSize: 14,
    color: '#6b7280',
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eef2ff',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    alignSelf: 'flex-start',
    marginTop: 8,
    gap: 4,
  },
  verifiedBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4F46E5',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 6,
  },
  locationText: {
    fontSize: 14,
    color: '#6b7280',
  },
  locationDivider: {
    color: '#d1d5db',
  },
  // Stats Section
  statsSection: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 16,
    marginTop: 16,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#e5e7eb',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginTop: 6,
  },
  statLabel: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#e5e7eb',
  },
  // Action Buttons
  actionButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  actionButton: {
    alignItems: 'center',
  },
  actionIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(2, 132, 199, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  actionButtonText: {
    fontSize: 12,
    color: '#374151',
  },
  // Tabs
  tabContainer: {
    backgroundColor: '#FFFFFF',
  },
  tabContent: {
    paddingBottom: 100,
  },
  // Sections
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
  },
  aboutText: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 22,
  },
  infoList: {
    marginTop: 16,
    gap: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  infoText: {
    fontSize: 14,
    color: '#374151',
  },
  infoLabel: {
    fontWeight: '600',
  },
  // Services
  serviceCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    backgroundColor: '#f9fafb',
    padding: 14,
    borderRadius: 12,
    marginBottom: 10,
  },
  serviceInfo: {
    flex: 1,
  },
  serviceName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  serviceDescription: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
  },
  servicePrice: {
    backgroundColor: '#eef2ff',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  servicePriceText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4F46E5',
  },
  // Portfolio
  portfolioScroll: {
    marginHorizontal: -16,
    paddingHorizontal: 16,
  },
  portfolioItem: {
    width: 176,
    marginRight: 12,
  },
  portfolioImage: {
    width: 176,
    height: 132,
    borderRadius: 12,
    backgroundColor: '#f3f4f6',
  },
  portfolioCaption: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 8,
  },
  // Posts
  postCard: {
    marginBottom: 16,
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  postHeaderText: {
    flex: 1,
    marginLeft: 10,
  },
  postAuthor: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  postDate: {
    fontSize: 12,
    color: '#6b7280',
  },
  reportButton: {
    padding: 8,
  },
  postCaption: {
    fontSize: 14,
    color: '#374151',
    marginBottom: 12,
  },
  postImages: {
    marginBottom: 12,
  },
  postImage: {
    width: 200,
    height: 150,
    borderRadius: 8,
    marginRight: 8,
  },
  postFooter: {
    flexDirection: 'row',
    gap: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  postStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  postStatText: {
    fontSize: 13,
    color: '#6b7280',
  },
  // Reviews
  reviewCard: {
    marginBottom: 16,
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  reviewHeaderText: {
    flex: 1,
    marginLeft: 10,
  },
  reviewAuthor: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  reviewRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  reviewDate: {
    fontSize: 12,
    color: '#6b7280',
  },
  reviewTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 6,
  },
  reviewComment: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
  },
  // Write Review
  writeReviewCard: {
    marginTop: 16,
    padding: 16,
  },
  writeReviewTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 16,
  },
  ratingInputRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 16,
  },
  ratingStar: {
    marginHorizontal: 4,
  },
  reviewInput: {
    marginBottom: 12,
  },
  // Empty State
  emptyText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    paddingVertical: 20,
  },
  // Bottom Action Bar
  bottomActionBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    gap: 12,
  },
  bottomActionButton: {
    flex: 1,
  },
  bottomActionButtonPrimary: {
    flex: 1,
    backgroundColor: '#4F46E5',
  },
  // Modal
  modalInput: {
    marginBottom: 12,
  },
  contactPreferenceRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  preferenceButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    alignItems: 'center',
  },
  preferenceButtonActive: {
    backgroundColor: '#4F46E5',
    borderColor: '#4F46E5',
  },
  preferenceText: {
    fontSize: 14,
    color: '#6b7280',
  },
  preferenceTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
  },
});

export default BusinessDetailScreen;
