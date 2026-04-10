import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Text,
  FlatList,
  Image,
  Share,
  Linking,
  StyleSheet,
} from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import {
  getPortfolio,
  addPortfolioItem,
  updatePortfolioItem,
  deletePortfolioItem,
  updateContractorProfile,
} from '../api/contractor';
import {
  getContractorPosts,
  createPost,
  likePost,
  unlikePost,
  deletePost,
} from '../api/post';
import {
  getContractorEarnings,
  getContractorLeads,
  getContractorQuotes,
  getContractorJobs,
  getStripeConnectUrl,
  getStripeAccountStatus,
} from '../api/stripe';
import { getContractorReviews } from '../api/review';
import { useImagePicker } from '../hooks/useImagePicker';
import { Tabs, TabPanel } from '../components/common/Tabs';
import { SkeletonLoader } from '../components/common/SkeletonLoader';
import { EmptyState } from '../components/common/EmptyState';
import { ErrorState } from '../components/common/ErrorState';
import { Modal } from '../components/common/Modal';
import Input from '../components/common/Input';
import Button from '../components/common/Button';
import Card from '../components/common/Card';
import Typography from '../components/common/Typography';
import { AppHeader } from '../components/layout/AppHeader';
import { Spacing, Radii, Colors, Shadows } from '../constants/designTokens';
import { Post, Review, PortfolioItem, Quote, Lead, Job, Contractor, Earnings, StripeConnectStatus } from '../types';
const TABS = [
  { key: 'posts', label: 'Posts' },
  { key: 'about', label: 'About' },
  { key: 'services', label: 'Services' },
  { key: 'portfolio', label: 'Portfolio' },
  { key: 'reviews', label: 'Reviews' },
  { key: 'payments', label: 'Payments' },
  { key: 'promote', label: 'Promote' },
];

const PLATFORM_FEE_RATE = 0.05;

const ContractorDashboardScreen: React.FC = () => {
  const [activeTab, setActiveTab] = useState('posts');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [posts, setPosts] = useState<Post[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>([]);
  const [earnings, setEarnings] = useState<Earnings | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [stripeStatus, setStripeStatus] = useState<StripeConnectStatus | null>(null);

  const [showCreatePostModal, setShowCreatePostModal] = useState(false);
  const [showAddPortfolioModal, setShowAddPortfolioModal] = useState(false);
  const [showQuoteModal, setShowQuoteModal] = useState(false);

  const [postCaption, setPostCaption] = useState('');
  const [postTags, setPostTags] = useState('');
  const [postLocation, setPostLocation] = useState('');
  const [postImages, setPostImages] = useState<string[]>([]);

  const [portfolioItem, setPortfolioItem] = useState({ name: '', description: '', imageUrl: '' });

  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editableData, setEditableData] = useState({
    description: '',
    pricing: '',
    certifications: '',
    servicesOffered: [] as string[],
    phone: '',
    email: '',
    website: '',
    address: '',
  });

  const { pickFromLibrary, loading: imageLoading } = useImagePicker({ folder: 'ratedeed/posts' });

  const contractorId = 'current';

  const loadData = useCallback(async () => {
    try {
      setError(null);
      const [postsData, reviewsData, portfolioData, earningsData, leadsData, quotesData, jobsData, stripeData] = await Promise.all([
        getContractorPosts(contractorId).catch(() => []),
        getContractorReviews(contractorId).catch(() => ({ reviews: [] })).then(r => r.reviews || []),
        getPortfolio(contractorId).catch(() => []),
        getContractorEarnings().catch(() => null),
        getContractorLeads().catch(() => []),
        getContractorQuotes().catch(() => []),
        getContractorJobs().catch(() => []),
        getStripeAccountStatus().catch(() => ({ connected: false })),
      ]);

      setPosts(Array.isArray(postsData) ? postsData : []);
      setReviews(Array.isArray(reviewsData) ? reviewsData : []);
      setPortfolio(Array.isArray(portfolioData) ? portfolioData : []);
      setEarnings(earningsData);
      setLeads(Array.isArray(leadsData) ? leadsData : []);
      setQuotes(Array.isArray(quotesData) ? quotesData : []);
      setJobs(Array.isArray(jobsData) ? jobsData : []);
      setStripeStatus(stripeData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [contractorId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  const handleLikePost = async (postId: string, isLiked: boolean) => {
    try {
      if (isLiked) {
        await unlikePost(postId);
      } else {
        await likePost(postId);
      }
      setPosts(prev => prev.map(p => {
        if (p._id === postId) {
          const userId = 'current';
          return {
            ...p,
            likes: isLiked ? p.likes.filter(id => id !== userId) : [...p.likes, userId],
          };
        }
        return p;
      }));
    } catch (err) {
      Alert.alert('Error', 'Failed to update like');
    }
  };

  const handleDeletePost = async (postId: string) => {
    Alert.alert('Delete Post', 'Are you sure you want to delete this post?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deletePost(postId);
            setPosts(prev => prev.filter(p => p._id !== postId));
          } catch (err) {
            Alert.alert('Error', 'Failed to delete post');
          }
        },
      },
    ]);
  };

  const handleCreatePost = async () => {
    if (!postCaption.trim()) {
      Alert.alert('Error', 'Caption is required');
      return;
    }

    try {
      const tags = postTags.split(',').map(t => t.trim()).filter(Boolean);
      await createPost({
        caption: postCaption,
        images: postImages,
        tags,
        location: postLocation,
      });
      setPostCaption('');
      setPostTags('');
      setPostLocation('');
      setPostImages([]);
      setShowCreatePostModal(false);
      loadData();
      Alert.alert('Success', 'Post created successfully');
    } catch (err) {
      Alert.alert('Error', 'Failed to create post');
    }
  };

  const handleAddImage = async () => {
    const url = await pickFromLibrary();
    if (url) {
      setPostImages(prev => [...prev, url]);
    }
  };

  const formatCurrency = (amount: number) => {
    return '$' + Number(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const getQuoteStatusColor = (status: string) => {
    switch (status) {
      case 'accepted': return Colors.success500;
      case 'rejected': return Colors.error500;
      default: return Colors.warning500;
    }
  };

  const getJobStatusColor = (status: string) => {
    switch (status) {
      case 'completed_paid': return Colors.success500;
      case 'awaiting_payment': return Colors.warning500;
      default: return Colors.primary500;
    }
  };

  const renderStars = (rating: number) => {
    return '★'.repeat(Math.floor(rating)) + '☆'.repeat(5 - Math.floor(rating));
  };

  if (loading) {
    return (
      <View style={styles.fullScreenContainer}>
        <AppHeader title="Contractor Dashboard" />
        <View style={styles.loadingContainer}>
          <SkeletonLoader type="card" count={3} />
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.fullScreenContainer}>
        <AppHeader title="Contractor Dashboard" />
        <ErrorState message={error} onRetry={loadData} />
      </View>
    );
  }

  return (
    <View style={styles.fullScreenContainer}>
      <AppHeader title="Contractor Dashboard" />
      <Tabs tabs={TABS} activeTab={activeTab} onTabChange={setActiveTab} />

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <TabPanel isActive={activeTab === 'posts'}>
          <View style={styles.tabContent}>
            <Card style={styles.createPostCard}>
              <TouchableOpacity onPress={() => setShowCreatePostModal(true)}>
                <View style={styles.createPostInput}>
                  <Text style={styles.createPostPlaceholder}>What's new with your projects?</Text>
                </View>
              </TouchableOpacity>
              <View style={styles.createPostActions}>
                <TouchableOpacity style={styles.createPostAction} onPress={() => setShowCreatePostModal(true)}>
                  <FontAwesome5 name="camera" size={18} color={Colors.neutral600} />
                  <Text style={styles.createPostActionText}>Photo</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.createPostAction}>
                  <FontAwesome5 name="map-marker-alt" size={18} color={Colors.neutral600} />
                  <Text style={styles.createPostActionText}>Location</Text>
                </TouchableOpacity>
              </View>
            </Card>

            {posts.length === 0 ? (
              <EmptyState
                title="No posts yet"
                message="Share updates about your projects and business"
                actionLabel="Create Post"
                onAction={() => setShowCreatePostModal(true)}
                icon="📝"
              />
            ) : (
              posts.map(post => (
                <Card key={post._id} style={styles.postCard}>
                  <View style={styles.postHeader}>
                    <View style={styles.postAvatar}>
                      <Text style={styles.postAvatarText}>{post.contractor?.user?.firstName?.[0] || 'C'}</Text>
                    </View>
                    <View style={styles.postAuthorInfo}>
                      <Typography variant="body" style={styles.postAuthorName}>
                        {post.contractor?.user?.firstName} {post.contractor?.user?.lastName}
                      </Typography>
                      <Text style={styles.postDate}>{formatDate(post.createdAt)}</Text>
                    </View>
                    <TouchableOpacity onPress={() => handleDeletePost(post._id)}>
                      <FontAwesome5 name="trash" size={16} color={Colors.neutral400} />
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.postCaption}>{post.caption}</Text>
                  {post.images?.length > 0 && (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.postImages}>
                      {post.images.map((img, idx) => (
                        <Image key={idx} source={{ uri: img }} style={styles.postImage} />
                      ))}
                    </ScrollView>
                  )}
                  <View style={styles.postFooter}>
                    <TouchableOpacity
                      style={styles.postAction}
                      onPress={() => handleLikePost(post._id, post.likes.includes('current'))}
                    >
                      <FontAwesome5 
                        name="heart" 
                        size={16} 
                        color={post.likes.includes("current") ? '#ef4444' : Colors.neutral500} 
                      />
                      <Text style={[styles.postActionText, post.likes.includes("current") && styles.postActionTextActive]}>
                        {post.likes.length}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.postAction}>
                      <FontAwesome5 name="comment" size={16} color={Colors.neutral500} />
                      <Text style={styles.postActionText}>{post.comments?.length || 0}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.postAction}>
                      <FontAwesome5 name="share" size={16} color={Colors.neutral500} />
                      <Text style={styles.postActionText}>Share</Text>
                    </TouchableOpacity>
                  </View>
                </Card>
              ))
            )}
          </View>
        </TabPanel>

        <TabPanel isActive={activeTab === 'about'}>
          <View style={styles.tabContent}>
            <Card style={styles.aboutCard}>
              <Typography variant="h5" style={styles.sectionTitle}>About Us</Typography>
              <Typography variant="body" style={styles.aboutText}>
                {editableData.description || 'Write a compelling bio about your business...'}
              </Typography>
              <View style={styles.aboutStatsRow}>
                <View style={styles.aboutStatBox}>
                  <Text style={styles.aboutStatLabel}>Pricing</Text>
                  <Text style={styles.aboutStatValue}>{editableData.pricing || 'Contact for quote'}</Text>
                </View>
                <View style={styles.aboutStatBox}>
                  <Text style={styles.aboutStatLabel}>Certifications</Text>
                  <Text style={styles.aboutStatValue}>{editableData.certifications || 'Licensed, Bonded, Insured'}</Text>
                </View>
              </View>
              <Button title="Edit Profile" onPress={() => setIsEditingProfile(true)} style={styles.editButton} />
            </Card>

            <Card style={styles.hoursCard}>
              <Typography variant="h5" style={styles.sectionTitle}>Business Hours</Typography>
              {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map(day => (
                <View key={day} style={styles.hoursRow}>
                  <Text style={styles.hoursDay}>{day}</Text>
                  <Text style={styles.hoursTime}>9:00 AM - 5:00 PM</Text>
                </View>
              ))}
            </Card>
          </View>
        </TabPanel>

        <TabPanel isActive={activeTab === 'services'}>
          <View style={styles.tabContent}>
            {editableData.servicesOffered.length === 0 ? (
              <EmptyState
                title="No services listed"
                message="Add your services to help clients understand what you offer"
                actionLabel="Add Services"
                onAction={() => setIsEditingProfile(true)}
                icon="🔧"
              />
            ) : (
              <View style={styles.servicesGrid}>
                {editableData.servicesOffered.map((service, idx) => (
                  <View key={idx} style={styles.serviceTag}>
                    <Text style={styles.serviceTagText}>{service}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </TabPanel>

        <TabPanel isActive={activeTab === 'portfolio'}>
          <View style={styles.tabContent}>
            <View style={styles.reviewsHeader}>
              <Typography variant="h5">Our Portfolio</Typography>
              <Button title="Add Project" onPress={() => setShowAddPortfolioModal(true)} size="sm" />
            </View>
            {portfolio.length === 0 ? (
              <EmptyState
                title="Portfolio Empty"
                message="Showcase your best work by adding projects to your portfolio"
                actionLabel="Add Project"
                onAction={() => setShowAddPortfolioModal(true)}
                icon="🖼️"
              />
            ) : (
              <View style={styles.portfolioGrid}>
                {portfolio.map(item => (
                  <Card key={item.imageUrl} style={styles.portfolioCard}>
                    <Image source={{ uri: item.imageUrl }} style={styles.portfolioImage} />
                    <View style={styles.portfolioInfo}>
                      <Typography variant="body" style={styles.leadName}>{item.name}</Typography>
                      <Typography variant="caption" style={styles.leadDate} numberOfLines={2}>
                        {item.description}
                      </Typography>
                    </View>
                  </Card>
                ))}
              </View>
            )}
          </View>
        </TabPanel>

        <TabPanel isActive={activeTab === 'reviews'}>
          <View style={styles.tabContent}>
            <View style={styles.reviewsHeader}>
              <View>
                <Typography variant="h5">Customer Reviews</Typography>
              </View>
              <View style={styles.reviewsOverview}>
                <Text style={styles.reviewsRating}>
                  {reviews.length > 0 ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1) : '0.0'}
                </Text>
                <Text style={styles.reviewsStars}>{renderStars(reviews.length > 0 ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length : 0)}</Text>
              </View>
            </View>
            {reviews.length === 0 ? (
              <EmptyState
                title="No Reviews Yet"
                message="Reviews from your clients will appear here"
                icon="⭐"
              />
            ) : (
              reviews.map(review => (
                <Card key={review._id} style={styles.reviewCard}>
                  <View style={styles.reviewHeader}>
                    <View style={styles.reviewAvatar}>
                      <Text>{review.user?.firstName?.[0] || 'U'}</Text>
                    </View>
                    <View>
                      <Typography variant="body" style={styles.leadName}>
                        {review.user?.firstName} {review.user?.lastName}
                      </Typography>
                      <Text style={styles.reviewStars}>{renderStars(review.rating)}</Text>
                    </View>
                  </View>
                  {review.title && <Text style={styles.reviewTitle}>{review.title}</Text>}
                  <Text style={styles.reviewComment}>{review.comment}</Text>
                  <Text style={styles.leadDate}>{formatDate(review.createdAt)}</Text>
                </Card>
              ))
            )}
          </View>
        </TabPanel>

        <TabPanel isActive={activeTab === 'payments'}>
          <View style={styles.tabContent}>
            {!stripeStatus?.connected && (
              <Card style={styles.stripeCard}>
                <Text style={styles.stripeIcon}>💳</Text>
                <Typography variant="h6">Payments via Stripe</Typography>
                <Typography variant="body" style={styles.stripeDescription}>
                  Set up your Stripe account to send professional quotes and receive secure payments.
                </Typography>
                <Button title="Connect Stripe Account" onPress={async () => {
                  try {
                    const { url } = await getStripeConnectUrl();
                    Linking.openURL(url);
                  } catch (err) {
                    Alert.alert('Error', 'Failed to connect Stripe');
                  }
                }} />
              </Card>
            )}

            <View style={styles.earningsRow}>
              <Card style={styles.earningsCard}>
                <Text style={styles.earningsLabel}>Total Earnings</Text>
                <Text style={styles.reviewsRating}>{formatCurrency(earnings?.totalEarnings || 0)}</Text>
              </Card>
              <Card style={styles.earningsCard}>
                <Text style={styles.earningsLabel}>Pending Escrow</Text>
                <Text style={[styles.earningsValue, styles.earningsPending]}>
                  {formatCurrency(earnings?.pendingEscrow || 0)}
                </Text>
              </Card>
              <Card style={styles.earningsCard}>
                <Text style={styles.earningsLabel}>Active Jobs</Text>
                <Text style={styles.reviewsRating}>{jobs.filter(j => j.status === 'funded_in_progress').length}</Text>
              </Card>
            </View>

            <Card style={styles.leadsSection}>
              <Typography variant="h6" style={styles.sectionTitle}>New Inquiries (Leads)</Typography>
              {leads.length === 0 ? (
                <Text style={styles.emptyText}>No new inquiries yet.</Text>
              ) : (
                leads.map(lead => (
                  <View key={lead._id} style={styles.leadRow}>
                    <View>
                      <Text style={styles.leadName}>{(lead.user as any)?.firstName} {(lead.user as any)?.lastName}</Text>
                      <Text style={styles.leadProject}>{lead.projectTitle}</Text>
                    </View>
                    <Text style={styles.leadDate}>{formatDate(lead.createdAt)}</Text>
                  </View>
                ))
              )}
            </Card>

            <Card style={styles.leadsSection}>
              <Typography variant="h6" style={styles.sectionTitle}>Quotes Sent</Typography>
              {quotes.length === 0 ? (
                <Text style={styles.emptyText}>No quotes sent yet.</Text>
              ) : (
                quotes.map(quote => (
                  <View key={quote._id} style={styles.leadRow}>
                    <View>
                      <Text style={styles.leadName}>{(quote.user as any)?.firstName} {(quote.user as any)?.lastName}</Text>
                      <Text style={styles.leadProject}>{formatCurrency(quote.totalAmount / 100)}</Text>
                    </View>
                    <View style={[styles.quoteStatusBadge, { backgroundColor: getQuoteStatusColor(quote.status) + "20" }]}>
                      <Text style={[styles.quoteStatusText, { color: getQuoteStatusColor(quote.status) }]}>
                        {quote.status.replace('_', ' ')}
                      </Text>
                    </View>
                  </View>
                ))
              )}
            </Card>
          </View>
        </TabPanel>

        <TabPanel isActive={activeTab === 'promote'}>
          <View style={styles.tabContent}>
            <Card>
              <Typography variant="h5" style={styles.sectionTitle}>Share Your Profile</Typography>
              <Typography variant="body" style={styles.promoteText}>
                Copy your direct profile link to share with clients or add to your social media bios.
              </Typography>
              <View style={styles.shareUrlContainer}>
                <Text style={styles.shareUrl} numberOfLines={1}>https://ratedeed.com/contractor/your-profile</Text>
                <TouchableOpacity style={styles.portfolioInfo} onPress={() => Alert.alert('Copied!', 'Link copied to clipboard')}>
                  <Text style={styles.copyButtonText}>📋</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.socialButtons}>
                <TouchableOpacity style={[styles.socialButton, { backgroundColor: '#1877F2' }]}>
                  <Text style={styles.socialIcon}>📘</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.socialButton, { backgroundColor: '#1DA1F2' }]}>
                  <Text style={styles.socialIcon}>🐦</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.socialButton, { backgroundColor: '#0A66C2' }]}>
                  <Text style={styles.socialIcon}>💼</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.socialButton, { backgroundColor: '#25D366' }]}>
                  <Text style={styles.socialIcon}>💬</Text>
                </TouchableOpacity>
              </View>
            </Card>
          </View>
        </TabPanel>
      </ScrollView>

      <Modal visible={showCreatePostModal} onClose={() => setShowCreatePostModal(false)} title="Create Post">
        <Input
          label="Caption"
          multiline
          numberOfLines={3}
          value={postCaption}
          onChangeText={setPostCaption}
          placeholder="What's new with your projects?"
        />
        <Input
          label="Tags (comma-separated)"
          value={postTags}
          onChangeText={setPostTags}
          placeholder="#Renovation, #Bathroom"
        />
        <Input
          label="Location (Optional)"
          value={postLocation}
          onChangeText={setPostLocation}
          placeholder="e.g., Queens, NY"
        />
        <View style={styles.imageUploadSection}>
          <TouchableOpacity style={styles.imageUploadButton} onPress={handleAddImage} disabled={imageLoading}>
            <Text style={styles.imageUploadIcon}>📷</Text>
            <Text style={styles.imageUploadText}>{imageLoading ? 'Uploading...' : 'Add Photos'}</Text>
          </TouchableOpacity>
          {postImages.length > 0 && (
            <ScrollView horizontal style={styles.leadsSection}>
              {postImages.map((img, idx) => (
                <View key={idx} style={styles.imagePreviewItem}>
                  <Image source={{ uri: img }} style={styles.imagePreview} />
                  <TouchableOpacity
                    style={styles.imageRemoveButton}
                    onPress={() => setPostImages(prev => prev.filter((_, i) => i !== idx))}
                  >
                    <Text>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          )}
        </View>
        <Button title="Publish Post" onPress={handleCreatePost} />
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  fullScreenContainer: {
    flex: 1,
    backgroundColor: Colors.neutral50,
  },
  loadingContainer: {
    flex: 1,
    padding: Spacing.lg,
  },
  content: {
    flex: 1,
  },
  tabContent: {
    padding: Spacing.lg,
  },
  createPostCard: {
    marginBottom: Spacing.lg,
  },
  createPostInput: {
    backgroundColor: Colors.neutral100,
    borderRadius: Radii.md,
    padding: Spacing.md,
    minHeight: 50,
    justifyContent: 'center',
  },
  createPostPlaceholder: {
    color: Colors.neutral500,
    fontSize: 14,
  },
  createPostActions: {
    flexDirection: 'row',
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.neutral200,
    gap: Spacing.lg,
  },
  createPostAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  createPostActionIcon: {
    fontSize: 18,
  },
  createPostActionText: {
    color: Colors.neutral600,
    fontSize: 14,
  },
  postCard: {
    marginBottom: Spacing.lg,
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  postAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary500,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.sm,
  },
  postAvatarText: {
    color: Colors.neutral50,
    fontSize: 16,
    fontWeight: '600',
  },
  postAuthorInfo: {
    flex: 1,
  },
  postAuthorName: {
    fontWeight: '600',
    color: Colors.neutral900,
  },
  postDate: {
    color: Colors.neutral500,
    fontSize: 12,
  },
  deleteButton: {
    fontSize: 18,
  },
  postCaption: {
    color: Colors.neutral800,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: Spacing.md,
  },
  postImages: {
    marginBottom: Spacing.md,
  },
  postImage: {
    width: 200,
    height: 150,
    borderRadius: Radii.md,
    marginRight: Spacing.sm,
  },
  postFooter: {
    flexDirection: 'row',
    gap: Spacing.xl,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.neutral200,
  },
  postAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  postActionText: {
    color: Colors.neutral600,
    fontSize: 14,
  },
  postActionTextActive: {
    color: '#ef4444',
  },
  liked: {
    color: '#ef4444',
  },
  sectionTitle: {
    marginBottom: Spacing.md,
  },
  aboutCard: {
    marginBottom: Spacing.lg,
  },
  aboutText: {
    color: Colors.neutral700,
    lineHeight: 24,
    marginBottom: Spacing.lg,
  },
  aboutStatsRow: {
    flexDirection: 'row',
    gap: Spacing.lg,
  },
  aboutStatBox: {
    flex: 1,
    backgroundColor: Colors.neutral100,
    padding: Spacing.md,
    borderRadius: Radii.md,
  },
  aboutStatLabel: {
    fontSize: 12,
    color: Colors.neutral500,
    textTransform: 'uppercase',
    marginBottom: Spacing.xs,
  },
  aboutStatValue: {
    color: Colors.neutral900,
    fontWeight: '600',
  },
  hoursCard: {
    marginTop: Spacing.lg,
  },
  hoursRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.neutral200,
  },
  hoursDay: {
    color: Colors.neutral600,
  },
  hoursTime: {
    color: Colors.neutral900,
    fontWeight: '500',
  },
  editButton: {
    marginTop: Spacing.lg,
  },
  servicesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  serviceTag: {
    backgroundColor: Colors.primary100,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radii.round,
  },
  serviceTagText: {
    color: Colors.primary700,
    fontWeight: '500',
  },
  portfolioGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  portfolioCard: {
    width: '48%',
    overflow: 'hidden',
    marginBottom: Spacing.md,
  },
  portfolioImage: {
    width: '100%',
    height: 120,
  },
  portfolioInfo: {
    padding: Spacing.sm,
  },
  portfolioName: {
    fontWeight: '600',
    color: Colors.neutral900,
  },
  portfolioDesc: {
    fontSize: 12,
    color: Colors.neutral500,
  },
  reviewsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  reviewsOverview: {
    alignItems: 'center',
  },
  reviewsRating: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.neutral900,
  },
  reviewsStars: {
    color: '#f59e0b',
    fontSize: 14,
  },
  reviewCard: {
    marginBottom: Spacing.lg,
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  reviewAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primary500,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.sm,
  },
  reviewAvatarText: {
    color: Colors.neutral50,
    fontSize: 14,
    fontWeight: '600',
  },
  reviewAuthor: {
    fontWeight: '600',
    color: Colors.neutral900,
  },
  reviewStars: {
    color: '#f59e0b',
    fontSize: 12,
  },
  reviewTitle: {
    fontWeight: '600',
    color: Colors.neutral900,
    marginBottom: Spacing.xs,
  },
  reviewComment: {
    color: Colors.neutral600,
    lineHeight: 20,
    marginBottom: Spacing.sm,
  },
  reviewDate: {
    color: Colors.neutral400,
    fontSize: 12,
  },
  stripeCard: {
    alignItems: 'center',
    padding: Spacing.xl,
    marginBottom: Spacing.lg,
  },
  stripeIcon: {
    fontSize: 48,
    marginBottom: Spacing.md,
  },
  earningsRow: {
    flexDirection: 'row',
    gap: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  earningsCard: {
    flex: 1,
    alignItems: 'center',
  },
  earningsLabel: {
    fontSize: 12,
    color: Colors.neutral500,
    textTransform: 'uppercase',
    marginBottom: Spacing.xs,
  },
  earningsValue: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.neutral900,
  },
  earningsPending: {
    color: Colors.primary600,
  },
  leadsSection: {
    marginTop: Spacing.lg,
  },
  leadRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.neutral200,
  },
  leadInfo: {},
  leadName: {
    fontWeight: '600',
    color: Colors.neutral900,
  },
  leadProject: {
    color: Colors.neutral500,
    fontSize: 13,
  },
  leadDate: {
    color: Colors.neutral400,
    fontSize: 12,
  },
  quoteRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.neutral200,
  },
  quoteStatusBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: Radii.sm,
  },
  quoteStatusText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  promoteCard: {
    marginBottom: Spacing.lg,
  },
  profileLinkBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.neutral100,
    borderRadius: Radii.md,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.lg,
  },
  profileLinkText: {
    flex: 1,
    color: Colors.neutral500,
    fontSize: 13,
    paddingVertical: Spacing.md,
  },
  copyButton: {
    padding: Spacing.sm,
  },
  socialButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.lg,
  },
  socialButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  createPostModal: {
    padding: Spacing.lg,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.neutral900,
    marginBottom: Spacing.lg,
  },
  inputGroup: {
    marginBottom: Spacing.lg,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.neutral700,
    marginBottom: Spacing.xs,
  },
  imageUploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.lg,
    borderWidth: 2,
    borderColor: Colors.neutral300,
    borderRadius: Radii.md,
    borderStyle: 'dashed',
  },
  imageUploadText: {
    color: Colors.neutral500,
    fontWeight: '500',
  },
  imagePreviewScroll: {
    marginTop: Spacing.md,
  },
  imagePreview: {
    marginRight: Spacing.sm,
    position: 'relative',
  },
  imageRemoveButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.error500,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  modalButton: {
    flex: 1,
  },

  stripeDescription: {
    textAlign: 'center',
    marginBottom: Spacing.md,
    color: Colors.neutral500,
  },


  emptyText: {
    color: Colors.neutral500,
    textAlign: 'center',
    paddingVertical: Spacing.lg,
  },
  promoteText: {
    color: Colors.neutral600,
    marginBottom: Spacing.md,
  },
  shareUrlContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.neutral100,
    borderRadius: Radii.md,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.lg,
  },
  shareUrl: {
    flex: 1,
    color: Colors.neutral600,
    fontSize: 13,
    paddingVertical: Spacing.md,
  },
  copyButtonText: {
    fontSize: 18,
  },
  socialIcon: {
    fontSize: 20,
  },
  imageUploadSection: {
    marginVertical: Spacing.md,
  },
  imageUploadIcon: {
    fontSize: 24,
    marginRight: Spacing.sm,
  },
  imagePreviewItem: {
    marginRight: Spacing.sm,
    position: 'relative',
  },
});

export default ContractorDashboardScreen;
