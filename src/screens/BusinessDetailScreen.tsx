import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Share,
  Linking,
  Platform,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { FontAwesome5 } from '@expo/vector-icons';
import { fetchContractorDetails, submitReview, fetchContractorPosts, createLead } from '../api';
import { fetchContractorReviews } from '../api/review';
import { API_BASE_URL } from '../config';
import { Tabs, TabPanel } from '../components/common/Tabs';
import { Modal } from '../components/common/Modal';
import Input from '../components/common/Input';
import Button from '../components/common/Button';
import Header from '../components/common/Header';
import Card from '../components/common/Card';
import Avatar from '../components/common/Avatar';
import Typography from '../components/common/Typography';
import ReportButton from '../components/ReportButton';
import { Spacing, Radii, Colors, Shadows } from '../constants/designTokens';
import { Contractor, Post, Review } from '../types';

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

  useEffect(() => {
    if (id) {
      loadContractorDetails();
    } else {
      Alert.alert('Error', 'No contractor ID provided');
      setLoading(false);
    }
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
      const state = contractor?.contactInfo?.state?.toLowerCase() || 'usa';
      const zip = contractor?.contactInfo?.zipCode || '00000';
      const slug = contractor?.slug || contractor?._id;
      const url = `https://ratedeed.com/contractor/${state}/${zip}/${slug}`;
      await Share.share({
        message: `Check out ${contractor?.companyName} on RateDeed! ${url}`,
        url: url,
      });
    } catch (error) {
      console.error('Share error:', error);
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
        contactPreference: quoteContactPreference
      });
      Alert.alert('Success', 'Your quote request has been sent!');
      setIsQuoteModalVisible(false);
      setQuoteProjectTitle('');
      setQuoteDescription('');
      setQuoteContactPreference('email');
    } catch (error) {
      Alert.alert('Error', 'Failed to send quote request');
    }
  };

  const loadContractorDetails = async () => {
    try {
      const [contractorData, postsData, reviewsData] = await Promise.all([
        fetchContractorDetails(id),
        fetchContractorPosts(id),
        fetchContractorReviews(id),
      ]);
      setContractor(contractorData);
      setContractorPosts(postsData.posts || []);
      setContractorReviews(reviewsData || []);
    } catch (error) {
      console.error('Error loading contractor:', error);
      Alert.alert('Error', 'Failed to load contractor details');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadContractorDetails();
  }, [id]);

  const handleReviewSubmit = async () => {
    if (reviewRating === 0) {
      Alert.alert('Error', 'Please provide a rating');
      return;
    }
    setSubmittingReview(true);
    try {
      await submitReview(id, {
        rating: reviewRating,
        title: reviewTitle,
        comment: reviewComment,
      });
      Alert.alert('Success', 'Your review has been submitted!');
      setReviewRating(0);
      setReviewTitle('');
      setReviewComment('');
      loadContractorDetails();
    } catch (error) {
      Alert.alert('Error', 'Failed to submit review');
    } finally {
      setSubmittingReview(false);
    }
  };

  const getAssetUrl = (filename: string | undefined): string => {
    if (!filename) return 'https://via.placeholder.com/150';
    return `${API_BASE_URL}/uploads/${filename}`;
  };

  const getUserProfilePictureUrl = (profilePicture: string | undefined, fullName: string): string => {
    if (profilePicture) return getAssetUrl(profilePicture);
    const initials = fullName?.split(' ').map(n => n[0]).join('').toUpperCase() || 'UN';
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName || 'Unknown')}&background=random&color=fff&size=128`;
  };

  const renderStarRating = (rating: number, size: number = 16) => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <FontAwesome5
          key={i}
          name={rating >= i ? 'star' : 'star'}
          solid={rating >= i}
          size={size}
          color={rating >= i ? Colors.warning : Colors.neutral300}
        />
      );
    }
    return <View style={styles.starRatingContainer}>{stars}</View>;
  };

  const renderHeaderSection = () => (
    <View style={styles.headerSection}>
      <View style={styles.bannerContainer}>
        <Image
          source={{ uri: contractor?.licenseDocumentUrl || 'https://via.placeholder.com/600x200?text=No+Banner' }}
          style={styles.bannerImage}
        />
      </View>
      <View style={styles.profileImageContainer}>
        <Avatar
          source={{ uri: contractor?.licenseDocumentUrl || 'https://via.placeholder.com/100' }}
          size={100}
          style={styles.profilePicture}
        />
      </View>
      <View style={styles.headerInfo}>
        <View style={styles.nameRow}>
          <Typography variant="h2" style={styles.contractorName}>{contractor?.companyName}</Typography>
          <ReportButton
            reportedItemId={contractor?._id || id}
            onModel="Contractor"
            renderTrigger={({ onPress }) => (
              <TouchableOpacity
                onPress={onPress}
                style={styles.reportTrigger}
                accessibilityLabel="Report this contractor"
              >
                <FontAwesome5 name="flag" size={16} color={Colors.neutral500} />
              </TouchableOpacity>
            )}
          />
        </View>
        <View style={styles.ratingRow}>
          {renderStarRating(contractor?.averageRating || 0, 18)}
          <Typography variant="body" style={styles.ratingText}>
            {contractor?.averageRating?.toFixed(1) || 'N/A'} ({contractor?.numReviews || 0} reviews)
          </Typography>
        </View>
        <View style={styles.badgeRow}>
          {contractor?.isVerified && (
            <View style={[styles.badge, styles.verifiedBadge]}>
              <Typography variant="caption" style={styles.badgeText}>LICENSE VERIFIED</Typography>
            </View>
          )}
          {contractor?.isSponsored && (
            <View style={[styles.badge, styles.sponsoredBadge]}>
              <Typography variant="caption" style={styles.badgeText}>SPONSORED</Typography>
            </View>
          )}
        </View>
        <View style={styles.actionButtonsRow}>
          <TouchableOpacity style={styles.actionIconButton} onPress={handleCall}>
            <View style={styles.actionIconCircle}>
              <FontAwesome5 name="phone" size={16} color={Colors.primary500} />
            </View>
            <Typography variant="caption" style={styles.actionIconText}>Call</Typography>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionIconButton} onPress={handleDirections}>
            <View style={styles.actionIconCircle}>
              <FontAwesome5 name="directions" size={16} color={Colors.primary500} />
            </View>
            <Typography variant="caption" style={styles.actionIconText}>Directions</Typography>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionIconButton} onPress={handleWebsite}>
            <View style={styles.actionIconCircle}>
              <FontAwesome5 name="globe" size={16} color={Colors.primary500} />
            </View>
            <Typography variant="caption" style={styles.actionIconText}>Website</Typography>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionIconButton} onPress={handleShare}>
            <View style={styles.actionIconCircle}>
              <FontAwesome5 name="share" size={16} color={Colors.primary500} />
            </View>
            <Typography variant="caption" style={styles.actionIconText}>Share</Typography>
          </TouchableOpacity>
        </View>
        <View style={styles.mainActionButtonsRow}>
          <Button
            title="Message"
            variant="outline"
            onPress={() => navigation.navigate('ChatScreen', {
              recipientId: contractor?.user?._id,
              recipientName: contractor?.companyName,
            })}
            style={styles.halfButton}
          />
          <Button
            title="Request Quote"
            onPress={() => setIsQuoteModalVisible(true)}
            style={styles.halfButton}
          />
        </View>
      </View>
    </View>
  );

  const renderAboutTab = () => (
    <Card style={styles.card}>
      {contractor?.description && (
        <>
          <Typography variant="h4" style={styles.sectionTitle}>About</Typography>
          <Typography variant="body" style={styles.bioText}>{contractor.description}</Typography>
        </>
      )}
      <View style={styles.detailsGrid}>
        {contractor?.yearsInBusiness && (
          <View style={styles.detailItem}>
            <Typography variant="label" style={styles.detailLabel}>Years in Business</Typography>
            <Typography variant="body">{contractor.yearsInBusiness}</Typography>
          </View>
        )}
        {contractor?.certifications && contractor.certifications.length > 0 && (
          <View style={styles.detailItem}>
            <Typography variant="label" style={styles.detailLabel}>Certifications</Typography>
            <Typography variant="body">{contractor.certifications.join(', ')}</Typography>
          </View>
        )}
        {contractor?.pricing && (
          <View style={styles.detailItem}>
            <Typography variant="label" style={styles.detailLabel}>Pricing</Typography>
            <Typography variant="body">{contractor.pricing}</Typography>
          </View>
        )}
        {contractor?.zipCodesCovered && contractor.zipCodesCovered.length > 0 && (
          <View style={styles.detailItem}>
            <Typography variant="label" style={styles.detailLabel}>Areas Served</Typography>
            <Typography variant="body">{contractor.zipCodesCovered.join(', ')}</Typography>
          </View>
        )}
      </View>
    </Card>
  );

  const renderServicesTab = () => (
    <Card style={styles.card}>
      <Typography variant="h4" style={styles.sectionTitle}>Services Offered</Typography>
      {contractor?.servicesOffered && contractor.servicesOffered.length > 0 ? (
        <View style={styles.servicesContainer}>
          {contractor.servicesOffered.map((service, index) => (
            <View key={index} style={styles.serviceTag}>
              <Typography variant="body" style={styles.serviceTagText}>
                {typeof service === 'string' ? service : service.name}
              </Typography>
            </View>
          ))}
        </View>
      ) : (
        <Typography variant="body" style={styles.emptyText}>No services listed</Typography>
      )}
    </Card>
  );

  const renderPortfolioTab = () => (
    <Card style={styles.card}>
      <Typography variant="h4" style={styles.sectionTitle}>Portfolio</Typography>
      {contractor?.portfolio && contractor.portfolio.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.portfolioGallery}>
            {contractor.portfolio.map((item, index) => (
              <View key={index} style={styles.portfolioItem}>
                <Image
                  source={{ uri: item.imageUrl || 'https://via.placeholder.com/180x120' }}
                  style={styles.portfolioImage}
                />
                {item.caption && (
                  <Typography variant="caption" style={styles.portfolioCaption}>{item.caption}</Typography>
                )}
              </View>
            ))}
          </View>
        </ScrollView>
      ) : (
        <Typography variant="body" style={styles.emptyText}>No portfolio items</Typography>
      )}
    </Card>
  );

  const renderPostsTab = () => (
    <Card style={styles.card}>
      <Typography variant="h4" style={styles.sectionTitle}>Posts</Typography>
      {contractorPosts.length > 0 ? (
        contractorPosts.map((post, index) => (
          <View key={post._id || index} style={styles.postCard}>
            <View style={styles.postHeader}>
              <Avatar
                source={{ uri: getUserProfilePictureUrl(post.contractor?.user?.profilePicture, `${post.contractor?.user?.firstName || ''} ${post.contractor?.user?.lastName || ''}`) }}
                size={40}
              />
              <View style={styles.postHeaderInfo}>
                <Typography variant="h6">{`${post.contractor?.user?.firstName || ''} ${post.contractor?.user?.lastName || ''}`}</Typography>
                <Typography variant="caption" style={styles.dateText}>
                  {new Date(post.createdAt).toLocaleDateString()}
                </Typography>
              </View>
              <ReportButton
                reportedItemId={post._id || `post-${index}`}
                onModel="Post"
                renderTrigger={({ onPress }) => (
                  <TouchableOpacity onPress={onPress} style={styles.reportTriggerSmall}>
                    <FontAwesome5 name="flag" size={12} color={Colors.neutral400} />
                  </TouchableOpacity>
                )}
              />
            </View>
            <Typography variant="body" style={styles.postCaption}>{post.caption}</Typography>
            {post.images && post.images.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.postImageScroll}>
                {post.images.map((image, imgIndex) => (
                  <Image key={imgIndex} source={{ uri: getAssetUrl(image) }} style={styles.postImage} />
                ))}
              </ScrollView>
            )}
            <View style={styles.postActions}>
              <View style={styles.actionItem}>
                <FontAwesome5 name="heart" solid size={16} color={Colors.neutral600} />
                <Typography variant="caption" style={styles.actionText}>{post.likes?.length || 0} Likes</Typography>
              </View>
              <View style={styles.actionItem}>
                <FontAwesome5 name="comment" solid size={16} color={Colors.neutral600} />
                <Typography variant="caption" style={styles.actionText}>{post.comments?.length || 0} Comments</Typography>
              </View>
            </View>
          </View>
        ))
      ) : (
        <Typography variant="body" style={styles.emptyText}>No posts yet</Typography>
      )}
    </Card>
  );

  const renderReviewsTab = () => (
    <Card style={styles.card}>
      <Typography variant="h4" style={styles.sectionTitle}>Reviews</Typography>
      {contractorReviews.length > 0 ? (
        contractorReviews.map((review, index) => (
          <View key={review._id || index} style={styles.reviewCard}>
            <View style={styles.reviewHeader}>
              <Avatar
                source={{ uri: getUserProfilePictureUrl(review.user?.profilePicture, `${review.user?.firstName || ''} ${review.user?.lastName || ''}`) }}
                size={40}
              />
              <View style={styles.reviewHeaderInfo}>
                <Typography variant="h6">
                  {review.user ? `${review.user.firstName} ${review.user.lastName}` : 'Anonymous'}
                </Typography>
                {renderStarRating(review.rating, 14)}
              </View>
              <View style={styles.reviewActions}>
                <ReportButton
                  reportedItemId={review._id || `review-${index}`}
                  onModel="Review"
                  renderTrigger={({ onPress }) => (
                    <TouchableOpacity onPress={onPress} style={styles.reportTriggerSmall}>
                      <FontAwesome5 name="flag" size={12} color={Colors.neutral400} />
                    </TouchableOpacity>
                  )}
                />
              </View>
            </View>
            {review.title && <Typography variant="subtitle2" style={styles.reviewTitle}>{review.title}</Typography>}
            {review.comment && <Typography variant="body" style={styles.reviewComment}>{review.comment}</Typography>}
            <Typography variant="caption" style={styles.dateText}>
              {new Date(review.createdAt).toLocaleDateString()}
            </Typography>
          </View>
        ))
      ) : (
        <Typography variant="body" style={styles.emptyText}>No reviews yet</Typography>
      )}

      <View style={styles.leaveReviewSection}>
        <Typography variant="h5" style={styles.leaveReviewTitle}>Leave a Review</Typography>
        <View style={styles.ratingInputContainer}>
          <Typography variant="label">Your Rating</Typography>
          <View style={styles.ratingInput}>
            {[1, 2, 3, 4, 5].map((star) => (
              <TouchableOpacity key={star} onPress={() => setReviewRating(star)}>
                <FontAwesome5
                  name="star"
                  solid={reviewRating >= star}
                  size={28}
                  color={reviewRating >= star ? Colors.warning : Colors.neutral300}
                  style={styles.starInput}
                />
              </TouchableOpacity>
            ))}
          </View>
        </View>
        <Input
          label="Review Title"
          placeholder="Summarize your experience"
          value={reviewTitle}
          onChangeText={setReviewTitle}
          style={styles.inputField}
        />
        <Input
          label="Your Comment"
          placeholder="Share details about your experience"
          multiline
          numberOfLines={4}
          value={reviewComment}
          onChangeText={setReviewComment}
          style={[styles.inputField, styles.textArea]}
        />
        <Button
          title={submittingReview ? 'Submitting...' : 'Submit Review'}
          onPress={handleReviewSubmit}
          disabled={submittingReview}
        />
      </View>
    </Card>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary500} />
        <Typography variant="body" style={styles.loadingText}>Loading contractor profile...</Typography>
      </View>
    );
  }

  if (!contractor) {
    return (
      <View style={styles.loadingContainer}>
        <Typography variant="h6" style={styles.errorText}>Contractor not found</Typography>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header title={contractor.companyName || 'Business Profile'} showBackButton onBackPress={() => navigation.goBack()} rightComponent={null} />
      <Tabs tabs={TABS} activeTab={activeTab} onTabChange={setActiveTab} />
      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {activeTab === 'about' && renderAboutTab()}
        {activeTab === 'services' && renderServicesTab()}
        {activeTab === 'portfolio' && renderPortfolioTab()}
        {activeTab === 'posts' && renderPostsTab()}
        {activeTab === 'reviews' && renderReviewsTab()}
      </ScrollView>
      <Modal
        visible={isQuoteModalVisible}
        onClose={() => setIsQuoteModalVisible(false)}
        title="Request a Quote"
      >
        <Typography variant="body" style={styles.modalSubtitle}>
          Tell the contractor about your project to get an accurate estimate.
        </Typography>
        <Input
          label="Project Title"
          placeholder="e.g., Bathroom Remodel"
          value={quoteProjectTitle}
          onChangeText={setQuoteProjectTitle}
          style={styles.inputField}
        />
        <Input
          label="Description"
          placeholder="Describe your project details..."
          multiline
          numberOfLines={4}
          value={quoteDescription}
          onChangeText={setQuoteDescription}
          style={[styles.inputField, styles.textArea]}
        />
        <Typography variant="label" style={styles.contactPrefLabel}>Contact Preference</Typography>
        <View style={styles.radioGroup}>
          <TouchableOpacity
            style={[styles.radioItem, quoteContactPreference === 'email' && styles.radioItemSelected]}
            onPress={() => setQuoteContactPreference('email')}
          >
            <Typography variant="body" style={quoteContactPreference === 'email' ? styles.radioTextSelected : styles.radioText}>Email</Typography>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.radioItem, quoteContactPreference === 'phone' && styles.radioItemSelected]}
            onPress={() => setQuoteContactPreference('phone')}
          >
            <Typography variant="body" style={quoteContactPreference === 'phone' ? styles.radioTextSelected : styles.radioText}>Phone</Typography>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.radioItem, quoteContactPreference === 'in_app' && styles.radioItemSelected]}
            onPress={() => setQuoteContactPreference('in_app')}
          >
            <Typography variant="body" style={quoteContactPreference === 'in_app' ? styles.radioTextSelected : styles.radioText}>In App Chat</Typography>
          </TouchableOpacity>
        </View>
        <Button
          title="Send Request"
          onPress={handleRequestQuote}
          style={styles.modalSubmitButton}
        />
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.neutral100,
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.neutral100,
  },
  loadingText: {
    marginTop: Spacing.sm,
    color: Colors.neutral600,
  },
  errorText: {
    color: Colors.error,
  },
  headerSection: {
    backgroundColor: Colors.neutral50,
  },
  bannerContainer: {
    height: 180,
    backgroundColor: Colors.neutral300,
  },
  bannerImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  profileImageContainer: {
    alignItems: 'center',
    marginTop: -50,
  },
  profilePicture: {
    borderWidth: 4,
    borderColor: Colors.neutral50,
  },
  headerInfo: {
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.sm,
  },
  contractorName: {
    color: Colors.neutral900,
    textAlign: 'center',
  },
  reportTrigger: {
    marginLeft: Spacing.md,
    padding: Spacing.xs,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  starRatingContainer: {
    flexDirection: 'row',
  },
  ratingText: {
    marginLeft: Spacing.sm,
    color: Colors.neutral700,
  },
  badgeRow: {
    flexDirection: 'row',
    marginTop: Spacing.sm,
  },
  badge: {
    paddingVertical: Spacing.xxs,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radii.sm,
    marginRight: Spacing.sm,
  },
  verifiedBadge: {
    backgroundColor: Colors.success,
  },
  sponsoredBadge: {
    backgroundColor: Colors.warning,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.neutral50,
  },
  
  actionButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
  },
  actionIconButton: {
    alignItems: 'center',
  },
  actionIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.primary100,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.xxs,
  },
  actionIconText: {
    color: Colors.neutral700,
  },
  mainActionButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: Spacing.sm,
  },
  halfButton: {
    flex: 1,
    marginHorizontal: Spacing.xs,
  },
  modalSubtitle: {
    color: Colors.neutral600,
    marginBottom: Spacing.md,
  },
  contactPrefLabel: {
    marginBottom: Spacing.xs,
  },
  radioGroup: {
    flexDirection: 'row',
    marginBottom: Spacing.lg,
  },
  radioItem: {
    flex: 1,
    paddingVertical: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.neutral300,
    borderRadius: Radii.md,
    alignItems: 'center',
    marginRight: Spacing.sm,
  },
  radioItemSelected: {
    borderColor: Colors.primary500,
    backgroundColor: Colors.primary50,
  },
  radioText: {
    color: Colors.neutral700,
  },
  radioTextSelected: {
    color: Colors.primary700,
    fontWeight: 'bold',
  },
  modalSubmitButton: {
    marginTop: Spacing.md,
  },

  card: {
    margin: Spacing.md,
    padding: Spacing.lg,
  },
  sectionTitle: {
    color: Colors.neutral900,
    marginBottom: Spacing.md,
  },
  bioText: {
    color: Colors.neutral700,
    marginBottom: Spacing.md,
  },
  detailsGrid: {
    marginTop: Spacing.sm,
  },
  detailItem: {
    marginBottom: Spacing.md,
  },
  detailLabel: {
    fontWeight: '600',
    color: Colors.neutral800,
    marginBottom: Spacing.xxs,
  },
  servicesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  serviceTag: {
    backgroundColor: Colors.primary100,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md,
    borderRadius: Radii.xl,
    marginRight: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  serviceTagText: {
    color: Colors.primary700,
  },
  portfolioGallery: {
    flexDirection: 'row',
    paddingVertical: Spacing.xs,
  },
  portfolioItem: {
    marginRight: Spacing.md,
  },
  portfolioImage: {
    width: 180,
    height: 120,
    borderRadius: Radii.md,
    resizeMode: 'cover',
  },
  portfolioCaption: {
    marginTop: Spacing.xs,
    textAlign: 'center',
  },
  postCard: {
    backgroundColor: Colors.neutral50,
    borderRadius: Radii.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    ...Shadows.sm,
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  postHeaderInfo: {
    flex: 1,
    marginLeft: Spacing.sm,
  },
  postCaption: {
    color: Colors.neutral800,
    marginBottom: Spacing.sm,
  },
  postImageScroll: {
    marginBottom: Spacing.sm,
  },
  postImage: {
    width: 200,
    height: 150,
    borderRadius: Radii.sm,
    marginRight: Spacing.sm,
    resizeMode: 'cover',
  },
  postActions: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: Colors.neutral200,
    paddingTop: Spacing.sm,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: Spacing.lg,
  },
  actionText: {
    marginLeft: Spacing.xxs,
    color: Colors.neutral600,
  },
  reviewCard: {
    backgroundColor: Colors.neutral50,
    borderRadius: Radii.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  reviewHeaderInfo: {
    flex: 1,
    marginLeft: Spacing.sm,
  },
  reviewActions: {
    flexDirection: 'row',
  },
  reportTriggerSmall: {
    padding: Spacing.xs,
  },
  reviewTitle: {
    color: Colors.neutral800,
    marginBottom: Spacing.xxs,
  },
  reviewComment: {
    color: Colors.neutral700,
    marginBottom: Spacing.xs,
  },
  emptyText: {
    color: Colors.neutral600,
    textAlign: 'center',
    paddingVertical: Spacing.lg,
  },
  leaveReviewSection: {
    marginTop: Spacing.xl,
    paddingTop: Spacing.xl,
    borderTopWidth: 1,
    borderTopColor: Colors.neutral200,
  },
  leaveReviewTitle: {
    color: Colors.neutral900,
    marginBottom: Spacing.lg,
  },
  ratingInputContainer: {
    marginBottom: Spacing.lg,
  },
  ratingInput: {
    flexDirection: 'row',
    marginTop: Spacing.xs,
  },
  starInput: {
    marginRight: Spacing.sm,
  },
  inputField: {
    marginBottom: Spacing.md,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  dateText: {
    color: Colors.neutral500,
  },
});

export default BusinessDetailScreen;
