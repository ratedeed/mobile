import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Clipboard from 'expo-clipboard';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import * as WebBrowser from 'expo-web-browser';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useColorScheme } from 'react-native';
import {
  View,
  ScrollView,
  Pressable,
  Alert,
  Text,
  Image,
  TextInput,
  Linking,
  KeyboardAvoidingView,
  Platform,
  Animated,
  TouchableWithoutFeedback,
} from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import {
  fetchContractorPosts,
  createPost,
  likePost,
  unlikePost,
  deletePost,
  getContractorEarnings,
  fetchConversations,
  getContractorQuotes,
  getContractorJobs,
  getStripeConnectUrl,
  getStripeAccountStatus,
  fetchContractorReviews,
  respondToReview,
  updateContractorProfile, getContractorProfile,
  requestVerification,
  getContractorDetails,
  get,
  del,
  getAuthHeaders,
  post as apiPost,
} from '../api';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import ServiceAreaMap from '../components/common/ServiceAreaMap';
import AnalyticsTab from '../components/contractor/AnalyticsTab';
import { API_BASE_URL } from '../config';
import { uploadToCloudinary, CLOUDINARY_FOLDERS } from '../utils/cloudinary';
import { getCoverImageUrl, getProfileImageUrl, isSvgUrl } from '../utils/avatarUtils';
import { SvgImage } from '../components/common/SvgImage';
import { useAuth } from '../context/AuthContext';
import { requestPhotoLibraryPermission } from '../utils/permissions';
import { parsePriceRange } from '../utils/price';
import { EmptyState } from '../components/common/EmptyState';
import { VerifiedBadge } from '../components/common/VerifiedBadge';
import { SkeletonLoader } from '../components/common/SkeletonLoader';
import { BouncingDotsLoader, BouncingRefreshScrollView } from '../components/common';
import OperationalOverviewCard from '../components/dashboard/OperationalOverviewCard';
import TrustActionRequiredCard from '../components/dashboard/TrustActionRequiredCard';
import DashboardKpiGrid from '../components/dashboard/DashboardKpiGrid';
import ContractorCalendarTab from '../components/dashboard/ContractorCalendarTab';

const CURATED_TAGS = [
  'Before & After',
  'Completed Project',
  'Under Construction',
  'Kitchen',
  'Bathroom',
  'Outdoor Living',
  'Special Offer',
  'Announcement'
];

const CATEGORIES_LIST = [
  { id: 'general', label: 'General' },
  { id: 'builders', label: 'Home Builders' },
  { id: 'plumbers', label: 'Plumbers' },
  { id: 'electricians', label: 'Electricians' },
  { id: 'painters', label: 'Painters' },
  { id: 'landscape', label: 'Landscapers' },
  { id: 'hvac', label: 'HVAC' },
  { id: 'roofers', label: 'Roofers' },
  { id: 'carpenters', label: 'Carpenters' },
  { id: 'cleaners', label: 'Cleaners' },
  { id: 'handyman', label: 'Handymen' },
];

const TAG_MAP: Record<string, string[]> = {
  general: [
    'Before & After', 'Completed Project', 'Under Construction', 'Special Offer',
    'Announcement', 'Client Review', 'Service Update', 'Maintenance Tip'
  ],
  builders: [
    'New Construction', 'Custom Home', 'Home Addition', 'Kitchen Remodel', 
    'Bathroom Remodel', 'Framing', 'Foundation', 'Before & After'
  ],
  plumbers: [
    'Leak Repair', 'Drain Cleaning', 'Water Heater', 'Pipe Replacement', 
    'Emergency Service', 'Fixture Install', 'Clogged Drain', 'Sump Pump'
  ],
  electricians: [
    'Wiring Upgrade', 'Panel Upgrade', 'Lighting Install', 'EV Charger', 
    'Smart Home', 'Outlet Repair', 'Generator', 'Safety Inspection'
  ],
  painters: [
    'Interior Painting', 'Exterior Painting', 'Cabinet Refinishing', 'Deck Staining', 
    'Wallpaper Removal', 'Drywall Repair', 'Before & After', 'Color Consultation'
  ],
  landscape: [
    'Lawn Care', 'Hardscaping', 'Garden Design', 'Irrigation System', 
    'Tree Trimming', 'Patio Install', 'Spring Cleanup', 'Outdoor Lighting'
  ],
  hvac: [
    'AC Installation', 'AC Repair', 'Heating Install', 'Furnace Repair', 
    'Heat Pump', 'Duct Cleaning', 'Thermostat Install', 'Maintenance Tune-up'
  ],
  roofers: [
    'Roof Replacement', 'Roof Repair', 'Shingle Repair', 'Gutter Install', 
    'Leak Repair', 'Commercial Roofing', 'Storm Damage', 'Siding'
  ],
  carpenters: [
    'Custom Deck', 'Trim & Molding', 'Framing', 'Cabinetry', 
    'Door Installation', 'Wood Rot Repair', 'Shed Build', 'Furniture repair'
  ],
  cleaners: [
    'Deep Cleaning', 'Move In/Out Clean', 'Regular Housekeeping', 'Post-Construction', 
    'Carpet Cleaning', 'Window Wash', 'Eco-Friendly Clean', 'Office Cleaning'
  ],
  handyman: [
    'Drywall Repair', 'Fixture Replace', 'Door Repair', 'Furniture Assembly', 
    'Gutter Clean', 'TV Mounting', 'Fence Repair', 'Tile Repair'
  ],
};

const getMobileTagIcon = (tag: string) => {
  const t = tag.toLowerCase();
  let name = 'wrench';
  let color = '#737373';

  if (t === 'before & after') { name = 'history'; color = '#6366f1'; }
  else if (t === 'completed project') { name = 'check-circle'; color = '#059669'; }
  else if (t === 'under construction') { name = 'hammer'; color = '#d97706'; }
  else if (t === 'special offer') { name = 'percent'; color = '#f43f5e'; }
  else if (t === 'announcement') { name = 'bullhorn'; color = '#3b82f6'; }
  else if (t.includes('leak') || t.includes('drain') || t.includes('water') || t.includes('pipe') || t.includes('sump') || t.includes('clogged')) { name = 'tint'; color = '#3b82f6'; }
  else if (t.includes('wiring') || t.includes('panel') || t.includes('lighting') || t.includes('charger') || t.includes('smart') || t.includes('outlet') || t.includes('generator') || t.includes('safety')) { name = 'bolt'; color = '#eab308'; }
  else if (t.includes('paint') || t.includes('refinish') || t.includes('stain') || t.includes('wallpaper') || t.includes('drywall') || t.includes('color')) { name = 'paint-brush'; color = '#a855f7'; }
  else if (t.includes('roof') || t.includes('gutter') || t.includes('shingle') || t.includes('siding') || t.includes('storm')) { name = 'home'; color = '#57534e'; }
  else if (t.includes('clean') || t.includes('wash') || t.includes('housekeep')) { name = 'magic'; color = '#06b6d4'; }
  else if (t.includes('bath') || t.includes('shower')) { name = 'bath'; color = '#0d9488'; }
  else if (t.includes('tree') || t.includes('garden') || t.includes('lawn') || t.includes('irrigation') || t.includes('patio') || t.includes('landscape')) { name = 'tree'; color = '#10b981'; }

  return <FontAwesome5 name={name} size={9} color={color} style={{ marginRight: 4 }} />;
};

const TABS = [
  { key: 'today', label: 'Today', icon: 'th-large' },
  { key: 'calendar', label: 'Calendar', icon: 'calendar-alt' },
  { key: 'profile', label: 'Public Profile', icon: 'user' },
  { key: 'payments', label: 'Earnings & Jobs', icon: 'wallet' },
  { key: 'analytics', label: 'Analytics', icon: 'chart-bar' },
  { key: 'promote', label: 'Promote', icon: 'bullhorn' },
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
    pending: { label: 'Pending', bg: 'bg-amber-100 dark:bg-amber-900/40', text: 'text-amber-800 dark:text-amber-300' },
    accepted: { label: 'Accepted', bg: 'bg-emerald-100 dark:bg-emerald-900/40', text: 'text-emerald-800 dark:text-emerald-300' },
    rejected: { label: 'Rejected', bg: 'bg-indigo-100 dark:bg-indigo-900/40', text: 'text-indigo-800 dark:text-indigo-300' },
    funded_in_progress: { label: 'In Progress', bg: 'bg-indigo-100 dark:bg-indigo-900/40', text: 'text-indigo-800 dark:text-indigo-300' },
    partially_funded: { label: 'Partially Funded', bg: 'bg-amber-100 dark:bg-amber-900/40', text: 'text-amber-800 dark:text-amber-300' },
    awaiting_payment: { label: 'Awaiting Payment', bg: 'bg-amber-100 dark:bg-amber-900/40', text: 'text-amber-800 dark:text-amber-300' },
    completed_pending_release: { label: 'Pending Release', bg: 'bg-blue-100 dark:bg-blue-900/40', text: 'text-blue-800 dark:text-blue-300' },
    completed_paid: { label: 'Completed', bg: 'bg-emerald-100 dark:bg-emerald-900/40', text: 'text-emerald-800 dark:text-emerald-300' },
    disputed: { label: 'Disputed', bg: 'bg-indigo-100 dark:bg-indigo-900/40', text: 'text-indigo-800 dark:text-indigo-300' },
    new: { label: 'New', bg: 'bg-emerald-100 dark:bg-emerald-900/40', text: 'text-emerald-800 dark:text-emerald-300' },
    contacted: { label: 'Contacted', bg: 'bg-amber-100 dark:bg-amber-900/40', text: 'text-amber-800 dark:text-amber-300' },
    quoted: { label: 'Quoted', bg: 'bg-blue-100 dark:bg-blue-900/40', text: 'text-blue-800 dark:text-blue-300' },
    archived: { label: 'Archived', bg: 'bg-neutral-100 dark:bg-neutral-800/45', text: 'text-neutral-500 dark:text-neutral-400' },
  };
  const c = config[status] || { label: status, bg: 'bg-neutral-100 dark:bg-neutral-800 dark:bg-neutral-800', text: 'text-neutral-800 dark:text-neutral-100 dark:text-neutral-300' };
  return (
    <View className={`${c.bg} px-2 py-0.5 rounded-full self-start`}>
      <Text className={`${c.text} text-xs font-semibold`}>{c.label}</Text>
    </View>
  );
}

// ---- Star Rating ----
function StarRating({ rating, size = 12 }: { rating: number; size?: number }) {
  const isDark = useColorScheme() === 'dark';
  return (
    <View className="flex-row items-center" style={{ gap: 1 }}>
      {[1, 2, 3, 4, 5].map(i => (
        <FontAwesome5
          key={i}
          name="star"
          solid={i <= Math.round(rating)}
          size={size}
          color={i <= Math.round(rating) ? '#eab308' : (isDark ? '#404040' : '#d4d4d4')}
        />
      ))}
    </View>
  );
}



// ---- Bottom Sheet ----
function Sheet({ visible, onClose, title, children }: { visible: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  if (!visible) return null;
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      className="absolute inset-0 z-[90]"
      style={{ flex: 1 }}
    >
      <View className="flex-1 justify-end" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
        <Pressable className="absolute inset-0" onPress={onClose} />
        <View className="bg-white dark:bg-neutral-800 rounded-t-2xl max-h-[85vh]" style={{ flexShrink: 1 }}>
          <View className="w-10 h-1 rounded-full bg-neutral-300 dark:bg-neutral-500 mx-auto mt-3" />
          <View className="flex-row items-center justify-between px-5 pt-4 pb-2 border-b border-neutral-100 dark:border-neutral-700">
            <Text className="text-lg font-bold text-neutral-900 dark:text-white">{title}</Text>
            <Pressable onPress={onClose} className="w-8 h-8 items-center justify-center rounded-full">
              <FontAwesome5 name="times" size={16} color="#a3a3a3" />
            </Pressable>
          </View>
          <ScrollView className="px-5 py-4 pb-10" keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const getOtherParticipant = (conv: any, currentUserId: string | null) => {
  if (!conv || !conv.participants || !currentUserId) return null;
  return conv.participants.find((p: any) => {
    const id = p._id || p.id;
    return id !== currentUserId;
  }) || conv.otherParticipant || conv.participant2User || null;
};

const getDisplayName = (user: any) => {
  if (!user) return 'Homeowner';
  if (user.companyName || user.businessName) {
    return user.companyName || user.businessName;
  }
  const first = user.firstName || '';
  const last = user.lastName || '';
  const fullName = `${first} ${last}`.trim();
  return fullName || user.name || 'Homeowner';
};

const resolveParticipantAvatar = (user: any) => {
  if (!user) return '';
  return user.profilePicture || user.profileImage || user.avatar || '';
};

const getJobDate = (j: any) => {
  const raw = j.quote?.estimatedStartDate || j.quote?.startDate || j.startDate || j.date || j.createdAt;
  if (!raw) return null;
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
};

import ScaleButton from '../components/common/ScaleButton';

// ================================================================
// Main Component
// ================================================================
const ContractorDashboardScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute();
  const { userId: currentUserId, updateUser } = useAuth();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [realContractorId, setRealContractorId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('today');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [paymentSubTab, setPaymentSubTab] = useState('overview');
  const [profileSubTab, setProfileSubTab] = useState<'posts' | 'about' | 'services' | 'portfolio' | 'reviews'>('posts');
  const [calendarDate, setCalendarDate] = useState(() => new Date());
  const [selectedDay, setSelectedDay] = useState<number | null>(() => new Date().getDate());

  const [posts, setPosts] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [portfolio, setPortfolio] = useState<any[]>([]);
  const [_earnings, setEarnings] = useState<any>(null);
  const [conversations, setConversations] = useState<any[]>([]);
  const [quotes, setQuotes] = useState<any[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [stripeStatus, setStripeStatus] = useState<any>(null);

  const [showCreatePost, setShowCreatePost] = useState(false);
  const [showAddPortfolio, setShowAddPortfolio] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [activeEditSection, setActiveEditSection] = useState<string | null>(null);
  const [newZip, setNewZip] = useState('');
  const [leadFilter, setLeadFilter] = useState<'active' | 'archived'>('active');
  const [activeReplyReviewId, setActiveReplyReviewId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [replySubmitting, setReplySubmitting] = useState(false);

  const [postCaption, setPostCaption] = useState('');
  const [postTags, setPostTags] = useState<string[]>([]);
  const [postLocation, setPostLocation] = useState('');
  const [postImages, setPostImages] = useState<string[]>([]);
  const [postSubmitting, setPostSubmitting] = useState(false);

  const [portfolioItem, setPortfolioItem] = useState({ name: '', description: '', imageUrl: '' });
  const [portfolioSubmitting, setPortfolioSubmitting] = useState(false);

  const [licenseDocUri, setLicenseDocUri] = useState<string | null>(null);
  const [isSubmittingVerification, setIsSubmittingVerification] = useState(false);
  const [verificationResult, setVerificationResult] = useState<{ success: boolean; message: string } | null>(null);

  const [editableData, setEditableData] = useState({
    slug: "",
    description: "",
    pricing: "",
    certifications: "" as any,
    servicesOffered: [] as { name: string; description: string; minPrice: string; maxPrice: string; contactForQuote: boolean }[],
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
  const [bannerPics, setBannerPics] = useState<string[]>([]);
  const [avatarUrl, setAvatarUrl] = useState('');
  const [contractorName, setContractorName] = useState('');
  const [licenseStatus, setLicenseStatus] = useState<string>('not_submitted');
  const [contractorCategory, setContractorCategory] = useState('general');
  const [postCategory, setPostCategory] = useState('general');
  const [onboardingComplete, setOnboardingComplete] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  const [imageLoading, setImageLoading] = useState(false);
  const [isStripeConnecting, setIsStripeConnecting] = useState(false);
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
      setLicenseDocUri(asset.uri);
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to select document');
    }
  };

  const handleSubmitVerification = async () => {
    if (!editableData.licenseNumber.trim() || !licenseDocUri) {
      Alert.alert('Error', 'Please provide both license number and your verification document.');
      return;
    }
    setIsSubmittingVerification(true);
    setVerificationResult(null);

    try {
      const cloudinaryUrl = await uploadToCloudinary(licenseDocUri, CLOUDINARY_FOLDERS.LICENSES);

      await requestVerification({
        licenseNumber: editableData.licenseNumber.trim(),
        licenseDocumentFile: cloudinaryUrl, // Pass the Cloudinary URL
      });
      setVerificationResult({
        success: true,
        message: 'License verification request submitted! Our team will review it.',
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
      Alert.alert('Verification Error', err?.message || 'Failed to submit verification request.');
      setVerificationResult({
        success: false,
        message: err?.message || 'Failed to submit verification request.',
      });
    } finally {
      setIsSubmittingVerification(false);
    }
  };



  const handleRespondToReview = async (reviewId: string) => {
    if (!replyText.trim()) {
      Alert.alert('Validation Error', 'Please enter a reply.');
      return;
    }
    setReplySubmitting(true);
    try {
      await respondToReview(reviewId, replyText.trim());
      Alert.alert('Success', 'Your response has been submitted!');
      setActiveReplyReviewId(null);
      setReplyText('');
      loadData();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to submit response');
    } finally {
      setReplySubmitting(false);
    }
  };

  const pickFromLibrary = async (): Promise<string | null> => {
    const hasPermission = await requestPhotoLibraryPermission();
    if (!hasPermission) return null;

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
      });
      if (result.canceled || !result.assets?.length) return null;
      const asset = result.assets[0];
      if (asset.fileSize && asset.fileSize > 5 * 1024 * 1024) {
        Alert.alert("File too large", "Please choose an image under 5MB.");
        return null;
      }
      return asset.uri;
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to select image');
      return null;
    }
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
      const [postsData, reviewsData, portfolioData, earningsData, conversationsData, quotesData, jobsData, stripeData] = await Promise.all([
        fetchContractorPosts(cid).catch(() => ({ posts: [] })),
        fetchContractorReviews(cid).catch(() => []),
        getPortfolio(cid).catch(() => []),
        getContractorEarnings().catch(() => null),
        fetchConversations().catch(() => []),
        getContractorQuotes().catch(() => []),
        getContractorJobs().catch(() => []),
        getStripeAccountStatus().catch(() => ({ connected: false })),
      ]);

      setEarnings(earningsData);
      setConversations(Array.isArray(conversationsData) ? conversationsData : []);
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
       const normalizedServices = rawServices.map((s: any) => {
         const rawRange = s.priceRange || s.priceEstimate || '';
         const parsed = parsePriceRange(rawRange);
         return {
           name: typeof s === "string" ? s : s.name || "",
           description: s.description || s.desc || "",
           minPrice: parsed.min,
           maxPrice: parsed.max,
           contactForQuote: parsed.contactForQuote,
         };
       });

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
      setContractorCategory(cat || 'general');
      setBannerUrl(getCoverImageUrl(name, rawBanner, cat));
      const rawBanners = profile.bannerImages || [];
      const banners = (Array.isArray(rawBanners) && rawBanners.length > 0) ? rawBanners : (rawBanner ? [rawBanner] : []);
      setBannerPics(banners);
      setAvatarUrl(getProfileImageUrl(name, rawAvatar, cat));

      setEditableData({
        slug: profile.slug || "",
        description: profile.description || "",
        pricing: profile.pricingInfo || profile.pricing || profile.priceRange || "",
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

  useEffect(() => {
    loadData();

    // Handle tab navigation from other screens
    const initialTab = (route.params as any)?.initialTab;
    if (initialTab && TABS.some(t => t.key === initialTab)) {
      setActiveTab(initialTab);
    }

    // Handle deep-linked Stripe return
    const stripeReturn = (route.params as any)?.stripe_return;
    if (stripeReturn === 'true' || stripeReturn === true) {
      Alert.alert('Success', 'Stripe account connected successfully!');
      loadData(); // Refresh status
    }

    // Handle opening the create post sheet
    const openCreatePost = (route.params as any)?.openCreatePost;
    if (openCreatePost) {
      setPostCategory(contractorCategory);
      setShowCreatePost(true);
      navigation.setParams({ openCreatePost: undefined } as any);
    }
  }, [loadData, (route.params as any)?.initialTab, (route.params as any)?.stripe_return, (route.params as any)?.openCreatePost]);


  useEffect(() => {
    if (!loading && !onboardingComplete && realContractorId) {
      navigation.navigate('ContractorOnboarding');
    }
  }, [loading, onboardingComplete, realContractorId, navigation]);

  useEffect(() => {
    return () => {
      if (addressSearchTimer.current) clearTimeout(addressSearchTimer.current);
    };
  }, []);

  // Refresh Stripe Connect status whenever the screen regains focus
  // (e.g. after the user returns from the Stripe onboarding browser).
  useFocusEffect(
    useCallback(() => {
      getStripeAccountStatus()
        .then((status) => { if (status) setStripeStatus(status); })
        .catch(() => {});
      // Keep financial stats fresh (e.g. after returning from Earnings/withdrawal
      // or after a job status transition).
      getContractorEarnings()
        .then((e) => { if (e) setEarnings(e); })
        .catch(() => {});
      getContractorJobs()
        .then((j) => { if (Array.isArray(j)) setJobs(j); })
        .catch(() => {});
    }, [])
  );

  // In-app notification: when Stripe marks the account as approved, surface it
  // once so the contractor doesn't have to dig through the dashboard to find out.
  // Persisted in AsyncStorage so it truly only shows once per device.
  const [approvedAlertShown, setApprovedAlertShown] = useState(true); // default true to prevent flash
  useEffect(() => {
    AsyncStorage.getItem('@stripe_approved_alert_shown').then((val) => {
      if (val !== 'true') setApprovedAlertShown(false);
    }).catch(() => setApprovedAlertShown(false));
  }, []);
  useEffect(() => {
    if (stripeStatus?.chargesEnabled && !approvedAlertShown) {
      setApprovedAlertShown(true);
      AsyncStorage.setItem('@stripe_approved_alert_shown', 'true').catch(() => {});
      Alert.alert(
        "You're Approved!",
        'Your Stripe account is fully verified and ready to receive payments. You can now create and send quotes to clients.',
        [{ text: 'Awesome' }]
      );
    }
  }, [stripeStatus?.chargesEnabled, approvedAlertShown]);

  const onRefresh = useCallback(() => { setRefreshing(true); loadData(); }, [loadData]);

  // ---- Post handlers ----
  const handleCreatePost = async () => {
    if (!postCaption.trim()) { Alert.alert('Error', 'Caption is required'); return; }
    setPostSubmitting(true);
    try {
      const uploadedUrls = await Promise.all(
        postImages.map(img => uploadToCloudinary(img, CLOUDINARY_FOLDERS.POST_IMAGES))
      );
      const tags = postTags;
      await createPost({ caption: postCaption, images: uploadedUrls, tags, location: postLocation });
      setPostCaption(''); setPostTags([]); setPostLocation(''); setPostImages([]);
      setShowCreatePost(false);
      loadData();
      Alert.alert('Success', 'Post created successfully');
    } catch (err: any) {
      console.error(err);
      Alert.alert('Error', err?.message || 'Failed to create post');
    } finally {
      setPostSubmitting(false);
    }
  };

  const handleLikePost = async (postId: string, isLiked: boolean) => {
    try {
      if (isLiked) await unlikePost(postId); else await likePost(postId);
      setPosts(prev => prev.map(p => p._id === postId ? { ...p, likes: isLiked ? p.likes.filter((id: string) => id !== currentUserId) : [...p.likes, currentUserId] } : p));
    } catch (err: any) {
      console.error(err);
      Alert.alert('Error', err?.message || 'Failed to update like');
    }
  };

  const handleDeletePost = async (postId: string) => {
    Alert.alert('Delete Post', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
      try {
        await deletePost(postId);
        setPosts(prev => prev.filter(p => p._id !== postId));
      } catch (err: any) {
        console.error(err);
        Alert.alert("Error", err?.message || "Failed to delete post");
      }
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
      else {
        updateData.bannerImage = uploadedUrl;
        updateData.bannerUrl = uploadedUrl;
        const newBanners = [uploadedUrl, ...bannerPics.filter(x => x !== uploadedUrl)].slice(0, 5);
        updateData.bannerImages = newBanners;
        setBannerPics(newBanners);
      }
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
      let finalImageUrl = portfolioItem.imageUrl;
      if (finalImageUrl && finalImageUrl.startsWith('file://')) {
        finalImageUrl = await uploadToCloudinary(finalImageUrl, CLOUDINARY_FOLDERS.PORTFOLIO);
      }
      await addPortfolioItem({
        ...portfolioItem,
        imageUrl: finalImageUrl,
        images: finalImageUrl ? [finalImageUrl] : []
      });
      setPortfolioItem({ name: '', description: '', imageUrl: '' });
      setShowAddPortfolio(false);
      loadData();
      Alert.alert('Success', 'Portfolio project added');
    } catch (err: any) {
      console.error(err);
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
        pricingInfo: editableData.pricing || undefined,
        certifications: Array.isArray(editableData.certifications) ? editableData.certifications : editableData.certifications?.split(",").map((s: string) => s.trim()).filter(Boolean) || [],
        zipCodesCovered: editableData.zipCodes.length > 0 ? editableData.zipCodes : undefined,
        licenseNumber: editableData.licenseNumber || undefined,
        businessHours: Object.keys(formattedHours).length > 0 ? formattedHours : undefined,
        servicesOffered: editableData.servicesOffered.map(s => {
          let priceEstimate = 'Contact for Quote';
          if (!s.contactForQuote) {
            const min = (s.minPrice || '').replace(/[^0-9]/g, '').trim();
            const max = (s.maxPrice || '').replace(/[^0-9]/g, '').trim();
            if (min && max) {
              priceEstimate = `$${Number(min).toLocaleString()} – $${Number(max).toLocaleString()}`;
            } else if (min) {
              priceEstimate = `$${Number(min).toLocaleString()}+`;
            } else if (max) {
              priceEstimate = `Up to $${Number(max).toLocaleString()}`;
            }
          }
          return {
            name: s.name || undefined,
            description: s.description || undefined,
            priceEstimate,
          };
        }),
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
        bannerImages: bannerPics,
        bannerImage: bannerPics[0] || "",
        bannerUrl: bannerPics[0] || "",
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
  const jobAmount = (j: any) => j.totalAmount || j.amount || j.quote?.totalAmount || j.quote?.subtotal || j.amountFunded || 0;
  const totalEarnings = jobs.filter(j => j.status === 'completed_paid').reduce((sum, j) => sum + jobAmount(j), 0);
  const pendingEscrow = jobs.filter(j => ['funded_in_progress', 'partially_funded', 'completed_pending_release'].includes(j.status)).reduce((sum, j) => sum + jobAmount(j), 0);
  const activeJobsCount = jobs.filter(j => ['funded_in_progress', 'partially_funded', 'awaiting_payment'].includes(j.status)).length;
  const avgRating = reviews.length > 0 ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length : 0;
  const ratingBreakdown = [5, 4, 3, 2, 1].map(stars => ({
    stars,
    count: reviews.filter((r: any) => Math.floor(r.rating) === stars).length,
    pct: reviews.length > 0 ? (reviews.filter((r: any) => Math.floor(r.rating) === stars).length / reviews.length) * 100 : 0,
  }));

  if (loading) {
    return (
      <View className="flex-1 bg-white dark:bg-neutral-900 p-6 pt-16">
        <SkeletonLoader type="profile" count={1} />
      </View>
    );
  }

  // Profile completion tracking
  const completionSteps = [
    { key: 'photo', done: !!avatarUrl, label: 'Photo' },
    { key: 'description', done: !!editableData.description, label: 'Description' },
    { key: 'services', done: editableData.servicesOffered.length > 0, label: 'Services' },
    { key: 'location', done: editableData.zipCodes.length > 0, label: 'Area' },
  ];
  const completedCount = completionSteps.filter(s => s.done).length;
  const completionPct = Math.round((completedCount / completionSteps.length) * 100);
  const showBanner = !bannerDismissed && completionPct < 100;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0} className="flex-1 bg-neutral-50 dark:bg-neutral-800">
      {/* Profile Completion Banner */}
      {showBanner && (
        <View className="bg-white dark:bg-neutral-900 border-b border-neutral-100 dark:border-neutral-800 px-4 py-3">
          <View className="flex-row items-center justify-between mb-1.5">
            <Text className="text-[11px] font-bold text-neutral-900 dark:text-white">
              {completionPct}% complete
            </Text>
            <Pressable onPress={() => setBannerDismissed(true)} className="p-1">
              <FontAwesome5 name="times" size={10} color="#a3a3a3" />
            </Pressable>
          </View>
          <View className="h-1.5 bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden mb-2">
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
                  <Text className={`text-[10px] font-semibold ${step.done ? 'text-neutral-400 dark:text-neutral-500 line-through' : 'text-neutral-700 dark:text-neutral-300'}`}>
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

      <BouncingRefreshScrollView
        showsVerticalScrollIndicator={false}
        refreshing={refreshing}
        onRefresh={onRefresh}
      >
        {activeTab === 'profile' ? (
          <View>
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
                  className="absolute top-4 left-4 bg-white dark:bg-neutral-900/90 px-3 py-1.5 rounded-lg flex-row items-center shadow-sm"
                  style={{ gap: 6, zIndex: 50 }}
                >
                  <FontAwesome5 name="camera" size={12} color={isDark ? "#a3a3a3" : "#404040"} />
                  <Text className="text-[10px] font-bold text-neutral-800 dark:text-neutral-100">Edit Cover</Text>
                </Pressable>

                <Pressable
                  onPress={() => setShowEditProfile(true)}
                  className="absolute top-4 right-4 bg-white dark:bg-neutral-900/90 px-3 py-1.5 rounded-lg flex-row items-center shadow-sm"
                  style={{ gap: 6, zIndex: 50 }}
                >
                  <FontAwesome5 name="pen" size={10} color={isDark ? "#d4d4d4" : "#525252"} />
                  <Text className="text-xs font-semibold text-neutral-800 dark:text-neutral-100">Edit Profile</Text>
                </Pressable>
              </View>

              {/* Profile Card Overlap */}
              <View className="mx-4 -mt-10 bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-100 dark:border-neutral-800 shadow-sm p-4 relative z-10">
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
                      <Text className="text-xl font-bold text-neutral-900 dark:text-white">{contractorName || "My Business"}</Text>
                    </View>
                    <View className="flex-row items-center mt-1" style={{ gap: 8 }}>
                      <StarRating rating={avgRating} />
                      <Text className="text-xs text-neutral-500 dark:text-neutral-400 font-medium">{reviews.length} reviews</Text>
                    </View>
                  </View>
                </View>
              </View>
            </View>

            {/* Profile Info Description */}
            <View className="px-4 mt-4">
              <Text className="text-sm text-neutral-600 dark:text-neutral-300 leading-5" numberOfLines={3}>
                {editableData.description || "No description added yet."}
              </Text>
            </View>
          </View>
        ) : (
          <View className="px-4 pt-4 pb-2 flex-row items-center justify-between">
            <View>
              <Text className="text-2xl font-bold text-neutral-900 dark:text-white">
                {TABS.find(t => t.key === activeTab)?.label}
              </Text>
              <Text className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                {contractorName || 'My Business'}
              </Text>
            </View>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} className="w-10 h-10 rounded-full border border-neutral-200 dark:border-neutral-700" />
            ) : (
              <View className="w-10 h-10 bg-indigo-50 dark:bg-indigo-950 rounded-full items-center justify-center border border-neutral-200 dark:border-neutral-700">
                <Text className="text-sm font-bold text-indigo-600 dark:text-indigo-400">
                  {contractorName ? contractorName.charAt(0) : 'B'}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* ==================== Tab Navigation ==================== */}
        <View className="mt-4 px-4">
          <View className="bg-neutral-100 dark:bg-neutral-900 p-1.5 rounded-2xl border border-neutral-200/80 dark:border-neutral-800">
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View className="flex-row" style={{ gap: 6 }}>
                {TABS.map(tab => {
                  const isActive = activeTab === tab.key;
                  return (
                    <ScaleButton
                      key={tab.key}
                      onPress={() => setActiveTab(tab.key)}
                      className={`flex-row items-center px-4 py-2.5 rounded-xl transition-all ${
                        isActive
                          ? 'bg-white dark:bg-neutral-800 border border-neutral-200/60 dark:border-neutral-700'
                          : 'bg-transparent'
                      }`}
                      style={{ gap: 6 }}
                    >
                      <FontAwesome5
                        name={tab.icon}
                        size={13}
                        color={isActive ? (isDark ? '#818cf8' : '#4f46e5') : (isDark ? '#a3a3a3' : '#6b7280')}
                      />
                      <Text
                        className={`text-xs font-bold whitespace-nowrap ${
                          isActive
                            ? 'text-indigo-600 dark:text-indigo-400'
                            : 'text-neutral-600 dark:text-neutral-400'
                        }`}
                      >
                        {tab.label}
                      </Text>
                    </ScaleButton>
                  );
                })}
              </View>
            </ScrollView>
          </View>
        </View>

        {/* ==================== Tab Content ==================== */}
        <View className="px-4 py-6">

          {/* TAB: Today */}
          {activeTab === 'today' && (
            <View style={{ gap: 16 }}>
              {/* Operational Overview */}
              <OperationalOverviewCard
                contractorName={contractorName}
                activeJobsCount={jobs.filter((j: any) => ['funded_in_progress', 'partially_funded'].includes(j.status)).length}
                unreadConversationsCount={conversations.filter(c => c.unreadCount > 0).length}
                onViewSchedule={() => setActiveTab('calendar')}
                onViewEarnings={() => { setActiveTab('payments'); setPaymentSubTab('overview'); }}
              />

              {/* Trust & Verification Onboarding Status checklist */}
              <TrustActionRequiredCard
                onboardingComplete={onboardingComplete}
                licenseStatus={licenseStatus}
                stripeStatus={stripeStatus}
                onConnectStripe={() => { setActiveTab('payments'); setPaymentSubTab('overview'); }}
                onVerifyLicense={() => setShowEditProfile(true)}
              />

              {/* KPI Cards Grid */}
              <DashboardKpiGrid
                activeJobsCount={jobs.filter((j: any) => ['funded_in_progress', 'partially_funded'].includes(j.status)).length}
                unreadChatsCount={conversations.filter(c => c.unreadCount > 0).length}
                quotesCount={quotes.length}
                availableBalanceText={formatCurrency(((_earnings?.availableBalance ?? 0)) / 100)}
                onPressActiveJobs={() => { setActiveTab('payments'); setPaymentSubTab('jobs'); }}
                onPressUnreadChats={() => navigation.navigate('Main', { screen: 'Messages' } as any)}
                onPressQuotes={() => { setActiveTab('payments'); setPaymentSubTab('quotes'); }}
                onPressBalance={() => { setActiveTab('payments'); setPaymentSubTab('overview'); }}
              />

              {/* Recent Chats Section */}
              <View className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-4">
                <View className="flex-row items-center justify-between mb-3">
                  <Text className="text-sm font-bold text-neutral-900 dark:text-white">Recent Chats</Text>
                  <ScaleButton
                    onPress={() => navigation.navigate('Main', { screen: 'Messages' } as any)}
                    className="bg-indigo-50 dark:bg-indigo-950/40 px-2.5 py-1 rounded-lg"
                  >
                    <Text className="text-xs font-bold text-indigo-600 dark:text-indigo-400">View Inbox</Text>
                  </ScaleButton>
                </View>

                {(() => {
                  const recentChats = conversations
                    .map(c => {
                      const other = getOtherParticipant(c, currentUserId);
                      return {
                        ...c,
                        otherParticipant: other,
                        displayName: getDisplayName(other),
                      };
                    })
                    .sort((a, b) => {
                      const da = new Date(a.updatedAt || a.createdAt || 0).getTime();
                      const db = new Date(b.updatedAt || b.createdAt || 0).getTime();
                      return db - da;
                    })
                    .slice(0, 3);

                  if (recentChats.length === 0) {
                    return (
                      <Text className="text-xs text-neutral-400 dark:text-neutral-500 text-center py-4">No recent conversations.</Text>
                    );
                  }

                  return (
                    <View style={{ gap: 10 }}>
                      {recentChats.map(c => {
                        const otherPic = resolveParticipantAvatar(c.otherParticipant);
                        return (
                          <Pressable
                            key={c.conversationId || c._id}
                            onPress={() => {
                              const otherId = c.otherParticipant?._id || c.otherParticipant?.id;
                              if (otherId) {
                                navigation.navigate('ChatScreen', {
                                  recipientId: otherId,
                                  recipientName: c.displayName,
                                } as any);
                              }
                            }}
                            className="flex-row items-center bg-neutral-50 dark:bg-neutral-800/40 p-3 rounded-xl border border-neutral-100 dark:border-neutral-800/60"
                            style={{ gap: 10 }}
                          >
                            {otherPic ? (
                              <Image source={{ uri: otherPic }} className="w-8 h-8 rounded-full" />
                            ) : (
                              <View className="w-8 h-8 bg-indigo-100 dark:bg-indigo-950 rounded-full items-center justify-center">
                                <Text className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                                  {c.displayName ? c.displayName.charAt(0) : 'U'}
                                </Text>
                              </View>
                            )}
                            <View className="flex-1 min-w-0">
                              <View className="flex-row justify-between items-center">
                                <Text className="text-xs font-bold text-neutral-800 dark:text-neutral-200 truncate" numberOfLines={1}>
                                  {c.displayName}
                                </Text>
                                <Text className="text-[8px] text-neutral-400">{formatDate(c.updatedAt || c.createdAt)}</Text>
                              </View>
                              <Text className="text-[10px] text-neutral-500 dark:text-neutral-400 truncate mt-0.5" numberOfLines={1}>
                                {c.lastMessage?.messageText || 'Tap to view conversation'}
                              </Text>
                            </View>
                            {c.unreadCount > 0 && (
                              <View className="w-2 h-2 bg-indigo-600 rounded-full" />
                            )}
                          </Pressable>
                        );
                      })}
                    </View>
                  );
                })()}
              </View>

              {/* Upcoming Schedule */}
              <View className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-4">
                <View className="flex-row items-center justify-between mb-3">
                  <Text className="text-sm font-bold text-neutral-900 dark:text-white">Upcoming Schedule</Text>
                  <ScaleButton
                    onPress={() => setActiveTab('calendar')}
                    className="bg-indigo-50 dark:bg-indigo-950/40 px-2.5 py-1 rounded-lg"
                  >
                    <Text className="text-xs font-bold text-indigo-600 dark:text-indigo-400">View Calendar</Text>
                  </ScaleButton>
                </View>

                {(() => {
                  const upcomingJobs = jobs
                    .filter((j: any) => {
                      const d = getJobDate(j);
                      return d && d.getTime() >= new Date().setHours(0, 0, 0, 0);
                    })
                    .sort((a: any, b: any) => {
                      const da = getJobDate(a)?.getTime() || 0;
                      const db = getJobDate(b)?.getTime() || 0;
                      return da - db;
                    })
                    .slice(0, 2);

                  if (upcomingJobs.length === 0) {
                    return (
                      <Text className="text-xs text-neutral-400 dark:text-neutral-500 text-center py-4">No upcoming jobs scheduled.</Text>
                    );
                  }

                  return (
                    <View style={{ gap: 10 }}>
                      {upcomingJobs.map((j: any) => {
                        const date = getJobDate(j);
                        return (
                          <View key={j._id} className="flex-row items-center bg-neutral-50 dark:bg-neutral-800/40 p-3 rounded-xl border border-neutral-100 dark:border-neutral-800/60" style={{ gap: 12 }}>
                            <View className="bg-indigo-50 dark:bg-indigo-950/60 px-2.5 py-1.5 rounded-xl items-center justify-center" style={{ minWidth: 42 }}>
                              <Text className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase">
                                {date?.toLocaleDateString('en-US', { month: 'short' })}
                              </Text>
                              <Text className="text-sm font-black text-indigo-700 dark:text-indigo-300 mt-0.5">
                                {date?.getDate()}
                              </Text>
                            </View>
                            <View className="flex-1 min-w-0">
                              <Text className="text-xs font-bold text-neutral-800 dark:text-neutral-200 truncate">{j.title || 'Project'}</Text>
                              <Text className="text-[10px] text-neutral-500 dark:text-neutral-400 mt-0.5 truncate">
                                Client: {j.user ? `${j.user.firstName || ''} ${j.user.lastName || ''}`.trim() : 'Homeowner'}
                              </Text>
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  );
                })()}
              </View>
            </View>
          )}

          {/* TAB: Calendar */}
          {activeTab === 'calendar' && (
            <ContractorCalendarTab
              calendarDate={calendarDate}
              selectedDay={selectedDay}
              jobs={jobs}
              isDark={isDark}
              setCalendarDate={setCalendarDate}
              setSelectedDay={setSelectedDay}
              getJobDate={getJobDate}
            />
          )}

          {/* TAB: Public Profile */}
          {activeTab === 'profile' && (
            <View style={{ gap: 16 }}>
              {/* Secondary Sub-tabs */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-2">
                <View className="flex-row" style={{ gap: 6 }}>
                  {[
                    { key: 'posts', label: 'Posts' },
                    { key: 'about', label: 'About Us' },
                    { key: 'services', label: 'Services' },
                    { key: 'portfolio', label: 'Portfolio' },
                    { key: 'reviews', label: 'Reviews' },
                  ].map(subTab => (
                    <Pressable
                      key={subTab.key}
                      onPress={() => setProfileSubTab(subTab.key as any)}
                      style={({ pressed }) => ({
                        transform: [{ scale: pressed ? 0.96 : 1 }]
                      })}
                      className={`px-3 py-1.5 rounded-full ${
                        profileSubTab === subTab.key ? 'bg-neutral-900' : 'bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700'
                      }`}
                    >
                      <Text className={`text-xs font-semibold ${profileSubTab === subTab.key ? 'text-white' : 'text-neutral-600 dark:text-neutral-300'}`}>
                        {subTab.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </ScrollView>

              {/* Sub-tab content */}
              {profileSubTab === 'posts' && (
            <View style={{ gap: 16 }}>
              {/* Create Post Card */}
              <Pressable onPress={() => { setPostCategory(contractorCategory); setShowCreatePost(true); }} className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-700 p-4">
                <View className="flex-row items-center" style={{ gap: 8 }}>
                  <FontAwesome5 name="pen" size={14} color="#a3a3a3" />
                  <Text className="text-sm text-neutral-400 dark:text-neutral-500">What's new with your business?</Text>
                </View>
                <View className="flex-row mt-3 pt-3 border-t border-neutral-100 dark:border-neutral-800" style={{ gap: 16 }}>
                  <View className="flex-row items-center" style={{ gap: 4 }}>
                    <FontAwesome5 name="camera" size={14} color={isDark ? "#a3a3a3" : "#737373"} />
                    <Text className="text-xs text-neutral-500 dark:text-neutral-400 dark:text-neutral-500">Photo</Text>
                  </View>
                  <View className="flex-row items-center" style={{ gap: 4 }}>
                    <FontAwesome5 name="map-marker-alt" size={14} color={isDark ? "#a3a3a3" : "#737373"} />
                    <Text className="text-xs text-neutral-500 dark:text-neutral-400 dark:text-neutral-500">Location</Text>
                  </View>
                </View>
              </Pressable>

              {/* Posts Feed */}
              {posts.length === 0 ? (
                <EmptyState icon="file-alt" title="No posts yet" message="Share updates about your business" />
              ) : (
                <View style={{ gap: 14 }}>
                  {posts.map(post => (
                    <View key={post._id} className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-100 dark:border-neutral-800 overflow-hidden shadow-sm">
                      
                      {/* Post Card Header */}
                      <View className="p-4 flex-row items-start justify-between border-b border-neutral-50 dark:border-neutral-800">
                        <View className="flex-row items-center" style={{ gap: 10 }}>
                          {avatarUrl ? (
                            <Image source={{ uri: avatarUrl }} className="w-9 h-9 rounded-full border border-neutral-100 dark:border-neutral-800" />
                          ) : (
                            <View className="w-9 h-9 bg-indigo-50 dark:bg-indigo-950 rounded-full items-center justify-center">
                              <Text className="text-sm font-bold text-indigo-600 dark:text-indigo-400">
                                {contractorName ? contractorName.charAt(0) : 'B'}
                              </Text>
                            </View>
                          )}
                          <View>
                            <Text className="text-sm font-bold text-neutral-900 dark:text-white leading-tight">{contractorName || 'My Business'}</Text>
                            <View className="flex-row items-center mt-1" style={{ gap: 6 }}>
                              <Text className="text-[10px] text-neutral-400 dark:text-neutral-500">{formatDate(post.createdAt)}</Text>
                              {post.location && (
                                <>
                                  <Text className="text-neutral-300 dark:text-neutral-600 text-[8px]">•</Text>
                                  <View className="flex-row items-center bg-emerald-50 dark:bg-emerald-950/50 px-1.5 py-0.5 rounded-md" style={{ gap: 2 }}>
                                    <FontAwesome5 name="map-marker-alt" size={8} color="#059669" />
                                    <Text className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400">{post.location}</Text>
                                  </View>
                                </>
                              )}
                            </View>
                          </View>
                        </View>
                        
                        <Pressable 
                          onPress={() => handleDeletePost(post._id)}
                          className="p-1.5 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800"
                        >
                          <FontAwesome5 name="trash" size={12} color="#a3a3a3" />
                        </Pressable>
                      </View>

                      {/* Post Card Image */}
                      {post.images?.length > 0 && (
                        <View className="aspect-video bg-neutral-100 dark:bg-neutral-850">
                          <Image source={{ uri: post.images[0] }} className="w-full h-full" resizeMode="cover" />
                        </View>
                      )}

                      {/* Post Card Body */}
                      <View className="p-4">
                        <Text className="text-sm text-neutral-800 dark:text-neutral-200" style={{ lineHeight: 20 }}>
                          {post.caption}
                        </Text>
                        
                        {/* Post Card Tags */}
                        {post.tags && post.tags.length > 0 && (
                          <View className="flex-row flex-wrap mt-3" style={{ gap: 6 }}>
                            {post.tags.map((tag: string, idx: number) => (
                              <View key={idx} className="flex-row items-center border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 px-2.5 py-1 rounded-full" style={{ gap: 4, marginRight: 4, marginBottom: 4 }}>
                                {getMobileTagIcon(tag)}
                                <Text className="text-[10px] font-bold text-neutral-700 dark:text-neutral-300">{tag}</Text>
                              </View>
                            ))}
                          </View>
                        )}
                      </View>

                    </View>
                  ))}
                </View>
              )}
            </View>
          )}
          {profileSubTab === 'about' && (
            <View style={{ gap: 16 }}>
              <View className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-700 p-5">
                <Text className="text-base font-semibold text-neutral-900 dark:text-white mb-3">About Us</Text>
                <Text className="text-sm text-neutral-700 dark:text-neutral-300 leading-5">
                  {editableData.description || 'No description provided yet. Click "Edit Profile" to add your bio.'}
                </Text>
              </View>

              <View className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-700 p-5">
                <Text className="text-base font-semibold text-neutral-900 dark:text-white mb-3">Pricing</Text>
                <Text className="text-sm text-neutral-700 dark:text-neutral-300">{editableData.pricing || 'Contact for pricing'}</Text>
              </View>

              <View className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-700 p-5">
                <Text className="text-base font-semibold text-neutral-900 dark:text-white mb-3">Service Areas</Text>
                <ServiceAreaMap
                  businessName={contractorName || 'My Business'}
                  locationName={editableData.address}
                  zipCodes={editableData.zipCodes}
                  height={160}
                />
                {editableData.zipCodes.length > 0 ? (
                  <View className="flex-row flex-wrap mt-3" style={{ gap: 8 }}>
                    {editableData.zipCodes.map(zip => (
                      <View key={zip} className="bg-neutral-100 dark:bg-neutral-800 px-3 py-1.5 rounded-full">
                        <Text className="text-xs font-medium text-neutral-600 dark:text-neutral-300">{zip}</Text>
                      </View>
                    ))}
                  </View>
                ) : (
                  <Text className="text-sm text-neutral-500 dark:text-neutral-400 dark:text-neutral-500 italic mt-2">No service areas listed — edit your profile to add zip codes</Text>
                )}
              </View>

              <View className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-700 p-5">
                <Text className="text-base font-semibold text-neutral-900 dark:text-white mb-3">Business Hours</Text>
                {DAYS.map(day => {
                  const h = hours[day];
                  const isOpen = h?.isOpen !== false;
                  return (
                    <View key={day} className="flex-row justify-between py-2 border-b border-neutral-100 dark:border-neutral-800">
                      <Text className="text-sm text-neutral-600 dark:text-neutral-300">{day}</Text>
                      <Text className="text-sm text-neutral-900 dark:text-white font-medium">
                        {isOpen ? `${formatTimeDisplay(h?.open || '09:00')} - ${formatTimeDisplay(h?.close || '17:00')}` : 'Closed'}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>
          )}
          {profileSubTab === 'services' && (
            <View>
              <Text className="text-base font-semibold text-neutral-900 dark:text-white mb-4">Services Offered</Text>
              {editableData.servicesOffered.length === 0 ? (
                <EmptyState icon="briefcase" title="No services listed" message="Edit your profile to add services" />
              ) : (
                <View style={{ gap: 12 }}>
                  {editableData.servicesOffered.map((service, idx) => (
                    <View key={idx} className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-700 p-4">
                      <Text className="text-sm font-bold text-neutral-900 dark:text-white">{service.name}</Text>
                      {service.description ? (
                        <Text className="text-xs text-neutral-500 dark:text-neutral-400 dark:text-neutral-500 mt-1">{service.description}</Text>
                      ) : null}
                      {service.contactForQuote ? (
                        <Text className="text-xs font-semibold text-indigo-600 mt-2">Contact for Quote</Text>
                      ) : (service.minPrice || service.maxPrice) ? (
                        <Text className="text-xs font-semibold text-indigo-600 mt-2">
                          {service.minPrice && service.maxPrice
                            ? `$${Number(service.minPrice).toLocaleString()} – $${Number(service.maxPrice).toLocaleString()}`
                            : service.minPrice
                            ? `$${Number(service.minPrice).toLocaleString()}+`
                            : `Up to $${Number(service.maxPrice).toLocaleString()}`}
                        </Text>
                      ) : null}
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}
          {profileSubTab === 'portfolio' && (
            <View>
              <View className="flex-row items-center justify-between mb-4">
                <Text className="text-base font-semibold text-neutral-900 dark:text-white">Portfolio</Text>
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
                    <View key={item._id || i} className="w-[48%] bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-700 overflow-hidden">
                      {item.imageUrl ? (
                        <Image source={{ uri: item.imageUrl }} className="w-full h-28" resizeMode="cover" />
                      ) : (
                        <View className="w-full h-28 bg-neutral-100 dark:bg-neutral-800 items-center justify-center">
                          <FontAwesome5 name="image" size={24} color="#d4d4d4" />
                        </View>
                      )}
                      <View className="p-3">
                        <Text className="text-sm font-semibold text-neutral-900 dark:text-white">{item.name || 'Untitled'}</Text>
                        {item.description ? (
                          <Text className="text-xs text-neutral-500 dark:text-neutral-400 dark:text-neutral-500 mt-0.5" numberOfLines={2}>{item.description}</Text>
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
          {profileSubTab === 'reviews' && (
            <View style={{ gap: 16 }}>
              {/* Overall Rating */}
              <View className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-700 p-5 flex-row items-center" style={{ gap: 24 }}>
                <View className="items-center">
                  <Text className="text-4xl font-bold text-neutral-900 dark:text-white">{avgRating > 0 ? avgRating.toFixed(1) : '—'}</Text>
                  <StarRating rating={avgRating} size={16} />
                  <Text className="text-xs text-neutral-500 dark:text-neutral-400 dark:text-neutral-500 mt-1">Overall</Text>
                </View>
                <View className="flex-1" style={{ gap: 4 }}>
                  {ratingBreakdown.map(r => (
                    <View key={r.stars} className="flex-row items-center" style={{ gap: 6 }}>
                      <Text className="text-xs text-neutral-500 dark:text-neutral-400 dark:text-neutral-500 w-3">{r.stars}</Text>
                      <FontAwesome5 name="star" solid size={10} color="#eab308" />
                      <View className="flex-1 h-1.5 bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                        <View className="h-full bg-yellow-500 rounded-full" style={{ width: `${r.pct}%` }} />
                      </View>
                      <Text className="text-xs text-neutral-400 dark:text-neutral-500 w-6 text-right">{r.count}</Text>
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
                    <View key={review._id} className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-700 p-5">
                      <View className="flex-row items-center" style={{ gap: 10 }}>
                        <Image
                          source={{ uri: review.user?.profilePicture || '' }}
                          className="w-10 h-10 rounded-full bg-neutral-100 dark:bg-neutral-800"
                        />
                        <View className="flex-1">
                          <Text className="text-sm font-semibold text-neutral-900 dark:text-white">
                            {review.user?.firstName || ''} {review.user?.lastName || ''}
                          </Text>
                          <StarRating rating={review.rating} size={10} />
                        </View>
                        <Text className="text-xs text-neutral-400 dark:text-neutral-500">{formatDate(review.createdAt)}</Text>
                      </View>
                      <Text className="text-sm text-neutral-700 dark:text-neutral-300 mt-3">{review.comment || review.title || ''}</Text>

                      {/* Reply Section */}
                      <View className="mt-4 pt-3 border-t border-neutral-100 dark:border-neutral-800">
                        {review.reply ? (
                          <View className="bg-neutral-50 dark:bg-neutral-800/40 p-3 rounded-lg border border-neutral-100 dark:border-neutral-800">
                            <View className="flex-row items-center mb-1" style={{ gap: 6 }}>
                              <FontAwesome5 name="comment-dots" size={12} color="#4F46E5" />
                              <Text className="text-xs font-bold text-neutral-800 dark:text-neutral-200">Your Response:</Text>
                            </View>
                            <Text className="text-xs text-neutral-600 dark:text-neutral-400 leading-5">{review.reply}</Text>
                          </View>
                        ) : activeReplyReviewId === review._id ? (
                          <View style={{ gap: 8 }}>
                            <TextInput
                              value={replyText}
                              onChangeText={setReplyText}
                              placeholder="Write your response to this client feedback..."
                              placeholderTextColor="#a3a3a3"
                              multiline
                              numberOfLines={3}
                              className="w-full text-xs p-2.5 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white"
                              style={{ textAlignVertical: 'top', minHeight: 60 }}
                            />
                            <View className="flex-row justify-end" style={{ gap: 8 }}>
                              <Pressable
                                onPress={() => { setActiveReplyReviewId(null); setReplyText(''); }}
                                className="px-3 py-1.5 rounded-lg bg-neutral-100 dark:bg-neutral-800"
                              >
                                <Text className="text-[10px] font-semibold text-neutral-600 dark:text-neutral-300">Cancel</Text>
                              </Pressable>
                              <Pressable
                                onPress={() => handleRespondToReview(review._id)}
                                disabled={!replyText.trim() || replySubmitting}
                                className={`px-4 py-1.5 rounded-lg flex-row items-center ${
                                  (!replyText.trim() || replySubmitting) ? 'bg-indigo-300' : 'bg-indigo-600'
                                }`}
                                style={{ gap: 6 }}
                              >
                                {replySubmitting && <BouncingDotsLoader size="small" color="#fff" style={{ marginRight: 4 }} />}
                                <Text className="text-[10px] font-semibold text-white">Submit</Text>
                              </Pressable>
                            </View>
                          </View>
                        ) : (
                          <Pressable
                            onPress={() => { setActiveReplyReviewId(review._id); setReplyText(''); }}
                            className="flex-row items-center"
                            style={{ gap: 6 }}
                          >
                            <FontAwesome5 name="reply" size={10} color="#4F46E5" />
                            <Text className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">Reply to Review</Text>
                          </Pressable>
                        )}
                      </View>
                    </View>
                  ))}
                </View>
              )}
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
                    { key: 'quotes', label: 'Quotes' },
                    { key: 'jobs', label: 'Jobs' },
                  ].map(tab => (
                    <Pressable
                      key={tab.key}
                      onPress={() => setPaymentSubTab(tab.key)}
                      className={`shrink-0 px-3 py-1.5 rounded-full flex-row items-center ${
                        paymentSubTab === tab.key ? 'bg-neutral-900' : 'bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700'
                      }`}
                      style={{ gap: 4 }}
                    >
                      <Text className={`text-xs font-semibold ${paymentSubTab === tab.key ? 'text-white' : 'text-neutral-600 dark:text-neutral-300'}`}>
                        {tab.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </ScrollView>

              {/* Overview */}
              {paymentSubTab === 'overview' && (
                <View style={{ gap: 12 }}>
                  {/* Stripe Connect */}
                  <View className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-700 p-5">
                    <View className="flex-row items-center justify-between">
                      <View className="flex-row items-center" style={{ gap: 12 }}>
                        <View className={`w-10 h-10 rounded-lg items-center justify-center ${
                          stripeStatus?.chargesEnabled
                            ? 'bg-emerald-50'
                            : stripeStatus?.connected
                            ? 'bg-amber-50'
                            : 'bg-indigo-50'
                        }`}>
                          <FontAwesome5
                            name={stripeStatus?.chargesEnabled ? 'check-circle' : stripeStatus?.connected ? 'clock' : 'credit-card'}
                            size={16}
                            color={stripeStatus?.chargesEnabled ? '#059669' : stripeStatus?.connected ? '#d97706' : '#4F46E5'}
                          />
                        </View>
                        <View>
                          <Text className="text-sm font-semibold text-neutral-900 dark:text-white">Stripe Connect</Text>
                          <Text className="text-xs text-neutral-500 dark:text-neutral-400">
                            {stripeStatus?.chargesEnabled
                              ? 'Connected & Active'
                              : stripeStatus?.connected
                              ? stripeStatus.requirements?.pastDue?.length
                                ? 'Action required'
                                : 'Pending verification'
                              : 'Not connected'}
                          </Text>
                        </View>
                      </View>
                      {!stripeStatus?.chargesEnabled && (
                        <Pressable
                          onPress={async () => {
                            if (isStripeConnecting) return;
                            
                            const runStripeConnect = async (businessType: 'individual' | 'company') => {
                              setIsStripeConnecting(true);
                              try {
                                const { url } = await getStripeConnectUrl(businessType, 'contractor-dashboard');
                                let result;
                                try {
                                  result = await WebBrowser.openAuthSessionAsync(url, 'ratedeed://contractor-dashboard');
                                } catch (browserError: any) {
                                  if (browserError?.message?.toLowerCase().includes('already open')) {
                                    try { await WebBrowser.dismissBrowser(); } catch {}
                                    Alert.alert(
                                      'Browser Already Open',
                                      'Please close any open browser windows and try again, or open Stripe setup in your default browser.',
                                      [
                                        { text: 'Cancel', style: 'cancel' },
                                        { text: 'Open in Browser', onPress: () => Linking.openURL(url) }
                                      ]
                                    );
                                    return;
                                  }
                                  throw browserError;
                                }

                                const returned = result.type === 'success' || result.type === 'cancel';
                                if (returned) {
                                  await loadData();
                                  const latest = await getStripeAccountStatus().catch(() => null);
                                  if (latest?.chargesEnabled) {
                                    Alert.alert(
                                      "You're Approved!",
                                      'Your Stripe account is fully verified and ready to receive payments.',
                                      [{ text: 'Awesome' }]
                                    );
                                  } else if (latest?.connected) {
                                    const due = latest.requirements?.currentlyDue || [];
                                    const pastDue = latest.requirements?.pastDue || [];
                                    const reason = latest.requirements?.disabledReason || latest.disabledReason;
                                    let message = 'Your Stripe account is still pending verification. We\'ll notify you once it\'s approved.';
                                    if (pastDue.length > 0) {
                                      message = `Stripe needs additional information to verify your account:\n\n• ${pastDue.join('\n• ')}\n\nPlease tap "Continue Setup" to fix these issues.`;
                                    } else if (due.length > 0) {
                                      message = `Stripe still needs a few things from you to finish verification:\n\n• ${due.join('\n• ')}\n\nPlease tap "Continue Setup" to provide them.`;
                                    } else if (reason) {
                                      message = `Stripe couldn't fully verify your account (${reason}). Please tap "Continue Setup" to provide the missing information.`;
                                    } else if (latest.message) {
                                      message = `${latest.message}\n\nPlease tap "Continue Setup" to finish.`;
                                    }
                                    Alert.alert(
                                      pastDue.length > 0 ? 'Action Required' : 'Verification Pending',
                                      message,
                                      [{ text: 'OK' }]
                                    );
                                  } else {
                                    Alert.alert(
                                      'Verification Submitted',
                                      'Your information was submitted to Stripe. It can take a few minutes for them to verify your account.',
                                      [{ text: 'Got it' }]
                                    );
                                  }
                                }
                              } catch (e) {
                                Alert.alert('Stripe Error', (e as any)?.message || 'Failed to connect Stripe. Check your internet connection and try again.');
                              } finally {
                                setIsStripeConnecting(false);
                              }
                            };

                            Alert.alert(
                              'Stripe Onboarding',
                              'Would you like to register as an Individual/Sole Proprietor or as a Company/LLC?',
                              [
                                { text: 'Cancel', style: 'cancel' },
                                { text: 'Individual (SSN)', onPress: () => runStripeConnect('individual') },
                                { text: 'Company (EIN)', onPress: () => runStripeConnect('company') }
                              ]
                            );
                          }}
                          disabled={isStripeConnecting}
                          className={`px-3 py-2 rounded-lg flex-row items-center ${
                            isStripeConnecting
                              ? 'bg-indigo-400'
                              : stripeStatus?.requirements?.pastDue?.length
                              ? 'bg-amber-500'
                              : 'bg-indigo-600'
                          }`}
                          style={{ gap: 6 }}
                        >
                          {isStripeConnecting ? (
                            <>
                              <BouncingDotsLoader size="small" color="#fff" />
                              <Text className="text-xs font-semibold text-white">Pending…</Text>
                            </>
                          ) : (
                            <Text className="text-xs font-semibold text-white">
                              {stripeStatus?.connected
                                ? stripeStatus.requirements?.pastDue?.length
                                  ? 'Fix Now'
                                  : 'Continue'
                                : 'Connect'}
                            </Text>
                          )}
                        </Pressable>
                      )}
                    </View>
                    {stripeStatus?.connected && !stripeStatus?.chargesEnabled && (
                      <View className="mt-3 pt-3 border-t border-neutral-100 dark:border-neutral-800">
                        {stripeStatus.requirements?.pastDue?.length ? (
                          <Text className="text-xs text-amber-700 dark:text-amber-400 leading-4">
                            <Text className="font-bold">Action required: </Text>
                            {stripeStatus.requirements.pastDue.join(', ')}. Tap "Fix Now" to update.
                          </Text>
                        ) : stripeStatus.disabledReason ? (
                          <Text className="text-xs text-amber-700 dark:text-amber-400 leading-4">
                            <Text className="font-bold">Reason: </Text>
                            {stripeStatus.disabledReason}
                          </Text>
                        ) : (
                          <Text className="text-xs text-neutral-500 dark:text-neutral-400 leading-4">
                            Stripe is reviewing your info. This usually takes a few minutes.
                          </Text>
                        )}
                      </View>
                    )}
                  </View>

                  {/* Stats */}
                  <View className="flex-row" style={{ gap: 8 }}>
                    <View className="flex-1 bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-700 p-4">
                      <View className="flex-row items-center" style={{ gap: 4 }}>
                        <FontAwesome5 name="wallet" size={12} color="#059669" />
                        <Text className="text-xs text-neutral-500 dark:text-neutral-400 dark:text-neutral-500 font-medium">Available</Text>
                      </View>
                      <Text className="text-xl font-bold text-neutral-900 dark:text-white mt-1">{formatCurrency(((_earnings?.availableBalance ?? 0)) / 100)}</Text>
                      <Text className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-0.5">Withdrawable now</Text>
                    </View>
                    <View className="flex-1 bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-700 p-4">
                      <View className="flex-row items-center" style={{ gap: 4 }}>
                        <FontAwesome5 name="shield-alt" size={12} color="#d97706" />
                        <Text className="text-xs text-neutral-500 dark:text-neutral-400 dark:text-neutral-500 font-medium">In Escrow</Text>
                      </View>
                      <Text className="text-xl font-bold text-neutral-900 dark:text-white mt-1">{formatCurrency(pendingEscrow / 100)}</Text>
                      <Text className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-0.5">Pending release</Text>
                    </View>
                    <View className="flex-1 bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-700 p-4">
                      <View className="flex-row items-center" style={{ gap: 4 }}>
                        <FontAwesome5 name="chart-line" size={12} color="#4F46E5" />
                        <Text className="text-xs text-neutral-500 dark:text-neutral-400 dark:text-neutral-500 font-medium">Total Earned</Text>
                      </View>
                      <Text className="text-xl font-bold text-neutral-900 dark:text-white mt-1">{formatCurrency(((_earnings?.totalEarned ?? totalEarnings)) / 100)}</Text>
                      <Text className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-0.5">Lifetime (net)</Text>
                    </View>
                  </View>

                  {/* Withdraw / View Earnings */}
                  <Pressable
                    onPress={() => navigation.navigate('EarningsScreen')}
                    className="mt-3 flex-row items-center justify-between bg-neutral-900 dark:bg-neutral-100 rounded-xl px-4 py-3.5"
                    style={{ gap: 8 }}
                  >
                    <View className="flex-row items-center" style={{ gap: 10 }}>
                      <View className="w-9 h-9 rounded-lg bg-white/10 dark:bg-neutral-900/10 items-center justify-center">
                        <FontAwesome5 name="wallet" size={14} color="#fff" />
                      </View>
                      <View>
                        <Text className="text-sm font-bold text-white dark:text-neutral-900">Earnings & Withdrawals</Text>
                        <Text className="text-[11px] text-neutral-400 dark:text-neutral-500">
                          {_earnings?.availableBalance
                            ? `Available: ${formatCurrency(_earnings.availableBalance / 100)} · Tap to withdraw`
                            : 'View balance, payouts & transactions'}
                        </Text>
                      </View>
                    </View>
                    <FontAwesome5 name="chevron-right" size={12} color={isDark ? '#a3a3a3' : '#fff'} />
                  </Pressable>
                </View>
              )}

              {/* Quotes */}
              {paymentSubTab === 'quotes' && (
                <View>
                  <Text className="text-base font-semibold text-neutral-900 dark:text-white mb-3">Quotes Sent</Text>
                  {quotes.length === 0 ? (
                    <EmptyState icon="file-alt" title="No quotes sent" message="Quotes you send to clients will appear here" />
                  ) : (
                    <View style={{ gap: 10 }}>
                      {quotes.map(quote => (
                        <View key={quote._id} className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-700 p-4 flex-row justify-between items-center">
                          <View>
                            <Text className="text-sm font-semibold text-neutral-900 dark:text-white">
                              {quote.user?.firstName || ''} {quote.user?.lastName || ''}
                            </Text>
                            <Text className="text-sm text-neutral-600 dark:text-neutral-300">{formatCurrency(quote.totalAmount / 100)}</Text>
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
                  <View className="flex-row items-center justify-between mb-3">
                    <Text className="text-base font-semibold text-neutral-900 dark:text-white">Active Jobs</Text>
                    {activeJobsCount > 0 && (
                      <View className="bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded-full">
                        <Text className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400">{activeJobsCount}</Text>
                      </View>
                    )}
                  </View>
                  {jobs.length === 0 ? (
                    <EmptyState icon="briefcase" title="No jobs yet" message="Jobs will appear here when work begins" />
                  ) : (
                    <View style={{ gap: 10 }}>
                      {jobs.map(job => (
                        <Pressable key={job._id} onPress={() => navigation.navigate('JobDetail', { jobId: job._id })} className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-700 p-4 active:bg-neutral-50 dark:active:bg-neutral-800">
                          <View className="flex-row justify-between items-start">
                            <View>
                              <Text className="text-sm font-semibold text-neutral-900 dark:text-white">{job.title || job.projectTitle || job.quote?.projectTitle || job.quote?.projectName || 'Job'}</Text>
                              <Text className="text-sm text-neutral-600 dark:text-neutral-300">{formatCurrency((job.totalAmount || job.amount || job.quote?.totalAmount || job.quote?.subtotal || job.amountFunded || 0) / 100)}</Text>
                            </View>
                            <View className="flex-row items-center" style={{ gap: 6 }}>
                              <StatusBadge status={job.status} />
                              <FontAwesome5 name="chevron-right" size={10} color="#a3a3a3" />
                            </View>
                          </View>
                          <Text className="text-xs text-neutral-400 dark:text-neutral-500 mt-2">{formatDate(job.createdAt)}</Text>
                        </Pressable>
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
              onViewAllJobs={() => {
                setActiveTab('payments');
                setPaymentSubTab('jobs');
              }}
            />
          )}

          {/* TAB: Promote */}
          {activeTab === 'promote' && (
            <View className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-700 p-5">
              <Text className="text-base font-semibold text-neutral-900 dark:text-white mb-2">Share Your Profile</Text>
              <Text className="text-sm text-neutral-600 dark:text-neutral-300 mb-4">
                Copy your direct profile link to share with clients or add to your social media bios.
              </Text>
              <View className="flex-row items-center bg-neutral-100 dark:bg-neutral-800 rounded-lg px-3 mb-4">
                <Text className="flex-1 text-sm text-neutral-500 dark:text-neutral-400 py-3" numberOfLines={1}>
                  https://www.ratedeed.com/c/{editableData.slug || 'my-profile'}
                </Text>
                <Pressable 
                  onPress={async () => {
                    await Clipboard.setStringAsync(`https://www.ratedeed.com/c/${editableData.slug || ''}`);
                    Alert.alert('Copied!', 'Profile link copied to clipboard.');
                  }} 
                  className="p-2"
                >
                  <FontAwesome5 name="copy" size={14} color={isDark ? "#a3a3a3" : "#737373"} />
                </Pressable>
              </View>
              <View className="flex-row justify-center" style={{ gap: 16 }}>
                {[
                  { name: 'facebook-f', color: '#1877F2', url: `https://www.facebook.com/sharer/sharer.php?u=https://www.ratedeed.com/c/${editableData.slug}` },
                  { name: 'x-twitter', color: '#000000', url: `https://twitter.com/intent/tweet?url=https://www.ratedeed.com/c/${editableData.slug}` },
                  { name: 'linkedin-in', color: '#0A66C2', url: `https://www.linkedin.com/sharing/share-offsite/?url=https://www.ratedeed.com/c/${editableData.slug}` },
                  { name: 'whatsapp', color: '#25D366', url: `whatsapp://send?text=Check out my profile on Ratedeed: https://www.ratedeed.com/c/${editableData.slug}` },
                ].map(social => (
                  <Pressable 
                    key={social.name} 
                    onPress={() => {
                      Linking.openURL(social.url).catch(() => {
                        Alert.alert('Error', 'Could not open sharing app.');
                      });
                    }} 
                    className="w-11 h-11 rounded-full items-center justify-center" 
                    style={{ backgroundColor: social.color }}
                  >
                    <FontAwesome5 name={social.name} size={16} color="#fff" />
                  </Pressable>
                ))}
              </View>
            </View>
          )}
        </View>

        <View className="h-20" />
      </BouncingRefreshScrollView>

      {/* ==================== CREATE POST SHEET ==================== */}
      <Sheet visible={showCreatePost} onClose={() => setShowCreatePost(false)} title="Create Post">
        <Text className="text-xs font-bold text-neutral-600 dark:text-neutral-300 mb-1.5">Caption</Text>
        <TextInput
          value={postCaption}
          onChangeText={setPostCaption}
          placeholder="Share an update, recent project details, or announcements with homeowners..."
          placeholderTextColor="#a3a3a3"
          multiline
          numberOfLines={3}
          className="w-full border border-neutral-200 dark:border-neutral-700 rounded-xl px-4 py-3 text-sm mb-4 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white"
          style={{ textAlignVertical: 'top', minHeight: 90 }}
        />

        <Text className="text-xs font-bold text-neutral-600 dark:text-neutral-300 mb-2">Project Category</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4" style={{ marginBottom: 16 }}>
          <View className="flex-row" style={{ gap: 8 }}>
            {CATEGORIES_LIST.map(cat => {
              const isSelected = postCategory === cat.id;
              return (
                <Pressable
                  key={cat.id}
                  onPress={() => {
                    setPostCategory(cat.id);
                    setPostTags([]); // Clear tags when category changes
                  }}
                  className={`px-3 py-1.5 rounded-full border ${
                    isSelected
                      ? 'bg-indigo-600 border-indigo-600'
                      : 'bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-700'
                  }`}
                >
                  <Text className={`text-xs font-bold ${isSelected ? 'text-white' : 'text-neutral-600 dark:text-neutral-300'}`}>
                    {cat.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>

        <Text className="text-xs font-bold text-neutral-600 dark:text-neutral-300 mb-2">Select Tags</Text>
        <View className="flex-row flex-wrap mb-4" style={{ gap: 8, marginBottom: 16 }}>
          {(TAG_MAP[postCategory] || TAG_MAP.general).map((tag: string) => {
            const isSelected = postTags.includes(tag);
            return (
              <Pressable
                key={tag}
                onPress={() => {
                  setPostTags(prev =>
                    prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
                  );
                }}
                className={`px-3 py-1.5 rounded-full border ${
                  isSelected
                    ? 'bg-indigo-600 border-indigo-600'
                    : 'bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-700'
                }`}
              >
                <Text className={`text-xs font-bold ${isSelected ? 'text-white' : 'text-neutral-600 dark:text-neutral-300'}`}>
                  {tag}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text className="text-xs font-bold text-neutral-600 dark:text-neutral-300 mb-1.5">Location</Text>
        <View className="w-full flex-row items-center border border-neutral-200 dark:border-neutral-700 rounded-xl px-3 mb-4 bg-white dark:bg-neutral-900">
          <FontAwesome5 name="map-marker-alt" size={12} color="#a3a3a3" style={{ marginRight: 8 }} />
          <TextInput
            value={postLocation}
            onChangeText={setPostLocation}
            placeholder="Job location (city/neighborhood)"
            placeholderTextColor="#a3a3a3"
            className="flex-1 py-2 text-sm text-neutral-900 dark:text-white"
          />
        </View>

        <Text className="text-xs font-bold text-neutral-600 dark:text-neutral-300 mb-1.5">Photos</Text>
        <Pressable
          onPress={handleAddImage}
          disabled={imageLoading}
          className="w-full border border-dashed border-neutral-200 dark:border-neutral-700 rounded-xl p-4 items-center justify-center mb-5 min-h-[90px] bg-neutral-50/50 dark:bg-neutral-900/50"
        >
          {postImages.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="w-full">
              <View className="flex-row" style={{ gap: 10 }}>
                {postImages.map((img, idx) => (
                  <View key={idx} className="w-16 h-16 rounded-xl overflow-hidden relative border border-neutral-100 dark:border-neutral-800">
                    <Image source={{ uri: img }} className="w-full h-full" />
                    <Pressable
                      onPress={() => setPostImages(prev => prev.filter((_, i) => i !== idx))}
                      className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/75 items-center justify-center"
                    >
                      <FontAwesome5 name="times" size={8} color="#fff" />
                    </Pressable>
                  </View>
                ))}
                <View className="w-16 h-16 rounded-xl border border-dashed border-neutral-300 flex items-center justify-center bg-white dark:bg-neutral-800">
                  <FontAwesome5 name="plus" size={12} color="#a3a3a3" />
                </View>
              </View>
            </ScrollView>
          ) : (
            <View className="items-center" style={{ gap: 6 }}>
              <FontAwesome5 name="images" size={18} color="#a3a3a3" />
              <Text className="text-xs font-bold text-neutral-700 dark:text-neutral-300">{imageLoading ? 'Uploading...' : 'Tap to upload photos'}</Text>
              <Text className="text-[10px] text-neutral-400 dark:text-neutral-500">Showcase your recent job (max 3MB per file)</Text>
            </View>
          )}
        </Pressable>

        <Pressable
          onPress={handleCreatePost}
          disabled={!postCaption.trim() || postSubmitting}
          className={`w-full py-3.5 rounded-xl items-center flex-row justify-center shadow-sm ${
            postCaption.trim() ? 'bg-indigo-600' : 'bg-neutral-100 dark:bg-neutral-800'
          }`}
          style={{ gap: 8 }}
        >
          {postSubmitting ? (
            <BouncingDotsLoader size="small" color="#fff" />
          ) : (
            <FontAwesome5 name="paper-plane" size={12} color={postCaption.trim() ? '#fff' : '#a3a3a3'} />
          )}
          <Text className={`text-sm font-bold ${postCaption.trim() ? 'text-white' : 'text-neutral-400 dark:text-neutral-500'}`}>
            {postSubmitting ? 'Publishing...' : 'Publish Update'}
          </Text>
        </Pressable>
      </Sheet>

      {/* ==================== ADD PORTFOLIO SHEET ==================== */}
      <Sheet visible={showAddPortfolio} onClose={() => setShowAddPortfolio(false)} title="Add Portfolio Project">
        <Text className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 dark:text-neutral-500 mb-1">Project Name</Text>
        <TextInput
          value={portfolioItem.name}
          onChangeText={t => setPortfolioItem(p => ({ ...p, name: t }))}
          placeholder="e.g., Modern Kitchen Remodel"
          placeholderTextColor="#a3a3a3"
          className="w-full border border-neutral-200 dark:border-neutral-700 rounded-xl px-4 py-2.5 text-sm mb-3"
        />
        <Text className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 dark:text-neutral-500 mb-1">Description</Text>
        <TextInput
          value={portfolioItem.description}
          onChangeText={t => setPortfolioItem(p => ({ ...p, description: t }))}
          placeholder="Describe the project..."
          placeholderTextColor="#a3a3a3"
          multiline
          numberOfLines={3}
          className="w-full border border-neutral-200 dark:border-neutral-700 rounded-xl px-4 py-2.5 text-sm mb-3"
          style={{ textAlignVertical: 'top', minHeight: 80 }}
        />
        <Text className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 dark:text-neutral-500 mb-1">Project Image</Text>
        <Pressable
          onPress={handleAddPortfolioImage}
          disabled={imageLoading}
          className="w-full border-2 border-dashed border-neutral-200 dark:border-neutral-700 rounded-lg p-5 items-center mb-3 overflow-hidden"
        >
          {portfolioItem.imageUrl ? (
            <Image source={{ uri: portfolioItem.imageUrl }} className="w-full h-32 rounded-lg" resizeMode="cover" />
          ) : (
            <View className="items-center" style={{ gap: 6 }}>
              <FontAwesome5 name="camera" size={20} color="#a3a3a3" />
              <Text className="text-sm text-neutral-500 dark:text-neutral-400 dark:text-neutral-500">{imageLoading ? 'Uploading...' : 'Upload project photo'}</Text>
            </View>
          )}
        </Pressable>
        <Text className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 dark:text-neutral-500 mb-1">Image URL (Optional)</Text>
        <TextInput
          value={portfolioItem.imageUrl}
          onChangeText={t => setPortfolioItem(p => ({ ...p, imageUrl: t }))}
          placeholder="https://..."
          placeholderTextColor="#a3a3a3"
          className="w-full border border-neutral-200 dark:border-neutral-700 rounded-xl px-4 py-2.5 text-sm mb-3"
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
          {portfolioSubmitting && <BouncingDotsLoader size="small" color="#fff" />}
          <Text className={`text-sm font-semibold ${portfolioItem.name.trim() ? 'text-white' : 'text-neutral-400 dark:text-neutral-500'}`}>
            {portfolioSubmitting ? 'Adding...' : 'Add Project'}
          </Text>
        </Pressable>
      </Sheet>

      {/* ==================== EDIT PROFILE SHEET ==================== */}
      <Sheet visible={showEditProfile} onClose={() => setShowEditProfile(false)} title="Edit Profile">
        {/* Banner & Avatar Preview */}
        <View className="mb-6">
          <View className="flex-row items-center justify-between mb-2 px-1">
            <Text className="text-sm font-bold text-neutral-800 dark:text-neutral-200">Banner Images ({bannerPics.length}/5)</Text>
            <Text className="text-[10px] text-neutral-500 italic">Recommended: 1200 × 400</Text>
          </View>
          
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row mb-4 px-1" style={{ minHeight: 96 }}>
            {bannerPics.map((pic, idx) => (
              <View key={`${pic}-${idx}`} className="w-36 h-24 mr-3 bg-neutral-200 dark:bg-neutral-800 rounded-xl overflow-hidden relative border border-neutral-300 dark:border-neutral-700 shadow-sm">
                <Image source={{ uri: pic }} className="w-full h-full" resizeMode="cover" />
                
                {/* Delete/Remove button */}
                <Pressable 
                  onPress={() => {
                    const newPics = bannerPics.filter((_, i) => i !== idx);
                    setBannerPics(newPics);
                    setBannerUrl(newPics[0] || '');
                  }}
                  className="absolute top-1 right-1 w-6 h-6 bg-red-500 rounded-full items-center justify-center shadow"
                  style={{ zIndex: 10 }}
                >
                  <FontAwesome5 name="trash-alt" size={10} color="#fff" />
                </Pressable>

                {/* Status indicator: Primary or Make Primary button */}
                {idx === 0 ? (
                  <View className="absolute bottom-1 left-1 bg-indigo-600 px-1.5 py-0.5 rounded shadow-sm" style={{ zIndex: 10 }}>
                    <Text className="text-[8px] font-bold text-white uppercase tracking-wider">Primary</Text>
                  </View>
                ) : (
                  <Pressable 
                    onPress={() => {
                      const newPics = [...bannerPics];
                      const [removed] = newPics.splice(idx, 1);
                      newPics.unshift(removed);
                      setBannerPics(newPics);
                      setBannerUrl(removed);
                    }}
                    className="absolute bottom-1 left-1 bg-white/95 dark:bg-neutral-900/95 px-1.5 py-0.5 rounded shadow-sm flex-row items-center"
                    style={{ gap: 2, zIndex: 10 }}
                  >
                    <FontAwesome5 name="star" size={8} color="#eab308" />
                    <Text className="text-[8px] font-bold text-neutral-800 dark:text-neutral-200">Make Primary</Text>
                  </Pressable>
                )}
              </View>
            ))}

            {bannerPics.length < 5 && (
              <Pressable 
                onPress={async () => {
                  try {
                    const uri = await pickFromLibrary();
                    if (!uri) return;
                    setImageLoading(true);
                    const uploadedUrl = await uploadToCloudinary(uri, CLOUDINARY_FOLDERS.CONTRACTOR_BANNER);
                    setBannerPics(prev => {
                      const newPics = [...prev, uploadedUrl];
                      if (prev.length === 0) setBannerUrl(uploadedUrl);
                      return newPics;
                    });
                  } catch (err: any) {
                    Alert.alert("Error", err?.message || "Upload failed");
                  } finally {
                    setImageLoading(false);
                  }
                }}
                className="w-36 h-24 border-2 border-dashed border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 rounded-xl items-center justify-center mr-3"
              >
                {imageLoading ? (
                  <BouncingDotsLoader size="small" color="#4F46E5" />
                ) : (
                  <>
                    <FontAwesome5 name="plus" size={14} color="#a3a3a3" />
                    <Text className="text-[10px] text-neutral-500 dark:text-neutral-400 mt-1 font-semibold">Add Banner</Text>
                  </>
                )}
              </Pressable>
            )}
          </ScrollView>
          
          <View className="flex-row items-end px-4 mt-2" style={{ gap: 12 }}>
            <View className="w-16 h-16 rounded-2xl border-4 border-white dark:border-neutral-950 overflow-hidden bg-neutral-200 shadow-sm relative">
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} className="w-full h-full" resizeMode="cover" />
              ) : (
                <FontAwesome5 name="user" size={20} color="#a3a3a3" style={{ position: "absolute", top: 18, left: 18 }} />
              )}
              <Pressable 
                onPress={() => handleUpdateImage("avatar")}
                className="absolute inset-0 bg-black/20 items-center justify-center"
              >
                <FontAwesome5 name="camera" size={10} color="#fff" />
              </Pressable>
            </View>
            <View className="pb-1">
              <Text className="text-base font-bold text-neutral-900 dark:text-white">{contractorName || "Your Business"}</Text>
              <Text className="text-xs text-neutral-500 dark:text-neutral-400">Profile Preview</Text>
            </View>
          </View>
        </View>

        <View style={{ gap: 12 }} className="pb-10">
          {/* License Verification Accordion */}
          <View className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-700 overflow-hidden">
            <Pressable 
              onPress={() => setActiveEditSection(activeEditSection === 'license' ? null : 'license')}
              className="flex-row items-center justify-between p-4"
            >
              <View className="flex-row items-center" style={{ gap: 12 }}>
                <View className="w-10 h-10 rounded-lg bg-indigo-50 items-center justify-center">
                  <FontAwesome5 name="shield-alt" size={16} color="#4F46E5" />
                </View>
                <View>
                  <Text className="text-sm font-bold text-neutral-900 dark:text-white">License Verification</Text>
                  <Text className="text-[10px] text-neutral-500 dark:text-neutral-400 dark:text-neutral-500">Verified status builds trust</Text>
                </View>
              </View>
              <FontAwesome5 name={activeEditSection === 'license' ? "chevron-up" : "chevron-down"} size={12} color="#a3a3a3" />
            </Pressable>
            
            {activeEditSection === 'license' && (
              <View className="p-4 border-t border-neutral-100 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/50" style={{ gap: 16 }}>
                {licenseStatus === 'approved' ? (
                  <View className="bg-emerald-50 rounded-xl p-4 border border-emerald-100 items-center">
                    <View style={{ marginBottom: 12 }}>
                      <VerifiedBadge size={56} animate={true} />
                    </View>
                    <Text className="text-sm font-bold text-emerald-900 text-center">Identity & License Verified</Text>
                    <Text className="text-[11px] text-emerald-700 text-center mt-1">Your business is verified and the badge is visible on your profile.</Text>
                    <View className="mt-3 bg-white dark:bg-neutral-900 px-3 py-1 rounded-lg border border-emerald-100">
                      <Text className="text-[11px] font-bold text-emerald-600">LIC: {editableData.licenseNumber}</Text>
                    </View>
                  </View>
                ) : licenseStatus === 'pending' ? (
                  <View className="bg-amber-50 rounded-xl p-4 border border-amber-100 items-center">
                    <View className="w-12 h-12 rounded-full bg-amber-100 items-center justify-center mb-3">
                      <FontAwesome5 name="clock" size={20} color="#d97706" solid />
                    </View>
                    <Text className="text-sm font-bold text-amber-900 text-center">Verification Pending</Text>
                    <Text className="text-[11px] text-amber-700 text-center mt-1">Our team is reviewing your documents. We will update your status as soon as the review is complete.</Text>
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
                      <Text className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 dark:text-neutral-500 mb-1.5">License Number</Text>
                      <TextInput
                        value={editableData.licenseNumber}
                        onChangeText={t => setEditableData(p => ({ ...p, licenseNumber: t }))}
                      placeholder="e.g. #12345678"
                      placeholderTextColor="#a3a3a3"
                      className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-xl px-4 py-2.5 text-sm text-neutral-900 dark:text-white"
                    />
                    </View>

                    <View>
                      <Text className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 dark:text-neutral-500 mb-1.5">License Document (Photo)</Text>
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
                          className="w-full flex-row items-center justify-center py-6 border-2 border-dashed border-neutral-200 dark:border-neutral-700 rounded-xl bg-white dark:bg-neutral-900"
                        >
                          <FontAwesome5 name="cloud-upload-alt" size={18} color={isDark ? "#a3a3a3" : "#737373"} />
                          <Text className="text-sm text-neutral-500 dark:text-neutral-400 dark:text-neutral-500 font-medium ml-2">Upload License Photo</Text>
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
                        <BouncingDotsLoader size="small" color="#fff" />
                      ) : (
                        <>
                          <FontAwesome5 name="shield-alt" size={14} color={editableData.licenseNumber.trim() && licenseDocUri ? "#fff" : "#a3a3a3"} />
                          <Text className={`text-sm font-bold ml-2 ${editableData.licenseNumber.trim() && licenseDocUri ? 'text-white' : 'text-neutral-400 dark:text-neutral-500'}`}>Submit for Review</Text>
                        </>
                      )}
                    </Pressable>
                  </>
                )}
              </View>
            )}
          </View>

          {/* About Us Accordion */}
          <View className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-700 overflow-hidden">
            <Pressable 
              onPress={() => setActiveEditSection(activeEditSection === 'about' ? null : 'about')}
              className="flex-row items-center justify-between p-4"
            >
              <View className="flex-row items-center" style={{ gap: 12 }}>
                <View className="w-10 h-10 rounded-lg bg-neutral-50 dark:bg-neutral-800 items-center justify-center">
                  <FontAwesome5 name="info-circle" size={16} color={isDark ? "#d4d4d4" : "#525252"} />
                </View>
                <View>
                  <Text className="text-sm font-bold text-neutral-900 dark:text-white">About Us</Text>
                  <Text className="text-[10px] text-neutral-500 dark:text-neutral-400 dark:text-neutral-500">Business description and info</Text>
                </View>
              </View>
              <FontAwesome5 name={activeEditSection === 'about' ? "chevron-up" : "chevron-down"} size={12} color="#a3a3a3" />
            </Pressable>
            
            {activeEditSection === 'about' && (
              <View className="p-4 border-t border-neutral-100 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/50" style={{ gap: 12 }}>
                <View>
                  <Text className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 dark:text-neutral-500 mb-1.5">Business Description</Text>
                  <TextInput
                    value={editableData.description}
                    onChangeText={t => setEditableData(p => ({ ...p, description: t }))}
                      placeholder="Tell homeowners about your business..."
                      placeholderTextColor="#a3a3a3"
                      multiline
                      numberOfLines={4}
                      className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-xl px-4 py-2.5 text-sm text-neutral-900 dark:text-white"
                      style={{ textAlignVertical: "top", minHeight: 100 }}
                  />
                </View>

                <View>
                  <Text className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 dark:text-neutral-500 mb-1.5">Certifications</Text>
                  <TextInput
                    value={editableData.certifications}
                    onChangeText={t => setEditableData(p => ({ ...p, certifications: t }))}
                      placeholder="Licensed, Bonded, Insured..."
                      placeholderTextColor="#a3a3a3"
                      className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-xl px-4 py-2.5 text-sm text-neutral-900 dark:text-white"
                    />
                </View>
              </View>
            )}
          </View>

          {/* Contact & Location Accordion */}
          <View className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-700 overflow-hidden">
            <Pressable 
              onPress={() => setActiveEditSection(activeEditSection === 'contact' ? null : 'contact')}
              className="flex-row items-center justify-between p-4"
            >
              <View className="flex-row items-center" style={{ gap: 12 }}>
                <View className="w-10 h-10 rounded-lg bg-neutral-50 dark:bg-neutral-800 items-center justify-center">
                  <FontAwesome5 name="map-marker-alt" size={16} color={isDark ? "#d4d4d4" : "#525252"} />
                </View>
                <View>
                  <Text className="text-sm font-bold text-neutral-900 dark:text-white">Contact & Location</Text>
                  <Text className="text-[10px] text-neutral-500 dark:text-neutral-400 dark:text-neutral-500">Where you work and how to reach you</Text>
                </View>
              </View>
              <FontAwesome5 name={activeEditSection === 'contact' ? "chevron-up" : "chevron-down"} size={12} color="#a3a3a3" />
            </Pressable>
            
            {activeEditSection === 'contact' && (
              <View className="p-4 border-t border-neutral-100 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/50" style={{ gap: 12 }}>
                <View>
                  <Text className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 dark:text-neutral-500 mb-1.5">Phone</Text>
                  <TextInput
                    value={editableData.phone}
                    onChangeText={t => setEditableData(p => ({ ...p, phone: formatPhoneInput(t) }))}
                      placeholder="212-555-0123"
                      placeholderTextColor="#a3a3a3"
                      keyboardType="phone-pad"
                      maxLength={12}
                      className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-xl px-4 py-2.5 text-sm text-neutral-900 dark:text-white"
                    />
                </View>
                <View>
                  <Text className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 dark:text-neutral-500 mb-1.5">Email</Text>
                  <TextInput
                    value={editableData.email}
                    placeholder="your@email.com"
                    placeholderTextColor="#a3a3a3"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    editable={false}
                    className="w-full bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl px-4 py-2.5 text-sm text-neutral-400 dark:text-neutral-500"
                  />
                  <Text className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-1">Contact support to change your email.</Text>
                </View>
                <View>
                  <Text className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 dark:text-neutral-500 mb-1.5">Website (Optional)</Text>
                  <TextInput
                    value={editableData.website}
                    onChangeText={t => setEditableData(p => ({ ...p, website: t }))}
                      placeholder="https://yourwebsite.com"
                      placeholderTextColor="#a3a3a3"
                      autoCapitalize="none"
                      className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-xl px-4 py-2.5 text-sm text-neutral-900 dark:text-white"
                    />
                </View>
                <View>
                  <Text className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 dark:text-neutral-500 mb-1.5">Service Areas (Zip Codes)</Text>
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
                      <Text className="text-xs text-neutral-400 dark:text-neutral-500 italic">No zip codes added</Text>
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
                      className="flex-1 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-xl px-4 py-2.5 text-sm text-neutral-900 dark:text-white"
                      onSubmitEditing={() => {
                        const val = newZip.trim();
                        if (!val) return;
                        if (/^\d{5}$/.test(val)) {
                          if (!editableData.zipCodes.includes(val)) {
                            setEditableData(p => ({ ...p, zipCodes: [...p.zipCodes, val] }));
                            setNewZip('');
                          }
                        } else {
                          Alert.alert('Invalid ZIP', 'Please enter a valid 5-digit numeric ZIP code.');
                        }
                      }}
                    />
                    <Pressable 
                      onPress={() => {
                        const val = newZip.trim();
                        if (!val) return;
                        if (/^\d{5}$/.test(val)) {
                          if (!editableData.zipCodes.includes(val)) {
                            setEditableData(p => ({ ...p, zipCodes: [...p.zipCodes, val] }));
                            setNewZip('');
                          }
                        } else {
                          Alert.alert('Invalid ZIP', 'Please enter a valid 5-digit numeric ZIP code.');
                        }
                      }}
                      className="bg-indigo-600 w-11 h-11 rounded-xl items-center justify-center shadow-sm shadow-indigo-200"
                    >
                      <FontAwesome5 name="plus" size={14} color="#fff" />
                    </Pressable>
                  </View>
                </View>
                <View className="relative z-50">
                  <Text className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 dark:text-neutral-500 mb-1.5">Address</Text>
                  <TextInput
                    value={editableData.address}
                    onChangeText={searchAddress}
                      placeholder="Start typing your address..."
                      placeholderTextColor="#a3a3a3"
                      className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-xl px-4 py-2.5 text-sm text-neutral-900 dark:text-white"
                    />
                  {isSearchingAddress && (
                    <View className="absolute right-3 top-8">
                      <BouncingDotsLoader size="small" color="#4F46E5" />
                    </View>
                  )}
                  {addressSuggestions.length > 0 && (
                    <View className="mt-2 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-xl overflow-hidden">
                      {addressSuggestions.map((item: any, index: number) => (
                        <Pressable
                          key={index}
                          onPress={() => handleSelectAddress(item)}
                          className={`px-4 py-3 border-b border-neutral-100 dark:border-neutral-800 active:bg-neutral-50 dark:bg-neutral-800 ${
                            index === addressSuggestions.length - 1 ? 'border-b-0' : ''
                          }`}
                        >
                          <Text className="text-xs text-neutral-900 dark:text-white font-medium" numberOfLines={1}>
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
          <View className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-700 overflow-hidden">
            <Pressable
              onPress={() => setActiveEditSection(activeEditSection === 'hours' ? null : 'hours')}
              className="flex-row items-center justify-between p-4"
            >
              <View className="flex-row items-center" style={{ gap: 12 }}>
                <View className="w-10 h-10 rounded-lg bg-neutral-50 dark:bg-neutral-800 items-center justify-center">
                  <FontAwesome5 name="clock" size={16} color={isDark ? "#d4d4d4" : "#525252"} />
                </View>
                <View>
                  <Text className="text-sm font-bold text-neutral-900 dark:text-white">Business Hours</Text>
                  <Text className="text-[10px] text-neutral-500 dark:text-neutral-400 dark:text-neutral-500">Set your weekly availability</Text>
                </View>
              </View>
              <FontAwesome5 name={activeEditSection === 'hours' ? "chevron-up" : "chevron-down"} size={12} color="#a3a3a3" />
            </Pressable>

            {activeEditSection === 'hours' && (
              <View className="p-4 border-t border-neutral-100 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/50">
                {DAYS.map(day => (
                  <View key={day} className="flex-row items-center justify-between py-2 border-b border-neutral-100 dark:border-neutral-800">
                    <Pressable
                      onPress={() => setHours(prev => ({
                        ...prev,
                        [day]: { ...prev[day], isOpen: !prev[day]?.isOpen }
                      }))}
                      className="flex-row items-center"
                      style={{ gap: 8, minWidth: 110 }}
                    >
                      <View className={`w-5 h-5 rounded border-2 items-center justify-center ${hours[day]?.isOpen !== false ? 'bg-indigo-600 border-indigo-600' : 'bg-white dark:bg-neutral-900 border-neutral-300 dark:border-neutral-600'}`}>
                        {hours[day]?.isOpen !== false && (
                          <FontAwesome5 name="check" size={9} color="#fff" />
                        )}
                      </View>
                      <Text className={`text-sm font-medium ${hours[day]?.isOpen !== false ? 'text-neutral-900 dark:text-white' : 'text-neutral-400 dark:text-neutral-500'}`}>{day.slice(0, 3)}</Text>
                    </Pressable>
                    {hours[day]?.isOpen !== false ? (
                      <View className="flex-row items-center" style={{ gap: 8 }}>
                        <Pressable
                          onPress={() => {
                            const currentIdx = TIME_OPTIONS.indexOf(hours[day]?.open || '09:00');
                            const newIdx = (currentIdx + 1) % TIME_OPTIONS.length;
                            setHours(prev => ({ ...prev, [day]: { ...prev[day], open: TIME_OPTIONS[newIdx] } }));
                          }}
                          className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg px-3 py-1.5"
                        >
                          <Text className="text-xs font-medium text-neutral-700 dark:text-neutral-300">{formatTimeDisplay(hours[day]?.open || '09:00')}</Text>
                        </Pressable>
                        <Text className="text-xs text-neutral-400 dark:text-neutral-500">to</Text>
                        <Pressable
                          onPress={() => {
                            const currentIdx = TIME_OPTIONS.indexOf(hours[day]?.close || '17:00');
                            const newIdx = (currentIdx + 1) % TIME_OPTIONS.length;
                            setHours(prev => ({ ...prev, [day]: { ...prev[day], close: TIME_OPTIONS[newIdx] } }));
                          }}
                          className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg px-3 py-1.5"
                        >
                          <Text className="text-xs font-medium text-neutral-700 dark:text-neutral-300">{formatTimeDisplay(hours[day]?.close || '17:00')}</Text>
                        </Pressable>
                      </View>
                    ) : (
                      <Text className="text-xs text-neutral-400 dark:text-neutral-500 italic">Closed</Text>
                    )}
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* Services Accordion */}
          <View className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-700 overflow-hidden">
            <Pressable 
              onPress={() => setActiveEditSection(activeEditSection === 'services' ? null : 'services')}
              className="flex-row items-center justify-between p-4"
            >
              <View className="flex-row items-center" style={{ gap: 12 }}>
                <View className="w-10 h-10 rounded-lg bg-neutral-50 dark:bg-neutral-800 items-center justify-center">
                  <FontAwesome5 name="briefcase" size={16} color={isDark ? "#d4d4d4" : "#525252"} />
                </View>
                <View>
                  <Text className="text-sm font-bold text-neutral-900 dark:text-white">Services</Text>
                  <Text className="text-[10px] text-neutral-500 dark:text-neutral-400 dark:text-neutral-500">{editableData.servicesOffered.length} services listed</Text>
                </View>
              </View>
              <FontAwesome5 name={activeEditSection === 'services' ? "chevron-up" : "chevron-down"} size={12} color="#a3a3a3" />
            </Pressable>
            
            {activeEditSection === 'services' && (
              <View className="p-4 border-t border-neutral-100 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/50" style={{ gap: 12 }}>
                <View className="flex-row items-center justify-between mb-2">
                  <Text className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 dark:text-neutral-500">Services Offered</Text>
                  <Pressable 
                    onPress={() => setEditableData(p => ({ ...p, servicesOffered: [...p.servicesOffered, { name: '', description: '', minPrice: '', maxPrice: '', contactForQuote: false }] }))}
                    className="flex-row items-center bg-indigo-50 px-3 py-1.5 rounded-lg"
                    style={{ gap: 6 }}
                  >
                    <FontAwesome5 name="plus" size={10} color="#4F46E5" />
                    <Text className="text-[11px] font-bold text-indigo-700">Add Service</Text>
                  </Pressable>
                </View>

                {editableData.servicesOffered.length === 0 && (
                  <View className="py-4 border border-dashed border-neutral-200 dark:border-neutral-700 rounded-xl items-center">
                    <Text className="text-xs text-neutral-400 dark:text-neutral-500">No services added yet</Text>
                  </View>
                )}

                {editableData.servicesOffered.map((service, idx) => (
                  <View key={idx} className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-700 p-4 relative mb-2">
                    <Pressable 
                      onPress={() => setEditableData(p => ({ ...p, servicesOffered: p.servicesOffered.filter((_, i) => i !== idx) }))}
                      className="absolute top-3 right-3 w-7 h-7 bg-neutral-50 dark:bg-neutral-800 rounded-full items-center justify-center"
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
                      className="text-sm font-bold text-neutral-900 dark:text-white mb-2 mr-8"
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
                      className="text-xs text-neutral-600 dark:text-neutral-300 mb-2 p-2 bg-neutral-50 dark:bg-neutral-800 rounded-lg"
                    />
                    <View style={{ gap: 8 }} className="mt-1">
                      <Pressable
                        onPress={() => {
                          const next = [...editableData.servicesOffered];
                          next[idx].contactForQuote = !next[idx].contactForQuote;
                          setEditableData(p => ({ ...p, servicesOffered: next }));
                        }}
                        className="flex-row items-center py-1"
                        style={{ gap: 8 }}
                      >
                        <View
                          className={`w-5 h-5 rounded-md items-center justify-center border ${
                            service.contactForQuote
                              ? 'bg-neutral-900 border-neutral-900 dark:bg-white dark:border-white'
                              : 'bg-white dark:bg-neutral-800 border-neutral-300 dark:border-neutral-700'
                          }`}
                        >
                          {service.contactForQuote && (
                            <FontAwesome5
                              name="check"
                              size={8}
                              color={isDark ? '#171717' : 'white'}
                            />
                          )}
                        </View>
                        <Text className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                          Contact for custom quote
                        </Text>
                      </Pressable>

                      {!service.contactForQuote && (
                        <View className="flex-row" style={{ gap: 8 }}>
                          <View className="flex-1 relative justify-center">
                            <Text className="absolute left-3 text-xs text-neutral-400 dark:text-neutral-500 z-10">$</Text>
                            <TextInput
                              value={service.minPrice}
                              onChangeText={t => {
                                const val = t.replace(/[^0-9]/g, '');
                                const next = [...editableData.servicesOffered];
                                next[idx].minPrice = val;
                                setEditableData(p => ({ ...p, servicesOffered: next }));
                              }}
                              placeholder="Min price"
                              placeholderTextColor={isDark ? "#737373" : "#a3a3a3"}
                              keyboardType="numeric"
                              className="bg-neutral-50 dark:bg-neutral-800 rounded-lg pl-7 pr-3 py-2 text-xs text-neutral-900 dark:text-white"
                            />
                          </View>
                          <View className="flex-1 relative justify-center">
                            <Text className="absolute left-3 text-xs text-neutral-400 dark:text-neutral-500 z-10">$</Text>
                            <TextInput
                              value={service.maxPrice}
                              onChangeText={t => {
                                const val = t.replace(/[^0-9]/g, '');
                                const next = [...editableData.servicesOffered];
                                next[idx].maxPrice = val;
                                setEditableData(p => ({ ...p, servicesOffered: next }));
                              }}
                              placeholder="Max price"
                              placeholderTextColor={isDark ? "#737373" : "#a3a3a3"}
                              keyboardType="numeric"
                              className="bg-neutral-50 dark:bg-neutral-800 rounded-lg pl-7 pr-3 py-2 text-xs text-neutral-900 dark:text-white"
                            />
                          </View>
                        </View>
                      )}
                    </View>
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
              <BouncingDotsLoader size="small" color="#fff" />
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
