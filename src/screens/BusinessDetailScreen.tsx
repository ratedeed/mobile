import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  Linking,
  useColorScheme,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList, Review, Contractor, Post } from '../types';
import { FontAwesome5 } from '@expo/vector-icons';
import HapticFeedback from '../utils/haptics';
import { SvgImage } from '../components/common/SvgImage';
import * as ImagePicker from 'expo-image-picker';
import { fetchContractorDetails, fetchContractorPosts, createLead, fetchContractorReviews, extractId, browseContractors, post as apiPost, submitClaim } from '../api';
import { API_BASE_URL } from '../config';
import { uploadToCloudinary, CLOUDINARY_FOLDERS } from '../utils/cloudinary';
import { getCoverImageUrl, getProfileImageUrl, isSvgUrl } from '../utils/avatarUtils';
import { isFavorite, addFavorite, removeFavorite } from '../utils/favoritesStore';
import { VerifiedBadge } from '../components/common/VerifiedBadge';
import ServiceAreaMap from '../components/common/ServiceAreaMap';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'BusinessDetail'>;

function formatDate(dateStr: string | Date): string {
  if (!dateStr) return '';
  try {
    const d = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch { return ''; }
}

function formatTime(timeStr: string): string {
  if (!timeStr) return '';
  if (/\d+\s*(am|pm)/i.test(timeStr)) return timeStr;
  const [h, m] = timeStr.split(':');
  const hr = parseInt(h, 10);
  if (isNaN(hr)) return timeStr;
  const ampm = hr >= 12 ? 'PM' : 'AM';
  const h12 = hr % 12 || 12;
  return `${h12}:${m} ${ampm}`;
}

function formatRelativeTime(dateStr: string): string {
  if (!dateStr) return '';
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
  const isDark = useColorScheme() === 'dark';
  const { id } = route.params as { id: string };
  
  const [contractor, setContractor] = useState<Contractor | null>(null);
  const [contractorPosts, setContractorPosts] = useState<Post[]>([]);
  const [contractorReviews, setContractorReviews] = useState<any[]>([]);
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
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [similarContractors, setSimilarContractors] = useState<Contractor[]>([]);
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [claimDocumentUploading, setClaimDocumentUploading] = useState(false);
  const [claimDocumentFile, setClaimDocumentFile] = useState<string | null>(null);
  const [claimSubmitting, setClaimSubmitting] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [descExpanded, setDescExpanded] = useState(false);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [showPhotoGallery, setShowPhotoGallery] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const flatListRef = useRef<FlatList>(null);

  const handleClaimDocumentPick = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
        allowsMultipleSelection: false,
        base64: true,
      });
      if (result.canceled || !result.assets?.length) return;

      const asset = result.assets[0];
      if (asset.fileSize && asset.fileSize > 5 * 1024 * 1024) {
        Alert.alert('File too large', 'Please choose an image under 5MB.');
        return;
      }
      setClaimDocumentFile(asset.uri);
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to select document');
    } finally {
      setClaimDocumentUploading(false);
    }
  };

  const handleSubmitClaim = async () => {
    if (!claimDocumentFile) {
      Alert.alert('Required', 'Please upload a verification document.');
      return;
    }
    setClaimSubmitting(true);
    setClaimError(null);
    try {
      const cloudinaryUrl = await uploadToCloudinary(claimDocumentFile, CLOUDINARY_FOLDERS.LICENSES);
      await submitClaim(id, cloudinaryUrl);
      Alert.alert('Claim Submitted', 'Your claim request has been submitted. Our team will review it within 1-3 business days.');
      setShowClaimModal(false);
      setClaimDocumentFile(null);
    } catch (err: any) {
      setClaimError(err?.message || 'Failed to submit claim.');
    } finally {
      setClaimSubmitting(false);
    }
  };

  const loadContractorDetails = async () => {
    try {
      if (isMounted.current) setLoading(true);
      const data = await fetchContractorDetails(id);
      
      if (!isMounted.current) return;
      setContractor(data);

      const contractorId = data?._id || (data as any).id || id;

      const [postsData, reviewsData, favStatus] = await Promise.all([
        fetchContractorPosts(contractorId).catch(() => ({ posts: [] })),
        fetchContractorReviews(contractorId).catch(() => []),
        isFavorite(contractorId)
      ]);
      
      if (!isMounted.current) return;
      setIsSaved(favStatus);
      setContractorPosts(postsData?.posts || []);
      
      // SYNC: Robust review list extraction matching web version
      let combinedReviews: any[] = [];
      if (Array.isArray(reviewsData)) {
        combinedReviews = [...reviewsData];
      } else if (reviewsData && Array.isArray((reviewsData as any).reviews)) {
        combinedReviews = [...(reviewsData as any).reviews];
      } else if (reviewsData && Array.isArray((reviewsData as any).data)) {
        combinedReviews = [...(reviewsData as any).data];
      }
      
      if (data && Array.isArray(data.reviewsList)) {
        combinedReviews = [...combinedReviews, ...data.reviewsList];
      }
      
      if (data && Array.isArray(data.reviews) && data.reviews.length > 0 && typeof (data.reviews[0]) === 'object') {
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
            
      setContractorReviews(uniqueReviews);

      // Fetch similar contractors by category (matching web version)
      if (data?.category) {
        try {
          const similarData = await browseContractors({ type: data.category, limit: 8 });
          const list = similarData?.contractors || (Array.isArray(similarData) ? similarData : []);
          const filtered = list
            .filter((sc: any) => (sc._id || sc.id) !== contractorId)
            .slice(0, 6);
          if (isMounted.current) setSimilarContractors(filtered);
        } catch (e) {
      // console.error('Failed to load similar contractors:', e);
        }
      }
    } catch (error) {
      // console.error('Error loading contractor:', error);
      Alert.alert('Error', 'Failed to load contractor details');
    } finally {
      if (isMounted.current) setLoading(false);
    }
  };

  const isMounted = React.useRef(true);
  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

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
      await apiPost(`${API_BASE_URL}/api/reports`, { contractorId, reason: reportReason });
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
    HapticFeedback.selection();
    const contractorId = contractor?._id || id;
    const previousState = isSaved;
    setIsSaved(!previousState);
    
    try {
      if (previousState) {
        await removeFavorite(contractorId);
      } else {
        await addFavorite(contractorId);
      }
    } catch {
      setIsSaved(previousState);
      Alert.alert('Error', 'Failed to update favorites.');
    }
  };

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long' });

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

  // SYNC: Review normalization matching web version logic exactly
  const normalizedReviews: any[] = contractorReviews.map((r: any, i: number) => {
    const firstName = r.user?.firstName || r.firstName || 'Ratedeed';
    const lastName = r.user?.lastName || r.lastName || 'User';
    const fullName = `${firstName} ${lastName}`.trim();
    const profilePicture = getProfileImageUrl(fullName, r.user?.profilePicture || r.profilePicture || '', c.category);

    return {
      _id: r._id || r.id || `r-${i}`,
      user: {
        ...(r.user || {}),
        _id: r.user?._id || r.user?.id || `u-${i}`,
        firstName,
        lastName,
        profilePicture
      },
      rating: r.rating || 5,
      comment: r.comment || r.text || r.title || '',
      createdAt: r.createdAt || new Date().toISOString(),
    };
  });

  const displayReviews = showAllReviews ? normalizedReviews : normalizedReviews.slice(0, 2);
  const avgRating = c.averageRating || c.rating || 0;
  const reviewCount = Math.max(normalizedReviews.length, c.numReviews || c.reviews || 0);

  const ratingBreakdown = [5, 4, 3, 2, 1].map(stars => ({
    stars,
    count: normalizedReviews.filter(r => Math.round(r.rating) === stars).length,
    pct: normalizedReviews.length > 0 ? (normalizedReviews.filter(r => Math.round(r.rating) === stars).length / normalizedReviews.length) * 100 : 0,
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
  const posts = contractorPosts || [];

  const heroImages = [
    bannerImage,
    ...(portfolio || []).flatMap((p: any) => p.images || (p.imageUrl ? [p.imageUrl] : [])).slice(0, 7)
  ].filter(img => typeof img === 'string' && img.length > 0);

  const serviceBadges = (() => {
    const badges: { icon: string; label: string }[] = [];
    if (c.isVerified) badges.push({ icon: 'shield-alt', label: 'Licensed & Insured' });
    if (services.some((s: any) => typeof s !== 'string' && s.emergencyAvailable)) badges.push({ icon: 'ambulance', label: '24/7 Emergency' });
    if (c.isVerified) badges.push({ icon: 'bolt', label: 'Same-Day Service' });
    if (badges.length === 0 && ((c as any).yearsInBusiness || 0) > 5) badges.push({ icon: 'award', label: 'Experienced Professional' });
    return badges;
  })();

  const featuredReview = normalizedReviews.length >= 3
    ? normalizedReviews.reduce((best: any, r: any) => {
        if (r.rating > best.rating) return r;
        if (r.rating === best.rating && (r.comment?.length || 0) > (best.comment?.length || 0)) return r;
        return best;
      }, normalizedReviews[0])
    : null;

  return (
    <View className="flex-1 bg-white dark:bg-neutral-950">
      <ScrollView
        ref={scrollViewRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ flexGrow: 1 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        onScroll={(e) => setShowBackToTop(e.nativeEvent.contentOffset.y > 400)}
        scrollEventThrottle={16}
      >
        {/* Hero Carousel */}
        <View className="relative w-full" style={{ aspectRatio: 16 / 9 }}>
          {heroImages.length > 0 ? (
            <FlatList
              ref={flatListRef}
              data={heroImages}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={(e) => {
                const index = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
                setActiveImageIndex(index);
              }}
              getItemLayout={(_, index) => ({ length: SCREEN_WIDTH, offset: SCREEN_WIDTH * index, index })}
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

          {/* Gradient overlay */}
          {heroImages.length > 0 && (
            <View className="absolute bottom-0 left-0 right-0 h-24" style={{ backgroundColor: 'rgba(0,0,0,0.3)' }} />
          )}

          {/* Carousel arrows */}
          {heroImages.length > 1 && activeImageIndex > 0 && (
            <Pressable
              onPress={() => flatListRef.current?.scrollToIndex({ index: activeImageIndex - 1, animated: true })}
              className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 items-center justify-center shadow-sm"
            >
              <FontAwesome5 name="chevron-left" size={14} color={isDark ? "#ffffff" : "#171717"} />
            </Pressable>
          )}
          {heroImages.length > 1 && activeImageIndex < heroImages.length - 1 && (
            <Pressable
              onPress={() => flatListRef.current?.scrollToIndex({ index: activeImageIndex + 1, animated: true })}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 items-center justify-center shadow-sm"
            >
              <FontAwesome5 name="chevron-right" size={14} color={isDark ? "#ffffff" : "#171717"} />
            </Pressable>
          )}

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

          {/* Show all photos button */}
          {heroImages.length > 1 && (
            <Pressable
              onPress={() => setShowPhotoGallery(true)}
              className="absolute bottom-4 right-4 flex-row items-center rounded-full px-3 py-1.5"
              style={{ gap: 6, backgroundColor: 'rgba(0,0,0,0.4)' }}
            >
              <FontAwesome5 name="camera" size={10} color="white" />
              <Text className="text-[10px] font-bold text-white">Show all photos</Text>
            </Pressable>
          )}

          <View className="absolute top-12 left-0 right-0 px-4 flex-row items-center justify-between">
            <Pressable
              onPress={() => navigation.goBack()}
              className="w-8 h-8 items-center justify-center bg-white dark:bg-neutral-950 rounded-full shadow-sm"
            >
              <FontAwesome5 name="chevron-left" size={16} color={isDark ? "#ffffff" : "#171717"} />
            </Pressable>
            <View className="flex-row" style={{ gap: 8 }}>
              <Pressable
                onPress={() => {
                  const recipientUserId = extractId(c.user) || c._id || id;
                  if (recipientUserId) {
                    navigation.navigate('ChatScreen', {
                      recipientId: recipientUserId,
                      recipientName: c.companyName || c.businessName || 'Contractor',
                    } as any);
                  }
                }}
                className="w-8 h-8 items-center justify-center bg-white/90 dark:bg-neutral-800/90 rounded-full shadow-sm"
              >
                <FontAwesome5 name="comment" size={14} color={isDark ? "#ffffff" : "#171717"} />
              </Pressable>
              <Pressable
                onPress={handleShare}
                className="w-8 h-8 items-center justify-center bg-white dark:bg-neutral-950 rounded-full shadow-sm"
              >
                <FontAwesome5 name="share-alt" size={14} color={isDark ? "#ffffff" : "#171717"} />
              </Pressable>
              <Pressable
                onPress={toggleFavorite}
                className="w-8 h-8 items-center justify-center bg-white dark:bg-neutral-950 rounded-full shadow-sm"
              >
                <FontAwesome5 name="heart" solid={isSaved} size={14} color={isSaved ? '#f43f5e' : '#171717'} />
              </Pressable>
              <Pressable
                onPress={() => setShowReportDialog(true)}
                className="w-8 h-8 items-center justify-center bg-white dark:bg-neutral-950 rounded-full shadow-sm"
              >
                <FontAwesome5 name="flag" size={14} color="#737373" />
              </Pressable>
              {(!(contractor?.isVerified) && !contractor?.user) && (
                <Pressable
                  onPress={() => setShowClaimModal(true)}
                  className="w-8 h-8 items-center justify-center bg-white dark:bg-neutral-950 rounded-full shadow-sm"
                >
                  <FontAwesome5 name="shield-alt" size={14} color="#4F46E5" />
                </Pressable>
              )}
            </View>
          </View>
        </View>

        {/* Content */}
        <View className="px-4 pb-20">
          <View className="mt-4">
            <Text className="text-2xl font-bold text-neutral-900 dark:text-neutral-50">{c.companyName || c.businessName || 'Company'}</Text>
            <View className="flex-row items-center flex-wrap mt-1" style={{ gap: 8 }}>
              <View className="flex-row items-center" style={{ gap: 4 }}>
                <FontAwesome5 name="star" solid size={14} color="#eab308" />
                <Text className="text-sm font-semibold text-slate-600">{avgRating.toFixed(2)}</Text>
                <Text className="text-sm text-neutral-500 dark:text-neutral-400">({reviewCount} reviews)</Text>
              </View>
              {!!c.isVerified && (
                <VerifiedBadge size="md" />
              )}
            </View>
          </View>

          {!!(location || (c as any).distance) && (
            <View className="flex-row items-center mt-2" style={{ gap: 4 }}>
              <FontAwesome5 name="map-marker-alt" size={12} color="#737373" />
              <Text className="text-sm text-neutral-500 dark:text-neutral-400">{location || ''}</Text>
              {!!(c as any).distance && (
                <Text className="text-sm text-neutral-500 dark:text-neutral-400"> · {(c as any).distance}</Text>
              )}
            </View>
          )}

          {/* Quick Stats */}
          <View className="flex-row mt-6 py-4 border-y border-neutral-100 dark:border-neutral-800">
            <View className="flex-1 items-center">
              <FontAwesome5 name="award" size={18} color="#171717" />
              <Text className="text-sm font-bold text-neutral-900 dark:text-neutral-50 mt-1">{(c as any).yearsInBusiness || (c as any).yearsExperience || 0}</Text>
              <Text className="text-[10px] text-neutral-500 dark:text-neutral-400">Years Exp.</Text>
            </View>
            <View className="flex-1 items-center">
              <FontAwesome5 name="star" solid size={18} color="#171717" />
              <Text className="text-sm font-bold text-neutral-900 dark:text-neutral-50 mt-1">{reviewCount}</Text>
              <Text className="text-[10px] text-neutral-500 dark:text-neutral-400">Reviews</Text>
            </View>
            <View className="flex-1 items-center">
              <FontAwesome5 name="clock" size={18} color="#171717" />
              <Text className="text-sm font-bold text-neutral-900 dark:text-neutral-50 mt-1">{(c as any).responseTime || 'N/A'}</Text>
              <Text className="text-[10px] text-neutral-500 dark:text-neutral-400">Response</Text>
            </View>
          </View>

          {/* Description */}
          {!!c.description && (
            <View className="mt-6">
              <Text className="text-base font-bold text-neutral-900 dark:text-neutral-50 mb-2">About Us</Text>
              <Text
                className="text-sm text-neutral-700 dark:text-neutral-300 leading-5"
                numberOfLines={descExpanded ? undefined : 3}
              >
                {c.description}
              </Text>
              {(c.description?.length || 0) > 120 && (
                <Pressable onPress={() => setDescExpanded(!descExpanded)} className="mt-1">
                  <Text className="text-sm font-semibold text-indigo-600">{descExpanded ? 'Show less' : 'Show more'}</Text>
                </Pressable>
              )}
            </View>
          )}

          {/* Service Badges */}
          {serviceBadges.length > 0 && (
            <View className="flex-row flex-wrap mt-4" style={{ gap: 8 }}>
              {serviceBadges.map((b, i) => (
                <View key={i} className="flex-row items-center bg-indigo-50 dark:bg-indigo-950 border border-indigo-200 dark:border-indigo-800 rounded-full px-3 py-1.5" style={{ gap: 6 }}>
                  <FontAwesome5 name={b.icon} size={10} color="#4F46E5" />
                  <Text className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">{b.label}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Services */}
          {services.length > 0 && (
            <View className="mt-8">
              <Text className="text-base font-bold text-neutral-900 dark:text-neutral-50 mb-3">Services</Text>
              <View style={{ gap: 8 }}>
                {services.map((svc: any, i: number) => {
                  const name = typeof svc === 'string' ? svc : svc.name;
                  const price = typeof svc === 'string' ? '' : svc.priceEstimate || svc.priceRange || '';
                  return (
                    <View key={i} className="bg-neutral-50 dark:bg-neutral-900 rounded-xl p-3 flex-row items-center justify-between">
                      <Text className="text-sm font-medium text-neutral-800 dark:text-neutral-200">{name}</Text>
                      {!!price && <Text className="text-xs font-bold text-indigo-600">{price}</Text>}
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* Portfolio */}
          {portfolio.length > 0 && (
            <View className="mt-8">
              <Text className="text-base font-bold text-neutral-900 dark:text-neutral-50 mb-3">Portfolio</Text>
              <View className="flex-row flex-wrap" style={{ gap: 12 }}>
                {portfolio.map((project: any, i: number) => {
                  const images = project.images || (project.imageUrl ? [project.imageUrl] : []);
                  return (
                    <Pressable
                      key={i}
                      onPress={() => { if (images.length > 0) { setGalleryProject({ ...project, images }); setGalleryIndex(0); } }}
                      style={{ width: '47%' }}
                      className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-100 dark:border-neutral-800 overflow-hidden"
                    >
                      <View style={{ aspectRatio: 1 }}>
                        {images[0] ? (
                          <Image source={{ uri: images[0] }} className="w-full h-full" resizeMode="cover" />
                        ) : (
                          <View className="w-full h-full bg-neutral-100 items-center justify-center">
                            <FontAwesome5 name="image" size={20} color="#d4d4d4" />
                          </View>
                        )}
                      </View>
                      <View className="p-2">
                        <Text className="text-xs font-bold text-neutral-900 dark:text-neutral-50" numberOfLines={1}>{project.name || project.title || 'Project'}</Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}

          {/* Posts */}
          {posts.length > 0 && (
            <View className="mt-8">
              <Text className="text-base font-bold text-neutral-900 dark:text-neutral-50 mb-3">Recent Updates</Text>
              {posts.map(post => (
                <View key={post._id} className="mb-4 bg-white dark:bg-neutral-900 rounded-xl border border-neutral-100 dark:border-neutral-800 overflow-hidden">
                  {post.images?.[0] && <Image source={{ uri: post.images[0] }} className="w-full aspect-square" resizeMode="cover" />}
                  <View className="p-3">
                    <Text className="text-sm text-neutral-700 dark:text-neutral-300">{post.caption}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Business Hours */}
          {(() => {
            const bh = (c as any).businessHours;
            if (!bh || typeof bh !== 'object') return null;
            const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
            const hasAny = days.some(d => bh[d]);
            if (!hasAny) return null;
            return (
              <View className="mt-8">
                <Text className="text-base font-bold text-neutral-900 dark:text-neutral-50 mb-3">Business Hours</Text>
                <View className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-100 dark:border-neutral-800 overflow-hidden">
                  {days.map((day) => {
                    const hours = bh[day];
                    if (!hours) return null;
                    const isToday = day === today;
                    return (
                      <View
                        key={day}
                        className={`flex-row items-center justify-between px-4 py-2.5 ${isToday ? 'bg-indigo-50 dark:bg-indigo-950' : ''}`}
                        style={{ borderBottomWidth: 1, borderBottomColor: isToday ? 'transparent' : '#f5f5f5' }}
                      >
                        <View className="flex-row items-center" style={{ gap: 8 }}>
                          {isToday && (
                            <View className="bg-indigo-600 rounded px-1.5 py-0.5">
                              <Text className="text-[9px] font-bold text-white">TODAY</Text>
                            </View>
                          )}
                          <Text className={`text-sm ${isToday ? 'font-bold text-indigo-700 dark:text-indigo-300' : 'text-neutral-700 dark:text-neutral-300'}`}>{day}</Text>
                        </View>
                        <Text className={`text-sm ${isToday ? 'font-semibold text-indigo-600 dark:text-indigo-400' : 'text-neutral-600 dark:text-neutral-400'}`}>
                          {hours === 'Closed' ? 'Closed' : typeof hours === 'string' ? hours.split('-').map((t: string) => formatTime(t.trim())).join(' – ') : String(hours)}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            );
          })()}

          {/* Certifications & Licenses */}
          {(() => {
            const certs = (c as any).certifications;
            const license = (c as any).licenseNumber;
            if ((!certs || !Array.isArray(certs) || certs.length === 0) && !license) return null;
            return (
              <View className="mt-8">
                <Text className="text-base font-bold text-neutral-900 dark:text-neutral-50 mb-3">Certifications & Licenses</Text>
                <View style={{ gap: 8 }}>
                  {license && (
                    <View className="flex-row items-center bg-white dark:bg-neutral-900 rounded-xl border border-neutral-100 dark:border-neutral-800 p-3" style={{ gap: 12 }}>
                      <View className="w-8 h-8 rounded-full bg-emerald-50 dark:bg-emerald-950 items-center justify-center">
                        <FontAwesome5 name="id-badge" size={12} color="#059669" />
                      </View>
                      <View className="flex-1">
                        <Text className="text-sm font-semibold text-neutral-900 dark:text-neutral-50">License #{license}</Text>
                        {(c as any).isVerified && <Text className="text-xs text-emerald-600">Verified</Text>}
                      </View>
                      <FontAwesome5 name="check-circle" size={16} color="#059669" />
                    </View>
                  )}
                  {Array.isArray(certs) && certs.map((cert: string, i: number) => (
                    <View key={i} className="flex-row items-center bg-white dark:bg-neutral-900 rounded-xl border border-neutral-100 dark:border-neutral-800 p-3" style={{ gap: 12 }}>
                      <View className="w-8 h-8 rounded-full bg-emerald-50 dark:bg-emerald-950 items-center justify-center">
                        <FontAwesome5 name="award" size={12} color="#059669" />
                      </View>
                      <Text className="flex-1 text-sm font-medium text-neutral-900 dark:text-neutral-50">{cert}</Text>
                      <FontAwesome5 name="check-circle" size={14} color="#059669" />
                    </View>
                  ))}
                </View>
              </View>
            );
          })()}

          {/* Service Area */}
          {(() => {
            const zipCodes = (c as any).serviceZipCodes || (c as any).zipCodesCovered || [];
            const serviceAreaText = (c as any).serviceArea || location;
            const hasMapData = !!serviceAreaText || (zipCodes && zipCodes.length > 0);
            if (!hasMapData) return null;
            const zipStrings = (zipCodes || []).map((zc: any) => typeof zc === 'string' ? zc : zc.zip || zc.name);
            return (
              <View className="mt-8">
                <Text className="text-base font-bold text-neutral-900 dark:text-neutral-50 mb-1">Service Area</Text>
                {!!serviceAreaText && (
                  <Text className="text-xs text-neutral-500 dark:text-neutral-400 mb-3">
                    {serviceAreaText}
                    {zipCodes.length > 0 && ` · ${zipCodes.length} zip codes served`}
                  </Text>
                )}
                <ServiceAreaMap
                  businessName={c.companyName || c.businessName || 'Contractor'}
                  locationName={serviceAreaText}
                  zipCodes={zipStrings}
                  height={180}
                />
                {zipCodes.length > 0 && (
                  <View className="flex-row flex-wrap mt-3" style={{ gap: 6 }}>
                    {zipCodes.map((zc: any, i: number) => {
                      const name = typeof zc === 'string' ? zc : zc.name || zc.zip;
                      return (
                        <View key={i} className="bg-indigo-50 dark:bg-indigo-950 border border-indigo-200 dark:border-indigo-800 rounded-full px-2.5 py-1">
                          <Text className="text-[10px] font-semibold text-indigo-700 dark:text-indigo-400">{name}</Text>
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            );
          })()}

          {/* REVIEWS SECTION */}
          <View className="mt-8 pt-6 border-t border-neutral-100 dark:border-neutral-800">
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-lg font-bold text-neutral-900 dark:text-neutral-50">Reviews</Text>
              <View className="flex-row items-center" style={{ gap: 4 }}>
                <FontAwesome5 name="star" solid size={14} color="#eab308" />
                <Text className="text-sm font-bold text-neutral-900 dark:text-neutral-50">{avgRating.toFixed(2)}</Text>
                <Text className="text-sm text-neutral-500">({reviewCount})</Text>
              </View>
            </View>

            {normalizedReviews.length > 0 ? (
              <View>
                {/* Breakdown */}
                <View className="mb-6" style={{ gap: 6 }}>
                  {ratingBreakdown.map(r => (
                    <View key={r.stars} className="flex-row items-center" style={{ gap: 10 }}>
                      <Text className="text-[10px] font-bold text-neutral-500 w-3">{r.stars}</Text>
                      <View className="flex-1 h-1.5 bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                        <View className="h-full bg-yellow-400" style={{ width: `${r.pct}%` }} />
                      </View>
                    </View>
                  ))}
                </View>

                {/* Featured Review */}
                {featuredReview && (
                  <View className="mb-6 bg-indigo-50 dark:bg-indigo-950 border border-indigo-100 dark:border-indigo-800 rounded-xl p-4">
                    <FontAwesome5 name="quote-left" size={16} color="#4F46E5" style={{ marginBottom: 8 }} />
                    <Text className="text-sm text-neutral-800 dark:text-neutral-200 leading-5 mb-3">{featuredReview.comment}</Text>
                    <View className="flex-row items-center" style={{ gap: 10 }}>
                      {isSvgUrl(featuredReview.user?.profilePicture) ? (
                        <View className="w-8 h-8 rounded-full overflow-hidden">
                          <SvgImage uri={featuredReview.user.profilePicture} width="100%" height="100%" />
                        </View>
                      ) : featuredReview.user?.profilePicture ? (
                        <Image source={{ uri: featuredReview.user.profilePicture }} className="w-8 h-8 rounded-full" />
                      ) : (
                        <View className="w-8 h-8 rounded-full bg-indigo-200 items-center justify-center">
                          <FontAwesome5 name="user" size={10} color="#4F46E5" />
                        </View>
                      )}
                      <View className="flex-1">
                        <Text className="text-xs font-bold text-neutral-900 dark:text-neutral-50">{featuredReview.user?.firstName} {featuredReview.user?.lastName}</Text>
                        <Text className="text-[10px] text-neutral-500">{formatDate(featuredReview.createdAt)}</Text>
                      </View>
                      <View className="flex-row items-center" style={{ gap: 2 }}>
                        <FontAwesome5 name="star" solid size={10} color="#eab308" />
                        <Text className="text-xs font-bold text-neutral-900 dark:text-neutral-50">{featuredReview.rating}</Text>
                      </View>
                    </View>
                  </View>
                )}

                {/* List */}
                <View style={{ gap: 20 }}>
                  {displayReviews.map((review, idx) => (
                    <View key={review._id || idx} className="pb-4 border-b border-neutral-50 dark:border-neutral-900 last:border-0">
                      <View className="flex-row items-center mb-2" style={{ gap: 10 }}>
                        {isSvgUrl(review.user?.profilePicture) ? (
                          <View className="w-10 h-10 rounded-full overflow-hidden">
                            <SvgImage uri={review.user.profilePicture} width="100%" height="100%" />
                          </View>
                        ) : review.user?.profilePicture ? (
                          <Image source={{ uri: review.user.profilePicture }} className="w-10 h-10 rounded-full" />
                        ) : (
                          <View className="w-10 h-10 rounded-full bg-neutral-100 items-center justify-center">
                            <FontAwesome5 name="user" size={14} color="#d4d4d4" />
                          </View>
                        )}
                        <View className="flex-1">
                          <Text className="text-sm font-bold text-neutral-900 dark:text-neutral-50">{review.user?.firstName} {review.user?.lastName}</Text>
                          <Text className="text-[10px] text-neutral-400">{formatDate(review.createdAt)}</Text>
                        </View>
                        <View className="flex-row items-center" style={{ gap: 2 }}>
                          <FontAwesome5 name="star" solid size={10} color="#eab308" />
                          <Text className="text-xs font-bold">{review.rating}</Text>
                        </View>
                      </View>
                      <Text className="text-sm text-neutral-600 dark:text-neutral-400 leading-5">{review.comment}</Text>
                    </View>
                  ))}
                </View>

                {normalizedReviews.length > 2 && !showAllReviews && (
                  <Pressable
                    onPress={() => setShowAllReviews(true)}
                    className="mt-4 py-3 bg-neutral-50 dark:bg-neutral-900 rounded-xl items-center"
                  >
                    <Text className="text-sm font-bold text-indigo-600">Show all {reviewCount} reviews</Text>
                  </Pressable>
                )}
              </View>
            ) : (
              <View className="py-10 items-center justify-center">
                <FontAwesome5 name="star" size={32} color="#f5f5f5" style={{ marginBottom: 12 }} />
                <Text className="text-neutral-400 text-sm">No reviews yet for this contractor</Text>
              </View>
            )}
          </View>

          {/* SIMILAR CONTRACTORS */}
          {similarContractors.length > 0 && (
            <View className="mt-8 pt-6 border-t border-neutral-100 dark:border-neutral-800">
              <Text className="text-lg font-bold text-neutral-900 dark:text-neutral-50 mb-3">Similar contractors</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
                {similarContractors.map((sc, i) => {
                  const scName = sc.companyName || sc.businessName || 'Contractor';
                  const scRating = sc.averageRating || sc.rating || 0;
                  const scReviews = sc.numReviews || sc.reviews || 0;
                  const scLocation = [sc.contactInfo?.city, sc.contactInfo?.state].filter(Boolean).join(', ');
                  const scCover = getCoverImageUrl(scName, (sc as any).bannerUrl || sc.bannerImage || (sc as any).imageUrl || sc.profilePicture || '', sc.category, 400, 400);
                  const scId = sc._id || (sc as any).id;
                  return (
                    <Pressable
                      key={scId || `sc-${i}`}
                      onPress={() => {
                        navigation.push('BusinessDetail' as any, { id: scId } as any);
                      }}
                      className="w-40 bg-white dark:bg-neutral-900 rounded-xl border border-neutral-100 dark:border-neutral-800 overflow-hidden"
                    >
                      <View style={{ aspectRatio: 1 }}>
                        {isSvgUrl(scCover) ? (
                          <View className="w-full h-full">
                            <SvgImage uri={scCover} width="100%" height="100%" />
                          </View>
                        ) : (
                          <Image source={{ uri: scCover }} className="w-full h-full" resizeMode="cover" />
                        )}
                        {sc.isVerified && (
                          <View className="absolute top-1.5 left-1.5">
                            <VerifiedBadge size="sm" variant="glass" />
                          </View>
                        )}
                      </View>
                      <View className="p-2">
                        <Text className="text-xs font-semibold text-neutral-900 dark:text-neutral-50 leading-tight" numberOfLines={1}>{scName}</Text>
                        <View className="flex-row items-center mt-0.5" style={{ gap: 2 }}>
                          <FontAwesome5 name="star" solid size={8} color="#eab308" />
                          <Text className="text-[10px] font-semibold text-neutral-700 dark:text-neutral-300">{scRating.toFixed(1)}</Text>
                          <Text className="text-[10px] text-neutral-400">({scReviews})</Text>
                        </View>
                        {!!scLocation && (
                          <Text className="text-[10px] text-neutral-500 dark:text-neutral-400 mt-0.5" numberOfLines={1}>{scLocation}</Text>
                        )}
                      </View>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          )}

          <View style={{ height: 100 }} />
        </View>
      </ScrollView>

      {/* Sticky Bottom CTA */}
      <View className="absolute bottom-0 left-0 right-0 bg-white/95 dark:bg-neutral-950/95 border-t border-neutral-100 dark:border-neutral-800 px-4 py-4 pb-8 flex-row items-center justify-between shadow-lg">
        <View>
          <Text className="text-lg font-bold text-neutral-900 dark:text-neutral-50">From {priceMin || 'N/A'}</Text>
          <Text className="text-[10px] text-neutral-500 uppercase tracking-tighter">Starting Project Price</Text>
        </View>
        <View className="flex-row items-center" style={{ gap: 8 }}>
          {(c.contactInfo?.phoneNumber || (c as any).phone) && (
            <Pressable
              onPress={() => Linking.openURL(`tel:${c.contactInfo?.phoneNumber || (c as any).phone}`)}
              className="w-12 h-12 items-center justify-center bg-emerald-50 dark:bg-emerald-950 rounded-xl"
            >
              <FontAwesome5 name="phone" size={18} color="#059669" />
            </Pressable>
          )}
          <Pressable
            onPress={() => {
              const recipientUserId = extractId(c.user) || c._id || id;
              if (recipientUserId) {
                navigation.navigate('ChatScreen', {
                  recipientId: recipientUserId,
                  recipientName: c.companyName || c.businessName || 'Contractor',
                } as any);
              }
            }}
            className="w-12 h-12 items-center justify-center bg-neutral-100 dark:bg-neutral-800 rounded-xl"
          >
            <FontAwesome5 name="comment" size={18} color="#171717" />
          </Pressable>
          <Pressable
            onPress={() => setIsQuoteModalVisible(true)}
            className="bg-indigo-600 px-6 py-3.5 rounded-2xl shadow-indigo-300"
          >
            <Text className="text-white font-bold">Request Quote</Text>
          </Pressable>
        </View>
      </View>

      {/* Quote Modal */}
      {isQuoteModalVisible && (
        <View className="absolute inset-0 z-[100] justify-end" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <Pressable className="flex-1" onPress={() => setIsQuoteModalVisible(false)} />
          <View className="bg-white dark:bg-neutral-950 rounded-t-3xl p-6">
            <Text className="text-xl font-bold mb-4">Request Quote</Text>
            <TextInput
              placeholder="What do you need help with?"
              className="bg-neutral-50 dark:bg-neutral-900 p-4 rounded-xl mb-3 text-sm"
              value={quoteProjectTitle}
              onChangeText={setQuoteProjectTitle}
            />
            <TextInput
              placeholder="Describe your project in detail..."
              multiline
              numberOfLines={4}
              className="bg-neutral-50 dark:bg-neutral-900 p-4 rounded-xl mb-4 text-sm"
              style={{ height: 100, textAlignVertical: 'top' }}
              value={quoteDescription}
              onChangeText={setQuoteDescription}
            />
            <View className="flex-row" style={{ gap: 12 }}>
              <Pressable onPress={() => setIsQuoteModalVisible(false)} className="flex-1 py-4 items-center">
                <Text className="text-neutral-500 font-bold">Cancel</Text>
              </Pressable>
              <Pressable onPress={handleRequestQuote} className="flex-2 bg-indigo-600 py-4 px-10 rounded-xl items-center">
                <Text className="text-white font-bold">Send Request</Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}

      {/* Report Modal */}
      {showReportDialog && (
        <View className="absolute inset-0 z-[100] justify-end" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <Pressable className="flex-1" onPress={() => setShowReportDialog(false)} />
          <View className="bg-white dark:bg-neutral-950 rounded-t-3xl p-6">
            <Text className="text-xl font-bold mb-4 text-neutral-900 dark:text-white">Report Profile</Text>
            <TextInput
              placeholder="Why are you reporting this profile?"
              multiline
              className="bg-neutral-50 dark:bg-neutral-900 p-4 rounded-xl mb-4 text-sm text-neutral-900 dark:text-white"
              style={{ height: 100, textAlignVertical: 'top' }}
              placeholderTextColor={isDark ? "#9ca3af" : "#a3a3a3"}
              value={reportReason}
              onChangeText={setReportReason}
            />
            <Pressable onPress={handleReport} className="bg-red-500 py-4 rounded-xl items-center">
              {reportSubmitting ? <ActivityIndicator color="#fff" /> : <Text className="text-white font-bold">Submit Report</Text>}
            </Pressable>
          </View>
        </View>
      )}

      {/* Claim Profile Modal */}
      {showClaimModal && (
        <View className="absolute inset-0 z-[100] justify-end" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <Pressable className="flex-1" onPress={() => { setShowClaimModal(false); setClaimDocumentFile(null); setClaimError(null); }} />
            <View className="bg-white dark:bg-neutral-950 rounded-t-3xl p-6">
            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-xl font-bold text-neutral-900 dark:text-white">Claim This Profile</Text>
              <Pressable onPress={() => { setShowClaimModal(false); setClaimDocumentFile(null); setClaimError(null); }} className="w-8 h-8 items-center justify-center rounded-full">
                <FontAwesome5 name="times" size={14} color={isDark ? "#a3a3a3" : "#737373"} />
              </Pressable>
            </View>

            <View className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 flex-row items-start mb-4" style={{ gap: 10 }}>
              <FontAwesome5 name="shield-alt" size={16} color="#4F46E5" style={{ marginTop: 2 }} />
              <Text className="text-xs text-indigo-700 leading-4 flex-1">
                To claim this profile and gain control over its content, reviews, and leads, please upload a document proving you own or operate this business (e.g., Business License, Utility Bill, or Tax Document).
              </Text>
            </View>

            {claimError && (
              <View className="bg-red-50 border border-red-100 rounded-xl p-3 flex-row items-center mb-4" style={{ gap: 10 }}>
                <FontAwesome5 name="exclamation-circle" size={14} color="#dc2626" />
                <Text className="text-sm text-red-700 flex-1">{claimError}</Text>
              </View>
            )}

            <Text className="text-sm font-semibold text-neutral-700 mb-2">Verification Document</Text>

            {!claimDocumentFile ? (
              <Pressable
                onPress={handleClaimDocumentPick}
                disabled={claimDocumentUploading}
                className="border-2 border-dashed border-neutral-300 rounded-xl p-6 items-center justify-center mb-4"
              >
                {claimDocumentUploading ? (
                  <ActivityIndicator size="small" color="#4F46E5" />
                ) : (
                  <>
                    <FontAwesome5 name="cloud-upload-alt" size={24} color="#a3a3a3" />
                    <Text className="text-sm font-semibold text-neutral-700 mt-2">Tap to upload document</Text>
                    <Text className="text-xs text-neutral-500 mt-1">JPEG, PNG, or PDF (Max 5MB)</Text>
                  </>
                )}
              </Pressable>
            ) : (
              <View className="flex-row items-center justify-between p-4 bg-neutral-50 border border-neutral-200 rounded-xl mb-4">
                <View className="flex-row items-center flex-1" style={{ gap: 10 }}>
                  <View className="w-8 h-8 rounded-lg bg-indigo-100 items-center justify-center">
                    <FontAwesome5 name="shield-alt" size={12} color="#4F46E5" />
                  </View>
                  <Text className="text-sm font-semibold text-neutral-900 flex-1" numberOfLines={1}>Document uploaded</Text>
                </View>
                <Pressable onPress={() => setClaimDocumentFile(null)} className="p-2">
                  <FontAwesome5 name="times" size={12} color="#737373" />
                </Pressable>
              </View>
            )}

            <Pressable
              onPress={handleSubmitClaim}
              disabled={!claimDocumentFile || claimSubmitting}
              className={`py-3.5 rounded-xl items-center ${!claimDocumentFile || claimSubmitting ? 'bg-indigo-300' : 'bg-indigo-600'}`}
            >
              {claimSubmitting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text className="text-white font-bold text-sm">Submit Claim Request</Text>
              )}
            </Pressable>
          </View>
        </View>
      )}

      {/* Back to Top */}
      {showBackToTop && (
        <Pressable
          onPress={() => scrollViewRef.current?.scrollTo({ y: 0, animated: true })}
          className="absolute bottom-24 right-4 w-10 h-10 rounded-full bg-indigo-600 items-center justify-center shadow-lg"
          style={{ elevation: 4 }}
        >
          <FontAwesome5 name="chevron-up" size={14} color="white" />
        </Pressable>
      )}

      {/* Photo Gallery Modal */}
      {showPhotoGallery && heroImages.length > 0 && (
        <View className="absolute inset-0 z-[200] bg-black">
          <View className="absolute top-12 left-0 right-0 z-10 flex-row items-center justify-between px-4">
            <Text className="text-white font-bold text-sm">{activeImageIndex + 1} / {heroImages.length}</Text>
            <Pressable
              onPress={() => setShowPhotoGallery(false)}
              className="w-8 h-8 items-center justify-center bg-white/20 rounded-full"
            >
              <FontAwesome5 name="times" size={14} color="white" />
            </Pressable>
          </View>
          <FlatList
            data={heroImages}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            initialScrollIndex={Math.min(activeImageIndex, heroImages.length - 1)}
            getItemLayout={(_, index) => ({ length: SCREEN_WIDTH, offset: SCREEN_WIDTH * index, index })}
            onMomentumScrollEnd={(e) => {
              const index = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
              setActiveImageIndex(index);
            }}
            keyExtractor={(_, i) => i.toString()}
            renderItem={({ item }) => (
              <View style={{ width: SCREEN_WIDTH, flex: 1 }} className="items-center justify-center">
                {isSvgUrl(item) ? (
                  <View className="w-full h-3/4">
                    <SvgImage uri={item} width="100%" height="100%" />
                  </View>
                ) : (
                  <Image source={{ uri: item }} className="w-full h-3/4" resizeMode="contain" />
                )}
              </View>
            )}
          />
        </View>
      )}
    </View>
  );
};

export default BusinessDetailScreen;
