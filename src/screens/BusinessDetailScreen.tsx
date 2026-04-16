import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  ScrollView,
  Image,
  Pressable,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Share,
  Text,
  TextInput,
  Dimensions,
  FlatList,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { FontAwesome5 } from '@expo/vector-icons';
import { SvgImage } from '../components/common/SvgImage';
import { fetchContractorDetails, fetchContractorPosts, createLead, fetchContractorReviews, extractId } from '../api';
import { Contractor, Post, Review } from '../types';
import { API_BASE_URL } from '../config';
import { getCoverImageUrl, getProfileImageUrl, isSvgUrl } from '../utils/avatarUtils';
import { isFavorite, addFavorite, removeFavorite } from '../utils/favoritesStore';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'BusinessDetail'>;

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch { return ''; }
}

function formatRelativeTime(dateStr: string): string {
  try {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return formatDate(dateStr);
  } catch { return ''; }
}

const BusinessDetailScreen: React.FC = () => {
  const route = useRoute();
  const navigation = useNavigation<NavigationProp>();
  const { id } = route.params as { id: string };
  const [contractor, setContractor] = useState<Contractor | null>(null);
  const [contractorPosts, setContractorPosts] = useState<Post[]>([]);
  const [contractorReviews, setContractorReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [showAllReviews, setShowAllReviews] = useState(false);
  const [galleryProject, setGalleryProject] = useState<any>(null);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [isQuoteModalVisible, setIsQuoteModalVisible] = useState(false);
  const [quoteProjectTitle, setQuoteProjectTitle] = useState('');
  const [quoteDescription, setQuoteDescription] = useState('');
  const [quoteContactPreference, setQuoteContactPreference] = useState('email');

  const loadContractorDetails = async () => {
    try {
      setLoading(true);
      const data = await fetchContractorDetails(id);
      if (__DEV__) console.log('BusinessDetail: Fetched contractor data');
      setContractor(data);
      
      const contractorId = data?._id || data?.id || id;
      
      const [postsData, reviewsData, favStatus] = await Promise.all([
        fetchContractorPosts(contractorId).catch(() => ({ posts: [] })),
        fetchContractorReviews(contractorId).catch(() => []),
        isFavorite(contractorId)
      ]);
      
      setIsSaved(favStatus);
      setContractorPosts(postsData?.posts || []);
      
      // SYNC: Robust review list extraction matching web version
      // Combine all potential sources of reviews
      let combinedReviews = [];
      
      // 1. Check separate reviews fetch
      if (Array.isArray(reviewsData)) {
        combinedReviews = [...reviewsData];
      } else if (reviewsData && Array.isArray((reviewsData as any).reviews)) {
        combinedReviews = [...(reviewsData as any).reviews];
      }
      
      // 2. Check reviewsList in contractor object
      if (data && Array.isArray(data.reviewsList)) {
        combinedReviews = [...combinedReviews, ...data.reviewsList];
      }
      
      // 3. Check reviews in contractor object
      if (data && Array.isArray(data.reviews) && typeof (data.reviews[0]) === 'object') {
        combinedReviews = [...combinedReviews, ...data.reviews];
      }

      // De-duplicate by ID
      const seen = new Set();
      const uniqueReviews = combinedReviews.filter(r => {
        const rid = r?._id || r?.id;
        if (!rid || seen.has(rid)) return false;
        seen.add(rid);
        return true;
      });
            
      if (__DEV__) console.log(`BusinessDetail: Loaded ${uniqueReviews.length} unique reviews`);
      setContractorReviews(uniqueReviews);
    } catch (error) {
      console.error('Error loading contractor:', error);
      Alert.alert('Error', 'Failed to load contractor details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (id) loadContractorDetails(); }, [id]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadContractorDetails().finally(() => setRefreshing(false));
  }, [id]);

  const handleShare = async () => {
    try {
      await Share.share({ message: `Check out ${contractor?.companyName || contractor?.businessName} on RateDeed!`, title: contractor?.companyName || contractor?.businessName });
    } catch {}
  };

  const handleRequestQuote = async () => {
    if (!quoteProjectTitle.trim() || !quoteDescription.trim()) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }
    try {
      const contractorId = contractor?._id || id;
      await createLead({ contractorId, projectTitle: quoteProjectTitle, description: quoteDescription, contactPreference: quoteContactPreference });
      Alert.alert('Success', 'Quote request sent!');
      setIsQuoteModalVisible(false);
      setQuoteProjectTitle('');
      setQuoteDescription('');
    } catch {
      Alert.alert('Error', 'Failed to send quote request');
    }
  };

  const handleReport = async () => {
    if (!reportReason.trim()) return;
    setReportSubmitting(true);
    try {
      const contractorId = contractor?._id || id;
      await fetch(`${API_BASE_URL}/api/reports`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contractorId, reason: reportReason }),
      });
      Alert.alert('Success', 'Report submitted');
      setShowReportDialog(false);
      setReportReason('');
    } catch {
      Alert.alert('Error', 'Failed to submit report');
    } finally {
      setReportSubmitting(false);
    }
  };

  const toggleFavorite = async () => {
    const contractorId = contractor?._id || id;
    if (isSaved) {
      await removeFavorite(contractorId);
      setIsSaved(false);
    } else {
      await addFavorite(contractorId);
      setIsSaved(true);
    }
  };

  const [activeImageIndex, setActiveImageIndex] = useState(0);

  if (loading) {
    return (
      <View className="flex-1 bg-white dark:bg-neutral-950 items-center justify-center">
        <ActivityIndicator size="large" color="#a3a3a3" />
      </View>
    );
  }

  if (!contractor) {
    return (
      <View className="flex-1 bg-white dark:bg-neutral-950 items-center justify-center p-6">
        <FontAwesome5 name="exclamation-circle" size={48} color="#d4d4d4" />
        <Text className="text-neutral-500 dark:text-neutral-400 mt-4 text-center">Contractor not found or profile is unavailable.</Text>
        <Pressable onPress={() => navigation.goBack()} className="mt-6 bg-indigo-600 px-6 py-2 rounded-lg">
          <Text className="text-white font-bold">Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const c = contractor;
  
  // SYNC: Review normalization matching web version logic
  const normalizedReviews: Review[] = contractorReviews.map((r: any, i: number) => {
    const firstName = r.user?.firstName || r.firstName || 'Ratedeed';
    const lastName = r.user?.lastName || r.lastName || 'User';
    const fullName = `${firstName} ${lastName}`.trim();
    const profilePicture = getProfileImageUrl(fullName, r.user?.profilePicture || r.profilePicture || '', c.category);
    
    return {
      _id: r._id || r.id || `r-${i}`,
      user: {
        ...(r.user || {}),
        firstName,
        lastName,
        profilePicture
      },
      rating: r.rating || 0,
      comment: r.comment || r.title || '',
      createdAt: r.createdAt || new Date().toISOString(),
    };
  });

  const displayReviews = showAllReviews ? normalizedReviews : normalizedReviews.slice(0, 2);
  const avgRating = c.averageRating || c.rating || 0;
  const reviewCount = normalizedReviews.length || c.numReviews || c.reviews || 0;

  const ratingBreakdown = [5, 4, 3, 2, 1].map(stars => ({
    stars,
    count: normalizedReviews.filter(r => Math.floor(r.rating) === stars).length,
    pct: normalizedReviews.length > 0 ? (normalizedReviews.filter(r => Math.floor(r.rating) === stars).length / normalizedReviews.length) * 100 : 0,
  }));

  const location = (() => {
    const city = c.contactInfo?.city || (c as any).city || '';
    const state = c.contactInfo?.state || (c as any).state || '';
    if (city && state) return `${city}, ${state}`;
    if (city || state) return city || state;
    const loc = (c as any).location;
    if (typeof loc === 'string' && loc.trim() && !loc.includes('{')) return loc.trim();
    const addr = (c as any).businessAddress || c.contact?.address;
    if (typeof addr === 'string' && addr.trim()) return addr.trim();
    return '';
  })();

  const priceMin = c.pricing?.split('–')[0]?.trim() || ( (c as any).priceMin ? `$${(c as any).priceMin}` : '');
  const rawBanner = (c as any).bannerUrl || c.bannerImage || (c as any).imageUrl || c.profilePicture || '';
  const bannerImage = getCoverImageUrl(c.companyName || c.businessName || 'Contractor', rawBanner, c.category);
  const services = c.servicesOffered || c.services || [];
  const portfolio = c.portfolio || [];
  const posts = contractorPosts;

  // Build hero images: cover + portfolio images (matching web version)
  const heroImages = [
    bannerImage,
    ...(portfolio || []).flatMap((p: any) => p.images || (p.imageUrl ? [p.imageUrl] : [])).slice(0, 7)
  ].filter(img => typeof img === 'string' && img.length > 0);

  return (
    <View className="flex-1 bg-white dark:bg-neutral-950">
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Hero Carousel */}
        <View className="relative w-full" style={{ aspectRatio: 16 / 9 }}>
          {heroImages.length > 0 ? (
            <FlatList
              data={heroImages}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={(e) => {
                const index = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
                setActiveImageIndex(index);
              }}
              keyExtractor={(_, i) => i.toString()}
              renderItem={({ item }) => (
                <View style={{ width: SCREEN_WIDTH, height: '100%' }}>
                  {isSvgUrl(item) ? (
                    <View className="w-full h-full">
                      <SvgImage uri={item} width="100%" height="100%" />
                    </View>
                  ) : (
                    <Image source={{ uri: item }} className="w-full h-full" resizeMode="cover" />
                  )}
                </View>
              )}
            />
          ) : (
            <View className="w-full h-full bg-neutral-200 dark:bg-neutral-800 items-center justify-center">
              <FontAwesome5 name="image" size={48} color="#a3a3a3" />
            </View>
          )}

          {/* Pagination dots */}
          {heroImages.length > 1 && (
            <View className="absolute bottom-4 left-0 right-0 flex-row justify-center" style={{ gap: 6 }}>
              {heroImages.map((_, i) => (
                <View
                  key={i}
                  className={`h-1.5 rounded-full ${activeImageIndex === i ? 'w-4 bg-white dark:bg-neutral-950' : 'w-1.5 bg-white dark:bg-neutral-950/50'}`}
                />
              ))}
            </View>
          )}

          {/* Floating Action Buttons */}
          <View className="absolute top-12 left-0 right-0 px-4 flex-row items-center justify-between">
            <Pressable
              onPress={() => navigation.goBack()}
              className="w-8 h-8 items-center justify-center bg-white dark:bg-neutral-950 rounded-full"
              style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4, elevation: 4 }}
            >
              <FontAwesome5 name="chevron-left" size={16} color="#171717" />
            </Pressable>
            <View className="flex-row" style={{ gap: 8 }}>
              <Pressable
                onPress={() => {
                  const recipientUserId = extractId(c.user);
                  if (recipientUserId) {
                    navigation.navigate('ChatScreen', {
                      recipientId: recipientUserId,
                      recipientName: c.companyName || c.businessName || 'Contractor',
                    } as any);
                  }
                }}
                className="w-8 h-8 items-center justify-center bg-white dark:bg-neutral-950 rounded-full"
                style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4, elevation: 4 }}
              >
                <FontAwesome5 name="comment" size={14} color="#171717" />
              </Pressable>
              <Pressable
                onPress={handleShare}
                className="w-8 h-8 items-center justify-center bg-white dark:bg-neutral-950 rounded-full"
                style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4, elevation: 4 }}
              >
                <FontAwesome5 name="share-alt" size={14} color="#171717" />
              </Pressable>
              <Pressable
                onPress={toggleFavorite}
                className="w-8 h-8 items-center justify-center bg-white dark:bg-neutral-950 rounded-full"
                style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4, elevation: 4 }}
              >
                <FontAwesome5 name="heart" solid={isSaved} size={14} color={isSaved ? '#f43f5e' : '#171717'} />
              </Pressable>
              <Pressable
                onPress={() => setShowReportDialog(true)}
                className="w-8 h-8 items-center justify-center bg-white dark:bg-neutral-950 rounded-full"
                style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4, elevation: 4 }}
              >
                <FontAwesome5 name="flag" size={14} color="#737373" />
              </Pressable>
            </View>
          </View>
        </View>

        {/* Content */}
        <View className="px-4 max-w-3xl mx-auto">
          {/* Title Row */}
          <View className="mt-1">
            <Text className="text-xl font-bold text-neutral-900 dark:text-neutral-50">{c.companyName || c.businessName || 'Company'}</Text>
            <View className="flex-row items-center flex-wrap mt-0.5" style={{ gap: 8 }}>
              <View className="flex-row items-center" style={{ gap: 4 }}>
                <FontAwesome5 name="star" solid size={14} color="#eab308" />
                <Text className="text-sm font-semibold text-slate-600">{avgRating.toFixed(2)}</Text>
                <Text className="text-sm text-neutral-500 dark:text-neutral-400">({reviewCount} reviews)</Text>
              </View>
              {!!c.isVerified && (
                <View className="bg-indigo-50 rounded-full px-2 py-0.5 flex-row items-center" style={{ gap: 4 }}>
                  <FontAwesome5 name="shield-alt" size={10} color="#4F46E5" />
                  <Text className="text-[10px] font-bold text-indigo-700">License Verified</Text>
                </View>
              )}
            </View>
          </View>

          {/* Location */}
          {!!(location || (c as any).distance) && (
            <View className="flex-row items-center mt-2" style={{ gap: 4 }}>
              <FontAwesome5 name="map-marker-alt" size={14} color="#737373" />
              <Text className="text-sm text-neutral-500 dark:text-neutral-400">{location || ''}</Text>
              {!!(c as any).distance && (
                <Text className="text-sm text-neutral-500 dark:text-neutral-400"> · {(c as any).distance}</Text>
              )}
            </View>
          )}

          {/* Stats */}
          <View className="flex-row mt-5 py-4 border-y border-neutral-200 dark:border-neutral-700" style={{ gap: 12 }}>
            <View className="flex-1 items-center">
              <FontAwesome5 name="award" size={20} color="#171717" />
              <Text className="text-base font-bold text-neutral-900 dark:text-neutral-50 mt-1">{c.yearsInBusiness || c.yearsExperience || 0}</Text>
              <Text className="text-[11px] text-neutral-500 dark:text-neutral-400">Years Exp.</Text>
            </View>
            <View className="flex-1 items-center">
              <FontAwesome5 name="star" solid size={20} color="#171717" />
              <Text className="text-base font-bold text-neutral-900 dark:text-neutral-50 mt-1">{reviewCount}</Text>
              <Text className="text-[11px] text-neutral-500 dark:text-neutral-400">Reviews</Text>
            </View>
            <View className="flex-1 items-center">
              <FontAwesome5 name="clock" size={20} color="#171717" />
              <Text className="text-base font-bold text-neutral-900 dark:text-neutral-50 mt-1">{(c as any).responseTime || 'N/A'}</Text>
              <Text className="text-[11px] text-neutral-500 dark:text-neutral-400">Response</Text>
            </View>
          </View>

          {/* About Us */}
          {!!c.description && (
            <View className="mt-5">
              <Text className="text-base font-bold text-neutral-900 dark:text-neutral-50 mb-2">About Us</Text>
              <Text className="text-sm text-neutral-700 dark:text-neutral-300 leading-5">{c.description}</Text>
              <View className="mt-3" style={{ gap: 8 }}>
                {!!c.licenseNumber && (
                  <View className="flex-row items-center" style={{ gap: 8 }}>
                    <FontAwesome5 name="shield-alt" size={14} color="#059669" />
                    <Text className="text-sm text-neutral-700 dark:text-neutral-300"><Text className="font-semibold">License:</Text> {c.licenseNumber}</Text>
                  </View>
                )}
                {!!(c.certifications?.[0] || (c as any).insuranceInfo) && (
                  <View className="flex-row items-center" style={{ gap: 8 }}>
                    <FontAwesome5 name="shield-alt" size={14} color="#059669" />
                    <Text className="text-sm text-neutral-700 dark:text-neutral-300"><Text className="font-semibold">Insurance:</Text> {c.certifications?.[0] || (c as any).insuranceInfo}</Text>
                  </View>
                )}
              </View>
            </View>
          )}

          {/* Services */}
          {services.length > 0 && (
            <View className="mt-6 pb-4 border-b border-neutral-200 dark:border-neutral-700">
              <Text className="text-base font-bold text-neutral-900 dark:text-neutral-50 mb-3">Services</Text>
              <View style={{ gap: 12 }}>
                {services.map((svc: any, i: number) => {
                  const name = typeof svc === 'string' ? svc : svc.name;
                  const desc = typeof svc === 'string' ? '' : svc.description || '';
                  const price = typeof svc === 'string' ? '' : svc.priceEstimate || svc.priceRange || '';
                  return (
                    <View key={i} className="bg-neutral-50 dark:bg-neutral-900 rounded-xl p-3.5 flex-row items-start justify-between" style={{ gap: 12 }}>
                      <View className="flex-1">
                        <Text className="text-sm font-semibold text-neutral-900 dark:text-neutral-50">{name || ''}</Text>
                        {!!desc && <Text className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5 leading-4">{desc}</Text>}
                      </View>
                      {!!price && (
                        <Text className="text-xs font-bold text-indigo-600 bg-indigo-50 rounded-lg px-2.5 py-1.5">
                          {price}
                        </Text>
                      )}
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* Portfolio */}
          {portfolio.length > 0 && (
            <View className="mt-6">
              <Text className="text-base font-bold text-neutral-900 dark:text-neutral-50 mb-3">Portfolio</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingBottom: 8 }}>
                {portfolio.map((project: any, i: number) => {
                  const images = project.images || (project.imageUrl ? [project.imageUrl] : []);
                  return (
                    <Pressable
                      key={project._id || project.id || i}
                      onPress={() => { if (images.length > 0) { setGalleryProject({ ...project, images }); setGalleryIndex(0); } }}
                      className="shrink-0 w-44 rounded-xl overflow-hidden border border-neutral-100 bg-white dark:bg-neutral-950"
                      style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 }}
                    >
                      <View className="relative" style={{ aspectRatio: 4 / 3 }}>
                        {images[0] ? (
                          <Image source={{ uri: images[0] }} className="absolute inset-0 w-full h-full" resizeMode="cover" />
                        ) : (
                          <View className="flex-1 bg-neutral-200 dark:bg-neutral-800 items-center justify-center">
                            <FontAwesome5 name="image" size={24} color="#a3a3a3" />
                          </View>
                        )}
                        {images.length > 1 && (
                          <View className="absolute bottom-1.5 right-1.5 bg-black/60 rounded px-1.5 py-0.5 flex-row items-center" style={{ gap: 2 }}>
                            <FontAwesome5 name="image" size={8} color="#fff" />
                            <Text className="text-[9px] font-bold text-white dark:text-neutral-900">{images.length}</Text>
                          </View>
                        )}
                      </View>
                      <View className="p-2.5">
                        <Text className="text-xs font-semibold text-neutral-900 dark:text-neutral-50 leading-tight" numberOfLines={2}>
                          {project.name || project.title || 'Project'}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {/* Posts */}
          {posts.length > 0 && (
            <View className="mt-6 pb-4 border-b border-neutral-200 dark:border-neutral-700">
              <Text className="text-base font-bold text-neutral-900 dark:text-neutral-50 mb-3">Posts</Text>
              <View style={{ gap: 16 }}>
                {posts.map(post => {
                  const userPic = (post as any).user?.profilePicture || c.profilePicture;
                  return (
                    <View key={post._id} className="bg-white dark:bg-neutral-950 rounded-xl border border-neutral-100 dark:border-neutral-800 overflow-hidden">
                      <View className="flex-row items-center p-3" style={{ gap: 10 }}>
                        {userPic ? (
                          <Image source={{ uri: userPic }} className="w-9 h-9 rounded-full" />
                        ) : (
                          <View className="w-9 h-9 rounded-full bg-neutral-200 dark:bg-neutral-800 items-center justify-center">
                            <FontAwesome5 name="user" size={14} color="#a3a3a3" />
                          </View>
                        )}
                        <View className="flex-1">
                          <View className="flex-row items-baseline" style={{ gap: 6 }}>
                            <Text className="text-sm font-bold text-neutral-900 dark:text-neutral-50" numberOfLines={1}>{c.companyName || c.businessName || ''}</Text>
                            <Text className="text-[10px] text-neutral-400">{formatRelativeTime(post.createdAt)}</Text>
                          </View>
                          <Text className="text-[11px] text-neutral-500 dark:text-neutral-400">{c.category || ''}</Text>
                        </View>
                      </View>
                      {post.images?.[0] && (
                        <Image source={{ uri: post.images[0] }} className="w-full" style={{ aspectRatio: 1 }} resizeMode="cover" />
                      )}
                      <View className="p-3">
                        <Text className="text-sm text-neutral-800 dark:text-neutral-100 leading-5">{post.caption || ''}</Text>
                        <View className="flex-row items-center mt-2.5" style={{ gap: 4 }}>
                          <FontAwesome5 name="heart" size={14} color="#737373" />
                          <Text className="text-xs font-semibold text-neutral-900 dark:text-neutral-50">{post.likes?.length || 0}</Text>
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* Reviews */}
          {normalizedReviews.length > 0 ? (
            <View className="mt-6">
              <View className="flex-row items-center mb-3" style={{ gap: 4 }}>
                <FontAwesome5 name="star" solid size={16} color="#eab308" />
                <Text className="text-base font-bold text-neutral-900 dark:text-neutral-50">{avgRating.toFixed(2)} · {reviewCount} reviews</Text>
              </View>

              {/* Rating Breakdown */}
              <View className="mb-4" style={{ gap: 6 }}>
                {ratingBreakdown.map(r => (
                  <View key={r.stars} className="flex-row items-center" style={{ gap: 8 }}>
                    <Text className="text-xs font-medium text-neutral-700 dark:text-neutral-300 w-3">{r.stars}</Text>
                    <FontAwesome5 name="star" solid size={12} color="#eab308" />
                    <View className="flex-1 h-1.5 bg-neutral-100 dark:bg-neutral-900 rounded-full overflow-hidden">
                      <View className="h-full bg-neutral-900 dark:bg-neutral-50 rounded-full" style={{ width: `${r.pct}%` }} />
                    </View>
                  </View>
                ))}
              </View>

              {/* Review List */}
              <View style={{ gap: 16 }}>
                {displayReviews.map(review => {
                  const reviewerPic = review.user?.profilePicture;
                  return (
                    <View key={review._id} className="py-3 border-t border-neutral-100 dark:border-neutral-800">
                      <View className="flex-row items-start" style={{ gap: 10 }}>
                        {isSvgUrl(reviewerPic || '') ? (
                          <View className="w-10 h-10 rounded-full overflow-hidden">
                            <SvgImage uri={reviewerPic || ''} width="100%" height="100%" />
                          </View>
                        ) : reviewerPic ? (
                          <Image source={{ uri: reviewerPic }} className="w-10 h-10 rounded-full bg-neutral-200 dark:bg-neutral-800" />
                        ) : (
                          <View className="w-10 h-10 rounded-full bg-neutral-200 dark:bg-neutral-800 items-center justify-center">
                            <FontAwesome5 name="user" size={14} color="#a3a3a3" />
                          </View>
                        )}
                        <View className="flex-1">
                          <View className="flex-row items-center justify-between">
                            <Text className="text-sm font-semibold text-neutral-900 dark:text-neutral-50">
                              {review.user?.firstName || 'Ratedeed'} {review.user?.lastName || 'User'}
                            </Text>
                            <View className="flex-row items-center" style={{ gap: 2 }}>
                              <FontAwesome5 name="star" solid size={10} color="#eab308" />
                              <Text className="text-xs font-bold text-neutral-900 dark:text-neutral-50">{review.rating}</Text>
                            </View>
                          </View>
                          <Text className="text-xs text-neutral-500 dark:text-neutral-400">{formatDate(review.createdAt)}</Text>
                          <Text className="text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed mt-2">{review.comment || ''}</Text>
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>

              {normalizedReviews.length > 2 && !showAllReviews && (
                <Pressable
                  onPress={() => setShowAllReviews(true)}
                  className="w-full py-3 border border-neutral-200 dark:border-neutral-700 rounded-xl items-center mt-2"
                >
                  <Text className="text-sm font-semibold text-neutral-900 dark:text-neutral-50">Show all {reviewCount} reviews</Text>
                </Pressable>
              )}
            </View>
          ) : (
            <View className="mt-10 py-10 items-center justify-center border-t border-neutral-100 dark:border-neutral-800">
              <FontAwesome5 name="star" size={24} color="#d4d4d4" style={{ marginBottom: 8 }} />
              <Text className="text-neutral-400 text-sm">No reviews yet</Text>
            </View>
          )}

          <View className="h-24" />
        </View>
      </ScrollView>

      {/* Sticky Bottom CTA */}
      <View className="absolute bottom-0 left-0 right-0 bg-white dark:bg-neutral-950 border-t border-neutral-200 dark:border-neutral-700 px-4 py-3">
        <View className="flex-row items-center justify-between max-w-3xl mx-auto">
          <View>
            <Text className="text-lg font-bold text-neutral-900 dark:text-neutral-50">From {priceMin || 'N/A'}</Text>
            <Text className="text-xs text-neutral-500 dark:text-neutral-400">starting price</Text>
          </View>
          <View className="flex-row" style={{ gap: 8 }}>
            <Pressable
              onPress={() => {
                const recipientUserId = extractId(c.user);
                if (recipientUserId) {
                  navigation.navigate('ChatScreen', {
                    recipientId: recipientUserId,
                    recipientName: c.companyName || c.businessName || 'Contractor',
                  } as any);
                }
              }}
              className="bg-neutral-100 dark:bg-neutral-900 px-5 py-3 rounded-xl"
            >
              <FontAwesome5 name="paper-plane" size={14} color="#171717" />
            </Pressable>
            <Pressable
              onPress={() => setIsQuoteModalVisible(true)}
              className="bg-indigo-600 px-6 py-3 rounded-xl"
              style={{ shadowColor: '#4F46E5', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 }}
            >
              <Text className="text-sm font-semibold text-white dark:text-neutral-900">Request Quote</Text>
            </Pressable>
          </View>
        </View>
      </View>

      {/* Quote Modal */}
      {isQuoteModalVisible && (
        <View className="absolute inset-0 z-[60] justify-end" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <Pressable className="flex-1" onPress={() => setIsQuoteModalVisible(false)} />
          <View className="bg-white dark:bg-neutral-950 rounded-t-3xl w-full px-5 pt-4 pb-8">
            <View className="w-10 h-1 bg-neutral-300 rounded-full mx-auto mb-5" />
            <Text className="text-lg font-bold text-neutral-900 dark:text-neutral-50 mb-4">Request a Quote</Text>
            <TextInput
              placeholder="Project title"
              value={quoteProjectTitle}
              onChangeText={setQuoteProjectTitle}
              className="w-full border border-neutral-300 rounded-xl px-4 py-3 text-sm bg-white dark:bg-neutral-950 mb-3"
              placeholderTextColor="#a3a3a3"
            />
            <TextInput
              placeholder="Describe your project..."
              value={quoteDescription}
              onChangeText={setQuoteDescription}
              multiline
              numberOfLines={4}
              className="w-full border border-neutral-300 rounded-xl px-4 py-3 text-sm bg-white dark:bg-neutral-950 mb-3"
              placeholderTextColor="#a3a3a3"
              style={{ textAlignVertical: 'top', minHeight: 100 }}
            />
            <Text className="text-sm font-semibold text-neutral-900 dark:text-neutral-50 mb-2">Contact Preference</Text>
            <View className="flex-row mb-4" style={{ gap: 8 }}>
              {['email', 'phone', 'message'].map(pref => (
                <Pressable
                  key={pref}
                  onPress={() => setQuoteContactPreference(pref)}
                  className={`px-4 py-2 rounded-lg ${quoteContactPreference === pref ? 'bg-indigo-600' : 'bg-neutral-100 dark:bg-neutral-900'}`}
                >
                  <Text className={`text-xs font-semibold capitalize ${quoteContactPreference === pref ? 'text-white' : 'text-neutral-700 dark:text-neutral-300'}`}>
                    {pref}
                  </Text>
                </Pressable>
              ))}
            </View>
            <View className="flex-row" style={{ gap: 12 }}>
              <Pressable onPress={() => setIsQuoteModalVisible(false)} className="flex-1 py-3 border border-neutral-900 rounded-xl items-center">
                <Text className="text-sm font-semibold text-neutral-900 dark:text-neutral-50">Cancel</Text>
              </Pressable>
              <Pressable onPress={handleRequestQuote} className="flex-1 py-3 bg-indigo-600 rounded-xl items-center">
                <Text className="text-sm font-semibold text-white">Send Request</Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}

      {/* Gallery Overlay */}
      {galleryProject && (
        <View className="absolute inset-0 z-[80] bg-black">
          <View className="absolute top-0 left-0 right-0 z-10 flex-row items-center justify-between px-4 py-4 pt-12">
            <Pressable onPress={() => setGalleryProject(null)} className="w-8 h-8 items-center justify-center rounded-full bg-white/20">
              <FontAwesome5 name="times" size={14} color="#fff" />
            </Pressable>
            <View className="items-center">
              <Text className="text-sm font-semibold text-white truncate max-w-[200px]" numberOfLines={1}>{galleryProject.name || galleryProject.title}</Text>
              <Text className="text-[10px] text-white/60">{galleryIndex + 1} / {galleryProject.images.length} photos</Text>
            </View>
            <View className="w-8" />
          </View>
          <View className="flex-1 items-center justify-center">
            {galleryProject.images[galleryIndex] ? (
              <Image source={{ uri: galleryProject.images[galleryIndex] }} className="w-full h-full" resizeMode="contain" />
            ) : (
              <FontAwesome5 name="image" size={48} color="rgba(255,255,255,0.3)" />
            )}
            {galleryProject.images.length > 1 && galleryIndex > 0 && (
              <Pressable onPress={() => setGalleryIndex(galleryIndex - 1)} className="absolute left-4 top-1/2 w-9 h-9 rounded-full bg-white/20 items-center justify-center">
                <FontAwesome5 name="chevron-left" size={16} color="#fff" />
              </Pressable>
            )}
            {galleryProject.images.length > 1 && galleryIndex < galleryProject.images.length - 1 && (
              <Pressable onPress={() => setGalleryIndex(galleryIndex + 1)} className="absolute right-4 top-1/2 w-9 h-9 rounded-full bg-white/20 items-center justify-center">
                <FontAwesome5 name="chevron-right" size={16} color="#fff" />
              </Pressable>
            )}
          </View>
        </View>
      )}

      {/* Report Dialog */}
      {showReportDialog && (
        <View className="absolute inset-0 z-[80]" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <Pressable className="flex-1" onPress={() => { if (!reportSubmitting) setShowReportDialog(false); }} />
          <View className="absolute bottom-0 left-0 right-0 bg-white dark:bg-neutral-950 rounded-t-2xl p-6">
            <Text className="text-lg font-bold text-neutral-900 dark:text-neutral-50 mb-4">Report Contractor</Text>
            <TextInput
              value={reportReason}
              onChangeText={setReportReason}
              placeholder="Describe the issue..."
              multiline
              numberOfLines={4}
              className="w-full p-3 rounded-lg border border-neutral-200 dark:border-neutral-700 text-sm"
              placeholderTextColor="#a3a3a3"
              style={{ textAlignVertical: 'top' }}
            />
            <View className="flex-row mt-4" style={{ gap: 12 }}>
              <Pressable onPress={() => setShowReportDialog(false)} className="flex-1 py-3 rounded-xl items-center border border-neutral-200 dark:border-neutral-700">
                <Text className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleReport}
                disabled={!reportReason.trim() || reportSubmitting}
                className={`flex-1 py-3 rounded-xl items-center ${reportReason.trim() && !reportSubmitting ? 'bg-indigo-500' : 'bg-neutral-200 dark:bg-neutral-800'}`}
              >
                {reportSubmitting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text className={`text-sm font-semibold ${reportReason.trim() ? 'text-white' : 'text-neutral-400'}`}>Submit Report</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      )}
    </View>
  );
};

export default BusinessDetailScreen;
