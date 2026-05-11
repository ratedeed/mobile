import { useNavigation } from '@react-navigation/native';
import * as WebBrowser from 'expo-web-browser';
import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  KeyboardAvoidingView,
  Platform,
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
  updateContractorProfile, getContractorProfile,
  requestVerification,
  getContractorDetails,
  get,
  del,
  getAuthHeaders,
  post as apiPost,
} from '../api';
import * as ImagePicker from 'expo-image-picker';
import ServiceAreaMap from '../components/common/ServiceAreaMap';
import AnalyticsTab from '../components/contractor/AnalyticsTab';
import { API_BASE_URL } from '../config';
import { uploadToCloudinary, CLOUDINARY_FOLDERS } from '../utils/cloudinary';
import { getCoverImageUrl, getProfileImageUrl, isSvgUrl } from '../utils/avatarUtils';
import { SvgImage } from '../components/common/SvgImage';
import { useAuth } from '../context/AuthContext';

const TABS = [
  { key: 'posts', label: 'Posts' },
  { key: 'about', label: 'About Us' },
  { key: 'services', label: 'Services' },
  { key: 'portfolio', label: 'Portfolio' },
  { key: 'reviews', label: 'Reviews' },
  { key: 'payments', label: 'Payments & Jobs' },
  { key: 'analytics', label: 'Analytics' },
  { key: 'promote', label: 'Promote' },
];

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const TIME_OPTIONS = [
  '00:00', '00:30', '01:00', '01:30', '02:00', '02:30', '03:00', '03:30', '04:00', '04:30', '05:00', '05:30', '06:00', '06:30', '07:00', '07:30', '08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00', '12:30', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00', '17:30', '18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00', '21:30', '22:00', '22:30', '23:00', '23:30'
];

function formatTimeDisplay(t: string) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 || 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${ampm}`;
}

function formatPhoneInput(text: string): string {
  const digits = text.replace(/\D/g, '').slice(0, 10);
  if (digits.length === 0) return '';
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
}

function stripPhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

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
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View className="bg-white rounded-t-2xl max-h-[85vh]">
          <View className="w-10 h-1 rounded-full bg-neutral-300 mx-auto mt-3" />
          <View className="flex-row items-center justify-between px-5 pt-4 pb-2 border-b border-neutral-100">
            <Text className="text-lg font-bold text-neutral-900">{title}</Text>
            <Pressable onPress={onClose} className="w-8 h-8 items-center justify-center rounded-full">
              <FontAwesome5 name="times" size={16} color="#737373" />
            </Pressable>
          </View>
          <ScrollView className="px-5 py-4 pb-10" keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

// ================================================================
// Main Component
// ================================================================
const ContractorDashboardScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { userId: currentUserId, updateUser } = useAuth();
  const [realContractorId, setRealContractorId] = useState<string | null>(null);
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
  const [activeEditSection, setActiveEditSection] = useState<string | null>(null);
  const [newZip, setNewZip] = useState('');

  const [postCaption, setPostCaption] = useState('');
  const [postTags, setPostTags] = useState('');
  const [postLocation, setPostLocation] = useState('');
  const [postImages, setPostImages] = useState<string[]>([]);
  const [postSubmitting, setPostSubmitting] = useState(false);

  const [portfolioItem, setPortfolioItem] = useState({ name: '', description: '', imageUrl: '' });
  const [portfolioSubmitting, setPortfolioSubmitting] = useState(false);

  const [licenseDocUri, setLicenseDocUri] = useState<string | null>(null);
  const [isSubmittingVerification, setIsSubmittingVerification] = useState(false);
  const [verificationResult, setVerificationResult] = useState<{ success: boolean; message: string } | null>(null);

  const [editableData, setEditableData] = useState({
    description: "",
    pricing: "",
    certifications: "" as any,
    servicesOffered: [] as { name: string; description: string; priceRange: string }[],
    phone: "",
    email: "",
    website: "",
    address: "",
    licenseNumber: "",
    zipCodes: [] as string[],
  });
  const [profileSaving, setProfileSaving] = useState(false);
  const [addressSuggestions, setAddressSuggestions] = useState<any[]>([]);
  const [isSearchingAddress, setIsSearchingAddress] = useState(false);

  const isMounted = useRef(true);
  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);
  const addressSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [hours, setHours] = useState<Record<string, { open: string; close: string; isOpen: boolean }>>({});
  const [bannerUrl, setBannerUrl] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [contractorName, setContractorName] = useState('');
  const [licenseStatus, setLicenseStatus] = useState<string>('not_submitted');
  const [onboardingComplete, setOnboardingComplete] = useState(true);
  const [bannerDismissed, setBannerDismissed] = useState(true);

  const [imageLoading, setImageLoading] = useState(false);
  const contractorId = realContractorId || currentUserId;

  const searchAddress = (text: string) => {
    setEditableData(p => ({ ...p, address: text }));
    if (addressSearchTimer.current) clearTimeout(addressSearchTimer.current);
    if (text.length < 3) {
      setAddressSuggestions([]);
      return;
    }
    addressSearchTimer.current = setTimeout(async () => {
      setIsSearchingAddress(true);
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(text)}&format=json&addressdetails=1&limit=5&countrycodes=us`,
          { headers: { 'User-Agent': 'RateDeedMobile/1.0' } }
        );
        const data = await response.json();
        setAddressSuggestions(data);
      } catch {
      } finally {
        setIsSearchingAddress(false);
      }
    }, 500);
  };

  const handleSelectAddress = (item: any) => {
    setEditableData(p => ({ ...p, address: item.display_name }));
    setAddressSuggestions([]);
  };

  const handleLicenseDocSelect = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.7,
        base64: true,
      });
      if (result.canceled || !result.assets?.length) return;
      const asset = result.assets[0];
      if (asset.fileSize && asset.fileSize > 5 * 1024 * 1024) {
        Alert.alert('File too large', 'Please choose an image under 5MB.');
        return;
      }
      setLicenseDocUri(`data:image/jpeg;base64,${asset.base64}`);
    } catch {
      /* non-critical */
    }
  };

  const handleSubmitVerification = async () => {
    if (!editableData.licenseNumber.trim() || !licenseDocUri) {
      Alert.alert('Error', 'Please provide both license number and a photo of your license.');
      return;
    }
    setIsSubmittingVerification(true);
    setVerificationResult(null);

    try {
      await requestVerification({
        licenseNumber: editableData.licenseNumber.trim(),
        licenseDocumentFile: licenseDocUri, // Pass the base64 string directly
      });
      setVerificationResult({
        success: true,
        message: 'Verification request submitted! We will review it within 2-3 business days.',
      });
      setLicenseDocUri(null);
      // Refresh contractor data
      const refreshedProfile = await getContractorProfile();
      if (refreshedProfile) {
        setEditableData(prev => ({
          ...prev,
          licenseNumber: refreshedProfile.licenseNumber || '',
        }));
      }
    } catch (err: any) {
      setVerificationResult({
        success: false,
        message: err?.message || 'Failed to submit verification request.',
      });
    } finally {
      setIsSubmittingVerification(false);
    }
  };

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
    return await del(`${API_BASE_URL}/api/contractors/portfolio/${itemId}`, headers);
  };

  const loadData = useCallback(async () => {
    try {
      // 1. Fetch profile first using JWT to get the REAL contractor ID
      const profile = await getContractorProfile().catch(() => null);
      if (!profile) {
        setLoading(false);
        setRefreshing(false);
        return;
      }

      if (!isMounted.current) return;
      const cid = profile._id;
      if (cid) setRealContractorId(cid);
      setOnboardingComplete(profile.onboardingComplete === true);

      // 2. Now fetch everything else using that REAL ID
      const [postsData, reviewsData, portfolioData, earningsData, leadsData, quotesData, jobsData, stripeData] = await Promise.all([
        fetchContractorPosts(cid).catch(() => ({ posts: [] })),
        fetchContractorReviews(cid).catch(() => []),
        getPortfolio(cid).catch(() => []),
        getContractorEarnings().catch(() => null),
        getContractorLeads().catch(() => []),
        getContractorQuotes().catch(() => []),
        getContractorJobs().catch(() => []),
        getStripeAccountStatus().catch(() => ({ connected: false })),
      ]);

      setEarnings(earningsData);
      setLeads(Array.isArray(leadsData) ? leadsData : []);
      setQuotes(Array.isArray(quotesData) ? quotesData : []);
      setJobs(Array.isArray(jobsData) ? jobsData : []);
      setStripeStatus(stripeData);

      // 3. Standardize and Map Data (Match web version robust mapping)
      setLicenseStatus(profile.licenseStatus || 'not_submitted');
      const name = profile.companyName || profile.businessName || profile.name || '';
      const cat = profile.category || '';
      const rawBanner = profile.bannerImage || profile.coverImage || (profile as any).bannerUrl || (profile as any).imageUrl || '';
      const rawAvatar = profile.profilePicture || profile.profileImage || profile.user?.profilePicture || '';
      
      const rawPhone = profile.phone || profile.contactInfo?.phoneNumber || profile.contact?.phone || profile.phoneNumber || "";
      const phone = formatPhoneInput(rawPhone);
      const email = profile.email || profile.contactInfo?.email || profile.contact?.email || "";
      const website = profile.website || profile.contactInfo?.website || profile.contact?.website || "";
      const rawLoc = (typeof profile.location === 'string') ? profile.location : '';
      const address = profile.businessAddress || profile.contactInfo?.streetAddress || profile.contact?.address || rawLoc || "";
      
      const rawServices = profile.services || profile.servicesOffered || [];
      const normalizedServices = rawServices.map((s: any) => ({
        name: typeof s === "string" ? s : s.name || "",
        description: s.description || s.desc || "",
        priceRange: s.priceRange || s.priceEstimate || ""
      }));

      const rawZips = profile.zipCodesCovered || profile.zipCodes || profile.serviceArea || [];
      const zipsArray = Array.isArray(rawZips) ? rawZips : (typeof rawZips === 'string' ? rawZips.split(',').map(z => z.trim()).filter(Boolean) : []);

      // Standardize Portfolio (Check profile.portfolio first, then separate fetch)
      const rawPortfolio = (profile.portfolio && Array.isArray(profile.portfolio) && profile.portfolio.length > 0) 
        ? profile.portfolio 
        : (Array.isArray(portfolioData) ? portfolioData : []);
      
      const normalizedPortfolio = rawPortfolio.map((p: any) => ({
        _id: p._id || p.id,
        name: p.name || p.title || p.caption || "Untitled Project",
        description: p.description || p.caption || "",
        imageUrl: p.imageUrl || (Array.isArray(p.images) ? p.images[0] : "") || "",
        images: Array.isArray(p.images) ? p.images : (p.imageUrl ? [p.imageUrl] : [])
      }));

      setPosts(Array.isArray(postsData?.posts) ? postsData.posts : []);
      setReviews(Array.isArray(reviewsData) ? reviewsData : []);
      setPortfolio(normalizedPortfolio);
      setContractorName(name);
      setBannerUrl(getCoverImageUrl(name, rawBanner, cat));
      setAvatarUrl(getProfileImageUrl(name, rawAvatar, cat));

      setEditableData({
        description: profile.description || "",
        pricing: profile.pricing || "",
        certifications: profile.certifications || "",
        servicesOffered: normalizedServices,
        phone,
        email,
        website,
        address,
        licenseNumber: profile.licenseNumber || "",
        zipCodes: zipsArray,
      });

      // Business Hours (match web logic)
      const existingHours: Record<string, any> = profile.businessHours || {};
      const hasSavedHours = Object.keys(existingHours).length > 0;
      const defaultHours: Record<string, { open: string; close: string; isOpen: boolean }> = {};
      for (const day of DAYS) {
        const h = existingHours[day] || existingHours[day.toLowerCase()];
        if (h) {
          defaultHours[day] = {
            open: h.start || h.open || '09:00',
            close: h.end || h.close || '17:00',
            isOpen: h.isOpen !== false,
          };
        } else {
          defaultHours[day] = { open: '09:00', close: '17:00', isOpen: hasSavedHours ? false : day !== 'Sunday' };
        }
      }
      setHours(defaultHours);

    } catch {
      /* non-critical */
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    return () => {
      if (addressSearchTimer.current) clearTimeout(addressSearchTimer.current);
    };
  }, []);

  const onRefresh = useCallback(() => { setRefreshing(true); loadData(); }, [loadData]);

  // ---- Post handlers ----
  const handleCreatePost = async () => {
    if (!postCaption.trim()) { Alert.alert('Error', 'Caption is required'); return; }
    setPostSubmitting(true);
    try {
      const uploadedUrls = await Promise.all(
        postImages.map(img => uploadToCloudinary(img, CLOUDINARY_FOLDERS.POST_IMAGES))
      );
      const tags = postTags.split(',').map(t => t.trim()).filter(Boolean);
      await createPost({ caption: postCaption, images: uploadedUrls, tags, location: postLocation });
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
      setPosts(prev => prev.map(p => p._id === postId ? { ...p, likes: isLiked ? p.likes.filter((id: string) => id !== currentUserId) : [...p.likes, currentUserId] } : p));
    } catch { Alert.alert('Error', 'Failed to update like'); }
  };

  const handleDeletePost = async (postId: string) => {
    Alert.alert('Delete Post', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
      try { await deletePost(postId); setPosts(prev => prev.filter(p => p._id !== postId)); }
      catch { Alert.alert("Error", "Failed to delete post"); }
    }}]);
  };

  const handleUpdateImage = async (type: "avatar" | "banner") => {
    try {
      const uri = await pickFromLibrary();
      if (!uri) return;
      setImageLoading(true);
      
      const folder = type === "avatar" ? CLOUDINARY_FOLDERS.CONTRACTOR_PROFILE : CLOUDINARY_FOLDERS.CONTRACTOR_BANNER;
      const uploadedUrl = await uploadToCloudinary(uri, folder);
      
      const updateData: any = {};
      if (type === "avatar") updateData.profilePicture = uploadedUrl;
      else { updateData.bannerImage = uploadedUrl; updateData.bannerUrl = uploadedUrl; }
      const result = await updateContractorProfile(updateData);
      if (result && result.user) updateUser(result.user);
      loadData();
    } catch (err: any) {
      Alert.alert("Error", err?.message || "Upload failed");
    } finally {
      setImageLoading(false);
    }
  };

  const handleAddImage = async () => {
    try {
      const uri = await pickFromLibrary();
      if (!uri) return;
      setImageLoading(true);
      setPostImages(prev => [...prev, uri]);
    } catch (err: any) {
      Alert.alert("Error", err?.message || "Upload failed");
    } finally {
      setImageLoading(false);
    }
  };

  const handleAddPortfolio = async () => {
    if (!portfolioItem.name.trim()) {
      Alert.alert('Error', 'Project name is required');
      return;
    }
    setPortfolioSubmitting(true);
    try {
      await addPortfolioItem(portfolioItem);
      setPortfolioItem({ name: '', description: '', imageUrl: '' });
      setShowAddPortfolio(false);
      loadData();
      Alert.alert('Success', 'Portfolio project added');
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to add portfolio item');
    } finally {
      setPortfolioSubmitting(false);
    }
  };

  const handleAddPortfolioImage = async () => {
    try {
      const uri = await pickFromLibrary();
      if (!uri) return;
      setImageLoading(true);
      setPortfolioItem(prev => ({ ...prev, imageUrl: uri }));
    } catch (err: any) {
      Alert.alert("Error", err?.message || "Upload failed");
    } finally {
      setImageLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    setProfileSaving(true);
    try {
      // Format business hours (match web logic)
      const formattedHours: Record<string, { start: string; end: string }> = {};
      for (const [day, val] of Object.entries(hours)) {
        if (val.isOpen) {
          formattedHours[day.toLowerCase()] = { start: val.open, end: val.close };
        }
      }

      const updateData: any = {
        description: editableData.description || undefined,
        pricing: editableData.pricing || undefined,
        certifications: Array.isArray(editableData.certifications) ? editableData.certifications : editableData.certifications?.split(",").map((s: string) => s.trim()).filter(Boolean) || [],
        zipCodesCovered: editableData.zipCodes.length > 0 ? editableData.zipCodes : undefined,
        licenseNumber: editableData.licenseNumber || undefined,
        businessHours: Object.keys(formattedHours).length > 0 ? formattedHours : undefined,
        // Match web version: send services as objects with priceEstimate
        servicesOffered: editableData.servicesOffered.map(s => ({
          name: s.name || undefined,
          description: s.description || undefined,
          priceEstimate: s.priceRange || undefined,
        })),
        services: editableData.servicesOffered.map(s => s.name),
        // Match web version: map portfolio properly
        portfolio: portfolio.map(p => ({
          name: p.name,
          description: p.description || undefined,
          imageUrl: p.imageUrl,
          images: p.images || [p.imageUrl].filter(Boolean),
        })),
        // Send both field name variants for compatibility with old and new backend
        contactInfo: {
          phoneNumber: editableData.phone || undefined,
          phone: editableData.phone || undefined,
          website: editableData.website || undefined,
          streetAddress: editableData.address || undefined,
          address: editableData.address || undefined,
        },
        phone: editableData.phone || undefined,
        businessAddress: editableData.address || undefined,
      };
      const result = await updateContractorProfile(updateData);
      if (result && result.user) updateUser(result.user);
      setShowEditProfile(false);
      loadData();
      Alert.alert("Success", "Profile updated!");
    } catch (err: any) {
      Alert.alert("Error", err?.message || "Failed to update profile");
    } finally {
      setProfileSaving(false);
    }
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

  // Profile completion tracking (Airbnb-style)
  const completionSteps = [
    { key: 'photo', done: !!avatarUrl, label: 'Photo' },
    { key: 'description', done: !!editableData.description, label: 'Description' },
    { key: 'services', done: editableData.servicesOffered.length > 0, label: 'Services' },
    { key: 'location', done: editableData.zipCodes.length > 0, label: 'Area' },
  ];
  const completedCount = completionSteps.filter(s => s.done).length;
  const completionPct = Math.round((completedCount / completionSteps.length) * 100);
  const showBanner = !onboardingComplete && !bannerDismissed && completedCount < completionSteps.length;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0} className="flex-1 bg-neutral-50">
      {/* Profile Completion Banner (Airbnb-style) */}
      {showBanner && (
        <View className="bg-white border-b border-neutral-100 px-4 py-3">
          <View className="flex-row items-center justify-between mb-1.5">
            <Text className="text-[11px] font-bold text-neutral-900">
              {completionPct}% complete
            </Text>
            <Pressable onPress={() => setBannerDismissed(true)} className="p-1">
              <FontAwesome5 name="times" size={10} color="#a3a3a3" />
            </Pressable>
          </View>
          <View className="h-1.5 bg-neutral-100 rounded-full overflow-hidden mb-2">
            <View
              className="h-full bg-neutral-900 rounded-full"
              style={{ width: `${completionPct}%` }}
            />
          </View>
          <View className="flex-row items-center justify-between">
            <View className="flex-row flex-wrap" style={{ gap: 8 }}>
              {completionSteps.map(step => (
                <View key={step.key} className="flex-row items-center" style={{ gap: 3 }}>
                  <FontAwesome5
                    name={step.done ? 'check' : 'circle'}
                    size={8}
                    color={step.done ? '#a3a3a3' : '#525252'}
                    solid={step.done}
                  />
                  <Text className={`text-[10px] font-semibold ${step.done ? 'text-neutral-400 line-through' : 'text-neutral-700'}`}>
                    {step.label}
                  </Text>
                </View>
              ))}
            </View>
            <Pressable
              onPress={() => navigation.navigate('ContractorOnboarding' as never)}
              className="bg-neutral-900 px-3 py-1.5 rounded-lg"
            >
              <Text className="text-[10px] font-bold text-white">Complete</Text>
            </Pressable>
          </View>
        </View>
      )}

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View className="relative">
          <View className="h-48 w-full bg-neutral-200 overflow-hidden">
            {bannerUrl ? (
              isSvgUrl(bannerUrl) ? (
                <SvgImage key={bannerUrl} uri={bannerUrl} width="100%" height="100%" />
              ) : (
                <Image key={bannerUrl} source={{ uri: bannerUrl }} className="w-full h-full" resizeMode="cover" />
              )
            ) : (
              <View className="absolute inset-0 bg-neutral-300" />
            )}
            <View className="absolute inset-0 bg-black/10" />
            <Pressable 
              onPress={() => handleUpdateImage("banner")} 
              className="absolute top-4 left-4 bg-white/90 px-3 py-1.5 rounded-lg flex-row items-center shadow-sm"
              style={{ gap: 6, zIndex: 50 }}
            >
              <FontAwesome5 name="camera" size={12} color="#404040" />
              <Text className="text-[10px] font-bold text-neutral-800">Edit Cover</Text>
            </Pressable>

            <Pressable
              onPress={() => setShowEditProfile(true)}
              className="absolute top-4 right-4 bg-white/90 px-3 py-1.5 rounded-lg flex-row items-center shadow-sm"
              style={{ gap: 6, zIndex: 50 }}
            >
              <FontAwesome5 name="pen" size={10} color="#525252" />
              <Text className="text-xs font-semibold text-neutral-800">Edit Profile</Text>
            </Pressable>
          </View>

          {/* Profile Card Overlap */}
          <View className="mx-4 -mt-10 bg-white rounded-2xl border border-neutral-100 shadow-sm p-4 relative z-10">
            <View className="flex-row items-end" style={{ gap: 16 }}>
              <View className="w-20 h-20 rounded-2xl border-4 border-white overflow-hidden bg-neutral-200 shadow-sm -mt-10 relative">
                {avatarUrl ? (
                  isSvgUrl(avatarUrl) ? (
                    <SvgImage key={avatarUrl} uri={avatarUrl} width="100%" height="100%" />
                  ) : (
                    <Image key={avatarUrl} source={{ uri: avatarUrl }} className="w-full h-full" resizeMode="cover" />
                  )
                ) : (
                  <FontAwesome5 name="user" size={24} color="#a3a3a3" style={{ position: "absolute", top: 24, left: 24 }} />
                )}
                <Pressable 
                  onPress={() => handleUpdateImage("avatar")} 
                  className="absolute inset-0 bg-black/10 items-center justify-center"
                >
                  <FontAwesome5 name="camera" size={12} color="#fff" />
                </Pressable>
              </View>
              <View className="flex-1 pb-1">
                <View className="flex-row items-center" style={{ gap: 6 }}>
                  <Text className="text-xl font-bold text-neutral-900">{contractorName || "My Business"}</Text>
                  <FontAwesome5 name="check-circle" size={16} color="#4F46E5" />
                </View>
                <View className="flex-row items-center mt-1" style={{ gap: 8 }}>
                  <StarRating rating={avgRating} />
                  <Text className="text-xs text-neutral-500 font-medium">{reviews.length} reviews</Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* ==================== Profile Info (Removed as it's now in the overlap card) ==================== */}
        <View className="px-4 mt-4">
          <Text className="text-sm text-neutral-600 leading-5" numberOfLines={3}>
            {editableData.description || "No description added yet."}
          </Text>
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
                  <Text className={`text-sm font-semibold whitespace-nowrap ${activeTab === tab.key ? "text-indigo-600" : "text-neutral-500"}`}>
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
                        <View className="flex-row items-center justify-end mt-3">
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
                <Text className="text-base font-semibold text-neutral-900 mb-3">Service Areas</Text>
                <ServiceAreaMap
                  businessName={contractorName || 'My Business'}
                  locationName={editableData.address}
                  zipCodes={editableData.zipCodes}
                  height={160}
                />
                {editableData.zipCodes.length > 0 ? (
                  <View className="flex-row flex-wrap mt-3" style={{ gap: 8 }}>
                    {editableData.zipCodes.map(zip => (
                      <View key={zip} className="bg-neutral-100 px-3 py-1.5 rounded-full">
                        <Text className="text-xs font-medium text-neutral-600">{zip}</Text>
                      </View>
                    ))}
                  </View>
                ) : (
                  <Text className="text-sm text-neutral-500 italic mt-2">No service areas listed — edit your profile to add zip codes</Text>
                )}
              </View>

              <View className="bg-white rounded-xl border border-neutral-200 p-5">
                <Text className="text-base font-semibold text-neutral-900 mb-3">Business Hours</Text>
                {DAYS.map(day => {
                  const h = hours[day];
                  const isOpen = h?.isOpen !== false;
                  return (
                    <View key={day} className="flex-row justify-between py-2 border-b border-neutral-100">
                      <Text className="text-sm text-neutral-600">{day}</Text>
                      <Text className="text-sm text-neutral-900 font-medium">
                        {isOpen ? `${formatTimeDisplay(h?.open || '09:00')} - ${formatTimeDisplay(h?.close || '17:00')}` : 'Closed'}
                      </Text>
                    </View>
                  );
                })}
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
                <View style={{ gap: 12 }}>
                  {editableData.servicesOffered.map((service, idx) => (
                    <View key={idx} className="bg-white rounded-xl border border-neutral-200 p-4">
                      <Text className="text-sm font-bold text-neutral-900">{service.name}</Text>
                      {service.description ? (
                        <Text className="text-xs text-neutral-500 mt-1">{service.description}</Text>
                      ) : null}
                      {service.priceRange ? (
                        <Text className="text-xs font-semibold text-indigo-600 mt-2">{service.priceRange}</Text>
                      ) : null}
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
                            try { 
                              const { url } = await getStripeConnectUrl(); 
                              const result = await WebBrowser.openAuthSessionAsync(url, 'ratedeed://contractor-dashboard');
                              if (result.type === 'success' && result.url?.includes('stripe_return=true')) {
                                Alert.alert('Success', 'Stripe account connected successfully!');
                                // Force a refresh of the profile/status
                                setTimeout(() => navigation.replace('ContractorDashboard'), 500);
                              }
                            } catch (e) { Alert.alert('Stripe Error', (e as any)?.message || 'Failed to connect Stripe. Check your internet connection and try again.'); }
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

          {/* TAB: Analytics */}
          {activeTab === 'analytics' && (
            <AnalyticsTab
              jobs={jobs}
              quotes={quotes}
              reviews={reviews}
              profile={editableData}
              loading={loading}
            />
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
                <Pressable onPress={() => Alert.alert('Coming Soon', 'Profile link sharing will be available in the next update.')} className="p-2">
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
                  <Pressable key={social.name} onPress={() => Alert.alert('Coming Soon', 'Social sharing will be available in the next update.')} className="w-11 h-11 rounded-full items-center justify-center" style={{ backgroundColor: social.color }}>
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
        <Text className="text-xs font-semibold text-neutral-500 mb-1">Project Image</Text>
        <Pressable
          onPress={handleAddPortfolioImage}
          disabled={imageLoading}
          className="w-full border-2 border-dashed border-neutral-200 rounded-lg p-5 items-center mb-3 overflow-hidden"
        >
          {portfolioItem.imageUrl ? (
            <Image source={{ uri: portfolioItem.imageUrl }} className="w-full h-32 rounded-lg" resizeMode="cover" />
          ) : (
            <View className="items-center" style={{ gap: 6 }}>
              <FontAwesome5 name="camera" size={20} color="#a3a3a3" />
              <Text className="text-sm text-neutral-500">{imageLoading ? 'Uploading...' : 'Upload project photo'}</Text>
            </View>
          )}
        </Pressable>
        <Text className="text-xs font-semibold text-neutral-500 mb-1">Image URL (Optional)</Text>
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
        {/* Banner & Avatar Preview */}
        <View className="mb-6">
          <View className="h-32 w-full bg-neutral-200 rounded-xl overflow-hidden relative">
            {bannerUrl ? (
              <Image source={{ uri: bannerUrl }} className="w-full h-full" resizeMode="cover" />
            ) : (
              <View className="absolute inset-0 bg-neutral-300" />
            )}
            <View className="absolute inset-0 bg-black/20 items-center justify-center">
              <View style={{ gap: 6 }} className="items-center">
                <Pressable
                  onPress={() => handleUpdateImage("banner")}
                  className="bg-white/90 px-4 py-2 rounded-xl flex-row items-center"
                  style={{ gap: 8 }}
                >
                  <FontAwesome5 name="camera" size={14} color="#404040" />
                  <Text className="text-xs font-bold text-neutral-800">Change Cover</Text>
                </Pressable>
                <Text className="text-[10px] text-white/70 font-medium">Recommended: 1200 × 400 pixels</Text>
              </View>
            </View>
          </View>
          
          <View className="flex-row items-end px-4 -mt-8" style={{ gap: 12 }}>
            <View className="w-20 h-20 rounded-2xl border-4 border-white overflow-hidden bg-neutral-200 shadow-sm relative">
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} className="w-full h-full" resizeMode="cover" />
              ) : (
                <FontAwesome5 name="user" size={24} color="#a3a3a3" style={{ position: "absolute", top: 24, left: 24 }} />
              )}
              <Pressable 
                onPress={() => handleUpdateImage("avatar")}
                className="absolute inset-0 bg-black/20 items-center justify-center"
              >
                <FontAwesome5 name="camera" size={12} color="#fff" />
              </Pressable>
            </View>
            <View className="pb-2">
              <Text className="text-base font-bold text-neutral-900">{contractorName || "Your Business"}</Text>
              <Text className="text-xs text-neutral-500">Profile Preview</Text>
            </View>
          </View>
        </View>

        <View style={{ gap: 12 }} className="pb-10">
          {/* License Verification Accordion */}
          <View className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
            <Pressable 
              onPress={() => setActiveEditSection(activeEditSection === 'license' ? null : 'license')}
              className="flex-row items-center justify-between p-4"
            >
              <View className="flex-row items-center" style={{ gap: 12 }}>
                <View className="w-10 h-10 rounded-lg bg-indigo-50 items-center justify-center">
                  <FontAwesome5 name="shield-alt" size={16} color="#4F46E5" />
                </View>
                <View>
                  <Text className="text-sm font-bold text-neutral-900">License Verification</Text>
                  <Text className="text-[10px] text-neutral-500">Verified status builds trust</Text>
                </View>
              </View>
              <FontAwesome5 name={activeEditSection === 'license' ? "chevron-up" : "chevron-down"} size={12} color="#a3a3a3" />
            </Pressable>
            
            {activeEditSection === 'license' && (
              <View className="p-4 border-t border-neutral-100 bg-neutral-50/50" style={{ gap: 16 }}>
                {licenseStatus === 'approved' ? (
                  <View className="bg-emerald-50 rounded-xl p-4 border border-emerald-100 items-center">
                    <View className="w-12 h-12 rounded-full bg-emerald-100 items-center justify-center mb-3">
                      <FontAwesome5 name="shield-alt" size={20} color="#059669" solid />
                    </View>
                    <Text className="text-sm font-bold text-emerald-900 text-center">Identity & License Verified</Text>
                    <Text className="text-[11px] text-emerald-700 text-center mt-1">Your business is verified and the badge is visible on your profile.</Text>
                    <View className="mt-3 bg-white px-3 py-1 rounded-lg border border-emerald-100">
                      <Text className="text-[11px] font-bold text-emerald-600">LIC: {editableData.licenseNumber}</Text>
                    </View>
                  </View>
                ) : licenseStatus === 'pending' ? (
                  <View className="bg-amber-50 rounded-xl p-4 border border-amber-100 items-center">
                    <View className="w-12 h-12 rounded-full bg-amber-100 items-center justify-center mb-3">
                      <FontAwesome5 name="clock" size={20} color="#d97706" solid />
                    </View>
                    <Text className="text-sm font-bold text-amber-900 text-center">Verification Pending</Text>
                    <Text className="text-[11px] text-amber-700 text-center mt-1">Our team is reviewing your documents. This usually takes 2-3 business days.</Text>
                  </View>
                ) : (
                  <>
                    {licenseStatus === 'rejected' && (
                      <View className="bg-red-50 rounded-xl p-4 border border-red-100 mb-2">
                        <View className="flex-row items-center mb-1">
                          <FontAwesome5 name="exclamation-circle" size={14} color="#ef4444" />
                          <Text className="text-sm font-bold text-red-900 ml-2">Verification Denied</Text>
                        </View>
                        <Text className="text-[11px] text-red-700">Please review your information and resubmit valid documentation.</Text>
                      </View>
                    )}
                    
                    <View>
                      <Text className="text-xs font-semibold text-neutral-500 mb-1.5">License Number</Text>
                      <TextInput
                        value={editableData.licenseNumber}
                        onChangeText={t => setEditableData(p => ({ ...p, licenseNumber: t }))}
                        placeholder="e.g. #12345678"
                        placeholderTextColor="#a3a3a3"
                        className="w-full bg-white border border-neutral-200 rounded-xl px-4 py-2.5 text-sm"
                      />
                    </View>

                    <View>
                      <Text className="text-xs font-semibold text-neutral-500 mb-1.5">License Document (Photo)</Text>
                      {licenseDocUri ? (
                        <View className="flex-row items-center bg-indigo-50 p-3 rounded-xl border border-indigo-200">
                          <FontAwesome5 name="file-image" size={16} color="#4F46E5" />
                          <Text className="text-xs font-semibold text-indigo-900 ml-2 flex-1 truncate" numberOfLines={1}>Document Attached</Text>
                          <Pressable onPress={() => setLicenseDocUri(null)} className="p-1">
                            <FontAwesome5 name="times-circle" size={14} color="#a3a3a3" />
                          </Pressable>
                        </View>
                      ) : (
                        <Pressable 
                          onPress={handleLicenseDocSelect}
                          className="w-full flex-row items-center justify-center py-6 border-2 border-dashed border-neutral-200 rounded-xl bg-white"
                        >
                          <FontAwesome5 name="cloud-upload-alt" size={18} color="#737373" />
                          <Text className="text-sm text-neutral-500 font-medium ml-2">Upload License Photo</Text>
                        </Pressable>
                      )}
                    </View>

                    {verificationResult && (
                      <View className={`rounded-xl p-3 border ${verificationResult.success ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100'}`}>
                        <Text className={`text-[11px] font-semibold ${verificationResult.success ? 'text-emerald-800' : 'text-red-800'}`}>{verificationResult.message}</Text>
                      </View>
                    )}

                    <Pressable 
                      onPress={handleSubmitVerification}
                      disabled={!editableData.licenseNumber.trim() || !licenseDocUri || isSubmittingVerification}
                      className={`w-full flex-row justify-center py-3.5 rounded-xl items-center ${
                        editableData.licenseNumber.trim() && licenseDocUri && !isSubmittingVerification ? 'bg-indigo-600' : 'bg-neutral-200'
                      }`}
                    >
                      {isSubmittingVerification ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <>
                          <FontAwesome5 name="shield-alt" size={14} color={editableData.licenseNumber.trim() && licenseDocUri ? "#fff" : "#a3a3a3"} />
                          <Text className={`text-sm font-bold ml-2 ${editableData.licenseNumber.trim() && licenseDocUri ? 'text-white' : 'text-neutral-400'}`}>Submit for Review</Text>
                        </>
                      )}
                    </Pressable>
                  </>
                )}
              </View>
            )}
          </View>

          {/* About Us Accordion */}
          <View className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
            <Pressable 
              onPress={() => setActiveEditSection(activeEditSection === 'about' ? null : 'about')}
              className="flex-row items-center justify-between p-4"
            >
              <View className="flex-row items-center" style={{ gap: 12 }}>
                <View className="w-10 h-10 rounded-lg bg-neutral-50 items-center justify-center">
                  <FontAwesome5 name="info-circle" size={16} color="#525252" />
                </View>
                <View>
                  <Text className="text-sm font-bold text-neutral-900">About Us</Text>
                  <Text className="text-[10px] text-neutral-500">Business description and info</Text>
                </View>
              </View>
              <FontAwesome5 name={activeEditSection === 'about' ? "chevron-up" : "chevron-down"} size={12} color="#a3a3a3" />
            </Pressable>
            
            {activeEditSection === 'about' && (
              <View className="p-4 border-t border-neutral-100 bg-neutral-50/50" style={{ gap: 12 }}>
                <View>
                  <Text className="text-xs font-semibold text-neutral-500 mb-1.5">Business Description</Text>
                  <TextInput
                    value={editableData.description}
                    onChangeText={t => setEditableData(p => ({ ...p, description: t }))}
                    placeholder="Tell homeowners about your business..."
                    placeholderTextColor="#a3a3a3"
                    multiline
                    numberOfLines={4}
                    className="w-full bg-white border border-neutral-200 rounded-xl px-4 py-2.5 text-sm"
                    style={{ textAlignVertical: "top", minHeight: 100 }}
                  />
                </View>
                <View>
                  <Text className="text-xs font-semibold text-neutral-500 mb-1.5">Pricing Info</Text>
                  <TextInput
                    value={editableData.pricing}
                    onChangeText={t => setEditableData(p => ({ ...p, pricing: t }))}
                    placeholder="e.g. $500 - $5,000"
                    placeholderTextColor="#a3a3a3"
                    className="w-full bg-white border border-neutral-200 rounded-xl px-4 py-2.5 text-sm"
                  />
                </View>
                <View>
                  <Text className="text-xs font-semibold text-neutral-500 mb-1.5">Certifications</Text>
                  <TextInput
                    value={editableData.certifications}
                    onChangeText={t => setEditableData(p => ({ ...p, certifications: t }))}
                    placeholder="Licensed, Bonded, Insured..."
                    placeholderTextColor="#a3a3a3"
                    className="w-full bg-white border border-neutral-200 rounded-xl px-4 py-2.5 text-sm"
                  />
                </View>
              </View>
            )}
          </View>

          {/* Contact & Location Accordion */}
          <View className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
            <Pressable 
              onPress={() => setActiveEditSection(activeEditSection === 'contact' ? null : 'contact')}
              className="flex-row items-center justify-between p-4"
            >
              <View className="flex-row items-center" style={{ gap: 12 }}>
                <View className="w-10 h-10 rounded-lg bg-neutral-50 items-center justify-center">
                  <FontAwesome5 name="map-marker-alt" size={16} color="#525252" />
                </View>
                <View>
                  <Text className="text-sm font-bold text-neutral-900">Contact & Location</Text>
                  <Text className="text-[10px] text-neutral-500">Where you work and how to reach you</Text>
                </View>
              </View>
              <FontAwesome5 name={activeEditSection === 'contact' ? "chevron-up" : "chevron-down"} size={12} color="#a3a3a3" />
            </Pressable>
            
            {activeEditSection === 'contact' && (
              <View className="p-4 border-t border-neutral-100 bg-neutral-50/50" style={{ gap: 12 }}>
                <View>
                  <Text className="text-xs font-semibold text-neutral-500 mb-1.5">Phone</Text>
                  <TextInput
                    value={editableData.phone}
                    onChangeText={t => setEditableData(p => ({ ...p, phone: formatPhoneInput(t) }))}
                    placeholder="212-555-0123"
                    placeholderTextColor="#a3a3a3"
                    keyboardType="phone-pad"
                    maxLength={12}
                    className="w-full bg-white border border-neutral-200 rounded-xl px-4 py-2.5 text-sm"
                  />
                </View>
                <View>
                  <Text className="text-xs font-semibold text-neutral-500 mb-1.5">Email</Text>
                  <TextInput
                    value={editableData.email}
                    placeholder="your@email.com"
                    placeholderTextColor="#a3a3a3"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    editable={false}
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-2.5 text-sm text-neutral-400"
                  />
                  <Text className="text-[10px] text-neutral-400 mt-1">Contact support to change your email.</Text>
                </View>
                <View>
                  <Text className="text-xs font-semibold text-neutral-500 mb-1.5">Website (Optional)</Text>
                  <TextInput
                    value={editableData.website}
                    onChangeText={t => setEditableData(p => ({ ...p, website: t }))}
                    placeholder="https://yourwebsite.com"
                    placeholderTextColor="#a3a3a3"
                    autoCapitalize="none"
                    className="w-full bg-white border border-neutral-200 rounded-xl px-4 py-2.5 text-sm"
                  />
                </View>
                <View>
                  <Text className="text-xs font-semibold text-neutral-500 mb-1.5">Service Areas (Zip Codes)</Text>
                  <View className="flex-row flex-wrap mb-3" style={{ gap: 8 }}>
                    {editableData.zipCodes.map((zip, idx) => (
                      <View key={idx} className="bg-indigo-50 px-3 py-1.5 rounded-full flex-row items-center" style={{ gap: 6 }}>
                        <Text className="text-xs font-medium text-indigo-700">{zip}</Text>
                        <Pressable onPress={() => setEditableData(p => ({ ...p, zipCodes: p.zipCodes.filter((_, i) => i !== idx) }))}>
                          <FontAwesome5 name="times" size={10} color="#6366f1" />
                        </Pressable>
                      </View>
                    ))}
                    {editableData.zipCodes.length === 0 && (
                      <Text className="text-xs text-neutral-400 italic">No zip codes added</Text>
                    )}
                  </View>
                  <View className="flex-row" style={{ gap: 8 }}>
                    <TextInput
                      value={newZip}
                      onChangeText={setNewZip}
                      placeholder="Add Zip Code"
                      placeholderTextColor="#a3a3a3"
                      keyboardType="number-pad"
                      maxLength={5}
                      className="flex-1 bg-white border border-neutral-200 rounded-xl px-4 py-2.5 text-sm"
                      onSubmitEditing={() => {
                        const val = newZip.trim();
                        if (val && !editableData.zipCodes.includes(val)) {
                          setEditableData(p => ({ ...p, zipCodes: [...p.zipCodes, val] }));
                          setNewZip('');
                        }
                      }}
                    />
                    <Pressable 
                      onPress={() => {
                        const val = newZip.trim();
                        if (val && !editableData.zipCodes.includes(val)) {
                          setEditableData(p => ({ ...p, zipCodes: [...p.zipCodes, val] }));
                          setNewZip('');
                        }
                      }}
                      className="bg-indigo-600 w-11 h-11 rounded-xl items-center justify-center shadow-sm shadow-indigo-200"
                    >
                      <FontAwesome5 name="plus" size={14} color="#fff" />
                    </Pressable>
                  </View>
                </View>
                <View className="relative z-50">
                  <Text className="text-xs font-semibold text-neutral-500 mb-1.5">Address</Text>
                  <TextInput
                    value={editableData.address}
                    onChangeText={searchAddress}
                    placeholder="Start typing your address..."
                    placeholderTextColor="#a3a3a3"
                    className="w-full bg-white border border-neutral-200 rounded-xl px-4 py-2.5 text-sm"
                  />
                  {isSearchingAddress && (
                    <View className="absolute right-3 top-8">
                      <ActivityIndicator size="small" color="#4F46E5" />
                    </View>
                  )}
                  {addressSuggestions.length > 0 && (
                    <View className="mt-2 bg-white border border-neutral-200 rounded-xl overflow-hidden">
                      {addressSuggestions.map((item: any, index: number) => (
                        <Pressable
                          key={index}
                          onPress={() => handleSelectAddress(item)}
                          className={`px-4 py-3 border-b border-neutral-100 active:bg-neutral-50 ${
                            index === addressSuggestions.length - 1 ? 'border-b-0' : ''
                          }`}
                        >
                          <Text className="text-xs text-neutral-900 font-medium" numberOfLines={1}>
                            {item.display_name}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  )}
                </View>
              </View>
            )}
          </View>

          {/* Business Hours Accordion */}
          <View className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
            <Pressable
              onPress={() => setActiveEditSection(activeEditSection === 'hours' ? null : 'hours')}
              className="flex-row items-center justify-between p-4"
            >
              <View className="flex-row items-center" style={{ gap: 12 }}>
                <View className="w-10 h-10 rounded-lg bg-neutral-50 items-center justify-center">
                  <FontAwesome5 name="clock" size={16} color="#525252" />
                </View>
                <View>
                  <Text className="text-sm font-bold text-neutral-900">Business Hours</Text>
                  <Text className="text-[10px] text-neutral-500">Set your weekly availability</Text>
                </View>
              </View>
              <FontAwesome5 name={activeEditSection === 'hours' ? "chevron-up" : "chevron-down"} size={12} color="#a3a3a3" />
            </Pressable>

            {activeEditSection === 'hours' && (
              <View className="p-4 border-t border-neutral-100 bg-neutral-50/50">
                {DAYS.map(day => (
                  <View key={day} className="flex-row items-center justify-between py-2 border-b border-neutral-100">
                    <Pressable
                      onPress={() => setHours(prev => ({
                        ...prev,
                        [day]: { ...prev[day], isOpen: !prev[day]?.isOpen }
                      }))}
                      className="flex-row items-center"
                      style={{ gap: 8, minWidth: 110 }}
                    >
                      <View className={`w-5 h-5 rounded border-2 items-center justify-center ${hours[day]?.isOpen !== false ? 'bg-indigo-600 border-indigo-600' : 'bg-white border-neutral-300'}`}>
                        {hours[day]?.isOpen !== false && (
                          <FontAwesome5 name="check" size={9} color="#fff" />
                        )}
                      </View>
                      <Text className={`text-sm font-medium ${hours[day]?.isOpen !== false ? 'text-neutral-900' : 'text-neutral-400'}`}>{day.slice(0, 3)}</Text>
                    </Pressable>
                    {hours[day]?.isOpen !== false ? (
                      <View className="flex-row items-center" style={{ gap: 8 }}>
                        <Pressable
                          onPress={() => {
                            const currentIdx = TIME_OPTIONS.indexOf(hours[day]?.open || '09:00');
                            const newIdx = (currentIdx + 1) % TIME_OPTIONS.length;
                            setHours(prev => ({ ...prev, [day]: { ...prev[day], open: TIME_OPTIONS[newIdx] } }));
                          }}
                          className="bg-white border border-neutral-200 rounded-lg px-3 py-1.5"
                        >
                          <Text className="text-xs font-medium text-neutral-700">{formatTimeDisplay(hours[day]?.open || '09:00')}</Text>
                        </Pressable>
                        <Text className="text-xs text-neutral-400">to</Text>
                        <Pressable
                          onPress={() => {
                            const currentIdx = TIME_OPTIONS.indexOf(hours[day]?.close || '17:00');
                            const newIdx = (currentIdx + 1) % TIME_OPTIONS.length;
                            setHours(prev => ({ ...prev, [day]: { ...prev[day], close: TIME_OPTIONS[newIdx] } }));
                          }}
                          className="bg-white border border-neutral-200 rounded-lg px-3 py-1.5"
                        >
                          <Text className="text-xs font-medium text-neutral-700">{formatTimeDisplay(hours[day]?.close || '17:00')}</Text>
                        </Pressable>
                      </View>
                    ) : (
                      <Text className="text-xs text-neutral-400 italic">Closed</Text>
                    )}
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* Services Accordion */}
          <View className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
            <Pressable 
              onPress={() => setActiveEditSection(activeEditSection === 'services' ? null : 'services')}
              className="flex-row items-center justify-between p-4"
            >
              <View className="flex-row items-center" style={{ gap: 12 }}>
                <View className="w-10 h-10 rounded-lg bg-neutral-50 items-center justify-center">
                  <FontAwesome5 name="briefcase" size={16} color="#525252" />
                </View>
                <View>
                  <Text className="text-sm font-bold text-neutral-900">Services</Text>
                  <Text className="text-[10px] text-neutral-500">{editableData.servicesOffered.length} services listed</Text>
                </View>
              </View>
              <FontAwesome5 name={activeEditSection === 'services' ? "chevron-up" : "chevron-down"} size={12} color="#a3a3a3" />
            </Pressable>
            
            {activeEditSection === 'services' && (
              <View className="p-4 border-t border-neutral-100 bg-neutral-50/50" style={{ gap: 12 }}>
                <View className="flex-row items-center justify-between mb-2">
                  <Text className="text-xs font-semibold text-neutral-500">Services Offered</Text>
                  <Pressable 
                    onPress={() => setEditableData(p => ({ ...p, servicesOffered: [...p.servicesOffered, { name: '', description: '', priceRange: '' }] }))}
                    className="flex-row items-center bg-indigo-50 px-3 py-1.5 rounded-lg"
                    style={{ gap: 6 }}
                  >
                    <FontAwesome5 name="plus" size={10} color="#4F46E5" />
                    <Text className="text-[11px] font-bold text-indigo-700">Add Service</Text>
                  </Pressable>
                </View>

                {editableData.servicesOffered.length === 0 && (
                  <View className="py-4 border border-dashed border-neutral-200 rounded-xl items-center">
                    <Text className="text-xs text-neutral-400">No services added yet</Text>
                  </View>
                )}

                {editableData.servicesOffered.map((service, idx) => (
                  <View key={idx} className="bg-white rounded-xl border border-neutral-200 p-4 relative mb-2">
                    <Pressable 
                      onPress={() => setEditableData(p => ({ ...p, servicesOffered: p.servicesOffered.filter((_, i) => i !== idx) }))}
                      className="absolute top-3 right-3 w-7 h-7 bg-neutral-50 rounded-full items-center justify-center"
                    >
                      <FontAwesome5 name="trash" size={10} color="#ef4444" />
                    </Pressable>
                    <TextInput
                      value={service.name}
                      onChangeText={t => {
                        const next = [...editableData.servicesOffered];
                        next[idx].name = t;
                        setEditableData(p => ({ ...p, servicesOffered: next }));
                      }}
                      placeholder="Service Name (e.g. Interior Painting)"
                      placeholderTextColor="#a3a3a3"
                      className="text-sm font-bold text-neutral-900 mb-2 mr-8"
                    />
                    <TextInput
                      value={service.description}
                      onChangeText={t => {
                        const next = [...editableData.servicesOffered];
                        next[idx].description = t;
                        setEditableData(p => ({ ...p, servicesOffered: next }));
                      }}
                      placeholder="Service Description"
                      placeholderTextColor="#a3a3a3"
                      multiline
                      className="text-xs text-neutral-600 mb-2 p-2 bg-neutral-50 rounded-lg"
                    />
                    <TextInput
                      value={service.priceRange}
                      onChangeText={t => {
                        const next = [...editableData.servicesOffered];
                        next[idx].priceRange = t;
                        setEditableData(p => ({ ...p, servicesOffered: next }));
                      }}
                      placeholder="Price Range (e.g. $500 - $1,500)"
                      placeholderTextColor="#a3a3a3"
                      className="text-xs font-semibold text-indigo-600"
                    />
                  </View>
                ))}
              </View>
            )}
          </View>

          <Pressable
            onPress={handleSaveProfile}
            disabled={profileSaving}
            className="w-full py-4 bg-indigo-600 rounded-2xl items-center flex-row justify-center mt-4 shadow-md shadow-indigo-200"
            style={{ gap: 10 }}
          >
            {profileSaving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <FontAwesome5 name="save" size={16} color="#fff" />
            )}
            <Text className="text-base font-bold text-white">{profileSaving ? "Saving Changes..." : "Save Profile"}</Text>
          </Pressable>
        </View>
      </Sheet>
    </KeyboardAvoidingView>
  );
};

export default ContractorDashboardScreen;
