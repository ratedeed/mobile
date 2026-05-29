import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Image,
  TextInput,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Modal,
  Dimensions,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { FontAwesome5 } from '@expo/vector-icons';
import { getContractorProfile, updateContractorProfile, requestVerification } from '../api';
import { uploadToCloudinary, CLOUDINARY_FOLDERS } from '../utils/cloudinary';
import { useAuth } from '../context/AuthContext';
import { requestPhotoLibraryPermission } from '../utils/permissions';
import { VerifiedBadge } from './common/VerifiedBadge';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const isSmallScreen = SCREEN_WIDTH < 768;

const TIME_OPTIONS = [
  '00:00',
  '01:00',
  '02:00',
  '03:00',
  '04:00',
  '05:00',
  '06:00',
  '07:00',
  '08:00',
  '08:30',
  '09:00',
  '09:30',
  '10:00',
  '10:30',
  '11:00',
  '11:30',
  '12:00',
  '12:30',
  '13:00',
  '13:30',
  '14:00',
  '14:30',
  '15:00',
  '15:30',
  '16:00',
  '16:30',
  '17:00',
  '17:30',
  '18:00',
  '18:30',
  '19:00',
  '19:30',
  '20:00',
  '20:30',
  '21:00',
  '22:00',
  '23:00',
];

// Ratedeed Design Tokens
const COLORS = {
  primary: '#4F46E5', // Indigo 600
  primaryHover: '#4338CA', // Indigo 700
  primaryLight: '#EEF2FF', // Indigo 50
  dark: '#222222',
  textPrimary: '#222222',
  textSecondary: '#717171',
  textMuted: '#B0B0B0',
  border: '#DDDDDD',
  borderLight: '#EBEBEB',
  background: '#FFFFFF',
  surface: '#F7F7F7',
  surfaceWarm: '#FAFAFA',
  success: '#008A05',
  successLight: '#EDF7ED',
  successBorder: '#C3E6C3',
  warning: '#9A6700',
  warningLight: '#FFF8E1',
  warningBorder: '#FFE082',
  error: '#C13515',
  errorLight: '#FEF2F2',
};

const RADII = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  pill: 24,
  full: 9999,
};

type TabId = 'basic' | 'contact' | 'services' | 'media' | 'verification';

interface ServiceItem {
  name: string;
  description: string;
  priceRange: string;
}

interface PortfolioProject {
  id: string;
  title: string;
  images: string[];
  category: string;
  _fileUri?: string;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  onProfileUpdated?: () => void;
}

// ─── Ratedeed-style reusable input ───────────────────────────
const RatedeedInput = ({
  value,
  onChangeText,
  placeholder,
  multiline,
  style,
  keyboardType,
  autoCapitalize,
}: {
  value: string;
  onChangeText: (t: string) => void;
  placeholder: string;
  multiline?: boolean;
  style?: any;
  keyboardType?: any;
  autoCapitalize?: any;
}) => (
  <TextInput
    value={value}
    onChangeText={onChangeText}
    placeholder={placeholder}
    placeholderTextColor={COLORS.textMuted}
    multiline={multiline}
    keyboardType={keyboardType}
    autoCapitalize={autoCapitalize}
    style={{
      borderWidth: 1.5,
      borderColor: COLORS.border,
      borderRadius: RADII.md,
      paddingHorizontal: 16,
      paddingVertical: 14,
      fontSize: 15,
      color: COLORS.textPrimary,
      backgroundColor: COLORS.background,
      fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
      ...(multiline ? { minHeight: 100, textAlignVertical: 'top' as const } : {}),
      ...style,
    }}
  />
);

// ─── Ratedeed-style label ────────────────────────────────────
const FieldLabel = ({ children, style }: { children: React.ReactNode; style?: any }) => (
  <Text
    style={{
      fontSize: 13,
      fontWeight: '600',
      color: COLORS.textPrimary,
      letterSpacing: 0.2,
      marginBottom: 8,
      ...style,
    }}
  >
    {children}
  </Text>
);

// ─── Ratedeed-style section heading ──────────────────────────
const SectionHeading = ({ title, subtitle }: { title: string; subtitle?: string }) => (
  <View style={{ marginBottom: 20 }}>
    <Text style={{ fontSize: 22, fontWeight: '700', color: COLORS.dark, letterSpacing: -0.3 }}>{title}</Text>
    {subtitle && (
      <Text style={{ fontSize: 14, color: COLORS.textSecondary, marginTop: 4, lineHeight: 20 }}>{subtitle}</Text>
    )}
  </View>
);

export default function ContractorEditProfileModal({ visible, onClose, onProfileUpdated }: Props) {
  const { userId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId | null>('basic');

  const [profileData, setProfileData] = useState<any>(null);

  // Basic Info
  const [companyName, setCompanyName] = useState('');
  const [description, setDescription] = useState('');
  const [pricingInfo, setPricingInfo] = useState('');
  const [certifications, setCertifications] = useState('');

  // Contact Details
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [addressSuggestions, setAddressSuggestions] = useState<any[]>([]);
  const [isSearchingAddress, setIsSearchingAddress] = useState(false);
  const addressSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [zipCodes, setZipCodes] = useState<string[]>([]);
  const [zipInput, setZipInput] = useState('');

  // Media
  const [coverImage, setCoverImage] = useState<string>('');
  const [profilePicture, setProfilePicture] = useState<string>('');
  const [profilePicUri, setProfilePicUri] = useState<string | null>(null);
  const [profileFileUri, setProfileFileUri] = useState<string | null>(null);
  const [bannerPicUri, setBannerPicUri] = useState<string | null>(null);
  const [bannerFileUri, setBannerFileUri] = useState<string | null>(null);
  const [portfolio, setPortfolio] = useState<PortfolioProject[]>([]);

  // Services & Hours
  const [servicesList, setServicesList] = useState<string[]>([]);
  const [serviceInput, setServiceInput] = useState('');

  const [showTimePicker, setShowTimePicker] = useState<{ day: string; type: 'open' | 'close' } | null>(null);
  const [hours, setHours] = useState<Record<string, { open: string; close: string; isOpen: boolean }>>({});

  const searchAddress = (text: string) => {
    setAddress(text);
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
        setAddressSuggestions([]);
      } finally {
        setIsSearchingAddress(false);
      }
    }, 500);
  };

  const handleSelectAddress = (item: any) => {
    setAddress(item.display_name);
    setAddressSuggestions([]);
  };

  const formatPhoneNumber = (value: string): string => {
    if (!value) return value;
    const phoneNumber = value.replace(/[^\d]/g, '');
    const phoneNumberLength = phoneNumber.length;
    if (phoneNumberLength < 4) return phoneNumber;
    if (phoneNumberLength < 7) {
      return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3)}`;
    }
    return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3, 6)}-${phoneNumber.slice(6, 10)}`;
  };

  // Verification
  const [licenseNumber, setLicenseNumber] = useState('');
  const [verifLicenseNumber, setVerifLicenseNumber] = useState('');
  const [licenseDocUri, setLicenseDocUri] = useState<string | null>(null);
  const [isSubmittingVerification, setIsSubmittingVerification] = useState(false);
  const [verificationResult, setVerificationResult] = useState<{ success: boolean; message: string } | null>(null);

  const loadProfile = useCallback(async () => {
    if (!visible) return;
    try {
      setLoading(true);
      const data = await getContractorProfile();
      setProfileData(data);

      setCompanyName(data.companyName || data.businessName || '');
      setDescription(data.description || '');
      setPricingInfo((data as any).pricingInfo || data.pricing || '');

      setPhone(formatPhoneNumber((data as any).phone || ''));
      setEmail((data as any).email || '');
      setAddress((data as any).address || '');
      setZipCodes((data as any).serviceZipCodes || []);
      setCertifications((data.certifications || []).join(', '));

      const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
      const existing = data.businessHours || {};
      const hasSavedHours = Object.keys(existing).length > 0;
      const defaults: Record<string, { open: string; close: string; isOpen: boolean }> = {};
      for (const day of days) {
        const h: any = existing[day] || existing[day.toLowerCase()];
        if (h) {
          defaults[day] = {
            open: h.start || h.open || '09:00',
            close: h.end || h.close || '17:00',
            isOpen: h.isOpen !== false,
          };
        } else {
          defaults[day] = { open: '09:00', close: '17:00', isOpen: hasSavedHours ? false : day !== 'Sunday' };
        }
      }
      setHours(defaults);

      setProfilePicture(data.profilePicture || (data as any).imageUrl || '');
      setCoverImage(data.bannerImage || (data as any).bannerUrl || '');
      if (Array.isArray(data.portfolio)) {
        setPortfolio(
          data.portfolio.map((p: any) => ({
            id: p._id || p.id || `portfolio-${Date.now()}`,
            title: p.name || p.title || '',
            images: Array.isArray(p.images) ? p.images : p.imageUrl ? [p.imageUrl] : [],
            category: p.category || '',
          }))
        );
      }

      if (Array.isArray(data.servicesOffered)) {
        setServicesList(data.servicesOffered.map((s: any) => (typeof s === 'string' ? s : s.name)).filter(Boolean));
      }

      setLicenseNumber(data.licenseNumber || '');
      setVerifLicenseNumber(data.licenseNumber || '');
    } catch {
      Alert.alert('Error', 'Failed to load profile data.');
    } finally {
      setLoading(false);
    }
  }, [visible]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const licenseStatus = profileData?.licenseStatus || 'not_submitted';
  const isVerified = profileData?.isVerified || false;

  const handleImageSelect = async (type: 'profile' | 'banner' | 'license' | 'portfolio', portfolioIndex?: number) => {
    const hasPermission = await requestPhotoLibraryPermission();
    if (!hasPermission) return;

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: type === 'profile' || type === 'banner',
        aspect: type === 'profile' ? [1, 1] : type === 'banner' ? [16, 9] : undefined,
        quality: 0.7,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const previewUri = `data:${asset.mimeType || 'image/jpeg'};base64,${asset.base64}`;
        const fileUri = asset.uri;
        if (type === 'profile') {
          setProfilePicUri(previewUri);
          setProfileFileUri(fileUri);
        } else if (type === 'banner') {
          setBannerPicUri(previewUri);
          setBannerFileUri(fileUri);
        } else if (type === 'license') setLicenseDocUri(previewUri);
        else if (type === 'portfolio' && portfolioIndex !== undefined) {
          const updated = [...portfolio];
          updated[portfolioIndex].images = [previewUri];
          updated[portfolioIndex]._fileUri = fileUri;
          setPortfolio(updated);
        }
      }
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to select image');
    }
  };

  const handleSave = async () => {
    if (!companyName.trim()) {
      Alert.alert('Validation Error', 'Company Name is required.');
      return;
    }

    if (phone.trim() && !/^\+?[1-9]\d{9,14}$/.test(phone.replace(/[-() ]/g, ''))) {
      Alert.alert('Validation Error', 'Please enter a valid phone number.');
      return;
    }

    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      Alert.alert('Validation Error', 'Please enter a valid email address.');
      return;
    }

    if (zipCodes.length > 0) {
      const invalidZip = zipCodes.some((zip) => !/^\d{5}$/.test(zip));
      if (invalidZip) {
        Alert.alert('Validation Error', 'Please ensure all covered zip codes are 5 digits.');
        return;
      }
    }

    setSaving(true);
    try {
      let finalProfilePicUrl = profilePicture;
      let finalCoverImageUrl = coverImage;

      // Use file URI for upload (more reliable than data URI with RN FormData)
      if (profileFileUri) {
        finalProfilePicUrl = await uploadToCloudinary(profileFileUri, CLOUDINARY_FOLDERS.CONTRACTOR_PROFILE);
      }
      if (bannerFileUri) {
        finalCoverImageUrl = await uploadToCloudinary(bannerFileUri, CLOUDINARY_FOLDERS.CONTRACTOR_BANNER);
      }

      const processedPortfolio = await Promise.all(
        portfolio.map(async (p) => {
          let imageUrl = p.images[0] || '';
          const fileSrc = (p as any)._fileUri || imageUrl;
          // Upload if it's a local file that hasn't been uploaded yet
          if (fileSrc.startsWith('file://') || imageUrl.startsWith('data:')) {
            imageUrl = await uploadToCloudinary(
              fileSrc.startsWith('file://') ? fileSrc : imageUrl,
              CLOUDINARY_FOLDERS.PORTFOLIO
            );
          }
          return {
            name: p.title,
            category: p.category,
            imageUrl: imageUrl,
            images: imageUrl ? [imageUrl] : [],
          };
        })
      );

      const formattedHours: Record<string, { start: string; end: string; isOpen: boolean }> = {};
      for (const [day, val] of Object.entries(hours)) {
        formattedHours[day.toLowerCase()] = {
          start: val.open,
          end: val.close,
          isOpen: val.isOpen,
        };
      }

      const updateData: any = {
        companyName: companyName || undefined,
        businessName: companyName || undefined,
        description: description || undefined,
        pricingInfo: pricingInfo || undefined,
        certifications: certifications
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        businessHours: formattedHours,
        contactInfo: {
          phoneNumber: phone || undefined,
          email: email || undefined,
          streetAddress: address || undefined,
        },
        phone: phone || undefined,
        email: email || undefined,
        businessAddress: address || undefined,
        zipCodesCovered: zipCodes.length > 0 ? zipCodes : undefined,
        licenseNumber: licenseNumber || undefined,
        profilePicture: finalProfilePicUrl || undefined,
        bannerUrl: finalCoverImageUrl || undefined,
        bannerImage: finalCoverImageUrl || undefined,
        servicesOffered: servicesList.map((s) => ({
          name: s,
          description: '',
          priceEstimate: '',
        })),
        portfolio: processedPortfolio,
      };

      await updateContractorProfile(updateData);
      Alert.alert('Success', 'Profile updated successfully!');

      setProfilePicUri(null);
      setProfileFileUri(null);
      setBannerPicUri(null);
      setBannerFileUri(null);
      if (finalProfilePicUrl) setProfilePicture(finalProfilePicUrl);
      if (finalCoverImageUrl) setCoverImage(finalCoverImageUrl);

      if (onProfileUpdated) onProfileUpdated();
      onClose();
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to save profile.');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitVerification = async () => {
    if (!verifLicenseNumber.trim() || !licenseDocUri) return;
    setIsSubmittingVerification(true);
    setVerificationResult(null);

    try {
      const cloudinaryUrl = await uploadToCloudinary(licenseDocUri, CLOUDINARY_FOLDERS.LICENSES);
      await requestVerification({
        licenseNumber: verifLicenseNumber.trim(),
        licenseDocumentFile: cloudinaryUrl,
      });
      setVerificationResult({
        success: true,
        message: 'Verification request submitted! We will review it within 2-3 business days.',
      });
      setVerifLicenseNumber('');
      setLicenseDocUri(null);
    } catch (err: any) {
      setVerificationResult({
        success: false,
        message: err?.message || 'Failed to submit verification request.',
      });
    } finally {
      setIsSubmittingVerification(false);
    }
  };

  const tabs: { id: TabId; label: string; icon: string }[] = [
    { id: 'basic', label: 'Basic Info', icon: 'building' },
    { id: 'contact', label: 'Contact', icon: 'phone' },
    { id: 'services', label: 'Services', icon: 'briefcase' },
    { id: 'media', label: 'Photos', icon: 'camera' },
    { id: 'verification', label: 'Verification', icon: 'shield-alt' },
  ];

  if (!visible) return null;

  // ─── Ratedeed-style reusable input ───────────────────────────
  const RatedeedInput = ({
    value,
    onChangeText,
    placeholder,
    multiline,
    style,
    keyboardType,
    autoCapitalize,
  }: {
    value: string;
    onChangeText: (t: string) => void;
    placeholder: string;
    multiline?: boolean;
    style?: any;
    keyboardType?: any;
    autoCapitalize?: any;
  }) => (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={COLORS.textMuted}
      multiline={multiline}
      keyboardType={keyboardType}
      autoCapitalize={autoCapitalize}
      style={{
        borderWidth: 1.5,
        borderColor: COLORS.border,
        borderRadius: RADII.md,
        paddingHorizontal: 16,
        paddingVertical: 14,
        fontSize: 15,
        color: COLORS.textPrimary,
        backgroundColor: COLORS.background,
        fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
        ...(multiline ? { minHeight: 100, textAlignVertical: 'top' as const } : {}),
        ...style,
      }}
    />
  );

  // ─── Ratedeed-style label ────────────────────────────────────
  const FieldLabel = ({ children, style }: { children: React.ReactNode; style?: any }) => (
    <Text
      style={{
        fontSize: 13,
        fontWeight: '600',
        color: COLORS.textPrimary,
        letterSpacing: 0.2,
        marginBottom: 8,
        ...style,
      }}
    >
      {children}
    </Text>
  );

  // ─── Ratedeed-style section heading ──────────────────────────
  const SectionHeading = ({ title, subtitle }: { title: string; subtitle?: string }) => (
    <View style={{ marginBottom: 20 }}>
      <Text style={{ fontSize: 22, fontWeight: '700', color: COLORS.dark, letterSpacing: -0.3 }}>{title}</Text>
      {subtitle && (
        <Text style={{ fontSize: 14, color: COLORS.textSecondary, marginTop: 4, lineHeight: 20 }}>{subtitle}</Text>
      )}
    </View>
  );

  const renderTimePicker = () => {
    if (!showTimePicker) return null;
    const { day, type } = showTimePicker;
    const currentValue = type === 'open' ? hours[day]?.open : hours[day]?.close;

    return (
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 9999,
          elevation: 9999,
        }}
      >
        <View style={{ width: '80%', backgroundColor: '#fff', borderRadius: 20, padding: 20, maxHeight: '70%' }}>
          <Text style={{ fontSize: 18, fontWeight: '700', color: COLORS.dark, marginBottom: 16 }}>
            Select {type === 'open' ? 'Opening' : 'Closing'} Time for {day}
          </Text>
          <ScrollView>
            {TIME_OPTIONS.map((time) => (
              <TouchableOpacity
                key={time}
                onPress={() => {
                  setHours({ ...hours, [day]: { ...hours[day], [type]: time } });
                  setShowTimePicker(null);
                }}
                style={{
                  paddingVertical: 15,
                  borderBottomWidth: 1,
                  borderBottomColor: COLORS.borderLight,
                  backgroundColor: currentValue === time ? COLORS.primaryLight : 'transparent',
                }}
              >
                <Text
                  style={{
                    fontSize: 16,
                    color: currentValue === time ? COLORS.primary : COLORS.textPrimary,
                    fontWeight: currentValue === time ? '600' : '400',
                  }}
                >
                  {time}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <TouchableOpacity
            onPress={() => setShowTimePicker(null)}
            style={{ marginTop: 16, padding: 12, alignItems: 'center' }}
          >
            <Text style={{ color: COLORS.primary, fontWeight: '700' }}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderAccordionHeader = (tabId: TabId, title: string, icon: string) => (
    <TouchableOpacity
      onPress={() => setActiveTab(activeTab === tabId ? null : tabId)}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 20,
        borderBottomWidth: activeTab === tabId ? 0 : 1,
        borderBottomColor: COLORS.borderLight,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <FontAwesome5 name={icon} size={18} color={activeTab === tabId ? COLORS.primary : COLORS.dark} />
        <Text
          style={{
            fontSize: 18,
            fontWeight: '600',
            color: activeTab === tabId ? COLORS.primary : COLORS.dark,
            marginLeft: 16,
          }}
        >
          {title}
        </Text>
      </View>
      <FontAwesome5 name={activeTab === tabId ? 'chevron-up' : 'chevron-down'} size={14} color={COLORS.textSecondary} />
    </TouchableOpacity>
  );

  return (
    <>
      <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
          style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.45)' }}
        >
          <View
            style={{
              backgroundColor: COLORS.background,
              borderRadius: RADII.xl,
              overflow: 'hidden',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.2,
              shadowRadius: 24,
              elevation: 16,
              width: isSmallScreen ? '96%' : '84%',
              height: isSmallScreen ? '92%' : '88%',
              maxWidth: 1040,
            }}
          >
            {/* ─── Header ──────────────────────────────────── */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingHorizontal: 28,
                paddingVertical: 20,
                borderBottomWidth: 1,
                borderBottomColor: COLORS.borderLight,
                backgroundColor: COLORS.background,
              }}
            >
              <View>
                <Text style={{ fontSize: 20, fontWeight: '700', color: COLORS.dark, letterSpacing: -0.3 }}>
                  Edit your profile
                </Text>
                <Text style={{ fontSize: 13, color: COLORS.textSecondary, marginTop: 3 }}>
                  Help homeowners get to know you
                </Text>
              </View>
              <TouchableOpacity
                onPress={onClose}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: RADII.full,
                  backgroundColor: COLORS.surface,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <FontAwesome5 name="times" size={14} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* ─── Body ────────────────────────────────────── */}
            <View style={{ flex: 1, flexDirection: 'column' }}>
              {/* ─── Content Area ──────────────────────────── */}
              <View style={{ flex: 1, backgroundColor: COLORS.background, position: 'relative' }}>
                {loading ? (
                  <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                    <ActivityIndicator size="large" color={COLORS.primary} />
                    <Text style={{ marginTop: 12, fontSize: 14, color: COLORS.textSecondary }}>
                      Loading your profile…
                    </Text>
                  </View>
                ) : (
                  <ScrollView
                    contentContainerStyle={{ padding: isSmallScreen ? 20 : 32, paddingBottom: 100 }}
                    showsVerticalScrollIndicator={false}
                  >
                    {/* ═══════════ BASIC INFO ═══════════ */}
                    {renderAccordionHeader('basic', 'Basic Info', 'building')}
                    {activeTab === 'basic' && (
                      <View
                        style={{
                          gap: 24,
                          paddingBottom: 32,
                          borderBottomWidth: 1,
                          borderBottomColor: COLORS.borderLight,
                        }}
                      >
                        <SectionHeading
                          title="About your business"
                          subtitle="This information helps homeowners decide if you're the right fit for their project."
                        />

                        <View>
                          <FieldLabel>Company name</FieldLabel>
                          <RatedeedInput
                            value={companyName}
                            onChangeText={setCompanyName}
                            placeholder="What's the name of your business?"
                          />
                        </View>

                        <View>
                          <FieldLabel>About your business</FieldLabel>
                          <RatedeedInput
                            value={description}
                            onChangeText={setDescription}
                            placeholder="Tell homeowners about your experience, values, and what makes you stand out…"
                            multiline
                            style={{ minHeight: 140 }}
                          />
                        </View>

                        <View>
                          <FieldLabel>Pricing information</FieldLabel>
                          <RatedeedInput
                            value={pricingInfo}
                            onChangeText={setPricingInfo}
                            placeholder="e.g. Free estimates, $50/hr minimum, flat-rate pricing"
                            multiline
                            style={{ minHeight: 90 }}
                          />
                        </View>
                      </View>
                    )}

                    {/* ═══════════ CONTACT DETAILS ═══════════ */}
                    {renderAccordionHeader('contact', 'Contact', 'phone')}
                    {activeTab === 'contact' && (
                      <View
                        style={{
                          gap: 24,
                          paddingBottom: 32,
                          borderBottomWidth: 1,
                          borderBottomColor: COLORS.borderLight,
                        }}
                      >
                        <SectionHeading
                          title="How can people reach you?"
                          subtitle="Your contact details will be shared with homeowners who book your services."
                        />

                        <View>
                          <FieldLabel>Phone number</FieldLabel>
                          <RatedeedInput
                            value={phone}
                            onChangeText={(val) => setPhone(formatPhoneNumber(val))}
                            placeholder="(555) 555-5555"
                            keyboardType="phone-pad"
                          />
                        </View>

                        <View style={{ position: 'relative', zIndex: 50 }}>
                          <FieldLabel>Business address</FieldLabel>
                          <TextInput
                            value={address}
                            onChangeText={searchAddress}
                            placeholder="Start typing your address..."
                            placeholderTextColor="#a3a3a3"
                            style={{
                              borderWidth: 1,
                              borderColor: '#e5e5e5',
                              borderRadius: 10,
                              paddingHorizontal: 12,
                              paddingVertical: 10,
                              fontSize: 14,
                              backgroundColor: '#fafafa',
                            }}
                          />
                          {isSearchingAddress && (
                            <View style={{ position: 'absolute', right: 12, top: 32 }}>
                              <ActivityIndicator size="small" color="#4F46E5" />
                            </View>
                          )}
                          {addressSuggestions.length > 0 && (
                            <View
                              style={{
                                position: 'absolute',
                                top: 58,
                                left: 0,
                                right: 0,
                                backgroundColor: '#fff',
                                borderWidth: 1,
                                borderColor: '#e5e5e5',
                                borderRadius: 10,
                                shadowColor: '#000',
                                shadowOpacity: 0.1,
                                shadowRadius: 8,
                                elevation: 5,
                                overflow: 'hidden',
                                zIndex: 50,
                              }}
                            >
                              {addressSuggestions.map((item: any, index: number) => (
                                <Pressable
                                  key={index}
                                  onPress={() => handleSelectAddress(item)}
                                  style={{
                                    paddingHorizontal: 12,
                                    paddingVertical: 10,
                                    borderBottomWidth: index === addressSuggestions.length - 1 ? 0 : 1,
                                    borderBottomColor: '#f5f5f5',
                                  }}
                                >
                                  <Text style={{ fontSize: 12, color: '#171717', fontWeight: '500' }} numberOfLines={1}>
                                    {item.display_name}
                                  </Text>
                                </Pressable>
                              ))}
                            </View>
                          )}
                        </View>
                      </View>
                    )}

                    {/* ═══════════ SERVICES ═══════════ */}
                    {renderAccordionHeader('services', 'Services', 'briefcase')}
                    {activeTab === 'services' && (
                      <View
                        style={{
                          gap: 24,
                          paddingBottom: 32,
                          borderBottomWidth: 1,
                          borderBottomColor: COLORS.borderLight,
                        }}
                      >
                        <View>
                          <FieldLabel>Service area (ZIP Codes)</FieldLabel>
                          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                            <TextInput
                              value={zipInput}
                              onChangeText={setZipInput}
                              placeholder="e.g. 10001"
                              keyboardType="number-pad"
                              maxLength={5}
                              style={{
                                flex: 1,
                                borderWidth: 1.5,
                                borderColor: COLORS.border,
                                borderRadius: RADII.md,
                                paddingHorizontal: 16,
                                paddingVertical: 12,
                                fontSize: 15,
                                color: COLORS.textPrimary,
                                backgroundColor: COLORS.background,
                              }}
                            />
                            <TouchableOpacity
                              onPress={() => {
                                const trimmedZip = zipInput.trim();
                                if (!trimmedZip) return;
                                if (/^\d{5}$/.test(trimmedZip)) {
                                  if (!zipCodes.includes(trimmedZip)) {
                                    setZipCodes([...zipCodes, trimmedZip]);
                                    setZipInput('');
                                  }
                                } else {
                                  Alert.alert('Invalid ZIP', 'Please enter a valid 5-digit numeric ZIP code.');
                                }
                              }}
                              style={{
                                paddingHorizontal: 20,
                                justifyContent: 'center',
                                backgroundColor: COLORS.surface,
                                borderWidth: 1.5,
                                borderColor: COLORS.border,
                                borderRadius: RADII.md,
                              }}
                            >
                              <Text style={{ fontWeight: '600', color: COLORS.dark }}>Add</Text>
                            </TouchableOpacity>
                          </View>
                          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                            {zipCodes.map((z) => (
                              <View
                                key={z}
                                style={{
                                  flexDirection: 'row',
                                  alignItems: 'center',
                                  backgroundColor: COLORS.surfaceWarm,
                                  paddingHorizontal: 12,
                                  paddingVertical: 8,
                                  borderRadius: RADII.full,
                                  borderWidth: 1,
                                  borderColor: COLORS.borderLight,
                                }}
                              >
                                <FontAwesome5
                                  name="map-marker-alt"
                                  size={10}
                                  color={COLORS.textSecondary}
                                  style={{ marginRight: 6 }}
                                />
                                <Text style={{ fontSize: 13, color: COLORS.textPrimary, marginRight: 8 }}>{z}</Text>
                                <TouchableOpacity onPress={() => setZipCodes(zipCodes.filter((x) => x !== z))}>
                                  <FontAwesome5 name="times" size={10} color={COLORS.textMuted} />
                                </TouchableOpacity>
                              </View>
                            ))}
                          </View>
                        </View>

                        <View>
                          <SectionHeading
                            title="Your services"
                            subtitle="Add the services you offer so homeowners can find you."
                          />
                          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                            <TextInput
                              value={serviceInput}
                              onChangeText={setServiceInput}
                              placeholder="e.g. Roof Repair"
                              style={{
                                flex: 1,
                                borderWidth: 1.5,
                                borderColor: COLORS.border,
                                borderRadius: RADII.md,
                                paddingHorizontal: 16,
                                paddingVertical: 12,
                                fontSize: 15,
                                color: COLORS.textPrimary,
                                backgroundColor: COLORS.background,
                              }}
                            />
                            <TouchableOpacity
                              onPress={() => {
                                if (serviceInput.trim() && !servicesList.includes(serviceInput.trim())) {
                                  setServicesList([...servicesList, serviceInput.trim()]);
                                  setServiceInput('');
                                }
                              }}
                              style={{
                                paddingHorizontal: 20,
                                justifyContent: 'center',
                                backgroundColor: COLORS.surface,
                                borderWidth: 1.5,
                                borderColor: COLORS.border,
                                borderRadius: RADII.md,
                              }}
                            >
                              <Text style={{ fontWeight: '600', color: COLORS.dark }}>Add</Text>
                            </TouchableOpacity>
                          </View>
                          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                            {servicesList.map((s) => (
                              <View
                                key={s}
                                style={{
                                  flexDirection: 'row',
                                  alignItems: 'center',
                                  backgroundColor: COLORS.surfaceWarm,
                                  paddingHorizontal: 12,
                                  paddingVertical: 8,
                                  borderRadius: RADII.full,
                                  borderWidth: 1,
                                  borderColor: COLORS.borderLight,
                                }}
                              >
                                <Text style={{ fontSize: 13, color: COLORS.textPrimary, marginRight: 8 }}>{s}</Text>
                                <TouchableOpacity onPress={() => setServicesList(servicesList.filter((x) => x !== s))}>
                                  <FontAwesome5 name="times" size={10} color={COLORS.textMuted} />
                                </TouchableOpacity>
                              </View>
                            ))}
                          </View>
                        </View>

                        <View style={{ height: 1, backgroundColor: COLORS.borderLight, marginVertical: 8 }} />

                        <View>
                          <FieldLabel>Certifications (comma-separated)</FieldLabel>
                          <RatedeedInput
                            value={certifications}
                            onChangeText={setCertifications}
                            placeholder="e.g. Licensed Plumber, EPA Certified"
                            multiline
                            style={{ minHeight: 90 }}
                          />
                        </View>

                        <View style={{ height: 1, backgroundColor: COLORS.borderLight, marginVertical: 8 }} />

                        <View>
                          <SectionHeading
                            title="Business Hours"
                            subtitle="Let homeowners know when you're available."
                          />
                          <View style={{ gap: 12 }}>
                            {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(
                              (day) => (
                                <View
                                  key={day}
                                  style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    paddingVertical: 8,
                                    borderBottomWidth: 1,
                                    borderBottomColor: COLORS.borderLight,
                                  }}
                                >
                                  <View style={{ width: 100, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                    <TouchableOpacity
                                      onPress={() =>
                                        setHours({ ...hours, [day]: { ...hours[day], isOpen: !hours[day]?.isOpen } })
                                      }
                                      style={{
                                        width: 20,
                                        height: 20,
                                        borderRadius: 4,
                                        borderWidth: 1.5,
                                        borderColor: hours[day]?.isOpen ? COLORS.primary : COLORS.border,
                                        backgroundColor: hours[day]?.isOpen ? COLORS.primary : 'transparent',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                      }}
                                    >
                                      {hours[day]?.isOpen && <FontAwesome5 name="check" size={10} color="#fff" />}
                                    </TouchableOpacity>
                                    <Text style={{ fontSize: 14, color: COLORS.textPrimary, fontWeight: '500' }}>
                                      {day}
                                    </Text>
                                  </View>

                                  {hours[day]?.isOpen ? (
                                    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 8 }}>
                                      <TouchableOpacity
                                        onPress={() => setShowTimePicker({ day, type: 'open' })}
                                        style={{
                                          flex: 1,
                                          borderWidth: 1,
                                          borderColor: COLORS.border,
                                          borderRadius: RADII.sm,
                                          paddingHorizontal: 12,
                                          paddingVertical: 10,
                                          backgroundColor: COLORS.background,
                                          alignItems: 'center',
                                        }}
                                      >
                                        <Text style={{ fontSize: 13, color: COLORS.textPrimary }}>
                                          {hours[day]?.open || '09:00'}
                                        </Text>
                                      </TouchableOpacity>
                                      <Text style={{ fontSize: 13, color: COLORS.textSecondary }}>to</Text>
                                      <TouchableOpacity
                                        onPress={() => setShowTimePicker({ day, type: 'close' })}
                                        style={{
                                          flex: 1,
                                          borderWidth: 1,
                                          borderColor: COLORS.border,
                                          borderRadius: RADII.sm,
                                          paddingHorizontal: 12,
                                          paddingVertical: 10,
                                          backgroundColor: COLORS.background,
                                          alignItems: 'center',
                                        }}
                                      >
                                        <Text style={{ fontSize: 13, color: COLORS.textPrimary }}>
                                          {hours[day]?.close || '17:00'}
                                        </Text>
                                      </TouchableOpacity>
                                    </View>
                                  ) : (
                                    <View style={{ flex: 1, alignItems: 'flex-start', paddingHorizontal: 12 }}>
                                      <Text style={{ fontSize: 13, color: COLORS.textMuted, fontStyle: 'italic' }}>
                                        Closed
                                      </Text>
                                    </View>
                                  )}
                                </View>
                              )
                            )}
                          </View>
                        </View>
                      </View>
                    )}

                    {/* ═══════════ PHOTOS & MEDIA ═══════════ */}
                    {renderAccordionHeader('media', 'Photos', 'camera')}
                    {activeTab === 'media' && (
                      <View
                        style={{
                          gap: 28,
                          paddingBottom: 32,
                          borderBottomWidth: 1,
                          borderBottomColor: COLORS.borderLight,
                        }}
                      >
                        <SectionHeading
                          title="Your photos"
                          subtitle="Great photos help homeowners feel confident about choosing you."
                        />

                        {/* ── Profile & Cover Row ── */}
                        <View style={{ flexDirection: isSmallScreen ? 'column' : 'row', gap: 24 }}>
                          {/* Profile Picture */}
                          <View style={{ flex: 1 }}>
                            <FieldLabel>Profile photo</FieldLabel>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                              <Image
                                source={{ uri: profilePicUri || profilePicture || 'https://via.placeholder.com/200' }}
                                style={{
                                  width: 72,
                                  height: 72,
                                  borderRadius: RADII.full,
                                  backgroundColor: COLORS.surface,
                                  borderWidth: 2,
                                  borderColor: COLORS.border,
                                }}
                              />
                              <TouchableOpacity
                                onPress={() => handleImageSelect('profile')}
                                style={{
                                  paddingHorizontal: 18,
                                  paddingVertical: 11,
                                  borderRadius: RADII.pill,
                                  backgroundColor: COLORS.background,
                                  borderWidth: 1.5,
                                  borderColor: COLORS.dark,
                                }}
                              >
                                <Text style={{ fontSize: 13, fontWeight: '600', color: COLORS.dark }}>
                                  Change photo
                                </Text>
                              </TouchableOpacity>
                            </View>
                          </View>

                          {/* Cover Photo */}
                          <View style={{ flex: 1 }}>
                            <FieldLabel>Cover photo</FieldLabel>
                            <View
                              style={{
                                width: '100%',
                                height: 120,
                                backgroundColor: COLORS.surface,
                                borderRadius: RADII.lg,
                                borderWidth: 1.5,
                                borderColor: COLORS.border,
                                overflow: 'hidden',
                                position: 'relative',
                              }}
                            >
                              <Image
                                source={{ uri: bannerPicUri || coverImage || 'https://via.placeholder.com/600x200' }}
                                style={{ width: '100%', height: '100%' }}
                                resizeMode="cover"
                              />
                              <TouchableOpacity
                                onPress={() => handleImageSelect('banner')}
                                style={{
                                  position: 'absolute',
                                  bottom: 10,
                                  right: 10,
                                  flexDirection: 'row',
                                  alignItems: 'center',
                                  paddingHorizontal: 14,
                                  paddingVertical: 8,
                                  borderRadius: RADII.pill,
                                  backgroundColor: 'rgba(255,255,255,0.92)',
                                  gap: 6,
                                }}
                              >
                                <FontAwesome5 name="camera" size={11} color={COLORS.dark} />
                                <Text style={{ fontSize: 12, fontWeight: '600', color: COLORS.dark }}>Change</Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        </View>
                      </View>
                    )}

                    {/* ═══════════ VERIFICATION ═══════════ */}
                    {renderAccordionHeader('verification', 'Verification', 'shield-alt')}
                    {activeTab === 'verification' && (
                      <View
                        style={{
                          gap: 24,
                          paddingBottom: 32,
                          borderBottomWidth: 1,
                          borderBottomColor: COLORS.borderLight,
                        }}
                      >
                        <SectionHeading
                          title="Verification"
                          subtitle="A verified badge builds trust and helps you stand out to homeowners."
                        />

                        {isVerified || licenseStatus === 'approved' ? (
                          /* ── Verified State ── */
                          <View
                            style={{
                              backgroundColor: COLORS.successLight,
                              borderRadius: RADII.lg,
                              padding: 28,
                              borderWidth: 1,
                              borderColor: COLORS.successBorder,
                              alignItems: 'center',
                            }}
                          >
                            <View style={{ marginBottom: 16 }}>
                              <VerifiedBadge size={56} animate={true} />
                            </View>
                            <Text
                              style={{
                                fontSize: 18,
                                fontWeight: '700',
                                color: '#1B5E20',
                                marginBottom: 6,
                              }}
                            >
                              You're verified!
                            </Text>
                            <Text
                              style={{
                                fontSize: 14,
                                color: '#2E7D32',
                                textAlign: 'center',
                                lineHeight: 20,
                                marginBottom: 20,
                              }}
                            >
                              Your license and background have been verified. You have a verified badge on your profile.
                            </Text>
                            <View
                              style={{
                                backgroundColor: COLORS.background,
                                paddingHorizontal: 20,
                                paddingVertical: 10,
                                borderRadius: RADII.md,
                                borderWidth: 1,
                                borderColor: COLORS.successBorder,
                              }}
                            >
                              <Text style={{ fontSize: 13, fontWeight: '600', color: '#2E7D32' }}>
                                License: {licenseNumber}
                              </Text>
                            </View>
                          </View>
                        ) : licenseStatus === 'pending' ? (
                          /* ── Pending State ── */
                          <View
                            style={{
                              backgroundColor: COLORS.warningLight,
                              borderRadius: RADII.lg,
                              padding: 28,
                              borderWidth: 1,
                              borderColor: COLORS.warningBorder,
                              alignItems: 'center',
                            }}
                          >
                            <View
                              style={{
                                width: 56,
                                height: 56,
                                borderRadius: RADII.full,
                                backgroundColor: '#FFF3CD',
                                alignItems: 'center',
                                justifyContent: 'center',
                                marginBottom: 16,
                              }}
                            >
                              <FontAwesome5 name="clock" size={22} color={COLORS.warning} solid />
                            </View>
                            <Text
                              style={{
                                fontSize: 18,
                                fontWeight: '700',
                                color: '#5D4037',
                                marginBottom: 6,
                              }}
                            >
                              Verification in progress
                            </Text>
                            <Text
                              style={{
                                fontSize: 14,
                                color: '#795548',
                                textAlign: 'center',
                                lineHeight: 20,
                              }}
                            >
                              We're reviewing your documents. This usually takes 2-3 business days.
                            </Text>
                          </View>
                        ) : (
                          /* ── Submit Verification ── */
                          <View
                            style={{
                              backgroundColor: COLORS.background,
                              borderRadius: RADII.lg,
                              borderWidth: 1,
                              borderColor: COLORS.border,
                              padding: 28,
                              shadowColor: '#000',
                              shadowOffset: { width: 0, height: 2 },
                              shadowOpacity: 0.05,
                              shadowRadius: 8,
                              elevation: 2,
                            }}
                          >
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                              <View
                                style={{
                                  width: 44,
                                  height: 44,
                                  borderRadius: RADII.md,
                                  backgroundColor: COLORS.primaryLight,
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                }}
                              >
                                <FontAwesome5 name="shield-alt" size={18} color={COLORS.primary} />
                              </View>
                              <View style={{ marginLeft: 14 }}>
                                <Text style={{ fontSize: 17, fontWeight: '700', color: COLORS.dark }}>
                                  Get verified
                                </Text>
                                <Text style={{ fontSize: 13, color: COLORS.textSecondary }}>
                                  Build trust with homeowners
                                </Text>
                              </View>
                            </View>

                            <Text
                              style={{
                                fontSize: 14,
                                color: COLORS.textSecondary,
                                lineHeight: 22,
                                marginBottom: 24,
                              }}
                            >
                              Submit your professional license and we'll review it. Once verified, you'll get a badge on
                              your profile that shows homeowners you're legit.
                            </Text>

                            <View style={{ marginBottom: 20 }}>
                              <FieldLabel>License number</FieldLabel>
                              <RatedeedInput
                                value={verifLicenseNumber}
                                onChangeText={setVerifLicenseNumber}
                                placeholder="e.g. LIC-12345"
                              />
                            </View>

                            <View style={{ marginBottom: 24 }}>
                              <FieldLabel>Upload license document</FieldLabel>
                              {licenseDocUri ? (
                                <View
                                  style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    padding: 16,
                                    borderRadius: RADII.md,
                                    backgroundColor: COLORS.primaryLight,
                                    borderWidth: 1.5,
                                    borderColor: COLORS.primary,
                                  }}
                                >
                                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                                    <FontAwesome5 name="file-image" size={18} color={COLORS.primary} />
                                    <Text style={{ fontSize: 14, fontWeight: '600', color: COLORS.primary }}>
                                      Document attached
                                    </Text>
                                  </View>
                                  <TouchableOpacity onPress={() => setLicenseDocUri(null)} style={{ padding: 6 }}>
                                    <FontAwesome5 name="times" size={14} color={COLORS.textSecondary} />
                                  </TouchableOpacity>
                                </View>
                              ) : (
                                <TouchableOpacity
                                  onPress={() => handleImageSelect('license')}
                                  style={{
                                    paddingVertical: 32,
                                    borderWidth: 2,
                                    borderColor: COLORS.border,
                                    borderStyle: 'dashed',
                                    borderRadius: RADII.lg,
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    backgroundColor: COLORS.surface,
                                    gap: 8,
                                  }}
                                >
                                  <FontAwesome5 name="cloud-upload-alt" size={22} color={COLORS.textMuted} />
                                  <Text style={{ fontSize: 14, fontWeight: '500', color: COLORS.textSecondary }}>
                                    Tap to upload a photo of your license
                                  </Text>
                                  <Text style={{ fontSize: 12, color: COLORS.textMuted }}>JPG, PNG up to 10MB</Text>
                                </TouchableOpacity>
                              )}
                            </View>

                            {verificationResult && (
                              <View
                                style={{
                                  padding: 14,
                                  borderRadius: RADII.md,
                                  marginBottom: 16,
                                  backgroundColor: verificationResult.success ? COLORS.successLight : COLORS.errorLight,
                                  borderLeftWidth: 3,
                                  borderLeftColor: verificationResult.success ? COLORS.success : COLORS.error,
                                }}
                              >
                                <Text
                                  style={{
                                    fontSize: 13,
                                    color: verificationResult.success ? '#1B5E20' : COLORS.error,
                                    lineHeight: 18,
                                  }}
                                >
                                  {verificationResult.message}
                                </Text>
                              </View>
                            )}

                            <TouchableOpacity
                              onPress={handleSubmitVerification}
                              disabled={!verifLicenseNumber.trim() || !licenseDocUri || isSubmittingVerification}
                              style={{
                                width: '100%',
                                paddingVertical: 16,
                                borderRadius: RADII.md,
                                alignItems: 'center',
                                justifyContent: 'center',
                                backgroundColor:
                                  verifLicenseNumber.trim() && licenseDocUri && !isSubmittingVerification
                                    ? COLORS.primary
                                    : COLORS.border,
                              }}
                            >
                              {isSubmittingVerification ? (
                                <ActivityIndicator size="small" color="#fff" />
                              ) : (
                                <Text
                                  style={{
                                    fontSize: 15,
                                    fontWeight: '600',
                                    color: verifLicenseNumber.trim() && licenseDocUri ? '#fff' : COLORS.textMuted,
                                  }}
                                >
                                  Submit for review
                                </Text>
                              )}
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>
                    )}
                  </ScrollView>
                )}

                {/* ─── Footer ──────────────────────────────────── */}
                <View
                  style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    backgroundColor: COLORS.background,
                    borderTopWidth: 1,
                    borderTopColor: COLORS.borderLight,
                    paddingHorizontal: 28,
                    paddingVertical: 16,
                    flexDirection: 'row',
                    justifyContent: 'flex-end',
                    alignItems: 'center',
                    gap: 12,
                  }}
                >
                  <TouchableOpacity
                    onPress={onClose}
                    style={{
                      paddingHorizontal: 22,
                      paddingVertical: 13,
                      borderRadius: RADII.md,
                      backgroundColor: COLORS.background,
                      borderWidth: 1.5,
                      borderColor: COLORS.dark,
                    }}
                  >
                    <Text style={{ fontSize: 14, fontWeight: '600', color: COLORS.dark }}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleSave}
                    disabled={saving || loading}
                    style={{
                      paddingHorizontal: 28,
                      paddingVertical: 14,
                      borderRadius: RADII.md,
                      backgroundColor: saving || loading ? COLORS.border : COLORS.primary,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      minWidth: 140,
                      gap: 8,
                    }}
                  >
                    {saving ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <FontAwesome5 name="check" size={12} color="#fff" />
                        <Text style={{ fontSize: 14, fontWeight: '600', color: '#fff' }}>Save changes</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
        {renderTimePicker()}
      </Modal>
    </>
  );
}
