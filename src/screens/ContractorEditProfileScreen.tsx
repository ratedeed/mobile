import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Image,
  TextInput,
  Alert,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  FlatList,
  useColorScheme,
  Switch,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getContractorProfile, updateContractorProfile, requestVerification } from '../api';
import { VerifiedBadge } from '../components/common/VerifiedBadge';
import { BouncingDotsLoader } from '../components/common';
import { uploadToCloudinary, CLOUDINARY_FOLDERS } from '../utils/cloudinary';
import { useAuth } from '../context/AuthContext';
import { requestPhotoLibraryPermission } from '../utils/permissions';
import { parsePriceRange, formatPriceRange } from '../utils/price';

type EditSection = 'about' | 'estimate' | 'services' | 'portfolio' | 'posts' | 'verification' | null;

interface ServiceItem {
  name: string;
  description: string;
  minPrice: string;
  maxPrice: string;
  contactForQuote: boolean;
}

interface PortfolioProject {
  id: string;
  title: string;
  description?: string;
  images: string[];
  category: string;
  localUri?: string;
}

export default function ContractorEditProfileScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { userId } = useAuth();
  const isDark = useColorScheme() === 'dark';
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeSection, setActiveSection] = useState<EditSection>(null);

  // Profile data state
  const [profileData, setProfileData] = useState<any>(null);
  
  // About Us state
  const [coverImage, setCoverImage] = useState<string>('');
  const [profilePicture, setProfilePicture] = useState<string>('');
  const [description, setDescription] = useState('');
  const [serviceArea, setServiceArea] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [showCompletedJobs, setShowCompletedJobs] = useState<boolean>(true);
  const [companyName, setCompanyName] = useState('');
  const [category, setCategory] = useState('');
  const [location, setLocation] = useState('');

  // Estimate Policy state
  const [estimateEnabled, setEstimateEnabled] = useState<boolean>(false);
  const [estimateType, setEstimateType] = useState<'free' | 'service_fee' | 'virtual_only'>('free');
  const [feeAmount, setFeeAmount] = useState<string>('75');
  const [feeWaivedIfHired, setFeeWaivedIfHired] = useState<boolean>(true);
  const [estimateNotes, setEstimateNotes] = useState<string>('');

  // Address autocomplete
  const [addressSuggestions, setAddressSuggestions] = useState<any[]>([]);
  const [isSearchingAddress, setIsSearchingAddress] = useState(false);
  const addressSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Local files to upload
  const [profilePicUri, setProfilePicUri] = useState<string | null>(null);
  const [bannerPicUri, setBannerPicUri] = useState<string | null>(null);
  const [bannerPics, setBannerPics] = useState<string[]>([]);

  // Services state
  const [services, setServices] = useState<ServiceItem[]>([]);

  // Portfolio state
  const [portfolio, setPortfolio] = useState<PortfolioProject[]>([]);

  // Posts state
  const [posts, setPosts] = useState<any[]>([]);

  // License verification state
  const [verifLicenseNumber, setVerifLicenseNumber] = useState('');
  const [licenseDocUri, setLicenseDocUri] = useState<string | null>(null);
  const [isSubmittingVerification, setIsSubmittingVerification] = useState(false);
  const [verificationResult, setVerificationResult] = useState<{ success: boolean; message: string } | null>(null);

  const searchAddress = (text: string) => {
    setLocation(text);
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
      } catch (error) {
      // console.error('Address search error:', error);
      } finally {
        setIsSearchingAddress(false);
      }
    }, 500);
  };

  const handleSelectAddress = (item: any) => {
    setLocation(item.display_name);
    setAddressSuggestions([]);
  };

  const isMounted = useRef(true);

  const loadProfile = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getContractorProfile();
      if (!isMounted.current) return;

      setProfileData(data);
      setDescription(data.description || '');
      setServiceArea(data.zipCodesCovered?.join(', ') || (data as any).serviceZipCodes?.join(', ') || '');
      setLicenseNumber(data.licenseNumber || '');
      setShowCompletedJobs(data.showCompletedJobs !== undefined ? !!data.showCompletedJobs : true);
      setCompanyName(data.companyName || data.businessName || '');
      setCategory(data.category || '');
      setLocation((data as any).businessAddress || (data as any).address || '');
      setProfilePicture(data.profilePicture || (data as any).imageUrl || '');
      const bannerUrl = data.bannerImage || (data as any).bannerUrl || '';
      setCoverImage(bannerUrl);
      const rawBanners = data.bannerImages || [];
      const banners = (Array.isArray(rawBanners) && rawBanners.length > 0) ? rawBanners : (bannerUrl ? [bannerUrl] : []);
      setBannerPics(banners);

      if (data.estimatePolicy) {
        const isEnabled = data.estimatePolicy.enabled !== undefined
          ? !!data.estimatePolicy.enabled
          : (data.estimatePolicy.type && data.estimatePolicy.type !== 'none');
        setEstimateEnabled(isEnabled);
        if (data.estimatePolicy.type && data.estimatePolicy.type !== 'none') {
          setEstimateType(data.estimatePolicy.type);
        }
        if (data.estimatePolicy.feeAmount !== undefined && data.estimatePolicy.feeAmount !== null) {
          setFeeAmount(data.estimatePolicy.feeAmount.toString());
        }
        if (data.estimatePolicy.feeWaivedIfHired !== undefined) {
          setFeeWaivedIfHired(data.estimatePolicy.feeWaivedIfHired);
        }
        if (data.estimatePolicy.notes) setEstimateNotes(data.estimatePolicy.notes);
      } else if (data.hasFreeEstimates) {
        setEstimateEnabled(true);
        setEstimateType('free');
      } else {
        setEstimateEnabled(false);
      }

      if (Array.isArray(data.servicesOffered)) {
        setServices(data.servicesOffered.map((s: any) => {
          const rawRange = s.priceEstimate || s.priceRange || '';
          const parsed = parsePriceRange(rawRange);
          return {
            name: s.name || '',
            description: s.description || '',
            minPrice: parsed.min,
            maxPrice: parsed.max,
            contactForQuote: parsed.contactForQuote,
          };
        }));
      }

      if (Array.isArray(data.portfolio)) {
        setPortfolio(data.portfolio.map((p: any) => ({
          id: p._id || p.id || `portfolio-${Date.now()}`,
          title: p.name || p.title || '',
          description: p.description || '',
          images: Array.isArray(p.images) ? p.images : (p.imageUrl ? [p.imageUrl] : []),
          category: p.category || '',
        })));
      }

      if (Array.isArray(data.posts)) {
        setPosts(data.posts);
      }
    } catch (err) {
      if (!isMounted.current) return;
      Alert.alert('Error', 'Failed to load profile data.');
    } finally {
      if (isMounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProfile();
    return () => {
      isMounted.current = false;
      if (addressSearchTimer.current) clearTimeout(addressSearchTimer.current);
    };
  }, [loadProfile]);

  const licenseStatus = profileData?.licenseStatus || 'not_submitted';
  const verificationNotes = profileData?.verificationNotes || '';
  const isVerified = profileData?.isVerified || false;

  const handleImageSelect = async (type: 'profile' | 'banner') => {
    const hasPermission = await requestPhotoLibraryPermission();
    if (!hasPermission) return;

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: type === 'profile' ? [1, 1] : [16, 9],
        quality: 0.7,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        if (type === 'profile') {
          setProfilePicUri(result.assets[0].uri);
        } else {
          setBannerPicUri(result.assets[0].uri);
        }
      }
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to pick image');
    }
  };

  const handleLicenseDocSelect = async () => {
    const hasPermission = await requestPhotoLibraryPermission();
    if (!hasPermission) return;

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setLicenseDocUri(result.assets[0].uri);
      }
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to pick license document');
    }
  };

  const addService = () => {
    setServices([...services, { name: '', description: '', minPrice: '', maxPrice: '', contactForQuote: false }]);
  };

  const updateService = (index: number, field: keyof ServiceItem, value: any) => {
    const updated = [...services];
    updated[index] = { ...updated[index], [field]: value };
    setServices(updated);
  };

  const removeService = (index: number) => {
    setServices(services.filter((_, i) => i !== index));
  };

  const addProject = () => {
    setPortfolio([...portfolio, { id: `new-${Date.now()}`, title: '', images: [], category: '' }]);
  };

  const updateProject = (index: number, field: keyof PortfolioProject, value: any) => {
    const updated = [...portfolio];
    updated[index] = { ...updated[index], [field]: value };
    setPortfolio(updated);
  };

  const removeProject = (index: number) => {
    setPortfolio(portfolio.filter((_, i) => i !== index));
  };

  const handlePortfolioImageUpload = async (projectIndex: number) => {
    const hasPermission = await requestPhotoLibraryPermission();
    if (!hasPermission) return;

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const localUri = result.assets[0].uri;
        const currentImages = portfolio[projectIndex]?.images || [];
        updateProject(projectIndex, 'images', [...currentImages, localUri]);
      }
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to add photo');
    }
  };

  const handleSave = async () => {
    if (!companyName.trim()) {
      Alert.alert('Validation Error', 'Company Name is required.');
      return;
    }

    if (serviceArea.trim()) {
      const zips = serviceArea.split(',').map(s => s.trim()).filter(Boolean);
      const invalidZip = zips.some(zip => !/^\d{5}$/.test(zip));
      if (invalidZip) {
        Alert.alert('Validation Error', 'Please ensure all zip codes in the service area are 5 digits.');
        return;
      }
    }

    setSaving(true);
    try {
      let finalProfilePicUrl = profilePicture;
      let finalCoverImageUrl = coverImage;

      if (profilePicUri) {
        finalProfilePicUrl = await uploadToCloudinary(profilePicUri, CLOUDINARY_FOLDERS.CONTRACTOR_PROFILE);
      }
      if (bannerPicUri) {
        finalCoverImageUrl = await uploadToCloudinary(bannerPicUri, CLOUDINARY_FOLDERS.CONTRACTOR_BANNER);
      }

      // Process portfolio images
      const updatedPortfolio = await Promise.all(
        portfolio.map(async (p) => {
          const projectImages = await Promise.all(
            (p.images || []).map(async (imgUri) => {
              if (imgUri.startsWith('file://') || imgUri.startsWith('content://')) {
                return await uploadToCloudinary(imgUri, CLOUDINARY_FOLDERS.PORTFOLIO);
              }
              return imgUri;
            })
          );
          return {
            name: p.title || undefined,
            description: p.description || undefined,
            category: p.category || undefined,
            imageUrl: projectImages[0] || undefined,
            images: projectImages,
          };
        })
      );

      const updateData: any = {
        companyName: companyName || undefined,
        businessName: companyName || undefined,
        description: description || undefined,
        address: location || undefined,
        businessAddress: location || undefined,
        zipCodesCovered: serviceArea.split(',').map(s => s.trim()).filter(Boolean),
        licenseNumber: licenseNumber || undefined,
        showCompletedJobs,
        hasFreeEstimates: estimateEnabled && estimateType === 'free',
        estimatePolicy: {
          enabled: estimateEnabled,
          type: estimateEnabled ? estimateType : 'none',
          feeAmount: estimateEnabled && estimateType === 'service_fee' ? parseFloat(feeAmount) || 75 : 0,
          feeWaivedIfHired: estimateEnabled && estimateType === 'service_fee' ? feeWaivedIfHired : false,
          notes: estimateEnabled ? estimateNotes : '',
        },
        profilePicture: finalProfilePicUrl || undefined,
        bannerUrl: finalCoverImageUrl || undefined,
        bannerImage: finalCoverImageUrl || undefined,
        bannerImages: bannerPics,
        servicesOffered: services.map(s => ({
          name: s.name || undefined,
          description: s.description || undefined,
          priceEstimate: formatPriceRange(s.minPrice, s.maxPrice, s.contactForQuote),
        })),
        portfolio: updatedPortfolio,
      };

      await updateContractorProfile(updateData);
      Alert.alert('Success', 'Profile updated successfully!');
      
      // Clear local URIs
      setProfilePicUri(null);
      setBannerPicUri(null);
      if (finalProfilePicUrl) setProfilePicture(finalProfilePicUrl);
      if (finalCoverImageUrl) setCoverImage(finalCoverImageUrl);
      
      setActiveSection(null);
    } catch (err: any) {
      // console.error('Failed to save profile:', err);
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
        message: 'License verification request submitted! Our team will review it.',
      });
      setVerifLicenseNumber('');
      setLicenseDocUri(null);
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

  // Section toggles
  const toggleSection = (section: EditSection) => {
    setActiveSection(activeSection === section ? null : section);
  };

  if (loading) {
    return (
      <View className="flex-1 bg-neutral-50 dark:bg-neutral-900 items-center justify-center">
        <BouncingDotsLoader size="large" color="#4F46E5" />
      </View>
    );
  }

  const renderLicenseStatusBadge = () => {
    if (licenseStatus === 'approved' || isVerified) {
      return (
        <View className="flex-row items-center bg-emerald-50 px-2 py-1 rounded-lg ml-2">
          <FontAwesome5 name="check-circle" size={10} color="#059669" solid />
          <Text className="text-[10px] font-semibold text-emerald-700 ml-1">Verified</Text>
        </View>
      );
    }
    if (licenseStatus === 'pending') {
      return (
        <View className="flex-row items-center bg-amber-50 px-2 py-1 rounded-lg ml-2">
          <FontAwesome5 name="clock" size={10} color="#D97706" solid />
          <Text className="text-[10px] font-semibold text-amber-700 ml-1">Reviewing</Text>
        </View>
      );
    }
    if (licenseStatus === 'rejected') {
      return (
        <View className="flex-row items-center bg-red-50 px-2 py-1 rounded-lg ml-2">
          <FontAwesome5 name="times-circle" size={10} color="#DC2626" solid />
          <Text className="text-[10px] font-semibold text-red-700 ml-1">Denied</Text>
        </View>
      );
    }
    return null;
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0} className="flex-1 bg-neutral-50 dark:bg-neutral-900">
      {/* Header */}
      <View className="bg-white dark:bg-neutral-950 border-b border-neutral-200 dark:border-neutral-700 flex-row items-center justify-between px-4" style={{ paddingTop: Math.max(insets.top, 16), paddingBottom: 12, zIndex: 40 }}>
        <TouchableOpacity onPress={() => navigation.goBack()} className="w-8 h-8 items-center justify-center rounded-full bg-neutral-100 dark:bg-neutral-800">
          <FontAwesome5 name="chevron-left" size={16} color={isDark ? "#ffffff" : "#171717"} />
        </TouchableOpacity>
        <Text className="text-base font-bold text-neutral-900 dark:text-white">Edit Profile</Text>
        <TouchableOpacity onPress={handleSave} disabled={saving} className="bg-indigo-600 px-3 py-1.5 rounded-lg flex-row items-center">
          {saving ? (
            <BouncingDotsLoader size="small" color="#fff" />
          ) : (
            <>
              <FontAwesome5 name="save" size={12} color="#fff" solid />
              <Text className="text-white text-xs font-semibold ml-1.5">Save</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false} onScrollBeginDrag={() => setAddressSuggestions([])} keyboardShouldPersistTaps="handled">
        {/* Cover Images Scrollable Editor */}
        <View className="bg-neutral-50 dark:bg-neutral-900 py-4 px-4 border-b border-neutral-200 dark:border-neutral-800">
          <View className="flex-row items-center justify-between mb-2 px-1">
            <Text className="text-sm font-bold text-neutral-800 dark:text-neutral-200">Banner Images ({bannerPics.length}/5)</Text>
            <Text className="text-[10px] text-neutral-500 italic">Recommended: 1200 × 400</Text>
          </View>
          
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row mb-2 px-1" style={{ minHeight: 96 }}>
            {bannerPics.map((pic, idx) => (
              <View key={`${pic}-${idx}`} className="w-36 h-24 mr-3 bg-neutral-200 dark:bg-neutral-800 rounded-xl overflow-hidden relative border border-neutral-300 dark:border-neutral-700 shadow-sm">
                <Image source={{ uri: pic }} className="w-full h-full" resizeMode="cover" />
                
                {/* Delete/Remove button */}
                <TouchableOpacity 
                  onPress={() => {
                    const newPics = bannerPics.filter((_, i) => i !== idx);
                    setBannerPics(newPics);
                    setCoverImage(newPics[0] || '');
                  }}
                  className="absolute top-1 right-1 w-6 h-6 bg-red-500 rounded-full items-center justify-center shadow"
                  style={{ zIndex: 10 }}
                >
                  <FontAwesome5 name="trash-alt" size={10} color="#fff" />
                </TouchableOpacity>

                {/* Status indicator: Primary or Make Primary button */}
                {idx === 0 ? (
                  <View className="absolute bottom-1 left-1 bg-indigo-600 px-1.5 py-0.5 rounded shadow-sm" style={{ zIndex: 10 }}>
                    <Text className="text-[8px] font-bold text-white uppercase tracking-wider">Primary</Text>
                  </View>
                ) : (
                  <TouchableOpacity 
                    onPress={() => {
                      const newPics = [...bannerPics];
                      const [removed] = newPics.splice(idx, 1);
                      newPics.unshift(removed);
                      setBannerPics(newPics);
                      setCoverImage(removed);
                    }}
                    className="absolute bottom-1 left-1 bg-white/95 dark:bg-neutral-900/95 px-1.5 py-0.5 rounded shadow-sm flex-row items-center"
                    style={{ gap: 2, zIndex: 10 }}
                  >
                    <FontAwesome5 name="star" size={8} color="#eab308" />
                    <Text className="text-[8px] font-bold text-neutral-800 dark:text-neutral-200">Make Primary</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}

            {bannerPics.length < 5 && (
              <TouchableOpacity 
                onPress={async () => {
                  const hasPermission = await requestPhotoLibraryPermission();
                  if (!hasPermission) return;
                  try {
                    const result = await ImagePicker.launchImageLibraryAsync({
                      mediaTypes: ['images'],
                      allowsEditing: true,
                      aspect: [16, 9],
                      quality: 0.7,
                    });

                    if (!result.canceled && result.assets && result.assets.length > 0) {
                      setSaving(true);
                      const uploadedUrl = await uploadToCloudinary(result.assets[0].uri, CLOUDINARY_FOLDERS.CONTRACTOR_BANNER);
                      setBannerPics(prev => {
                        const newPics = [...prev, uploadedUrl];
                        if (prev.length === 0) setCoverImage(uploadedUrl);
                        return newPics;
                      });
                    }
                  } catch (err: any) {
                    Alert.alert("Error", err?.message || "Upload failed");
                  } finally {
                    setSaving(false);
                  }
                }}
                className="w-36 h-24 border-2 border-dashed border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 rounded-xl items-center justify-center mr-3"
              >
                {saving ? (
                  <BouncingDotsLoader size="small" color="#4F46E5" />
                ) : (
                  <>
                    <FontAwesome5 name="plus" size={14} color="#a3a3a3" />
                    <Text className="text-[10px] text-neutral-500 dark:text-neutral-400 mt-1 font-semibold">Add Banner</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </ScrollView>
        </View>

        {/* Profile Info */}
        <View className="bg-white dark:bg-neutral-950 px-4 py-4 -mt-6 mx-4 rounded-xl border border-neutral-100 dark:border-neutral-800 shadow-sm z-10 flex-row items-end">
          <View className="relative -mt-10 mr-3">
            <Image source={{ uri: profilePicUri || profilePicture || 'https://via.placeholder.com/200' }} className="w-16 h-16 rounded-xl border-2 border-white dark:border-neutral-950 bg-white dark:bg-neutral-800" />
            <TouchableOpacity onPress={() => handleImageSelect('profile')} className="absolute -bottom-1 -right-1 w-6 h-6 bg-indigo-600 rounded-full items-center justify-center border-2 border-white dark:border-neutral-950">
              <FontAwesome5 name="camera" size={10} color="#fff" />
            </TouchableOpacity>
          </View>
          <View className="flex-1 pb-1">
            <View className="flex-row items-center">
              <Text className="text-sm font-bold text-neutral-900 dark:text-white">{companyName || 'Your Business'}</Text>
              {isVerified && (
                <TouchableOpacity onPress={() => Alert.alert('Verified Pro', 'Identity & License Verified', [{ text: 'OK' }])} style={{ marginLeft: 6 }}>
                  <VerifiedBadge size={16} animate={false} />
                </TouchableOpacity>
              )}
            </View>
            <Text className="text-xs text-neutral-500 dark:text-neutral-400">{category}{location ? ` · ${location}` : ''}</Text>
          </View>
        </View>

        <View className="px-4 mt-4" style={{ gap: 12 }}>
          {/* Verification Section */}
          <View className="bg-white dark:bg-neutral-950 rounded-xl border border-neutral-100 dark:border-neutral-800 overflow-hidden">
            <TouchableOpacity onPress={() => toggleSection('verification')} className="px-4 py-3.5 flex-row items-center justify-between">
              <View className="flex-row items-center flex-1">
                <View className={`w-8 h-8 rounded-lg items-center justify-center ${licenseStatus === 'approved' ? 'bg-emerald-50' : 'bg-indigo-50'}`}>
                  <FontAwesome5 name="shield-alt" size={14} color={licenseStatus === 'approved' ? '#059669' : '#4F46E5'} />
                </View>
                <View className="ml-3 flex-1">
                  <View className="flex-row items-center">
                    <Text className="text-sm font-bold text-neutral-900 dark:text-white">License Verification</Text>
                    {renderLicenseStatusBadge()}
                  </View>
                  <Text className="text-[11px] text-neutral-500 dark:text-neutral-400">Get verified to build trust with homeowners</Text>
                </View>
              </View>
              <View className={`w-5 h-5 rounded-full items-center justify-center ${activeSection === 'verification' ? 'bg-indigo-600' : 'bg-neutral-100 dark:bg-neutral-800'}`}>
                <FontAwesome5 name="chevron-down" size={10} color={activeSection === 'verification' ? '#fff' : (isDark ? '#737373' : '#a3a3a3')} />
              </View>
            </TouchableOpacity>

            {activeSection === 'verification' && (
              <View className="px-4 pb-4 pt-3 border-t border-neutral-100 dark:border-neutral-800" style={{ gap: 12 }}>
                {licenseStatus === 'approved' && (
                  <View className="bg-emerald-50 rounded-xl p-4 border border-emerald-100">
                    <Text className="text-sm font-semibold text-emerald-800">License Verified</Text>
                    <Text className="text-xs text-emerald-700 mt-1">Your license is verified and homeowners can see the badge on your profile.</Text>
                    <Text className="text-xs text-emerald-600 font-medium mt-2">License #: {profileData?.licenseNumber}</Text>
                  </View>
                )}

                {licenseStatus === 'pending' && (
                  <View className="bg-amber-50 rounded-xl p-4 border border-amber-100">
                    <Text className="text-sm font-semibold text-amber-800">Reviewing Verification</Text>
                    <Text className="text-xs text-amber-700 mt-1">Your document is being reviewed. We will update your status as soon as the review is complete.</Text>
                  </View>
                )}

                {licenseStatus !== 'approved' && licenseStatus !== 'pending' && (
                  <View style={{ gap: 12 }}>
                    <View>
                      <Text className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 mb-1">License Number</Text>
                      <TextInput
                        value={verifLicenseNumber || licenseNumber}
                        onChangeText={setVerifLicenseNumber}
                        placeholder="e.g. LIC-2024-123"
                        placeholderTextColor={isDark ? '#737373' : '#a3a3a3'}
                        className="w-full border border-neutral-200 dark:border-neutral-700 rounded-xl px-3 py-2.5 text-sm text-neutral-900 dark:text-white"
                      />
                    </View>
                    <View>
                      <Text className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 mb-1">License Document (Photo)</Text>
                      {licenseDocUri ? (
                        <View className="flex-row items-center bg-indigo-50 p-3 rounded-xl border border-indigo-200">
                          <FontAwesome5 name="file-image" size={16} color="#4F46E5" />
                          <Text className="text-xs font-semibold text-indigo-900 ml-2 flex-1 truncate" numberOfLines={1}>Document selected</Text>
                          <TouchableOpacity onPress={() => setLicenseDocUri(null)} className="p-1">
                            <FontAwesome5 name="times-circle" size={14} color={isDark ? '#737373' : '#a3a3a3'} />
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <TouchableOpacity onPress={handleLicenseDocSelect} className="w-full flex-row items-center justify-center py-4 border-2 border-dashed border-neutral-200 dark:border-neutral-700 rounded-xl">
                          <FontAwesome5 name="upload" size={14} color={isDark ? '#a3a3a3' : '#737373'} />
                          <Text className="text-sm text-neutral-500 dark:text-neutral-400 font-medium ml-2">Upload License Document</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                    
                    {verificationResult && (
                      <View className={`rounded-xl p-3 border ${verificationResult.success ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100'}`}>
                        <Text className={`text-xs font-semibold ${verificationResult.success ? 'text-emerald-800' : 'text-red-800'}`}>{verificationResult.message}</Text>
                      </View>
                    )}

                    <TouchableOpacity 
                      onPress={handleSubmitVerification}
                      disabled={!verifLicenseNumber.trim() || !licenseDocUri || isSubmittingVerification}
                      className={`w-full flex-row justify-center py-3 rounded-xl items-center ${
                        verifLicenseNumber.trim() && licenseDocUri && !isSubmittingVerification ? 'bg-indigo-600' : 'bg-neutral-200 dark:bg-neutral-700'
                      }`}
                    >
                      {isSubmittingVerification ? (
                        <BouncingDotsLoader size="small" color="#fff" />
                      ) : (
                        <>
                          <FontAwesome5 name="shield-alt" size={14} color={verifLicenseNumber.trim() && licenseDocUri ? "#fff" : (isDark ? '#737373' : '#a3a3a3')} />
                          <Text className={`text-sm font-semibold ml-2 ${verifLicenseNumber.trim() && licenseDocUri ? 'text-white' : 'text-neutral-400 dark:text-neutral-500'}`}>Submit for Verification</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}
          </View>

          {/* About Section */}
          <View className="bg-white dark:bg-neutral-950 rounded-xl border border-neutral-100 dark:border-neutral-800 overflow-hidden">
            <TouchableOpacity onPress={() => toggleSection('about')} className="px-4 py-3.5 flex-row items-center justify-between">
              <View>
                <Text className="text-sm font-bold text-neutral-900 dark:text-white">About Us</Text>
                <Text className="text-[11px] text-neutral-500 dark:text-neutral-400">Business description, service area, basic details</Text>
              </View>
              <View className={`w-5 h-5 rounded-full items-center justify-center ${activeSection === 'about' ? 'bg-indigo-600' : 'bg-neutral-100 dark:bg-neutral-800'}`}>
                <FontAwesome5 name="chevron-down" size={10} color={activeSection === 'about' ? '#fff' : (isDark ? '#737373' : '#a3a3a3')} />
              </View>
            </TouchableOpacity>

            {activeSection === 'about' && (
              <View className="px-4 pb-4 pt-3 border-t border-neutral-100 dark:border-neutral-800" style={{ gap: 12 }}>
                <View>
                  <Text className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 mb-1">Company Name</Text>
                  <TextInput value={companyName} onChangeText={setCompanyName} placeholderTextColor={isDark ? '#737373' : '#a3a3a3'} className="w-full border border-neutral-200 dark:border-neutral-700 rounded-xl px-3 py-2.5 text-sm text-neutral-900 dark:text-white" />
                </View>
                <View>
                  <Text className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 mb-1">Category</Text>
                  <TextInput value={category} onChangeText={setCategory} placeholder="e.g. Plumber" placeholderTextColor={isDark ? '#737373' : '#a3a3a3'} className="w-full border border-neutral-200 dark:border-neutral-700 rounded-xl px-3 py-2.5 text-sm text-neutral-900 dark:text-white" />
                </View>
                <View className="relative z-20">
                  <Text className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 mb-1">Business Address</Text>
                  <View className="flex-row items-center border border-neutral-200 dark:border-neutral-700 rounded-xl px-3 py-2.5">
                    <FontAwesome5 name="map-marker-alt" size={12} color={isDark ? '#737373' : '#a3a3a3'} />
                    <TextInput
                      value={location}
                      onChangeText={searchAddress}
                      placeholder="Start typing your address..."
                      placeholderTextColor={isDark ? '#737373' : '#a3a3a3'}
                      className="flex-1 text-sm ml-2 text-neutral-900 dark:text-white"
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                    {isSearchingAddress && (
                      <BouncingDotsLoader size="small" color="#4F46E5" />
                    )}
                  </View>
                  {addressSuggestions.length > 0 && (
                    <View className="absolute top-full left-0 right-0 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-xl mt-1 shadow-lg max-h-[160px] overflow-hidden z-50">
                      <FlatList
                        data={addressSuggestions}
                        keyExtractor={(_, i) => `suggestion-${i}`}
                        renderItem={({ item }) => (
                          <TouchableOpacity
                            onPress={() => handleSelectAddress(item)}
                            className="px-3 py-2.5 border-b border-neutral-50 dark:border-neutral-800 flex-row items-start"
                          >
                            <FontAwesome5 name="map-pin" size={10} color="#4F46E5" style={{ marginTop: 3 }} />
                            <Text className="text-xs text-neutral-700 dark:text-neutral-300 ml-2 flex-1" numberOfLines={2}>
                              {item.display_name}
                            </Text>
                          </TouchableOpacity>
                        )}
                        keyboardShouldPersistTaps="handled"
                      />
                    </View>
                  )}
                </View>
                <View>
                  <Text className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 mb-1">Business Description</Text>
                  <TextInput value={description} onChangeText={setDescription} multiline numberOfLines={4} placeholderTextColor={isDark ? '#737373' : '#a3a3a3'} className="w-full border border-neutral-200 dark:border-neutral-700 rounded-xl px-3 py-2.5 text-sm min-h-[80px] text-neutral-900 dark:text-white" style={{ textAlignVertical: 'top' }} />
                </View>
                <View>
                  <Text className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 mb-1">Service Area (Zip Codes)</Text>
                  <TextInput value={serviceArea} onChangeText={setServiceArea} placeholder="e.g. 10001, 10002" placeholderTextColor={isDark ? '#737373' : '#a3a3a3'} className="w-full border border-neutral-200 dark:border-neutral-700 rounded-xl px-3 py-2.5 text-sm text-neutral-900 dark:text-white" />
                </View>
                <View>
                  <Text className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 mb-1">Public License Number</Text>
                  <TextInput value={licenseNumber} onChangeText={setLicenseNumber} placeholderTextColor={isDark ? '#737373' : '#a3a3a3'} className="w-full border border-neutral-200 dark:border-neutral-700 rounded-xl px-3 py-2.5 text-sm text-neutral-900 dark:text-white" />
                </View>
                <View className="flex-row items-center justify-between p-3.5 bg-neutral-50 dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 mt-1">
                  <View className="flex-1 pr-3">
                    <Text className="text-xs font-semibold text-neutral-900 dark:text-white">Show Completed Jobs</Text>
                    <Text className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                      Display your verified RateDeed completed job count publicly on your profile.
                    </Text>
                  </View>
                  <Switch
                    value={showCompletedJobs}
                    onValueChange={setShowCompletedJobs}
                    trackColor={{ false: isDark ? '#3f3f46' : '#d4d4d4', true: '#4f46e5' }}
                    thumbColor="#ffffff"
                  />
                </View>
              </View>
            )}
          </View>

          {/* Estimate & Service Call Policy Section */}
          <View className="bg-white dark:bg-neutral-950 rounded-xl border border-neutral-100 dark:border-neutral-800 overflow-hidden">
            <TouchableOpacity onPress={() => toggleSection('estimate')} className="px-4 py-3.5 flex-row items-center justify-between">
              <View className="flex-row items-center flex-1">
                <View className={`w-8 h-8 rounded-lg items-center justify-center ${estimateEnabled ? 'bg-emerald-50 dark:bg-emerald-950/50' : 'bg-neutral-100 dark:bg-neutral-800'}`}>
                  <FontAwesome5 name="calculator" size={14} color={estimateEnabled ? '#059669' : (isDark ? '#737373' : '#a3a3a3')} />
                </View>
                <View className="ml-3 flex-1">
                  <Text className="text-sm font-bold text-neutral-900 dark:text-white">Estimate & Service Policy</Text>
                  <Text className="text-[11px] text-neutral-500 dark:text-neutral-400">
                    {!estimateEnabled
                      ? 'Off · No badge displayed'
                      : estimateType === 'free'
                      ? '✓ 100% Free Project Estimates'
                      : estimateType === 'service_fee'
                      ? `$${feeAmount || 75} Diagnostic Fee ${feeWaivedIfHired ? '(Waived if hired)' : ''}`
                      : '⚡ Free Photo / Online Quotes'}
                  </Text>
                </View>
              </View>
              <View className={`w-5 h-5 rounded-full items-center justify-center ${activeSection === 'estimate' ? 'bg-indigo-600' : 'bg-neutral-100 dark:bg-neutral-800'}`}>
                <FontAwesome5 name="chevron-down" size={10} color={activeSection === 'estimate' ? '#fff' : (isDark ? '#737373' : '#a3a3a3')} />
              </View>
            </TouchableOpacity>

            {activeSection === 'estimate' && (
              <View className="px-4 pb-4 pt-3 border-t border-neutral-100 dark:border-neutral-800" style={{ gap: 12 }}>
                {/* On / Off Toggle Row */}
                <View className="flex-row items-center justify-between p-3 rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
                  <View className="flex-1 pr-3">
                    <Text className="text-sm font-bold text-neutral-900 dark:text-white">Display Estimate Policy</Text>
                    <Text className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                      Show an estimate badge & policy highlight on your public profile and search results.
                    </Text>
                  </View>
                  <Switch
                    value={estimateEnabled}
                    onValueChange={setEstimateEnabled}
                    trackColor={{ false: isDark ? '#333' : '#d4d4d4', true: '#10b981' }}
                    thumbColor={estimateEnabled ? '#ffffff' : '#f4f4f5'}
                  />
                </View>

                {!estimateEnabled ? (
                  <View className="p-3.5 rounded-xl bg-neutral-100/70 dark:bg-neutral-900/50 border border-dashed border-neutral-200 dark:border-neutral-800">
                    <Text className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
                      Estimate policy is currently <Text className="font-semibold text-neutral-700 dark:text-neutral-300">turned off</Text>. No estimate badges or diagnostic fee tags will appear on your public listing.
                    </Text>
                  </View>
                ) : (
                  <>
                    <Text className="text-xs text-neutral-500 dark:text-neutral-400">
                      Select how you provide estimates and service consultations:
                    </Text>

                    {/* Option 1: Free Estimates */}
                    <TouchableOpacity
                      onPress={() => setEstimateType('free')}
                      className={`p-3.5 rounded-xl border-2 ${
                        estimateType === 'free'
                          ? 'border-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/20'
                          : 'border-neutral-200 dark:border-neutral-800'
                      }`}
                    >
                      <View className="flex-row items-center justify-between">
                        <View className="flex-row items-center" style={{ gap: 8 }}>
                          <View className={`w-4 h-4 rounded-full border-2 items-center justify-center ${
                            estimateType === 'free' ? 'border-emerald-600 bg-emerald-600' : 'border-neutral-400'
                          }`}>
                            {estimateType === 'free' && <View className="w-1.5 h-1.5 rounded-full bg-white" />}
                          </View>
                          <Text className="text-sm font-bold text-neutral-900 dark:text-white">100% Free Estimates</Text>
                        </View>
                        <View className="bg-emerald-100 dark:bg-emerald-900 px-2 py-0.5 rounded-full">
                          <Text className="text-[10px] font-bold text-emerald-800 dark:text-emerald-200">Popular</Text>
                        </View>
                      </View>
                      <Text className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 ml-6">
                        Free on-site or remote project estimates with no upfront cost.
                      </Text>
                    </TouchableOpacity>

                    {/* Option 2: Diagnostic / Service Call Fee */}
                    <TouchableOpacity
                      onPress={() => setEstimateType('service_fee')}
                      className={`p-3.5 rounded-xl border-2 ${
                        estimateType === 'service_fee'
                          ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/20'
                          : 'border-neutral-200 dark:border-neutral-800'
                      }`}
                    >
                      <View className="flex-row items-center" style={{ gap: 8 }}>
                        <View className={`w-4 h-4 rounded-full border-2 items-center justify-center ${
                          estimateType === 'service_fee' ? 'border-indigo-600 bg-indigo-600' : 'border-neutral-400'
                        }`}>
                          {estimateType === 'service_fee' && <View className="w-1.5 h-1.5 rounded-full bg-white" />}
                        </View>
                        <Text className="text-sm font-bold text-neutral-900 dark:text-white">Diagnostic / Service Call Fee</Text>
                      </View>
                      <Text className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 ml-6">
                        For emergency troubleshooting, diagnostic visits, or trip fees.
                      </Text>

                      {estimateType === 'service_fee' && (
                        <View className="mt-3 pt-3 border-t border-indigo-100 dark:border-neutral-800" style={{ gap: 10 }}>
                          <View>
                            <Text className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">Fee Amount ($ USD)</Text>
                            <TextInput
                              value={feeAmount}
                              onChangeText={setFeeAmount}
                              keyboardType="numeric"
                              placeholder="75"
                              placeholderTextColor={isDark ? '#737373' : '#a3a3a3'}
                              className="w-full border border-neutral-200 dark:border-neutral-700 rounded-xl px-3 py-2 text-sm text-neutral-900 dark:text-white font-bold"
                            />
                          </View>
                          <TouchableOpacity
                            onPress={() => setFeeWaivedIfHired(!feeWaivedIfHired)}
                            className="flex-row items-center"
                            style={{ gap: 8 }}
                          >
                            <View className={`w-4 h-4 rounded border items-center justify-center ${
                              feeWaivedIfHired ? 'bg-indigo-600 border-indigo-600' : 'border-neutral-400'
                            }`}>
                              {feeWaivedIfHired && <FontAwesome5 name="check" size={10} color="#fff" />}
                            </View>
                            <Text className="text-xs text-neutral-800 dark:text-neutral-200 flex-1">
                              Waive/apply fee toward repair if homeowner hires you (Recommended)
                            </Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </TouchableOpacity>

                    {/* Option 3: Virtual Photo Quotes */}
                    <TouchableOpacity
                      onPress={() => setEstimateType('virtual_only')}
                      className={`p-3.5 rounded-xl border-2 ${
                        estimateType === 'virtual_only'
                          ? 'border-purple-600 bg-purple-50/50 dark:bg-purple-950/20'
                          : 'border-neutral-200 dark:border-neutral-800'
                      }`}
                    >
                      <View className="flex-row items-center" style={{ gap: 8 }}>
                        <View className={`w-4 h-4 rounded-full border-2 items-center justify-center ${
                          estimateType === 'virtual_only' ? 'border-purple-600 bg-purple-600' : 'border-neutral-400'
                        }`}>
                          {estimateType === 'virtual_only' && <View className="w-1.5 h-1.5 rounded-full bg-white" />}
                        </View>
                        <Text className="text-sm font-bold text-neutral-900 dark:text-white">Free Photo / Online Quotes Only</Text>
                      </View>
                      <Text className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 ml-6">
                        Homeowners send photos/video via chat for a preliminary estimate.
                      </Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            )}
          </View>

          {/* Services Section */}
          <View className="bg-white dark:bg-neutral-950 rounded-xl border border-neutral-100 dark:border-neutral-800 overflow-hidden">
            <TouchableOpacity onPress={() => toggleSection('services')} className="px-4 py-3.5 flex-row items-center justify-between">
              <View>
                <Text className="text-sm font-bold text-neutral-900 dark:text-white">Services</Text>
                <Text className="text-[11px] text-neutral-500 dark:text-neutral-400">{services.length} services listed</Text>
              </View>
              <View className={`w-5 h-5 rounded-full items-center justify-center ${activeSection === 'services' ? 'bg-indigo-600' : 'bg-neutral-100 dark:bg-neutral-800'}`}>
                <FontAwesome5 name="chevron-down" size={10} color={activeSection === 'services' ? '#fff' : (isDark ? '#737373' : '#a3a3a3')} />
              </View>
            </TouchableOpacity>

            {activeSection === 'services' && (
              <View className="px-4 pb-4 pt-3 border-t border-neutral-100 dark:border-neutral-800" style={{ gap: 12 }}>
                {services.map((service, index) => (
                  <View key={index} className="bg-neutral-50 dark:bg-neutral-900 p-3 rounded-xl relative">
                    <TouchableOpacity onPress={() => removeService(index)} className="absolute top-2 right-2 p-1 bg-white dark:bg-neutral-800 rounded-full shadow-sm">
                      <FontAwesome5 name="trash" size={10} color="#ef4444" />
                    </TouchableOpacity>
                    <TextInput 
                      value={service.name} 
                      onChangeText={(v) => updateService(index, 'name', v)} 
                      placeholder="Service Name" 
                      placeholderTextColor={isDark ? '#737373' : '#a3a3a3'}
                      className="font-bold text-sm text-neutral-900 dark:text-white mb-1 w-[90%]" 
                    />
                    <TextInput 
                      value={service.description} 
                      onChangeText={(v) => updateService(index, 'description', v)} 
                      placeholder="Brief description" 
                      placeholderTextColor={isDark ? '#737373' : '#a3a3a3'}
                      className="text-xs bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg p-2 mb-2 text-neutral-900 dark:text-white" 
                      multiline
                    />
                    <View style={{ gap: 8 }} className="mt-1">
                      <TouchableOpacity
                        onPress={() => updateService(index, 'contactForQuote', !service.contactForQuote)}
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
                      </TouchableOpacity>

                      {!service.contactForQuote && (
                        <View className="flex-row" style={{ gap: 8 }}>
                          <View className="flex-1 relative justify-center">
                            <Text className="absolute left-3 text-sm text-neutral-400 dark:text-neutral-500 z-10">$</Text>
                            <TextInput
                              value={service.minPrice}
                              onChangeText={t => {
                                const val = t.replace(/[^0-9]/g, '');
                                updateService(index, 'minPrice', val);
                              }}
                              placeholder="Min price"
                              placeholderTextColor={isDark ? "#737373" : "#a3a3a3"}
                              keyboardType="numeric"
                              className="bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg pl-7 pr-3 py-2 text-sm text-neutral-900 dark:text-white"
                            />
                          </View>
                          <View className="flex-1 relative justify-center">
                            <Text className="absolute left-3 text-sm text-neutral-400 dark:text-neutral-500 z-10">$</Text>
                            <TextInput
                              value={service.maxPrice}
                              onChangeText={t => {
                                const val = t.replace(/[^0-9]/g, '');
                                updateService(index, 'maxPrice', val);
                              }}
                              placeholder="Max price"
                              placeholderTextColor={isDark ? "#737373" : "#a3a3a3"}
                              keyboardType="numeric"
                              className="bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg pl-7 pr-3 py-2 text-sm text-neutral-900 dark:text-white"
                            />
                          </View>
                        </View>
                      )}
                    </View>
                  </View>
                ))}
                <TouchableOpacity onPress={addService} className="w-full py-3 border-2 border-dashed border-neutral-200 dark:border-neutral-700 rounded-xl items-center flex-row justify-center">
                  <FontAwesome5 name="plus" size={12} color={isDark ? '#a3a3a3' : '#737373'} />
                  <Text className="text-sm font-semibold text-neutral-500 dark:text-neutral-400 ml-2">Add Service</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Portfolio Section */}
          <View className="bg-white dark:bg-neutral-950 rounded-xl border border-neutral-100 dark:border-neutral-800 overflow-hidden">
            <TouchableOpacity onPress={() => toggleSection('portfolio')} className="px-4 py-3.5 flex-row items-center justify-between">
              <View>
                <Text className="text-sm font-bold text-neutral-900 dark:text-white">Portfolio</Text>
                <Text className="text-[11px] text-neutral-500 dark:text-neutral-400">{portfolio.length} projects</Text>
              </View>
              <View className={`w-5 h-5 rounded-full items-center justify-center ${activeSection === 'portfolio' ? 'bg-indigo-600' : 'bg-neutral-100 dark:bg-neutral-800'}`}>
                <FontAwesome5 name="chevron-down" size={10} color={activeSection === 'portfolio' ? '#fff' : (isDark ? '#737373' : '#a3a3a3')} />
              </View>
            </TouchableOpacity>

            {activeSection === 'portfolio' && (
              <View className="px-4 pb-4 pt-3 border-t border-neutral-100 dark:border-neutral-800" style={{ gap: 12 }}>
                {portfolio.map((project, index) => (
                  <View key={project.id} className="bg-neutral-50 dark:bg-neutral-900 p-3 rounded-xl relative">
                    <TouchableOpacity onPress={() => {
                        const updated = [...portfolio];
                        updated.splice(index, 1);
                        setPortfolio(updated);
                    }} className="absolute top-2 right-2 p-1 bg-white dark:bg-neutral-800 rounded-full shadow-sm z-10">
                      <FontAwesome5 name="trash" size={10} color="#ef4444" />
                    </TouchableOpacity>
                    
                    <View className="flex-row items-center">
                        <TouchableOpacity 
                          onPress={() => handlePortfolioImageUpload(index)}
                          className="w-12 h-12 rounded-lg bg-neutral-200 dark:bg-neutral-700 overflow-hidden mr-3 items-center justify-center border border-neutral-300 dark:border-neutral-600"
                        >
                            {project.localUri || (project.images && project.images[0]) ? (
                                <Image source={{ uri: project.localUri || project.images[0] }} className="w-full h-full" resizeMode="cover" />
                            ) : (
                                <FontAwesome5 name="camera" size={14} color={isDark ? '#737373' : '#a3a3a3'} />
                            )}
                        </TouchableOpacity>
                        <View className="flex-1 pr-6">
                            <TextInput 
                            value={project.title} 
                            onChangeText={(v) => {
                                const updated = [...portfolio];
                                updated[index].title = v;
                                setPortfolio(updated);
                            }} 
                            placeholder="Project Title" 
                            placeholderTextColor={isDark ? '#737373' : '#a3a3a3'}
                            className="font-bold text-sm text-neutral-900 dark:text-white mb-1" 
                            />
                            <TextInput 
                            value={project.category} 
                            onChangeText={(v) => {
                                const updated = [...portfolio];
                                updated[index].category = v;
                                setPortfolio(updated);
                            }} 
                            placeholder="Category" 
                            placeholderTextColor={isDark ? '#737373' : '#a3a3a3'}
                            className="text-xs text-neutral-500 dark:text-neutral-400" 
                            />
                        </View>
                    </View>
                  </View>
                ))}
                <TouchableOpacity onPress={() => setPortfolio([...portfolio, { id: `new-${Date.now()}`, title: '', images: [], category: '' }])} className="w-full py-3 border-2 border-dashed border-neutral-200 dark:border-neutral-700 rounded-xl items-center flex-row justify-center">
                  <FontAwesome5 name="plus" size={12} color={isDark ? '#a3a3a3' : '#737373'} />
                  <Text className="text-sm font-semibold text-neutral-500 dark:text-neutral-400 ml-2">Add Project</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Posts Section */}
          <View className="bg-white dark:bg-neutral-950 rounded-xl border border-neutral-100 dark:border-neutral-800 overflow-hidden">
            <TouchableOpacity onPress={() => toggleSection('posts')} className="px-4 py-3.5 flex-row items-center justify-between">
              <View>
                <Text className="text-sm font-bold text-neutral-900 dark:text-white">Posts</Text>
                <Text className="text-[11px] text-neutral-500 dark:text-neutral-400">{posts.length} posts</Text>
              </View>
              <View className={`w-5 h-5 rounded-full items-center justify-center ${activeSection === 'posts' ? 'bg-indigo-600' : 'bg-neutral-100 dark:bg-neutral-800'}`}>
                <FontAwesome5 name="chevron-down" size={10} color={activeSection === 'posts' ? '#fff' : (isDark ? '#737373' : '#a3a3a3')} />
              </View>
            </TouchableOpacity>

            {activeSection === 'posts' && (
              <View className="px-4 pb-4 pt-3 border-t border-neutral-100 dark:border-neutral-800" style={{ gap: 12 }}>
                {posts.map((post) => (
                  <View key={post._id || post.id} className="bg-neutral-50 dark:bg-neutral-900 p-3 rounded-xl flex-row" style={{ gap: 12 }}>
                    <View className="w-14 h-14 rounded-lg bg-neutral-200 dark:bg-neutral-700 overflow-hidden shrink-0">
                      {post.images && post.images[0] && (
                        <Image source={{ uri: post.images[0] }} className="w-full h-full" resizeMode="cover" />
                      )}
                    </View>
                    <View className="flex-1 justify-center">
                      <Text className="text-xs text-neutral-500 dark:text-neutral-400" numberOfLines={2}>
                        {post.caption || 'No caption'}
                      </Text>
                    </View>
                  </View>
                ))}
                <TouchableOpacity onPress={() => navigation.navigate('ContractorDashboard', { openCreatePost: true })} className="w-full py-3 border-2 border-dashed border-neutral-200 dark:border-neutral-700 rounded-xl items-center flex-row justify-center">
                  <FontAwesome5 name="plus" size={12} color={isDark ? '#a3a3a3' : '#737373'} />
                  <Text className="text-sm font-semibold text-neutral-500 dark:text-neutral-400 ml-2">Create New Post</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}