import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
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
} from 'react-native';
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
import Header from '../components/common/Header';
import Card from '../components/common/Card';
import Typography from '../components/common/Typography';
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
        <Header title="Contractor Dashboard" />
        <View style={styles.loadingContainer}>
          <SkeletonLoader type="card" count={3} />
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.fullScreenContainer}>
        <Header title="Contractor Dashboard" />
        <ErrorState message={error} onRetry={loadData} />
      </View>
    );
  }

  return (
    <View style={styles.fullScreenContainer}>
      <Header title="Contractor Dashboard" />
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
                  <Text style={styles.createPostActionIcon}>📷</Text>
                  <Text style={styles.createPostActionText}>Photo</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.createPostAction}>
                  <Text style={styles.createPostActionIcon}>📍</Text>
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
                    <View style={styles.postAuthor}>
                      <View style={styles.postAvatar}>
                        <Text>{post.contractor?.user?.firstName?.[0] || 'C'}</Text>
                      </View>
                      <View>
                        <Typography variant="body" style={styles.postAuthorName}>
                          {post.contractor?.user?.firstName} {post.contractor?.user?.lastName}
                        </Typography>
                        <Typography variant="caption" style={styles.postDate}>
                          {formatDate(post.createdAt)}
                        </Typography>
                      </View>
                    </View>
                    <TouchableOpacity onPress={() => handleDeletePost(post._id)}>
                      <Text style={styles.deleteButton}>🗑️</Text>
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.postCaption}>{post.caption}</Text>
                  {post.images?.length > 0 && (
                    <ScrollView horizontal style={styles.postImages} showsHorizontalScrollIndicator={false}>
                      {post.images.map((img, idx) => (
                        <Image key={idx} source={{ uri: img }} style={styles.postImage} />
                      ))}
                    </ScrollView>
                  )}
                  <View style={styles.postActions}>
                    <TouchableOpacity
                      style={styles.postAction}
                      onPress={() => handleLikePost(post._id, post.likes.includes('current'))}
                    >
                      <Text style={[styles.postActionIcon, post.likes.includes('current') && styles.liked]}>
                        {post.likes.includes('current') ? '❤️' : '🤍'} {post.likes.length}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.postAction}>
                      <Text style={styles.postActionIcon}>💬 {post.comments?.length || 0}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.postAction}>
                      <Text style={styles.postActionIcon}>📤 Share</Text>
                    </TouchableOpacity>
                  </View>
                </Card>
              ))
            )}
          </View>
        </TabPanel>

        <TabPanel isActive={activeTab === 'about'}>
          <View style={styles.tabContent}>
            <Card>
              <Typography variant="h5" style={styles.sectionTitle}>About Us</Typography>
              <Typography variant="body" style={styles.aboutText}>
                {editableData.description || 'Write a compelling bio about your business...'}
              </Typography>
              <View style={styles.aboutGrid}>
                <View style={styles.aboutItem}>
                  <Text style={styles.aboutLabel}>Pricing</Text>
                  <Text style={styles.aboutValue}>{editableData.pricing || 'Contact for quote'}</Text>
                </View>
                <View style={styles.aboutItem}>
                  <Text style={styles.aboutLabel}>Certifications</Text>
                  <Text style={styles.aboutValue}>{editableData.certifications || 'Licensed, Bonded, Insured'}</Text>
                </View>
              </View>
              <Button title="Edit Profile" onPress={() => setIsEditingProfile(true)} style={styles.editButton} />
            </Card>

            <Card style={styles.marginTop}>
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
            <View style={styles.portfolioHeader}>
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
                  <Card key={item.imageUrl} style={styles.portfolioItem}>
                    <Image source={{ uri: item.imageUrl }} style={styles.portfolioImage} />
                    <View style={styles.portfolioInfo}>
                      <Typography variant="body" style={styles.portfolioName}>{item.name}</Typography>
                      <Typography variant="caption" style={styles.portfolioDesc} numberOfLines={2}>
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
              <View style={styles.ratingBadge}>
                <Text style={styles.ratingValue}>
                  {reviews.length > 0 ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1) : '0.0'}
                </Text>
                <Text style={styles.ratingStars}>{renderStars(reviews.length > 0 ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length : 0)}</Text>
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
                      <Typography variant="body" style={styles.reviewAuthor}>
                        {review.user?.firstName} {review.user?.lastName}
                      </Typography>
                      <Text style={styles.reviewStars}>{renderStars(review.rating)}</Text>
                    </View>
                  </View>
                  {review.title && <Text style={styles.reviewTitle}>{review.title}</Text>}
                  <Text style={styles.reviewComment}>{review.comment}</Text>
                  <Text style={styles.reviewDate}>{formatDate(review.createdAt)}</Text>
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
                <Typography variant="body" style={styles.stripeText}>
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

            <View style={styles.statsGrid}>
              <Card style={styles.statCard}>
                <Text style={styles.statLabel}>Total Earnings</Text>
                <Text style={styles.statValue}>{formatCurrency(earnings?.totalEarnings || 0)}</Text>
              </Card>
              <Card style={styles.statCard}>
                <Text style={styles.statLabel}>Pending Escrow</Text>
                <Text style={[styles.statValue, { color: Colors.primary500 }]}>
                  {formatCurrency(earnings?.pendingEscrow || 0)}
                </Text>
              </Card>
              <Card style={styles.statCard}>
                <Text style={styles.statLabel}>Active Jobs</Text>
                <Text style={styles.statValue}>{jobs.filter(j => j.status === 'funded_in_progress').length}</Text>
              </Card>
            </View>

            <Card style={styles.marginTop}>
              <Typography variant="h6" style={styles.sectionTitle}>New Inquiries (Leads)</Typography>
              {leads.length === 0 ? (
                <Text style={styles.emptyText}>No new inquiries yet.</Text>
              ) : (
                leads.map(lead => (
                  <View key={lead._id} style={styles.leadItem}>
                    <View>
                      <Text style={styles.leadName}>{(lead.user as any)?.firstName} {(lead.user as any)?.lastName}</Text>
                      <Text style={styles.leadProject}>{lead.projectTitle}</Text>
                    </View>
                    <Text style={styles.leadDate}>{formatDate(lead.createdAt)}</Text>
                  </View>
                ))
              )}
            </Card>

            <Card style={styles.marginTop}>
              <Typography variant="h6" style={styles.sectionTitle}>Quotes Sent</Typography>
              {quotes.length === 0 ? (
                <Text style={styles.emptyText}>No quotes sent yet.</Text>
              ) : (
                quotes.map(quote => (
                  <View key={quote._id} style={styles.quoteItem}>
                    <View>
                      <Text style={styles.quoteClient}>{(quote.user as any)?.firstName} {(quote.user as any)?.lastName}</Text>
                      <Text style={styles.quoteAmount}>{formatCurrency(quote.totalAmount / 100)}</Text>
                    </View>
                    <View style={[styles.quoteStatus, { backgroundColor: getQuoteStatusColor(quote.status) + '20' }]}>
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
                <TouchableOpacity style={styles.copyButton} onPress={() => Alert.alert('Copied!', 'Link copied to clipboard')}>
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
            <ScrollView horizontal style={styles.imagePreviewList}>
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
    backgroundColor: Colors.neutral100,
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
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  postAuthor: {
    flexDirection: 'row',
    alignItems: 'center',
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
  postActions: {
    flexDirection: 'row',
    gap: Spacing.xl,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.neutral200,
  },
  postAction: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  postActionIcon: {
    fontSize: 14,
  },
  liked: {
    color: Colors.error500,
  },
  sectionTitle: {
    marginBottom: Spacing.md,
  },
  aboutText: {
    color: Colors.neutral700,
    lineHeight: 24,
    marginBottom: Spacing.lg,
  },
  aboutGrid: {
    flexDirection: 'row',
    gap: Spacing.lg,
  },
  aboutItem: {
    flex: 1,
    backgroundColor: Colors.neutral100,
    padding: Spacing.md,
    borderRadius: Radii.md,
  },
  aboutLabel: {
    fontSize: 12,
    color: Colors.neutral500,
    textTransform: 'uppercase',
    marginBottom: Spacing.xs,
  },
  aboutValue: {
    color: Colors.neutral900,
    fontWeight: '600',
  },
  editButton: {
    marginTop: Spacing.lg,
  },
  hoursRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.neutral100,
  },
  hoursDay: {
    color: Colors.neutral700,
  },
  hoursTime: {
    color: Colors.neutral900,
    fontWeight: '500',
  },
  servicesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  serviceTag: {
    backgroundColor: Colors.primary100,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radii.round,
  },
  serviceTagText: {
    color: Colors.primary700,
    fontWeight: '500',
  },
  portfolioHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  portfolioGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  portfolioItem: {
    width: '48%',
    padding: 0,
    overflow: 'hidden',
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
    color: Colors.neutral600,
  },
  reviewsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  ratingBadge: {
    alignItems: 'center',
  },
  ratingValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.neutral900,
  },
  ratingStars: {
    color: Colors.warning500,
    fontSize: 14,
  },
  reviewCard: {
    marginBottom: Spacing.md,
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
  reviewAuthor: {
    fontWeight: '600',
    color: Colors.neutral900,
  },
  reviewStars: {
    color: Colors.warning500,
    fontSize: 12,
  },
  reviewTitle: {
    fontWeight: '600',
    color: Colors.neutral900,
    marginBottom: Spacing.xs,
  },
  reviewComment: {
    color: Colors.neutral700,
    lineHeight: 20,
    marginBottom: Spacing.sm,
  },
  reviewDate: {
    color: Colors.neutral500,
    fontSize: 12,
  },
  stripeCard: {
    alignItems: 'center',
    padding: Spacing.xl,
    marginBottom: Spacing.lg,
    backgroundColor: Colors.primary50,
  },
  stripeIcon: {
    fontSize: 48,
    marginBottom: Spacing.md,
  },
  stripeText: {
    textAlign: 'center',
    marginBottom: Spacing.lg,
    color: Colors.neutral600,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 12,
    color: Colors.neutral500,
    textTransform: 'uppercase',
    marginBottom: Spacing.xs,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.neutral900,
  },
  marginTop: {
    marginTop: Spacing.lg,
  },
  emptyText: {
    color: Colors.neutral500,
    textAlign: 'center',
    paddingVertical: Spacing.lg,
  },
  leadItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.neutral100,
  },
  leadName: {
    fontWeight: '600',
    color: Colors.neutral900,
  },
  leadProject: {
    color: Colors.neutral600,
    fontSize: 13,
  },
  leadDate: {
    color: Colors.neutral500,
    fontSize: 12,
  },
  quoteItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.neutral100,
  },
  quoteClient: {
    fontWeight: '600',
    color: Colors.neutral900,
  },
  quoteAmount: {
    color: Colors.neutral700,
    fontSize: 13,
  },
  quoteStatus: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Radii.sm,
  },
  quoteStatusText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
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
  copyButton: {
    padding: Spacing.sm,
  },
  copyButtonText: {
    fontSize: 18,
  },
  socialButtons: {
    flexDirection: 'row',
    gap: Spacing.md,
    justifyContent: 'center',
  },
  socialButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  socialIcon: {
    fontSize: 20,
  },
  imageUploadSection: {
    marginVertical: Spacing.md,
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
  imageUploadIcon: {
    fontSize: 24,
    marginRight: Spacing.sm,
  },
  imageUploadText: {
    color: Colors.neutral600,
    fontWeight: '500',
  },
  imagePreviewList: {
    marginTop: Spacing.md,
  },
  imagePreviewItem: {
    marginRight: Spacing.sm,
    position: 'relative',
  },
  imagePreview: {
    width: 80,
    height: 80,
    borderRadius: Radii.sm,
  },
  imageRemoveButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: Colors.error500,
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default ContractorDashboardScreen;
