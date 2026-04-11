import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  ScrollView,
  Pressable,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Text,
  Image,
  TextInput,
  Linking,
} from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import {
  fetchContractorPosts,
  createPost,
  likePost,
  unlikePost,
  deletePost,
  getContractorEarnings,
  getContractorLeads,
  getContractorQuotes,
  getContractorJobs,
  getStripeConnectUrl,
  getStripeAccountStatus,
  fetchContractorReviews,
  updateContractorProfile,
  getContractorDetails,
  updateBannerImage,
  updateProfilePicture,
  get,
  getAuthHeaders,
  post as apiPost,
} from '../api';
import * as ImagePicker from 'expo-image-picker';
import { API_BASE_URL } from '../config';
import { getCoverImageUrl, getProfileImageUrl, isSvgUrl } from '../utils/avatarUtils';
import { SvgImage } from '../components/common/SvgImage';

const TABS = [
  { key: 'posts', label: 'Posts' },
  { key: 'about', label: 'About Us' },
  { key: 'services', label: 'Services' },
  { key: 'portfolio', label: 'Portfolio' },
  { key: 'reviews', label: 'Reviews' },
  { key: 'payments', label: 'Payments & Jobs' },
  { key: 'promote', label: 'Promote' },
];

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function formatCurrency(amount: number) {
  return '$' + Number(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ---- Status Badge ----
function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; bg: string; text: string }> = {
    pending: { label: 'Pending', bg: 'bg-amber-100', text: 'text-amber-800' },
    accepted: { label: 'Accepted', bg: 'bg-emerald-100', text: 'text-emerald-800' },
    rejected: { label: 'Rejected', bg: 'bg-indigo-100', text: 'text-indigo-800' },
    funded_in_progress: { label: 'In Progress', bg: 'bg-indigo-100', text: 'text-indigo-800' },
    awaiting_payment: { label: 'Awaiting Payment', bg: 'bg-amber-100', text: 'text-amber-800' },
    completed_pending_release: { label: 'Pending Release', bg: 'bg-blue-100', text: 'text-blue-800' },
    completed_paid: { label: 'Completed', bg: 'bg-emerald-100', text: 'text-emerald-800' },
    disputed: { label: 'Disputed', bg: 'bg-indigo-100', text: 'text-indigo-800' },
  };
  const c = config[status] || { label: status, bg: 'bg-neutral-100', text: 'text-neutral-800' };
  return (
    <View className={`${c.bg} px-2 py-0.5 rounded-full self-start`}>
      <Text className={`${c.text} text-xs font-semibold`}>{c.label}</Text>
    </View>
  );
}

// ---- Star Rating ----
function StarRating({ rating, size = 12 }: { rating: number; size?: number }) {
  return (
    <View className="flex-row items-center" style={{ gap: 1 }}>
      {[1, 2, 3, 4, 5].map(i => (
        <FontAwesome5
          key={i}
          name="star"
          solid={i <= Math.round(rating)}
          size={size}
          color={i <= Math.round(rating) ? '#eab308' : '#d4d4d4'}
        />
      ))}
    </View>
  );
}

// ---- Empty State ----
function EmptyState({ icon, title, message }: { icon: string; title: string; message: string }) {
  const iconName: Record<string, string> = {
    'post': 'file-alt',
    'briefcase': 'briefcase',
    'portfolio': 'folder-open',
    'star': 'star',
    'users': 'users',
    'receipt': 'receipt',
    'dollar': 'dollar-sign',
  };
  return (
    <View className="bg-white rounded-xl border border-neutral-200 p-8 items-center">
      <FontAwesome5 name={iconName[icon] || icon} size={32} color="#d4d4d4" />
      <Text className="text-sm font-semibold text-neutral-600 mt-3">{title}</Text>
      <Text className="text-xs text-neutral-400 mt-1 text-center">{message}</Text>
    </View>
  );
}

// ---- Bottom Sheet ----
function Sheet({ visible, onClose, title, children }: { visible: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  if (!visible) return null;
  return (
    <View className="absolute inset-0 z-[90] justify-end" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
      <Pressable className="flex-1" onPress={onClose} />
      <View className="bg-white rounded-t-2xl max-h-[85vh]">
        <View className="w-10 h-1 rounded-full bg-neutral-300 mx-auto mt-3" />
        <View className="flex-row items-center justify-between px-5 pt-4 pb-2 border-b border-neutral-100">
          <Text className="text-lg font-bold text-neutral-900">{title}</Text>
          <Pressable onPress={onClose} className="w-8 h-8 items-center justify-center rounded-full">
            <FontAwesome5 name="times" size={16} color="#737373" />
          </Pressable>
        </View>
        <ScrollView className="px-5 py-4 pb-10">
          {children}
        </ScrollView>
      </View>
    </View>
  );
}

// ================================================================
// Main Component
// ================================================================
const ContractorDashboardScreen: React.FC = () => {
  const [activeTab, setActiveTab] = useState('posts');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [paymentSubTab, setPaymentSubTab] = useState('overview');

  const [posts, setPosts] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [portfolio, setPortfolio] = useState<any[]>([]);
  const [_earnings, setEarnings] = useState<any>(null);
  const [leads, setLeads] = useState<any[]>([]);
  const [quotes, setQuotes] = useState<any[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [stripeStatus, setStripeStatus] = useState<any>(null);

  const [showCreatePost, setShowCreatePost] = useState(false);
  const [showAddPortfolio, setShowAddPortfolio] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);

  const [postCaption, setPostCaption] = useState('');
  const [postTags, setPostTags] = useState('');
  const [postLocation, setPostLocation] = useState('');
  const [postImages, setPostImages] = useState<string[]>([]);
  const [postSubmitting, setPostSubmitting] = useState(false);

  const [portfolioItem, setPortfolioItem] = useState({ name: '', description: '', imageUrl: '' });
  const [portfolioSubmitting, setPortfolioSubmitting] = useState(false);

  const [editableData, setEditableData] = useState({
    description: '',
    pricing: '',
    certifications: '' as any,
    servicesOffered: [] as string[],
    phone: '',
    email: '',
    website: '',
    address: '',
  });
  const [profileSaving, setProfileSaving] = useState(false);
  const [bannerUrl, setBannerUrl] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [contractorName, setContractorName] = useState('');
  const [contractorCategory, setContractorCategory] = useState('');

  const [imageLoading, setImageLoading] = useState(false);
  const contractorId = 'current';

  const pickFromLibrary = async (): Promise<string | null> => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
      });
      if (result.canceled || !result.assets?.length) return null;
      return result.assets[0].uri;
    } catch { return null; }
  };

  // Portfolio API helpers (backend endpoints)
  const getPortfolio = async (id: string) => {
    try { const headers = await getAuthHeaders(); return await get(`${API_BASE_URL}/api/contractors/${id}/portfolio`, headers); }
    catch { return []; }
  };
  const addPortfolioItem = async (data: any) => {
    const headers = await getAuthHeaders();
    return await apiPost(`${API_BASE_URL}/api/contractors/portfolio`, data, headers);
  };
  const deletePortfolioItem = async (itemId: string) => {
    const headers = await getAuthHeaders();
    return await get(`${API_BASE_URL}/api/contractors/portfolio/${itemId}`, headers);
  };

  const loadData = useCallback(async () => {
    try {
      const [postsData, reviewsData, portfolioData, earningsData, leadsData, quotesData, jobsData, stripeData, profileData] = await Promise.all([
        fetchContractorPosts(contractorId).catch(() => ({ posts: [] })),
        fetchContractorReviews(contractorId).catch(() => []),
        getPortfolio(contractorId).catch(() => []),
        getContractorEarnings().catch(() => null),
        getContractorLeads().catch(() => []),
        getContractorQuotes().catch(() => []),
        getContractorJobs().catch(() => []),
        getStripeAccountStatus().catch(() => ({ connected: false })),
        getContractorDetails(contractorId).catch(() => null),
      ]);
      setPosts(Array.isArray(postsData?.posts) ? postsData.posts : []);
      setReviews(Array.isArray(reviewsData) ? reviewsData : []);
      setPortfolio(Array.isArray(portfolioData) ? portfolioData : []);
      setEarnings(earningsData);
      setLeads(Array.isArray(leadsData) ? leadsData : []);
      setQuotes(Array.isArray(quotesData) ? quotesData : []);
      setJobs(Array.isArray(jobsData) ? jobsData : []);
      setStripeStatus(stripeData);

      if (profileData) {
        const rawBanner = (profileData as any).bannerUrl || profileData.bannerImage || (profileData as any).imageUrl || '';
        const name = profileData.companyName || profileData.businessName || '';
        const cat = profileData.category || '';
        setContractorName(name);
        setContractorCategory(cat);
        setBannerUrl(getCoverImageUrl(name, rawBanner, cat));
        const rawAvatar = profileData.profilePicture || profileData.user?.profilePicture || '';
        setAvatarUrl(getProfileImageUrl(name, rawAvatar, cat));
      }
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [contractorId]);

  useEffect(() => { loadData(); }, [loadData]);

  const onRefresh = useCallback(() => { setRefreshing(true); loadData(); }, [loadData]);

  // ---- Post handlers ----
  const handleCreatePost = async () => {
    if (!postCaption.trim()) { Alert.alert('Error', 'Caption is required'); return; }
    setPostSubmitting(true);
    try {
      const tags = postTags.split(',').map(t => t.trim()).filter(Boolean);
      await createPost({ caption: postCaption, images: postImages, tags, location: postLocation });
      setPostCaption(''); setPostTags(''); setPostLocation(''); setPostImages([]);
      setShowCreatePost(false);
      loadData();
      Alert.alert('Success', 'Post created successfully');
    } catch { Alert.alert('Error', 'Failed to create post'); }
    finally { setPostSubmitting(false); }
  };

  const handleLikePost = async (postId: string, isLiked: boolean) => {
    try {
      if (isLiked) await unlikePost(postId); else await likePost(postId);
      setPosts(prev => prev.map(p => p._id === postId ? { ...p, likes: isLiked ? p.likes.filter((id: string) => id !== 'current') : [...p.likes, 'current'] } : p));
    } catch { Alert.alert('Error', 'Failed to update like'); }
  };

  const handleDeletePost = async (postId: string) => {
    Alert.alert('Delete Post', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try { await deletePost(postId); setPosts(prev => prev.filter(p => p._id !== postId)); }
        catch { Alert.alert('Error', 'Failed to delete post'); }
      }},
    ]);
  };

  const handleAddImage = async () => {
    setImageLoading(true);
    const url = await pickFromLibrary();
    if (url) setPostImages(prev => [...prev, url]);
    setImageLoading(false);
  };

  // ---- Portfolio handlers ----
  const handleAddPortfolio = async () => {
    if (!portfolioItem.name.trim()) { Alert.alert('Error', 'Project name is required'); return; }
    setPortfolioSubmitting(true);
    try {
      await addPortfolioItem(portfolioItem);
      setPortfolioItem({ name: '', description: '', imageUrl: '' });
      setShowAddPortfolio(false);
      loadData();
      Alert.alert('Success', 'Portfolio item added!');
    } catch { Alert.alert('Error', 'Failed to add portfolio item'); }
    finally { setPortfolioSubmitting(false); }
  };

  // ---- Profile handler ----
  const handleSaveProfile = async () => {
    setProfileSaving(true);
    try {
      await updateContractorProfile(editableData);
      setShowEditProfile(false);
      loadData();
      Alert.alert('Success', 'Profile updated!');
    } catch { Alert.alert('Error', 'Failed to update profile'); }
    finally { setProfileSaving(false); }
  };

  // ---- Computed values ----
  const totalEarnings = jobs.filter(j => ['completed_paid', 'funded_in_progress'].includes(j.status)).reduce((sum, j) => sum + (j.totalAmount || j.amount || 0), 0);
  const pendingEscrow = jobs.filter(j => ['funded_in_progress', 'completed_pending_release'].includes(j.status)).reduce((sum, j) => sum + (j.totalAmount || j.amount || 0), 0);
  const activeJobsCount = jobs.filter(j => ['funded_in_progress', 'awaiting_payment'].includes(j.status)).length;
  const avgRating = reviews.length > 0 ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length : 0;
  const ratingBreakdown = [5, 4, 3, 2, 1].map(stars => ({
    stars,
    count: reviews.filter((r: any) => Math.floor(r.rating) === stars).length,
    pct: reviews.length > 0 ? (reviews.filter((r: any) => Math.floor(r.rating) === stars).length / reviews.length) * 100 : 0,
  }));

  if (loading) {
    return (
      <View className="flex-1 bg-white items-center justify-center">
        <ActivityIndicator size="large" color="#4F46E5" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-neutral-50">
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* ==================== HEADER: Banner + Avatar ==================== */}
        <View className="relative">
          <View className="h-44 w-full bg-neutral-200 overflow-hidden">
            {bannerUrl ? (
              isSvgUrl(bannerUrl) ? (
                <SvgImage uri={bannerUrl} width="100%" height="100%" />
              ) : (
                <Image source={{ uri: bannerUrl }} className="absolute inset-0 w-full h-full" resizeMode="cover" />
              )
            ) : (
              <View className="absolute inset-0 bg-gradient-to-b from-neutral-300 to-neutral-200" />
            )}
          </View>
          <View className="absolute -bottom-12 left-4">
            <View className="w-24 h-24 rounded-full border-4 border-white overflow-hidden bg-neutral-200">
              {avatarUrl ? (
                isSvgUrl(avatarUrl) ? (
                  <SvgImage uri={avatarUrl} width="100%" height="100%" />
                ) : (
                  <Image source={{ uri: avatarUrl }} className="absolute inset-0 w-full h-full" resizeMode="cover" />
                )
              ) : (
                <FontAwesome5 name="user" size={32} color="#a3a3a3" style={{ position: 'absolute', top: 20, left: 20 }} />
              )}
            </View>
          </View>
          <Pressable
            onPress={() => setShowEditProfile(true)}
            className="absolute top-3 right-3 bg-white/90 px-3 py-1.5 rounded-lg flex-row items-center"
            style={{ gap: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2 }}
          >
            <FontAwesome5 name="pen" size={10} color="#525252" />
            <Text className="text-xs font-semibold text-neutral-800">Edit Profile</Text>
          </Pressable>
        </View>

        {/* ==================== Profile Info ==================== */}
        <View className="pt-14 px-4">
          <View className="flex-row items-center" style={{ gap: 8 }}>
            <Text className="text-xl font-bold text-neutral-900">{contractorName || 'My Business'}</Text>
            <FontAwesome5 name="badge-check" size={16} color="#4F46E5" />
          </View>
          <View className="flex-row items-center mt-2" style={{ gap: 8 }}>
            <StarRating rating={avgRating} />
            <Text className="text-sm text-neutral-500">({reviews.length} reviews)</Text>
          </View>
        </View>

        {/* ==================== Tab Navigation ==================== */}
        <View className="mt-4 border-b border-neutral-200">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="px-4">
            <View className="flex-row" style={{ gap: 0 }}>
              {TABS.map(tab => (
                <Pressable
                  key={tab.key}
                  onPress={() => setActiveTab(tab.key)}
                  className="relative px-4 py-3"
                >
                  <Text className={`text-sm font-semibold whitespace-nowrap ${activeTab === tab.key ? 'text-indigo-600' : 'text-neutral-500'}`}>
                    {tab.label}
                  </Text>
                  {activeTab === tab.key && (
                    <View className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 rounded-t-full" />
                  )}
                </Pressable>
              ))}
            </View>
          </ScrollView>
        </View>

        {/* ==================== Tab Content ==================== */}
        <View className="px-4 py-6">

          {/* TAB: Posts */}
          {activeTab === 'posts' && (
            <View style={{ gap: 16 }}>
              {/* Create Post Card */}
              <Pressable onPress={() => setShowCreatePost(true)} className="bg-white rounded-xl border border-neutral-200 p-4">
                <View className="flex-row items-center" style={{ gap: 8 }}>
                  <FontAwesome5 name="pen" size={14} color="#a3a3a3" />
                  <Text className="text-sm text-neutral-400">What's new with your business?</Text>
                </View>
                <View className="flex-row mt-3 pt-3 border-t border-neutral-100" style={{ gap: 16 }}>
                  <View className="flex-row items-center" style={{ gap: 4 }}>
                    <FontAwesome5 name="camera" size={14} color="#737373" />
                    <Text className="text-xs text-neutral-500">Photo</Text>
                  </View>
                  <View className="flex-row items-center" style={{ gap: 4 }}>
                    <FontAwesome5 name="map-marker-alt" size={14} color="#737373" />
                    <Text className="text-xs text-neutral-500">Location</Text>
                  </View>
                </View>
              </Pressable>

              {/* Posts Feed */}
              {posts.length === 0 ? (
                <EmptyState icon="file-alt" title="No posts yet" message="Share updates about your business" />
              ) : (
                <View style={{ gap: 12 }}>
                  {posts.map(post => (
                    <View key={post._id} className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
                      {post.images?.length > 0 && (
                        <View className="aspect-video bg-neutral-100">
                          <Image source={{ uri: post.images[0] }} className="w-full h-full" resizeMode="cover" />
                        </View>
                      )}
                      <View className="p-4">
                        <Text className="text-sm text-neutral-800" style={{ lineHeight: 20 }}>{post.caption}</Text>
                        <View className="flex-row items-center justify-between mt-3">
                          <View className="flex-row items-center" style={{ gap: 12 }}>
                            <Pressable onPress={() => handleLikePost(post._id, post.likes.includes('current'))} className="flex-row items-center" style={{ gap: 4 }}>
                              <FontAwesome5 name="heart" solid={post.likes.includes('current')} size={14} color={post.likes.includes('current') ? '#ef4444' : '#737373'} />
                              <Text className="text-xs text-neutral-500">{post.likes.length}</Text>
                            </Pressable>
                            <View className="flex-row items-center" style={{ gap: 4 }}>
                              <FontAwesome5 name="comment" size={14} color="#737373" />
                              <Text className="text-xs text-neutral-500">{post.comments?.length || 0}</Text>
                            </View>
                          </View>
                          <View className="flex-row items-center" style={{ gap: 8 }}>
                            <Text className="text-xs text-neutral-400">{formatDate(post.createdAt)}</Text>
                            <Pressable onPress={() => handleDeletePost(post._id)}>
                              <FontAwesome5 name="trash" size={12} color="#a3a3a3" />
                            </Pressable>
                          </View>
                        </View>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* TAB: About Us */}
          {activeTab === 'about' && (
            <View style={{ gap: 16 }}>
              <View className="bg-white rounded-xl border border-neutral-200 p-5">
                <Text className="text-base font-semibold text-neutral-900 mb-3">About Us</Text>
                <Text className="text-sm text-neutral-700 leading-5">
                  {editableData.description || 'No description provided yet. Click "Edit Profile" to add your bio.'}
                </Text>
              </View>

              <View className="bg-white rounded-xl border border-neutral-200 p-5">
                <Text className="text-base font-semibold text-neutral-900 mb-3">Pricing</Text>
                <Text className="text-sm text-neutral-700">{editableData.pricing || 'Contact for pricing'}</Text>
              </View>

              <View className="bg-white rounded-xl border border-neutral-200 p-5">
                <Text className="text-base font-semibold text-neutral-900 mb-3">Business Hours</Text>
                {DAYS.map(day => (
                  <View key={day} className="flex-row justify-between py-2 border-b border-neutral-100">
                    <Text className="text-sm text-neutral-600">{day}</Text>
                    <Text className="text-sm text-neutral-900 font-medium">9:00 AM - 5:00 PM</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* TAB: Services */}
          {activeTab === 'services' && (
            <View>
              <Text className="text-base font-semibold text-neutral-900 mb-4">Services Offered</Text>
              {editableData.servicesOffered.length === 0 ? (
                <EmptyState icon="briefcase" title="No services listed" message="Edit your profile to add services" />
              ) : (
                <View className="flex-row flex-wrap" style={{ gap: 8 }}>
                  {editableData.servicesOffered.map((service, idx) => (
                    <View key={idx} className="bg-indigo-50 px-3 py-1.5 rounded-full">
                      <Text className="text-xs font-medium text-indigo-700">{service}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* TAB: Portfolio */}
          {activeTab === 'portfolio' && (
            <View>
              <View className="flex-row items-center justify-between mb-4">
                <Text className="text-base font-semibold text-neutral-900">Portfolio</Text>
                <Pressable
                  onPress={() => setShowAddPortfolio(true)}
                  className="bg-indigo-600 px-3 py-1.5 rounded-lg flex-row items-center"
                  style={{ gap: 4 }}
                >
                  <FontAwesome5 name="plus" size={10} color="#fff" />
                  <Text className="text-xs font-semibold text-white">Add Project</Text>
                </Pressable>
              </View>
              {portfolio.length === 0 ? (
                <EmptyState icon="folder-open" title="No projects yet" message="Showcase your best work by adding projects" />
              ) : (
                <View className="flex-row flex-wrap" style={{ gap: 12 }}>
                  {portfolio.map((item, i) => (
                    <View key={item._id || i} className="w-[48%] bg-white rounded-xl border border-neutral-200 overflow-hidden">
                      {item.imageUrl ? (
                        <Image source={{ uri: item.imageUrl }} className="w-full h-28" resizeMode="cover" />
                      ) : (
                        <View className="w-full h-28 bg-neutral-100 items-center justify-center">
                          <FontAwesome5 name="image" size={24} color="#d4d4d4" />
                        </View>
                      )}
                      <View className="p-3">
                        <Text className="text-sm font-semibold text-neutral-900">{item.name || 'Untitled'}</Text>
                        {item.description ? (
                          <Text className="text-xs text-neutral-500 mt-0.5" numberOfLines={2}>{item.description}</Text>
                        ) : null}
                        <Pressable onPress={async () => {
                          try { await deletePortfolioItem(item._id || item.id); loadData(); }
                          catch { Alert.alert('Error', 'Failed to delete'); }
                        }} className="mt-2 self-end flex-row items-center" style={{ gap: 4 }}>
                          <FontAwesome5 name="trash" size={10} color="#6366f1" />
                          <Text className="text-xs text-indigo-500">Remove</Text>
                        </Pressable>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* TAB: Reviews */}
          {activeTab === 'reviews' && (
            <View style={{ gap: 16 }}>
              {/* Overall Rating */}
              <View className="bg-white rounded-xl border border-neutral-200 p-5 flex-row items-center" style={{ gap: 24 }}>
                <View className="items-center">
                  <Text className="text-4xl font-bold text-neutral-900">{avgRating > 0 ? avgRating.toFixed(1) : '—'}</Text>
                  <StarRating rating={avgRating} size={16} />
                  <Text className="text-xs text-neutral-500 mt-1">Overall</Text>
                </View>
                <View className="flex-1" style={{ gap: 4 }}>
                  {ratingBreakdown.map(r => (
                    <View key={r.stars} className="flex-row items-center" style={{ gap: 6 }}>
                      <Text className="text-xs text-neutral-500 w-3">{r.stars}</Text>
                      <FontAwesome5 name="star" solid size={10} color="#eab308" />
                      <View className="flex-1 h-1.5 bg-neutral-100 rounded-full overflow-hidden">
                        <View className="h-full bg-yellow-500 rounded-full" style={{ width: `${r.pct}%` }} />
                      </View>
                      <Text className="text-xs text-neutral-400 w-6 text-right">{r.count}</Text>
                    </View>
                  ))}
                </View>
              </View>

              {/* Review Cards */}
              {reviews.length === 0 ? (
                <EmptyState icon="star" title="No reviews yet" message="Reviews will appear here when clients leave feedback" />
              ) : (
                <View style={{ gap: 12 }}>
                  {reviews.map(review => (
                    <View key={review._id} className="bg-white rounded-xl border border-neutral-200 p-5">
                      <View className="flex-row items-center" style={{ gap: 10 }}>
                        <Image
                          source={{ uri: review.user?.profilePicture || '' }}
                          className="w-10 h-10 rounded-full bg-neutral-100"
                        />
                        <View className="flex-1">
                          <Text className="text-sm font-semibold text-neutral-900">
                            {review.user?.firstName || ''} {review.user?.lastName || ''}
                          </Text>
                          <StarRating rating={review.rating} size={10} />
                        </View>
                        <Text className="text-xs text-neutral-400">{formatDate(review.createdAt)}</Text>
                      </View>
                      <Text className="text-sm text-neutral-700 mt-3">{review.comment || review.title || ''}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* TAB: Payments & Jobs */}
          {activeTab === 'payments' && (
            <View style={{ gap: 16 }}>
              {/* Sub-tabs */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View className="flex-row" style={{ gap: 6 }}>
                  {[
                    { key: 'overview', label: 'Overview' },
                    { key: 'leads', label: 'Leads', count: leads.length },
                    { key: 'quotes', label: 'Quotes' },
                    { key: 'jobs', label: 'Jobs' },
                  ].map(tab => (
                    <Pressable
                      key={tab.key}
                      onPress={() => setPaymentSubTab(tab.key)}
                      className={`shrink-0 px-3 py-1.5 rounded-full flex-row items-center ${
                        paymentSubTab === tab.key ? 'bg-neutral-900' : 'bg-white border border-neutral-200'
                      }`}
                      style={{ gap: 4 }}
                    >
                      <Text className={`text-xs font-semibold ${paymentSubTab === tab.key ? 'text-white' : 'text-neutral-600'}`}>
                        {tab.label}
                      </Text>
                      {(tab.count ?? 0) > 0 && (
                        <View className={`px-1.5 py-0.5 rounded-full ${paymentSubTab === tab.key ? 'bg-white/20' : 'bg-indigo-100'}`}>
                          <Text className={`text-[10px] font-bold ${paymentSubTab === tab.key ? 'text-white' : 'text-indigo-700'}`}>
                            {tab.count}
                          </Text>
                        </View>
                      )}
                    </Pressable>
                  ))}
                </View>
              </ScrollView>

              {/* Overview */}
              {paymentSubTab === 'overview' && (
                <View style={{ gap: 12 }}>
                  {/* Stripe Connect */}
                  <View className="bg-white rounded-xl border border-neutral-200 p-5">
                    <View className="flex-row items-center justify-between">
                      <View className="flex-row items-center" style={{ gap: 12 }}>
                        <View className="w-10 h-10 rounded-lg bg-indigo-50 items-center justify-center">
                          <FontAwesome5 name="credit-card" size={16} color="#4F46E5" />
                        </View>
                        <View>
                          <Text className="text-sm font-semibold text-neutral-900">Stripe Connect</Text>
                          <Text className="text-xs text-neutral-500">
                            {stripeStatus?.chargesEnabled ? 'Connected & Active' : 'Not connected'}
                          </Text>
                        </View>
                      </View>
                      {!stripeStatus?.chargesEnabled && (
                        <Pressable
                          onPress={async () => {
                            try { const { url } = await getStripeConnectUrl(); Linking.openURL(url); }
                            catch { Alert.alert('Error', 'Failed to connect Stripe'); }
                          }}
                          className="bg-indigo-600 px-3 py-2 rounded-lg"
                        >
                          <Text className="text-xs font-semibold text-white">Connect</Text>
                        </Pressable>
                      )}
                    </View>
                  </View>

                  {/* Stats */}
                  <View className="flex-row" style={{ gap: 8 }}>
                    <View className="flex-1 bg-white rounded-xl border border-neutral-200 p-4">
                      <View className="flex-row items-center" style={{ gap: 4 }}>
                        <FontAwesome5 name="dollar-sign" size={12} color="#059669" />
                        <Text className="text-xs text-neutral-500 font-medium">Total Earnings</Text>
                      </View>
                      <Text className="text-xl font-bold text-neutral-900 mt-1">{formatCurrency(totalEarnings / 100)}</Text>
                    </View>
                    <View className="flex-1 bg-white rounded-xl border border-neutral-200 p-4">
                      <View className="flex-row items-center" style={{ gap: 4 }}>
                        <FontAwesome5 name="clock" size={12} color="#d97706" />
                        <Text className="text-xs text-neutral-500 font-medium">Pending</Text>
                      </View>
                      <Text className="text-xl font-bold text-neutral-900 mt-1">{formatCurrency(pendingEscrow / 100)}</Text>
                    </View>
                    <View className="flex-1 bg-white rounded-xl border border-neutral-200 p-4">
                      <View className="flex-row items-center" style={{ gap: 4 }}>
                        <FontAwesome5 name="briefcase" size={12} color="#4F46E5" />
                        <Text className="text-xs text-neutral-500 font-medium">Active Jobs</Text>
                      </View>
                      <Text className="text-xl font-bold text-neutral-900 mt-1">{activeJobsCount}</Text>
                    </View>
                  </View>
                </View>
              )}

              {/* Leads */}
              {paymentSubTab === 'leads' && (
                <View>
                  <Text className="text-base font-semibold text-neutral-900 mb-3">New Inquiries</Text>
                  {leads.length === 0 ? (
                    <EmptyState icon="users" title="No new inquiries" message="When homeowners reach out, their inquiries will appear here" />
                  ) : (
                    <View style={{ gap: 10 }}>
                      {leads.map(lead => (
                        <View key={lead._id} className="bg-white rounded-xl border border-neutral-200 p-4">
                          <View className="flex-row justify-between items-start">
                            <View>
                              <Text className="text-sm font-semibold text-neutral-900">{lead.projectTitle || 'New Inquiry'}</Text>
                              <Text className="text-xs text-neutral-500 mt-0.5">
                                From: {lead.user ? `${lead.user.firstName || ''} ${lead.user.lastName || ''}`.trim() : 'Homeowner'}
                              </Text>
                            </View>
                            <Text className="text-xs text-neutral-400">{formatDate(lead.createdAt)}</Text>
                          </View>
                          {lead.description && (
                            <Text className="text-sm text-neutral-600 mt-2">{lead.description}</Text>
                          )}
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              )}

              {/* Quotes */}
              {paymentSubTab === 'quotes' && (
                <View>
                  <Text className="text-base font-semibold text-neutral-900 mb-3">Quotes Sent</Text>
                  {quotes.length === 0 ? (
                    <EmptyState icon="file-alt" title="No quotes sent" message="Quotes you send to clients will appear here" />
                  ) : (
                    <View style={{ gap: 10 }}>
                      {quotes.map(quote => (
                        <View key={quote._id} className="bg-white rounded-xl border border-neutral-200 p-4 flex-row justify-between items-center">
                          <View>
                            <Text className="text-sm font-semibold text-neutral-900">
                              {quote.user?.firstName || ''} {quote.user?.lastName || ''}
                            </Text>
                            <Text className="text-sm text-neutral-600">{formatCurrency(quote.totalAmount / 100)}</Text>
                          </View>
                          <StatusBadge status={quote.status} />
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              )}

              {/* Jobs */}
              {paymentSubTab === 'jobs' && (
                <View>
                  <Text className="text-base font-semibold text-neutral-900 mb-3">Active Jobs</Text>
                  {jobs.length === 0 ? (
                    <EmptyState icon="briefcase" title="No jobs yet" message="Jobs will appear here when work begins" />
                  ) : (
                    <View style={{ gap: 10 }}>
                      {jobs.map(job => (
                        <View key={job._id} className="bg-white rounded-xl border border-neutral-200 p-4">
                          <View className="flex-row justify-between items-start">
                            <View>
                              <Text className="text-sm font-semibold text-neutral-900">{job.title || job.projectTitle || 'Job'}</Text>
                              <Text className="text-sm text-neutral-600">{formatCurrency((job.totalAmount || job.amount || 0) / 100)}</Text>
                            </View>
                            <StatusBadge status={job.status} />
                          </View>
                          <Text className="text-xs text-neutral-400 mt-2">{formatDate(job.createdAt)}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              )}
            </View>
          )}

          {/* TAB: Promote */}
          {activeTab === 'promote' && (
            <View className="bg-white rounded-xl border border-neutral-200 p-5">
              <Text className="text-base font-semibold text-neutral-900 mb-2">Share Your Profile</Text>
              <Text className="text-sm text-neutral-600 mb-4">
                Copy your direct profile link to share with clients or add to your social media bios.
              </Text>
              <View className="flex-row items-center bg-neutral-100 rounded-lg px-3 mb-4">
                <Text className="flex-1 text-sm text-neutral-500 py-3" numberOfLines={1}>https://ratedeed.com/contractor/my-profile</Text>
                <Pressable className="p-2">
                  <FontAwesome5 name="copy" size={14} color="#737373" />
                </Pressable>
              </View>
              <View className="flex-row justify-center" style={{ gap: 16 }}>
                {[
                  { name: 'facebook-f', color: '#1877F2' },
                  { name: 'twitter', color: '#1DA1F2' },
                  { name: 'linkedin-in', color: '#0A66C2' },
                  { name: 'whatsapp', color: '#25D366' },
                ].map(social => (
                  <Pressable key={social.name} className="w-11 h-11 rounded-full items-center justify-center" style={{ backgroundColor: social.color }}>
                    <FontAwesome5 name={social.name} size={16} color="#fff" />
                  </Pressable>
                ))}
              </View>
            </View>
          )}
        </View>

        <View className="h-20" />
      </ScrollView>

      {/* ==================== CREATE POST SHEET ==================== */}
      <Sheet visible={showCreatePost} onClose={() => setShowCreatePost(false)} title="Create Post">
        <Text className="text-xs font-semibold text-neutral-500 mb-1">Caption</Text>
        <TextInput
          value={postCaption}
          onChangeText={setPostCaption}
          placeholder="What's new with your projects?"
          placeholderTextColor="#a3a3a3"
          multiline
          numberOfLines={3}
          className="w-full border border-neutral-200 rounded-xl px-4 py-3 text-sm mb-3"
          style={{ textAlignVertical: 'top', minHeight: 80 }}
        />
        <Text className="text-xs font-semibold text-neutral-500 mb-1">Tags (comma-separated)</Text>
        <TextInput
          value={postTags}
          onChangeText={setPostTags}
          placeholder="#Renovation, #Bathroom"
          placeholderTextColor="#a3a3a3"
          className="w-full border border-neutral-200 rounded-xl px-4 py-2.5 text-sm mb-3"
        />
        <Text className="text-xs font-semibold text-neutral-500 mb-1">Location (Optional)</Text>
        <TextInput
          value={postLocation}
          onChangeText={setPostLocation}
          placeholder="e.g., Queens, NY"
          placeholderTextColor="#a3a3a3"
          className="w-full border border-neutral-200 rounded-xl px-4 py-2.5 text-sm mb-3"
        />
        <Pressable
          onPress={handleAddImage}
          disabled={imageLoading}
          className="w-full border-2 border-dashed border-neutral-200 rounded-lg p-5 items-center mb-3"
        >
          {postImages.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View className="flex-row" style={{ gap: 8 }}>
                {postImages.map((img, idx) => (
                  <View key={idx} className="w-14 h-14 rounded-lg overflow-hidden relative">
                    <Image source={{ uri: img }} className="w-full h-full" />
                    <Pressable
                      onPress={() => setPostImages(prev => prev.filter((_, i) => i !== idx))}
                      className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/60 items-center justify-center"
                    >
                      <FontAwesome5 name="times" size={8} color="#fff" />
                    </Pressable>
                  </View>
                ))}
              </View>
            </ScrollView>
          ) : (
            <View className="items-center" style={{ gap: 6 }}>
              <FontAwesome5 name="image" size={20} color="#a3a3a3" />
              <Text className="text-sm text-neutral-500">{imageLoading ? 'Uploading...' : 'Tap to upload photos'}</Text>
            </View>
          )}
        </Pressable>
        <Pressable
          onPress={handleCreatePost}
          disabled={!postCaption.trim() || postSubmitting}
          className={`w-full py-3 rounded-xl items-center flex-row justify-center ${
            postCaption.trim() ? 'bg-indigo-600' : 'bg-neutral-200'
          }`}
          style={{ gap: 8 }}
        >
          {postSubmitting && <ActivityIndicator size="small" color="#fff" />}
          <Text className={`text-sm font-semibold ${postCaption.trim() ? 'text-white' : 'text-neutral-400'}`}>
            {postSubmitting ? 'Publishing...' : 'Publish Post'}
          </Text>
        </Pressable>
      </Sheet>

      {/* ==================== ADD PORTFOLIO SHEET ==================== */}
      <Sheet visible={showAddPortfolio} onClose={() => setShowAddPortfolio(false)} title="Add Portfolio Project">
        <Text className="text-xs font-semibold text-neutral-500 mb-1">Project Name</Text>
        <TextInput
          value={portfolioItem.name}
          onChangeText={t => setPortfolioItem(p => ({ ...p, name: t }))}
          placeholder="e.g., Modern Kitchen Remodel"
          placeholderTextColor="#a3a3a3"
          className="w-full border border-neutral-200 rounded-xl px-4 py-2.5 text-sm mb-3"
        />
        <Text className="text-xs font-semibold text-neutral-500 mb-1">Description</Text>
        <TextInput
          value={portfolioItem.description}
          onChangeText={t => setPortfolioItem(p => ({ ...p, description: t }))}
          placeholder="Describe the project..."
          placeholderTextColor="#a3a3a3"
          multiline
          numberOfLines={3}
          className="w-full border border-neutral-200 rounded-xl px-4 py-2.5 text-sm mb-3"
          style={{ textAlignVertical: 'top', minHeight: 80 }}
        />
        <Text className="text-xs font-semibold text-neutral-500 mb-1">Image URL</Text>
        <TextInput
          value={portfolioItem.imageUrl}
          onChangeText={t => setPortfolioItem(p => ({ ...p, imageUrl: t }))}
          placeholder="https://..."
          placeholderTextColor="#a3a3a3"
          className="w-full border border-neutral-200 rounded-xl px-4 py-2.5 text-sm mb-3"
          autoCapitalize="none"
        />
        <Pressable
          onPress={handleAddPortfolio}
          disabled={!portfolioItem.name.trim() || portfolioSubmitting}
          className={`w-full py-3 rounded-xl items-center flex-row justify-center ${
            portfolioItem.name.trim() ? 'bg-indigo-600' : 'bg-neutral-200'
          }`}
          style={{ gap: 8 }}
        >
          {portfolioSubmitting && <ActivityIndicator size="small" color="#fff" />}
          <Text className={`text-sm font-semibold ${portfolioItem.name.trim() ? 'text-white' : 'text-neutral-400'}`}>
            {portfolioSubmitting ? 'Adding...' : 'Add Project'}
          </Text>
        </Pressable>
      </Sheet>

      {/* ==================== EDIT PROFILE SHEET ==================== */}
      <Sheet visible={showEditProfile} onClose={() => setShowEditProfile(false)} title="Edit Profile">
        <Text className="text-xs font-semibold text-neutral-500 mb-1">Description</Text>
        <TextInput
          value={editableData.description}
          onChangeText={t => setEditableData(p => ({ ...p, description: t }))}
          placeholder="Tell homeowners about your business..."
          placeholderTextColor="#a3a3a3"
          multiline
          numberOfLines={4}
          className="w-full border border-neutral-200 rounded-xl px-4 py-2.5 text-sm mb-3"
          style={{ textAlignVertical: 'top', minHeight: 100 }}
        />
        <Text className="text-xs font-semibold text-neutral-500 mb-1">Pricing</Text>
        <TextInput
          value={editableData.pricing}
          onChangeText={t => setEditableData(p => ({ ...p, pricing: t }))}
          placeholder="e.g., $500 - $5,000"
          placeholderTextColor="#a3a3a3"
          className="w-full border border-neutral-200 rounded-xl px-4 py-2.5 text-sm mb-3"
        />
        <Text className="text-xs font-semibold text-neutral-500 mb-1">Certifications</Text>
        <TextInput
          value={editableData.certifications}
          onChangeText={t => setEditableData(p => ({ ...p, certifications: t }))}
          placeholder="Licensed, Bonded, Insured..."
          placeholderTextColor="#a3a3a3"
          className="w-full border border-neutral-200 rounded-xl px-4 py-2.5 text-sm mb-3"
        />
        <Text className="text-xs font-semibold text-neutral-500 mb-1">Phone</Text>
        <TextInput
          value={editableData.phone}
          onChangeText={t => setEditableData(p => ({ ...p, phone: t }))}
          placeholder="(555) 123-4567"
          placeholderTextColor="#a3a3a3"
          keyboardType="phone-pad"
          className="w-full border border-neutral-200 rounded-xl px-4 py-2.5 text-sm mb-3"
        />
        <Text className="text-xs font-semibold text-neutral-500 mb-1">Email</Text>
        <TextInput
          value={editableData.email}
          onChangeText={t => setEditableData(p => ({ ...p, email: t }))}
          placeholder="your@email.com"
          placeholderTextColor="#a3a3a3"
          keyboardType="email-address"
          autoCapitalize="none"
          className="w-full border border-neutral-200 rounded-xl px-4 py-2.5 text-sm mb-3"
        />
        <Text className="text-xs font-semibold text-neutral-500 mb-1">Address</Text>
        <TextInput
          value={editableData.address}
          onChangeText={t => setEditableData(p => ({ ...p, address: t }))}
          placeholder="123 Main St, City, State"
          placeholderTextColor="#a3a3a3"
          className="w-full border border-neutral-200 rounded-xl px-4 py-2.5 text-sm mb-3"
        />
        <Pressable
          onPress={handleSaveProfile}
          disabled={profileSaving}
          className="w-full py-3 bg-indigo-600 rounded-xl items-center flex-row justify-center"
          style={{ gap: 8 }}
        >
          {profileSaving && <ActivityIndicator size="small" color="#fff" />}
          <Text className="text-sm font-semibold text-white">{profileSaving ? 'Saving...' : 'Save Changes'}</Text>
        </Pressable>
      </Sheet>
    </View>
  );
};

export default ContractorDashboardScreen;
