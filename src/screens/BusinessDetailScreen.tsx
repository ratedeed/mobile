import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  ScrollView,
  Image,
  Pressable,
  Alert,
  Share,
  Text,
  TextInput,
  Dimensions,
  FlatList,
  Linking,
  useColorScheme,
  Platform,
  Modal,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList, Review, Contractor, Post } from '../types';
import { FontAwesome5 } from '@expo/vector-icons';
import HapticFeedback from '../utils/haptics';
import { SvgImage } from '../components/common/SvgImage';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { fetchContractorDetails, fetchContractorPosts, createLead, fetchContractorReviews, extractId, browseContractors, post as apiPost, submitClaim, getContractorBySlug, checkOnlineStatus, onUserOnlineStatus, offUserOnlineStatus } from '../api';
import { API_BASE_URL } from '../config';
import { uploadToCloudinary, CLOUDINARY_FOLDERS } from '../utils/cloudinary';
import { requestPhotoLibraryPermission } from '../utils/permissions';
import { getCoverImageUrl, getProfileImageUrl, isSvgUrl } from '../utils/avatarUtils';
import { isFavorite, addFavorite, removeFavorite } from '../utils/favoritesStore';
import { VerifiedBadge } from '../components/common/VerifiedBadge';
import { SkeletonLoader } from '../components/common/SkeletonLoader';
import ServiceAreaMap from '../components/common/ServiceAreaMap';
import { useAuth } from '../context/AuthContext';
import GuestPrompt from '../components/GuestPrompt';
import LazyImage from '../components/common/LazyImage';
import { BouncingDotsLoader, BouncingRefreshScrollView } from '../components/common';

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

function formatResponseTime(minutes: number, sampleSize: number): string {
  if (!minutes) return 'New';
  if (minutes < 60) {
    return `~${minutes}min`;
  }
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (mins === 0) return `~${hrs}hr`;
  if (mins < 30) return `~${hrs}hr`;
  return `~${hrs}.5hrs`;
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
  const insets = useSafeAreaInsets();
  const isDark = useColorScheme() === 'dark';
  const params = route.params as { id?: string; slug?: string } || {};
  const id = params.id || params.slug || '';
  
  const [contractor, setContractor] = useState<Contractor | null>(null);
  const [contractorPosts, setContractorPosts] = useState<Post[]>([]);
  const [contractorReviews, setContractorReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [isOnline, setIsOnline] = useState(false);
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
  const [scrollY, setScrollY] = useState(0);
  const [showPhotoGallery, setShowPhotoGallery] = useState(false);
  const [showGuestPrompt, setShowGuestPrompt] = useState(false);
  const [guestAction, setGuestAction] = useState('do that');
  const scrollViewRef = useRef<ScrollView>(null);
  const flatListRef = useRef<FlatList>(null);
  const { isAuthenticated } = useAuth();

  const handleClaimDocumentPick = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/*', 'application/pdf'],
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.length) return;

      const asset = result.assets[0];
      if (asset.size && asset.size > 5 * 1024 * 1024) {
        Alert.alert('File too large', 'Please choose a document under 5MB.');
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
      await submitClaim(contractor?._id || id, cloudinaryUrl);
      Alert.alert('Claim Submitted', 'Your claim request has been submitted. Our team will review it and notify you.');
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
      let data;
      if (params.id) {
        data = await fetchContractorDetails(params.id);
      } else if (params.slug) {
        data = await getContractorBySlug(params.slug);
      } else {
        data = await fetchContractorDetails(id);
      }
      
      if (!isMounted.current) return;
      setContractor(data);

      const contractorId = data?._id || (data as any).id || id;

      const [postsData, reviewsData, favStatus] = await Promise.all([
        fetchContractorPosts(contractorId).catch(() => ({ posts: [] })),
        fetchContractorReviews(contractorId).catch(() => []),
        isFavorite(contractorId),
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

  useEffect(() => {
    const targetUserId = contractor?.user?._id;
    if (!targetUserId) {
      setIsOnline(false);
      return;
    }

    try {
      checkOnlineStatus(targetUserId);
    } catch (err) {
      if (__DEV__) console.warn('checkOnlineStatus failed:', err);
    }

    const handleStatus = (data: { userId: string; isOnline: boolean }) => {
      if (data.userId === targetUserId) {
        setIsOnline(data.isOnline);
      }
    };

    onUserOnlineStatus(handleStatus);

    return () => {
      offUserOnlineStatus(handleStatus);
    };
  }, [contractor?.user?._id]);

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
    if (!isAuthenticated) {
      setGuestAction('save this contractor');
      setShowGuestPrompt(true);
      return;
    }
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
      <View className="flex-1 bg-white dark:bg-neutral-950 p-6 pt-16">
        <SkeletonLoader type="profile" count={1} />
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
  const avatarImage = getProfileImageUrl(c.companyName || c.businessName || 'Contractor', c.profilePicture || c.profileImage || c.user?.profilePicture || '', c.category);
  const services = c.servicesOffered || c.services || [];
  const portfolio = c.portfolio || [];
  const posts = contractorPosts || [];

  const rawBanners = Array.isArray(c.bannerImages) && c.bannerImages.length > 0
    ? c.bannerImages.map((img: string) => getCoverImageUrl(c.companyName || c.businessName || 'Contractor', img, c.category))
    : [bannerImage];

  const heroImages = [
    ...rawBanners,
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
      {/* Floating Sticky Header */}
      <View 
        className="absolute left-0 right-0 z-50 flex-row items-center justify-between px-4 pb-3"
        style={{ 
          top: 0,
          paddingTop: insets.top > 0 ? insets.top + 8 : 12,
          backgroundColor: scrollY > 100 
            ? (isDark ? '#171717' : '#ffffff') 
            : 'transparent',
          borderBottomWidth: scrollY > 100 ? 1 : 0,
          borderBottomColor: isDark ? '#262626' : '#e5e5e5',
        }}
      >
        <Pressable
          onPress={() => navigation.goBack()}
          className="w-8 h-8 items-center justify-center bg-white dark:bg-neutral-950 rounded-full shadow-sm"
        >
          <FontAwesome5 name="chevron-left" size={16} color={isDark ? "#ffffff" : "#171717"} />
        </Pressable>

        <View className="flex-1 px-3">
          {scrollY > 100 && (
            <Text className="text-sm font-bold text-neutral-900 dark:text-neutral-50 text-center" numberOfLines={1}>
              {c.companyName || c.businessName || 'Contractor'}
            </Text>
          )}
        </View>

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
            <FontAwesome5 name="heart" solid={isSaved} size={14} color={isSaved ? '#f43f5e' : (isDark ? '#ffffff' : '#171717')} />
          </Pressable>
          {isAuthenticated && (
            <Pressable
              onPress={() => {
                setShowReportDialog(true);
              }}
              className="w-8 h-8 items-center justify-center bg-white dark:bg-neutral-950 rounded-full shadow-sm"
            >
              <FontAwesome5 name="flag" size={14} color={isDark ? '#ffffff' : '#737373'} />
            </Pressable>
          )}
          {(!(contractor?.isVerified) && !contractor?.user) && (
            <Pressable
              onPress={() => {
                if (!isAuthenticated) {
                  navigation.navigate('Login');
                } else {
                  setShowClaimModal(true);
                }
              }}
              className="w-8 h-8 items-center justify-center bg-white dark:bg-neutral-950 rounded-full shadow-sm"
            >
              <FontAwesome5 name="shield-alt" size={14} color="#4F46E5" />
            </Pressable>
          )}
        </View>
      </View>

      <BouncingRefreshScrollView
        ref={scrollViewRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ flexGrow: 1 }}
        refreshing={refreshing}
        onRefresh={onRefresh}
        onScroll={(e) => {
          const y = e.nativeEvent.contentOffset.y;
          setScrollY(y);
          setShowBackToTop(y > 400);
        }}
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
              windowSize={2}
              maxToRenderPerBatch={2}
              removeClippedSubviews
              renderItem={({ item }) => (
                <View style={{ width: SCREEN_WIDTH, height: '100%' }}>
                  {isSvgUrl(item) ? (
                    <View className="w-full h-full">
                      <SvgImage uri={item} width="100%" height="100%" />
                    </View>
                  ) : (
                    <LazyImage uri={item} style={{ width: '100%', height: '100%' }} />
                  )}
                </View>
              )}
            />
          ) : (
            <View className="w-full h-full bg-neutral-200 dark:bg-neutral-800 items-center justify-center">
              <FontAwesome5 name="image" size={48} color={isDark ? '#737373' : '#a3a3a3'} />
            </View>
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
        </View>

        {/* Content */}
        <View className="px-4 pb-20" style={{ overflow: 'visible' }}>
          {/* Header Row: Floating Avatar, Name, and Escrow protected badge */}
          <View className="relative flex-row items-start justify-between z-10 mt-3 min-h-[50px]" style={{ overflow: 'visible' }}>
            {/* Floating Avatar */}
            <View className="absolute left-0 top-[-36px] w-[72px] h-[72px] z-20" style={{ overflow: 'visible' }}>
              <View className="w-full h-full rounded-full border-4 border-white bg-white overflow-hidden shadow-md">
                {isSvgUrl(avatarImage) ? (
                  <SvgImage uri={avatarImage} width="100%" height="100%" />
                ) : (
                  <Image source={{ uri: avatarImage }} className="w-full h-full" resizeMode="cover" />
                )}
              </View>
              {isOnline && (
                <View 
                  className="absolute bottom-0 right-0 w-[18px] h-[18px] rounded-full border-2 border-white bg-green-500" 
                  style={{
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.2,
                    shadowRadius: 1,
                    elevation: 2,
                  }}
                />
              )}
            </View>
            {/* Business details */}
            <View className="flex-1 pl-[84px] pr-2">
              <Text className="text-xl font-bold text-neutral-900 dark:text-neutral-50 leading-tight" numberOfLines={2}>
                {c.companyName || c.businessName || 'Company'}
              </Text>
              <View className="flex-row items-center mt-1" style={{ gap: 4 }}>
                <FontAwesome5 name="star" solid size={11} color="#eab308" />
                <Text className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">
                  {reviewCount > 0 ? avgRating.toFixed(2) : 'New'}
                </Text>
                <Text className="text-xs text-neutral-500 dark:text-neutral-400">
                  ({reviewCount} {reviewCount === 1 ? 'review' : 'reviews'})
                </Text>
              </View>
              {!!location && (
                <View className="flex-row items-center mt-1" style={{ gap: 4 }}>
                  <FontAwesome5 name="map-marker-alt" size={10} color="#737373" />
                  <Text className="text-xs text-neutral-500 dark:text-neutral-400 flex-1" numberOfLines={1}>
                    {location}
                  </Text>
                </View>
              )}
              
              {/* Badges Row */}
              <View className="flex-row flex-wrap items-center mt-1.5" style={{ gap: 4 }}>
                {c.isVerified && (
                  <View className="bg-indigo-50 dark:bg-indigo-950/30 px-2 py-0.5 rounded-full border border-indigo-100 dark:border-indigo-900/30">
                    <Text className="text-[9px] font-bold text-indigo-700 dark:text-indigo-400 uppercase">Licensed</Text>
                  </View>
                )}
                {c.avgResponseHours !== undefined && c.avgResponseHours !== null && (
                  (() => {
                    const hrs = c.avgResponseHours;
                    let text = '';
                    let colorClass = '';
                    let textClass = '';
                    if (hrs < 1) {
                      text = '⚡ Responds in <1h';
                      colorClass = 'bg-emerald-50 border-emerald-100 dark:bg-emerald-950/20 dark:border-emerald-900/30';
                      textClass = 'text-emerald-700 dark:text-emerald-400';
                    } else if (hrs < 4) {
                      text = `⚡ Responds in ~${Math.round(hrs)}h`;
                      colorClass = 'bg-emerald-50 border-emerald-100 dark:bg-emerald-950/20 dark:border-emerald-900/30';
                      textClass = 'text-emerald-700 dark:text-emerald-400';
                    } else if (hrs < 24) {
                      text = `⏱️ Responds in ~${Math.round(hrs)}h`;
                      colorClass = 'bg-amber-50 border-amber-100 dark:bg-amber-950/20 dark:border-amber-900/30';
                      textClass = 'text-amber-700 dark:text-amber-400';
                    } else {
                      const days = Math.round(hrs / 24);
                      text = `🕐 Responds in ~${days}d`;
                      colorClass = 'bg-neutral-50 border-neutral-200 dark:bg-neutral-900/30 dark:border-neutral-800';
                      textClass = 'text-neutral-600 dark:text-neutral-400';
                    }
                    return (
                      <View className={`px-2 py-0.5 rounded-full border ${colorClass}`}>
                        <Text className={`text-[9px] font-bold ${textClass}`}>{text}</Text>
                      </View>
                    );
                  })()
                )}
              </View>
            </View>

            {/* Escrow Protected Trust Badge Card */}
            <View className="bg-emerald-50/90 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900 rounded-xl p-2.5 w-[140px]">
              <View className="flex-row items-center animate-pulse" style={{ gap: 4 }}>
                <FontAwesome5 name="shield-alt" size={11} color="#059669" />
                <Text className="text-[10px] font-bold text-emerald-800 dark:text-emerald-300">Escrow Protected</Text>
              </View>
              <Text className="text-[8px] text-emerald-600 dark:text-emerald-400 leading-normal mt-1">
                Payments held safely until work is complete.
              </Text>
            </View>
          </View>

          {/* Stats Row Grid (Dynamic values for new/existing contractors) */}
          {(() => {
            const yearsVal = c.yearsInBusiness || c.yearsExperience || 0;
            const onTimeVal = (c as any).onTimeRate || 98;
            const stats = [
              {
                icon: 'users',
                value: reviewCount > 0 ? reviewCount.toString() : '0',
                label: reviewCount === 1 ? 'Review' : 'Reviews',
              },
              {
                icon: 'star',
                value: reviewCount > 0 ? avgRating.toFixed(2) : 'New',
                label: 'Rating',
              },
              {
                icon: 'briefcase',
                value: yearsVal > 0 ? `${yearsVal}+` : 'New',
                label: yearsVal > 0 ? 'Years Active' : 'Business',
              },
              {
                icon: 'check-circle',
                value: reviewCount > 0 ? `${onTimeVal}%` : '100%',
                label: 'On-time rate',
              },
            ];

            return (
              <View className="flex-row justify-between items-center py-4 border-y border-neutral-100 dark:border-neutral-800 mt-6 bg-neutral-50/50 dark:bg-neutral-900/30 rounded-xl px-2">
                {stats.map((stat, idx) => (
                  <View key={idx} className="flex-1 items-center justify-center" style={{
                    borderRightWidth: idx < stats.length - 1 ? 1 : 0,
                    borderRightColor: isDark ? '#262626' : '#e5e5e5',
                  }}>
                    <FontAwesome5 name={stat.icon} size={14} color="#4f46e5" style={{ marginBottom: 4 }} />
                    <Text className="text-sm font-extrabold text-neutral-900 dark:text-neutral-50">{stat.value}</Text>
                    <Text className="text-[9px] text-neutral-500 dark:text-neutral-400 mt-0.5 text-center px-1" numberOfLines={1}>{stat.label}</Text>
                  </View>
                ))}
              </View>
            );
          })()}

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

          {/* Services Section with Enhanced Card layouts */}
          {services.length > 0 && (
            <View className="mt-8">
              <Text className="text-base font-bold text-neutral-900 dark:text-neutral-50 mb-3">Services</Text>
              <View style={{ gap: 8 }}>
                {services.map((svc: any, i: number) => {
                  const name = typeof svc === 'string' ? svc : svc.name;
                  const desc = typeof svc === 'string' ? '' : svc.description;
                  const priceRange = typeof svc === 'string' ? '' : (svc.priceRange || svc.priceEstimate || '');
                  
                  // Dynamically select an icon based on service name
                  let iconName = 'hammer';
                  const lowerName = name.toLowerCase();
                  if (lowerName.includes('remodel') || lowerName.includes('renovat') || lowerName.includes('construct')) {
                    iconName = 'home';
                  } else if (lowerName.includes('paint')) {
                    iconName = 'paint-roller';
                  } else if (lowerName.includes('plumb') || lowerName.includes('pipe') || lowerName.includes('leak') || lowerName.includes('faucet')) {
                    iconName = 'faucet';
                  } else if (lowerName.includes('electric') || lowerName.includes('wire') || lowerName.includes('light') || lowerName.includes('power')) {
                    iconName = 'bolt';
                  } else if (lowerName.includes('hvac') || lowerName.includes('heat') || lowerName.includes('cool') || lowerName.includes('ac') || lowerName.includes('air')) {
                    iconName = 'wind';
                  } else if (lowerName.includes('roof') || lowerName.includes('shingle') || lowerName.includes('tile')) {
                    iconName = 'shield-alt';
                  } else if (lowerName.includes('clean') || lowerName.includes('maid') || lowerName.includes('wash')) {
                    iconName = 'broom';
                  } else if (lowerName.includes('lawn') || lowerName.includes('landscap') || lowerName.includes('garden') || lowerName.includes('tree')) {
                    iconName = 'leaf';
                  }

                  const subtext = desc || `Professional ${name.toLowerCase()} services`;

                  return (
                    <View key={i} className="bg-neutral-50/50 dark:bg-neutral-900/40 rounded-xl p-3 border border-neutral-100 dark:border-neutral-800/60 flex-row items-center justify-between">
                      <View className="flex-row items-center flex-1 pr-3" style={{ gap: 12 }}>
                        <View className="w-11 h-11 bg-indigo-50/80 dark:bg-indigo-950/80 rounded-xl items-center justify-center">
                          <FontAwesome5 name={iconName} size={16} color="#4f46e5" />
                        </View>
                        <View className="flex-1">
                          <View className="flex-row items-center flex-wrap" style={{ gap: 6 }}>
                            <Text className="text-sm font-bold text-neutral-900 dark:text-neutral-50">{name}</Text>
                            {!!priceRange && (
                              <View className="bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-100 dark:border-indigo-900/30 rounded-md px-2 py-0.5">
                                <Text className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400">{priceRange}</Text>
                              </View>
                            )}
                          </View>
                          <Text className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5" numberOfLines={1}>{subtext}</Text>
                        </View>
                      </View>
                      <Pressable 
                        onPress={() => {
                          if (!isAuthenticated) {
                            setGuestAction('request a quote');
                            setShowGuestPrompt(true);
                            return;
                          }
                          setQuoteProjectTitle(name);
                          setIsQuoteModalVisible(true);
                        }}
                        className="bg-indigo-50 dark:bg-indigo-900/40 border border-indigo-100 dark:border-indigo-800 rounded-lg px-3 py-1.5"
                      >
                        <Text className="text-xs font-bold text-indigo-700 dark:text-indigo-300">Get Quote</Text>
                      </Pressable>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* Portfolio Horizontal ScrollView Carousel */}
          {portfolio.length > 0 && (
            <View className="mt-8">
              <View className="flex-row items-center justify-between mb-3">
                <Text className="text-base font-bold text-neutral-900 dark:text-neutral-50">Portfolio</Text>
                <Pressable onPress={() => setShowPhotoGallery(true)}>
                  <Text className="text-xs font-bold text-indigo-600">View all ({portfolio.reduce((acc, p) => acc + (p.images?.length || (p.imageUrl ? 1 : 0)), 0)})</Text>
                </Pressable>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingRight: 16 }}>
                {portfolio.map((project: any, i: number) => {
                  const images = project.images || (project.imageUrl ? [project.imageUrl] : []);
                  return (
                    <Pressable
                      key={i}
                      onPress={() => { if (images.length > 0) { setGalleryProject({ ...project, images }); setGalleryIndex(0); } }}
                      className="w-[140px]"
                    >
                      <View className="w-[140px] h-[105px] rounded-xl overflow-hidden bg-neutral-100 dark:bg-neutral-800 border border-neutral-100 dark:border-neutral-800">
                        {images[0] ? (
                          <LazyImage uri={images[0]} style={{ width: '100%', height: '100%' }} />
                        ) : (
                          <View className="w-full h-full items-center justify-center">
                            <FontAwesome5 name="image" size={20} color={isDark ? '#737373' : '#d4d4d4'} />
                          </View>
                        )}
                      </View>
                      <Text className="text-xs font-bold text-neutral-800 dark:text-neutral-200 mt-2 px-0.5" numberOfLines={1}>
                        {project.name || project.title || 'Project'}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {/* Posts */}
          {posts.length > 0 && (
            <View className="mt-8">
              <Text className="text-base font-bold text-neutral-900 dark:text-neutral-50 mb-3">Recent Updates</Text>
              {posts.map(post => (
                <View key={post._id} className="mb-4 bg-white dark:bg-neutral-900 rounded-xl border border-neutral-100 dark:border-neutral-800 overflow-hidden">
                  {post.images?.[0] && <LazyImage uri={post.images[0]} style={{ width: '100%' }} aspectRatio={1} />}
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
            const hasAny = days.some(d => bh[d] || bh[d.toLowerCase()]);
            if (!hasAny) return null;
            return (
              <View className="mt-8">
                <Text className="text-base font-bold text-neutral-900 dark:text-neutral-50 mb-3">Business Hours</Text>
                <View className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-100 dark:border-neutral-800 overflow-hidden">
                  {days.map((day) => {
                    const h = bh[day] || bh[day.toLowerCase()];
                    const isOpen = !!h && h.isOpen !== false;
                    const startTime = h?.start || h?.open;
                    const endTime = h?.end || h?.close;
                    
                    let hoursText = 'Closed';
                    if (isOpen && startTime && endTime) {
                      hoursText = `${formatTime(startTime)} – ${formatTime(endTime)}`;
                    } else if (typeof h === 'string' && h !== 'Closed') {
                      hoursText = h.split('-').map((t) => formatTime(t.trim())).join(' – ');
                    }

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
                          {hoursText}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            );
          })()}

          {/* Service Area Map */}
          {(() => {
            const zipCodes = (c as any).serviceZipCodes || (c as any).zipCodesCovered || [];
            const serviceAreaText = (c as any).serviceArea || location;
            const hasMapData = !!serviceAreaText || (zipCodes && zipCodes.length > 0);
            if (!hasMapData) return null;
            const zipStrings = (zipCodes || []).map((zc: any) => typeof zc === 'string' ? zc : zc.zip || zc.name);
            const businessCenter = (c as any).businessCenter || 
              ((c as any).location && typeof (c as any).location === 'object' && Array.isArray((c as any).location.coordinates) && (c as any).location.coordinates.length === 2
                ? [(c as any).location.coordinates[1], (c as any).location.coordinates[0]]
                : undefined);
            const lat = businessCenter ? businessCenter[0] : undefined;
            const lng = businessCenter ? businessCenter[1] : undefined;
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
                  zipGeoData={(c as any).zipGeoData || []}
                  latitude={lat}
                  longitude={lng}
                  height={220}
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

          {/* Testimonial Section - What clients say */}
          <View className="mt-8 pt-6 border-t border-neutral-100 dark:border-neutral-800">
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-base font-bold text-neutral-900 dark:text-neutral-50">What clients say</Text>
              {reviewCount > 0 && (
                <View className="flex-row items-center" style={{ gap: 4 }}>
                  <FontAwesome5 name="star" solid size={12} color="#eab308" />
                  <Text className="text-xs font-bold text-neutral-900 dark:text-neutral-50">{avgRating.toFixed(2)}</Text>
                  <Text className="text-xs text-neutral-500">({reviewCount})</Text>
                </View>
              )}
            </View>

            {normalizedReviews.length > 0 ? (
              <View>
                {/* Featured Client Say Testimonial Card */}
                {featuredReview && (
                  <View className="mb-6 bg-neutral-50/50 dark:bg-neutral-900/30 border border-neutral-100 dark:border-neutral-800/80 rounded-2xl p-4">
                    <View className="flex-row items-center mb-3" style={{ gap: 8 }}>
                      <FontAwesome5 name="star" solid size={11} color="#eab308" />
                      <Text className="text-xs font-bold text-neutral-900 dark:text-neutral-50">{featuredReview.rating.toFixed(1)}</Text>
                      <Text className="text-xs text-neutral-400">•</Text>
                      <Text className="text-xs font-bold text-neutral-800 dark:text-neutral-200">{featuredReview.user?.firstName} {featuredReview.user?.lastName?.[0]}.</Text>
                    </View>
                    <Text className="text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed italic">
                      "{featuredReview.comment}"
                    </Text>
                  </View>
                )}

                {/* Star rating distribution breakdown hidden for visual minimalism unless showAllReviews is tapped */}
                {showAllReviews && (
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
                )}

                {/* Review List */}
                <View style={{ gap: 20 }}>
                  {displayReviews.map((review, idx) => (
                    <View key={review._id || idx} className="pb-4 border-b border-neutral-50 dark:border-neutral-900 last:border-0">
                      <View className="flex-row items-center mb-2" style={{ gap: 10 }}>
                        {isSvgUrl(review.user?.profilePicture) ? (
                          <View className="w-9 h-9 rounded-full overflow-hidden">
                            <SvgImage uri={review.user.profilePicture} width="100%" height="100%" />
                          </View>
                        ) : review.user?.profilePicture ? (
                          <LazyImage uri={review.user.profilePicture} style={{ width: 36, height: 36 }} borderRadius={18} />
                        ) : (
                          <View className="w-9 h-9 rounded-full bg-neutral-100 dark:bg-neutral-800 items-center justify-center">
                            <FontAwesome5 name="user" size={12} color={isDark ? '#737373' : '#d4d4d4'} />
                          </View>
                        )}
                        <View className="flex-1">
                          <Text className="text-sm font-bold text-neutral-900 dark:text-neutral-50">{review.user?.firstName} {review.user?.lastName}</Text>
                          <Text className="text-[10px] text-neutral-400">{formatDate(review.createdAt)}</Text>
                        </View>
                        <View className="flex-row items-center" style={{ gap: 2 }}>
                          <FontAwesome5 name="star" solid size={10} color="#eab308" />
                          <Text className="text-xs font-bold text-neutral-900 dark:text-neutral-50">{review.rating}</Text>
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
              <View className="py-10 bg-neutral-50/50 dark:bg-neutral-900/30 border border-neutral-100 dark:border-neutral-800/80 rounded-2xl items-center justify-center px-4">
                <FontAwesome5 name="star" size={24} color={isDark ? '#404040' : '#d4d4d4'} style={{ marginBottom: 10 }} />
                <Text className="text-neutral-800 dark:text-neutral-200 text-sm font-bold">No reviews yet</Text>
                <Text className="text-neutral-400 text-xs text-center mt-1">Be the first to leave a review after your project is completed!</Text>
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
      </BouncingRefreshScrollView>

      {/* Sticky Bottom CTA */}
      <View className="absolute bottom-0 left-0 right-0 bg-white/95 dark:bg-neutral-950/95 border-t border-neutral-100 dark:border-neutral-800 px-4 py-4 pb-8 flex-row items-center justify-between shadow-lg">
        <View>
          {(() => {
            const clean = priceMin.trim();
            if (!clean || clean === '$0' || clean === '$0.00' || clean === '0' || clean.toLowerCase() === 'n/a' || clean.toLowerCase() === 'na') {
              return <Text className="text-base font-bold text-neutral-900 dark:text-neutral-50">Contact for Quote</Text>;
            }
            if (/^\$+$/.test(clean)) {
              return (
                <View>
                  <Text className="text-base font-bold text-neutral-900 dark:text-neutral-50">Contact for Quote</Text>
                  <Text className="text-[9px] text-neutral-500 uppercase tracking-tighter">Price level: {clean}</Text>
                </View>
              );
            }
            if (!/\d/.test(clean)) {
              return (
                <View>
                  <Text className="text-base font-bold text-neutral-900 dark:text-neutral-50">{clean}</Text>
                  <Text className="text-[9px] text-neutral-500 uppercase tracking-tighter">Pricing Info</Text>
                </View>
              );
            }
            const formattedPrice = clean.startsWith('$') ? clean : `$${clean}`;
            const subText = clean.toLowerCase().includes('/hr') || clean.toLowerCase().includes('hr') || clean.toLowerCase().includes('hour')
              ? 'Starting Rate' 
              : 'Starting Project Price';
            return (
              <View>
                <Text className="text-base font-bold text-neutral-900 dark:text-neutral-50">From {formattedPrice}</Text>
                <Text className="text-[9px] text-neutral-500 uppercase tracking-tighter">{subText}</Text>
              </View>
            );
          })()}
          
          <View className="flex-row items-center mt-1" style={{ gap: 4 }}>
            {reviewCount > 0 ? (
              <>
                <FontAwesome5 name="star" solid size={10} color="#eab308" />
                <Text className="text-xs font-semibold text-neutral-900 dark:text-neutral-50">{avgRating.toFixed(2)}</Text>
                <Text className="text-xs text-neutral-500 dark:text-neutral-400">({reviewCount} reviews)</Text>
              </>
            ) : (
              <>
                <FontAwesome5 name="star" size={10} color={isDark ? '#525252' : '#d4d4d4'} />
                <Text className="text-xs text-neutral-500 dark:text-neutral-400">No reviews yet</Text>
              </>
            )}
          </View>
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
              if (!isAuthenticated) {
                setGuestAction('message this contractor');
                setShowGuestPrompt(true);
                return;
              }
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
            <FontAwesome5 name="comment" size={18} color={isDark ? '#ffffff' : '#171717'} />
          </Pressable>
          <Pressable
            onPress={() => {
              if (!isAuthenticated) {
                setGuestAction('request a quote');
                setShowGuestPrompt(true);
                return;
              }
              setIsQuoteModalVisible(true);
            }}
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
          <View className="bg-white dark:bg-neutral-950 rounded-t-3xl p-6 pb-10">
            <Text className="text-xl font-bold mb-4 text-neutral-900 dark:text-neutral-50">Request Quote</Text>
            
            {/* Crisp Outlined Inputs Card */}
            <View className="border border-neutral-300 dark:border-neutral-700 rounded-xl overflow-hidden mb-4 bg-neutral-50 dark:bg-neutral-900">
              <View className="p-3 border-b border-neutral-300 dark:border-neutral-700">
                <Text className="text-[10px] font-extrabold text-neutral-900 dark:text-neutral-200 uppercase tracking-wider">Project Title</Text>
                <TextInput
                  placeholder="What do you need help with? (e.g. Roof Repair)"
                  placeholderTextColor={isDark ? '#737373' : '#a3a3a3'}
                  className="text-[15px] text-neutral-800 dark:text-neutral-200 mt-1 p-0"
                  value={quoteProjectTitle}
                  onChangeText={setQuoteProjectTitle}
                />
              </View>
              <View className="p-3">
                <Text className="text-[10px] font-extrabold text-neutral-900 dark:text-neutral-200 uppercase tracking-wider">Project Details</Text>
                <TextInput
                  placeholder="Describe your project in detail..."
                  placeholderTextColor={isDark ? '#737373' : '#a3a3a3'}
                  multiline
                  numberOfLines={4}
                  className="text-[15px] text-neutral-800 dark:text-neutral-200 mt-1 p-0 text-left"
                  style={{ minHeight: 80, textAlignVertical: 'top' }}
                  value={quoteDescription}
                  onChangeText={setQuoteDescription}
                />
              </View>
            </View>

            <View className="flex-row" style={{ gap: 12 }}>
              <Pressable onPress={() => setIsQuoteModalVisible(false)} className="flex-1 py-4 items-center justify-center">
                <Text className="text-neutral-500 dark:text-neutral-400 font-bold">Cancel</Text>
              </Pressable>
              <Pressable onPress={handleRequestQuote} className="flex-2 bg-indigo-600 py-4 px-10 rounded-xl items-center justify-center">
                <Text className="text-white font-bold">Send Request</Text>
              </Pressable>
            </View>
            <Text className="text-center text-xs text-neutral-500 dark:text-neutral-400 mt-3">You won't be charged yet</Text>
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
              {reportSubmitting ? <BouncingDotsLoader color="#fff" /> : <Text className="text-white font-bold">Submit Report</Text>}
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
                  <BouncingDotsLoader size="small" color="#4F46E5" />
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
                <BouncingDotsLoader size="small" color="#fff" />
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
          <View 
            className="absolute left-0 right-0 z-10 flex-row items-center justify-between px-4"
            style={{ top: insets.top > 0 ? insets.top + 8 : 12 }}
          >
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
            windowSize={2}
            maxToRenderPerBatch={2}
            removeClippedSubviews
            renderItem={({ item }) => (
              <View style={{ width: SCREEN_WIDTH, flex: 1 }} className="items-center justify-center">
                {isSvgUrl(item) ? (
                  <View className="w-full h-3/4">
                    <SvgImage uri={item} width="100%" height="100%" />
                  </View>
                ) : (
                  <LazyImage uri={item} style={{ width: '100%', height: '75%' }} />
                )}
              </View>
            )}
          />
        </View>
      )}

      {/* Portfolio Gallery Overlay Modal */}
      <Modal
        visible={!!galleryProject}
        transparent={false}
        animationType="fade"
        onRequestClose={() => setGalleryProject(null)}
      >
        <View className="flex-1 bg-black justify-between">
          {/* Header */}
          <View className="flex-row items-center justify-between px-4 py-3 bg-black/80 absolute top-0 left-0 right-0 z-10" style={{ paddingTop: insets.top > 0 ? insets.top : 12 }}>
            <Pressable onPress={() => setGalleryProject(null)} className="w-8 h-8 items-center justify-center rounded-full bg-white/20">
              <FontAwesome5 name="times" size={14} color="white" />
            </Pressable>
            <View className="items-center">
              <Text className="text-sm font-semibold text-white truncate max-w-[200px]" numberOfLines={1}>
                {galleryProject?.name || galleryProject?.title || 'Project'}
              </Text>
              <Text className="text-[10px] text-white/60">
                {(galleryIndex + 1)} / {galleryProject?.images?.length || 0} photos
              </Text>
            </View>
            <View className="w-8" />
          </View>

          {/* Main Image View */}
          <View className="flex-1 items-center justify-center p-4">
            {galleryProject?.images?.[galleryIndex] ? (
              <LazyImage 
                uri={galleryProject.images[galleryIndex]} 
                style={{ width: '100%', height: '100%' }} 
              />
            ) : (
              <View className="w-full h-full items-center justify-center">
                <FontAwesome5 name="image" size={48} color="rgba(255,255,255,0.3)" />
              </View>
            )}

            {/* Navigation Arrows */}
            {galleryProject?.images?.length > 1 && (
              <>
                {galleryIndex > 0 && (
                  <Pressable 
                    onPress={() => setGalleryIndex(galleryIndex - 1)} 
                    className="absolute left-4 w-10 h-10 rounded-full bg-white/20 items-center justify-center"
                    style={{ top: '50%', marginTop: -20 }}
                  >
                    <FontAwesome5 name="chevron-left" size={16} color="white" />
                  </Pressable>
                )}
                {galleryIndex < galleryProject.images.length - 1 && (
                  <Pressable 
                    onPress={() => setGalleryIndex(galleryIndex + 1)} 
                    className="absolute right-4 w-10 h-10 rounded-full bg-white/20 items-center justify-center"
                    style={{ top: '50%', marginTop: -20 }}
                  >
                    <FontAwesome5 name="chevron-right" size={16} color="white" />
                  </Pressable>
                )}
              </>
            )}
          </View>

          {/* Thumbnail Strip */}
          {galleryProject?.images?.length > 1 && (
            <View className="bg-black/80 py-4">
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ alignItems: 'center', gap: 8, paddingHorizontal: 16 }}
              >
                {galleryProject.images.map((img: string, i: number) => (
                  <Pressable
                    key={i}
                    onPress={() => setGalleryIndex(i)}
                    className={`rounded-lg overflow-hidden ${
                      i === galleryIndex ? 'border-2 border-white w-14 h-14' : 'w-10 h-10 opacity-50'
                    }`}
                  >
                    <LazyImage uri={img} style={{ width: '100%', height: '100%' }} />
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          )}
        </View>
      </Modal>

      <GuestPrompt
        visible={showGuestPrompt}
        onClose={() => setShowGuestPrompt(false)}
        onLogin={() => {
          setShowGuestPrompt(false);
          navigation.navigate('Login');
        }}
        action={guestAction}
      />
    </View>
  );
};

export default BusinessDetailScreen;
