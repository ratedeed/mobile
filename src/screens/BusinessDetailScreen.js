import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Image, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { FontAwesome5 } from '@expo/vector-icons';
import { fetchContractorDetails, submitReview, fetchContractorPosts, fetchContractorReviews } from '../api/contractor';
import { API_BASE_URL } from '../config'; // Import API_BASE_URL for asset paths
import Input from '../components/common/Input';
import Button from '../components/common/Button';
import Header from '../components/common/Header';
import Card from '../components/common/Card';
import Avatar from '../components/common/Avatar';
import Typography from '../components/common/Typography';
import { Spacing, Radii, Colors, Shadows } from '../constants/designTokens';

const BusinessDetailScreen = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const { id } = route.params || {};
  const [contractor, setContractor] = useState(null);
  const [contractorPosts, setContractorPosts] = useState([]);
  const [contractorReviews, setContractorReviews] = useState([]); // New state for reviews
  const [loading, setLoading] = useState(true);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewTitle, setReviewTitle] = useState('');
  const [reviewComment, setReviewComment] = useState('');

  useEffect(() => {
    if (!id) {
      Alert.alert("Error", "No contractor ID provided");
      setLoading(false);
      return;
    }
    loadContractorDetails();
  }, [id]);

  // Helper to get asset URL (similar to js/utils.js getAssetUrl)
  const getAssetUrl = (filename) => {
    if (!filename) return 'https://via.placeholder.com/150'; // Default placeholder
    // Assuming assets are served from API_BASE_URL/uploads
    return `${API_BASE_URL}/uploads/${filename}`;
  };

  // Helper to get user profile picture URL (similar to js/utils.js getUserProfilePictureUrl)
  const getUserProfilePictureUrl = (profilePicture, fullName) => {
    if (profilePicture) {
      return getAssetUrl(profilePicture);
    }
    // Fallback to a generic avatar or initial-based avatar
    const initials = fullName ? fullName.split(' ').map(n => n[0]).join('').toUpperCase() : 'UN';
    // In a real app, you might generate a unique color/avatar based on initials
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName || 'Unknown User')}&background=random&color=fff&size=128`;
  };

  const loadContractorDetails = async () => {
    setLoading(true);
    try {
      const contractorData = await fetchContractorDetails(id);
      setContractor(contractorData);

      // Fetch contractor posts
      const postsData = await fetchContractorPosts(id);
      setContractorPosts(postsData.posts);

      // Fetch contractor reviews
      const reviewsData = await fetchContractorReviews(id);
      setContractorReviews(reviewsData); // Corrected: reviewsData is already the array of reviews
      console.log('Fetched reviews data:', reviewsData); // Log the fetched data
      console.log('Contractor reviews state:', reviewsData); // Log the reviews array

    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to load contractor details, posts, or reviews.');
      console.error('Error fetching contractor details, posts, or reviews:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleReviewSubmit = async () => {
    if (reviewRating === 0) {
      Alert.alert('Error', 'Please provide a rating for your review.');
      return;
    }

    setLoading(true);
    try {
      const reviewData = {
        rating: reviewRating,
        title: reviewTitle,
        comment: reviewComment,
        // In a real app, you'd also send the userId
      };
      await submitReview(id, reviewData); // Removed DUMMY_AUTH_TOKEN
      Alert.alert('Success', 'Your review has been submitted!');
      loadContractorDetails(); // Re-fetch contractor details to show the new review
      setReviewRating(0);
      setReviewTitle('');
      setReviewComment('');
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to submit review.');
      console.error('Review submission error:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderStarRating = (rating, size = Spacing.md) => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <FontAwesome5
          key={i}
          name={rating >= i ? 'star' : (rating >= i - 0.5 ? 'star-half-alt' : 'star')}
          solid={rating >= i || rating >= i - 0.5}
          size={size}
          color={rating >= i ? Colors.warning : (rating >= i - 0.5 ? Colors.warning : Colors.neutral400)}
          style={styles.starIcon}
        />
      );
    }
    return <View style={styles.starRatingContainer}>{stars}</View>;
  };

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
        <Typography variant="h6" style={styles.errorText}>Contractor not found.</Typography>
      </View>
    );
  }

  return (
    <View style={styles.fullScreenContainer}>
      <Header title={contractor.companyName} showBackButton={true} />
      <ScrollView style={styles.container}>
        <View style={styles.bannerContainer}>
          <Image source={{ uri: contractor.licenseDocumentUrl || 'https://via.placeholder.com/600x200?text=No+Banner' }} style={styles.bannerImage} />
        </View>

        <View style={styles.contentContainer}>
          <View style={styles.headerInfo}>
<View style={styles.profileImageContainer}>
          <Avatar source={{ uri: contractor.licenseDocumentUrl || 'https://via.placeholder.com/100' }} size={120} style={styles.profilePicture} />
        </View>
            <Typography variant="h2" style={styles.contractorName}>{contractor.companyName}</Typography>
            <View style={styles.ratingAndBadgeContainer}>
              {renderStarRating(contractor.averageRating, Spacing.lg)}
              <Typography variant="h6" style={styles.averageRatingText}>
                {contractor.averageRating != null ? contractor.averageRating.toFixed(1) : 'N/A'}
              </Typography>
              <Typography variant="body" style={styles.reviewCountText}>({contractor.numReviews} reviews)</Typography>
              {contractor.isVerified && (
                <View style={styles.verifiedBadge}>
                  <Typography variant="caption" style={styles.badgeText}>LICENSE VERIFIED</Typography>
                </View>
              )}
              {contractor.isSponsored && (
                <View style={styles.premiumBadge}>
                  <Typography variant="caption" style={styles.badgeText}>SPONSORED</Typography>
                </View>
              )}
            </View>
            <Button
              title="Contact Contractor"
              onPress={() => navigation.navigate('ChatScreen', { recipientId: contractor.user._id, recipientName: contractor.companyName })}
              style={styles.contactButton}
            />
          </View>

          {contractor.bio && (
            <Card style={styles.section}>
              <Typography variant="h4" style={styles.sectionTitle}>About {contractor.companyName}</Typography>
              <Typography variant="body" style={styles.bioText}>{contractor.bio}</Typography>
              <View style={styles.detailsGrid}>
                {contractor.yearsInBusiness != null && (
                  <Typography variant="body" style={styles.detailItem}>
                    <Typography variant="label" style={styles.detailLabel}>Years in Business:</Typography> {contractor.yearsInBusiness}
                  </Typography>
                )}
                {contractor.certifications && contractor.certifications.length > 0 && (
                  <Typography variant="body" style={styles.detailItem}>
                    <Typography variant="label" style={styles.detailLabel}>Certifications:</Typography> {contractor.certifications.join(', ')}
                  </Typography>
                )}
                {contractor.pricing && (
                  <Typography variant="body" style={styles.detailItem}>
                    <Typography variant="label" style={styles.detailLabel}>Pricing:</Typography> {contractor.pricing}
                  </Typography>
                )}
                {contractor.zipCodesCovered && contractor.zipCodesCovered.length > 0 && (
                  <Typography variant="body" style={styles.detailItem}>
                    <Typography variant="label" style={styles.detailLabel}>Areas Served:</Typography> {contractor.zipCodesCovered.join(', ')}
                  </Typography>
                )}
              </View>
            </Card>
          )}

          {contractor.servicesOffered && contractor.servicesOffered.length > 0 && (
            <Card style={styles.section}>
              <Typography variant="h4" style={styles.sectionTitle}>Services Offered</Typography>
              <View style={styles.servicesContainer}>
                {contractor.servicesOffered.map((service, index) => (
                  <View key={index} style={styles.serviceTag}>
                    <Typography variant="body" style={styles.serviceTagText}>{service}</Typography>
                  </View>
                ))}
              </View>
            </Card>
          )}

          {contractor.portfolio && contractor.portfolio.length > 0 && (
            <Card style={styles.section}>
              <Typography variant="h4" style={styles.sectionTitle}>Portfolio</Typography>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.portfolioGallery}>
                {contractor.portfolio.map((item, index) => (
                  <Image key={index} source={{ uri: item.imageUrl || 'https://via.placeholder.com/180x120' }} style={styles.portfolioImage} />
                ))}
              </ScrollView>
            </Card>
          )}

          {contractorPosts && contractorPosts.length > 0 && (
            <Card style={styles.section}>
              <Typography variant="h4" style={styles.sectionTitle}>Posts</Typography>
              <View style={styles.postsFeed}>
                {contractorPosts.map((post, index) => (
                  <Card key={index} style={styles.postCard}>
                    <View style={styles.postHeader}>
                      <Avatar
                        source={{ uri: getUserProfilePictureUrl(post.contractor.user.profilePicture, `${post.contractor.user.firstName} ${post.contractor.user.lastName}`) }}
                        size={40}
                        style={styles.postAvatar}
                      />
                      <View>
                        <Typography variant="h6" style={styles.postUserName}>{`${post.contractor.user.firstName} ${post.contractor.user.lastName}`}</Typography>
                        <Typography variant="caption" style={styles.postDate}>{new Date(post.createdAt).toLocaleDateString()}</Typography>
                      </View>
                    </View>
                    <Typography variant="body" style={styles.postCaption}>{post.caption}</Typography>
                    {post.images && post.images.length > 0 && (
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.postImageGallery}>
                        {post.images.map((image, imgIndex) => (
                          <Image key={imgIndex} source={{ uri: getAssetUrl(image) }} style={styles.postImage} />
                        ))}
                      </ScrollView>
                    )}
                    {/* Likes and Comments (simplified for RN) */}
                    <View style={styles.postActions}>
                      <View style={styles.postActionItem}>
                        <FontAwesome5 name="heart" solid size={Spacing.md} color={Colors.neutral600} />
                        <Typography variant="caption" style={styles.postActionText}>{post.likes.length} Likes</Typography>
                      </View>
                      <View style={styles.postActionItem}>
                        <FontAwesome5 name="comment" solid size={Spacing.md} color={Colors.neutral600} />
                        <Typography variant="caption" style={styles.postActionText}>{post.comments.length} Comments</Typography>
                      </View>
                    </View>
                    {/* Comments Section (simplified for RN) */}
                    {post.comments && post.comments.length > 0 && (
                      <View style={styles.commentsSection}>
                        {post.comments.map((comment, commentIndex) => (
                          <View key={commentIndex} style={styles.commentItem}>
                            <Avatar
                              source={{ uri: getUserProfilePictureUrl(comment.user.profilePicture, `${comment.user.firstName} ${comment.user.lastName}`) }}
                              size={24}
                              style={styles.commentAvatar}
                            />
                            <View style={styles.commentContent}>
                              <Typography variant="caption" style={styles.commentUserName}>{comment.userName}</Typography>
                              <Typography variant="body" style={styles.commentText}>{comment.text}</Typography>
                              <Typography variant="caption" style={styles.commentDate}>{new Date(comment.createdAt).toLocaleDateString()}</Typography>
                            </View>
                          </View>
                        ))}
                      </View>
                    )}
                  </Card>
                ))}
              </View>
            </Card>
          )}

          <Card style={styles.section}>
            <Typography variant="h4" style={styles.sectionTitle}>Reviews</Typography>
            <View style={styles.reviewsList}>
              {contractorReviews && contractorReviews.length > 0 ? (
                contractorReviews.map((review, index) => (
                  <Card key={index} style={styles.reviewCard}>
                    <View style={styles.reviewHeader}>
                      <Avatar
                        source={{ uri: getUserProfilePictureUrl(review.user?.profilePicture, `${review.user?.firstName} ${review.user?.lastName}`) }}
                        size={32}
                        style={styles.reviewAvatar}
                      />
                      <View style={styles.reviewHeaderText}>
                        <Typography variant="h6" style={styles.reviewUser}>
                          {review.user ? `${review.user.firstName} ${review.user.lastName}` : 'Anonymous User'}
                        </Typography>
                        {renderStarRating(review.rating)}
                      </View>
                    </View>
                    <Typography variant="subtitle2" style={styles.reviewTitle}>{review.title}</Typography>
                    <Typography variant="body" style={styles.reviewComment}>{review.comment}</Typography>
                    <Typography variant="caption" style={styles.reviewDate}>{new Date(review.createdAt).toLocaleDateString()}</Typography>
                  </Card>
                ))
              ) : (
                <Typography variant="body" style={styles.noContentText}>No reviews yet. Be the first to leave a review!</Typography>
              )}
            </View>

            <Card style={styles.leaveReviewContainer}>
              <Typography variant="h5" style={styles.leaveReviewTitle}>Leave a Review</Typography>
              <View style={styles.ratingInputContainer}>
                <Typography variant="label" style={styles.label}>Your Rating</Typography>
                <View style={styles.starRatingInput}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <TouchableOpacity key={star} onPress={() => setReviewRating(star)}>
                      <FontAwesome5
                        name={reviewRating >= star ? 'star' : 'star'}
                        solid={reviewRating >= star}
                        size={Spacing.xl}
                        color={reviewRating >= star ? Colors.warning : Colors.neutral300}
                        style={styles.starInputIcon}
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
                style={[styles.inputField, styles.textArea]}
                placeholder="Share details about your experience with this contractor"
                multiline
                numberOfLines={4}
                value={reviewComment}
                onChangeText={setReviewComment}
              />
              <Button
                title="Submit Review"
                onPress={handleReviewSubmit}
                style={styles.submitReviewButton}
              />
            </Card>
          </Card>

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
    textAlign: 'center',
  },
  bannerContainer: {
    position: 'relative',
    height: 250,
    backgroundColor: Colors.neutral300,
    borderBottomLeftRadius: Radii.lg,
    borderBottomRightRadius: Radii.lg,
    overflow: 'hidden',
    ...Shadows.xl,
  },
  bannerImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  profileImageContainer: {
    position: 'absolute',
    top: -135,
    left: -20,
    zIndex: 999,
    ...Shadows.lg,
  },
  profilePicture: {
    borderWidth: Spacing.xs,
    borderColor: Colors.neutral50,
    backgroundColor: Colors.neutral200,
  },
  contentContainer: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xxxl, // Adjusted for profile picture overlap
    backgroundColor: Colors.neutral100,
  },
  headerInfo: {
    marginBottom: Spacing.xl,
  },
  contractorName: {
    color: Colors.neutral900,
    marginBottom: Spacing.xs,
  },
  ratingAndBadgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  starRatingContainer: {
    flexDirection: 'row',
    marginRight: Spacing.sm,
  },
  starIcon: {
    marginRight: Spacing.xxs,
  },
  averageRatingText: {
    color: Colors.neutral900,
    marginRight: Spacing.sm,
  },
  reviewCountText: {
    color: Colors.neutral600,
    marginRight: Spacing.lg,
  },
  verifiedBadge: {
    backgroundColor: Colors.success,
    paddingVertical: Spacing.xxs,
    paddingHorizontal: Spacing.xs,
    borderRadius: Radii.sm,
    marginRight: Spacing.sm,
  },
  premiumBadge: {
    backgroundColor: Colors.warning,
    paddingVertical: Spacing.xxs,
    paddingHorizontal: Spacing.xs,
    borderRadius: Radii.sm,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.neutral50,
  },
  contactButton: {
    alignSelf: 'flex-start',
    marginTop: Spacing.md,
  },
  section: {
    marginBottom: Spacing.xl,
    padding: Spacing.lg,
  },
  sectionTitle: {
    color: Colors.neutral900,
    marginBottom: Spacing.lg,
  },
  bioText: {
    color: Colors.neutral700,
    marginBottom: Spacing.md,
  },
  detailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  detailItem: {
    width: '100%',
    color: Colors.neutral700,
    marginBottom: Spacing.xs,
  },
  detailLabel: {
    fontWeight: '700',
    color: Colors.neutral800,
  },
  servicesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: Spacing.xs,
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
    paddingVertical: Spacing.xs,
  },
  portfolioImage: {
    width: 180,
    height: 120,
    borderRadius: Radii.md,
    marginRight: Spacing.md,
    resizeMode: 'cover',
    ...Shadows.sm,
  },
  postsFeed: {
    // Styles for posts
  },
  postCard: {
    marginBottom: Spacing.lg,
    padding: Spacing.md,
    borderRadius: Radii.md,
    backgroundColor: Colors.neutral50,
    ...Shadows.sm,
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  postAvatar: {
    marginRight: Spacing.sm,
  },
  postUserName: {
    fontWeight: 'bold',
    color: Colors.neutral900,
  },
  postDate: {
    color: Colors.neutral500,
    fontSize: 12,
  },
  postCaption: {
    color: Colors.neutral800,
    marginBottom: Spacing.md,
  },
  postImageGallery: {
    paddingVertical: Spacing.xs,
  },
  postImage: {
    width: 250, // Adjust as needed
    height: 180, // Adjust as needed
    borderRadius: Radii.sm,
    marginRight: Spacing.md,
    resizeMode: 'cover',
  },
  postActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.neutral200,
    paddingTop: Spacing.sm,
  },
  postActionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: Spacing.lg,
  },
  postActionText: {
    marginLeft: Spacing.xxs,
    color: Colors.neutral600,
  },
  commentsSection: {
    marginTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.neutral200,
    paddingTop: Spacing.md,
  },
  commentItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: Spacing.sm,
  },
  commentAvatar: {
    marginRight: Spacing.sm,
  },
  commentContent: {
    flex: 1,
  },
  commentUserName: {
    fontWeight: 'bold',
    color: Colors.neutral800,
    marginBottom: Spacing.xxs,
  },
  commentText: {
    color: Colors.neutral700,
    marginBottom: Spacing.xxs,
  },
  commentDate: {
    color: Colors.neutral500,
    fontSize: 10,
  },
  reviewsList: {
    marginBottom: Spacing.md,
  },
  reviewCard: {
    marginBottom: Spacing.md,
    padding: Spacing.md,
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  reviewAvatar: {
    marginRight: Spacing.sm,
  },
  reviewHeaderText: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  reviewUser: {
    color: Colors.neutral900,
    fontWeight: 'bold',
  },
  reviewTitle: {
    color: Colors.neutral800,
    marginBottom: Spacing.xs,
  },
  reviewComment: {
    color: Colors.neutral700,
    marginBottom: Spacing.xs,
  },
  reviewDate: {
    color: Colors.neutral500,
    textAlign: 'right',
  },
  noContentText: {
    color: Colors.neutral600,
    textAlign: 'center',
    paddingVertical: Spacing.md,
  },
  leaveReviewContainer: {
    backgroundColor: Colors.neutral50,
    padding: Spacing.lg,
    marginTop: Spacing.md,
  },
  leaveReviewTitle: {
    color: Colors.neutral900,
    marginBottom: Spacing.lg,
  },
  ratingInputContainer: {
    marginBottom: Spacing.lg,
  },
  label: {
    color: Colors.neutral700,
    marginBottom: Spacing.xs,
  },
  starRatingInput: {
    flexDirection: 'row',
  },
  starInputIcon: {
    marginRight: Spacing.sm,
  },
  inputField: {
    marginBottom: Spacing.md,
  },
  textArea: {
    minHeight: 120,
    textAlignVertical: 'top',
    paddingTop: Spacing.sm,
  },
  submitReviewButton: {
    marginTop: Spacing.md,
  },
});

export default BusinessDetailScreen;