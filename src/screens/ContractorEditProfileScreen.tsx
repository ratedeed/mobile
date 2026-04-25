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
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getContractorProfile, updateContractorProfile, requestVerification } from '../api';
import { uploadToCloudinary, CLOUDINARY_FOLDERS } from '../utils/cloudinary';
import { useAuth } from '../context/AuthContext';

type EditSection = 'about' | 'services' | 'portfolio' | 'posts' | 'verification' | null;

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
}

export default function ContractorEditProfileScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { userId } = useAuth();
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
  const [companyName, setCompanyName] = useState('');
  const [category, setCategory] = useState('');
  const [location, setLocation] = useState('');

  // Address autocomplete
  const [addressSuggestions, setAddressSuggestions] = useState<any[]>([]);
  const [isSearchingAddress, setIsSearchingAddress] = useState(false);
  const addressSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Local files to upload
  const [profilePicUri, setProfilePicUri] = useState<string | null>(null);
  const [bannerPicUri, setBannerPicUri] = useState<string | null>(null);

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
        console.error('Address search error:', error);
      } finally {
        setIsSearchingAddress(false);
      }
    }, 500);
  };

  const handleSelectAddress = (item: any) => {
    setLocation(item.display_name);
    setAddressSuggestions([]);
  };

  const loadProfile = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getContractorProfile();
      setProfileData(data);
      
      setDescription(data.description || '');
      setServiceArea(data.zipCodesCovered?.join(', ') || (data as any).serviceZipCodes?.join(', ') || '');
      setLicenseNumber(data.licenseNumber || '');
      setCompanyName(data.companyName || data.businessName || '');
      setCategory(data.category || '');
      setLocation((data as any).businessAddress || (data as any).address || '');
      setProfilePicture(data.profilePicture || (data as any).imageUrl || '');
      setCoverImage(data.bannerImage || (data as any).bannerUrl || '');
      
      if (Array.isArray(data.servicesOffered)) {
        setServices(data.servicesOffered.map((s: any) => ({
          name: s.name || '',
          description: s.description || '',
          priceRange: s.priceEstimate || s.priceRange || '',
        })));
      }
      
      if (Array.isArray(data.portfolio)) {
        setPortfolio(data.portfolio.map((p: any) => ({
          id: p._id || p.id || `portfolio-${Date.now()}`,
          title: p.name || p.title || '',
          images: Array.isArray(p.images) ? p.images : (p.imageUrl ? [p.imageUrl] : []),
          category: p.category || '',
        })));
      }
      
      if (Array.isArray(data.posts)) {
        setPosts(data.posts);
      }
    } catch (err) {
      console.error('Failed to load contractor profile:', err);
      Alert.alert('Error', 'Failed to load profile data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const licenseStatus = profileData?.licenseStatus || 'not_submitted';
  const verificationNotes = profileData?.verificationNotes || '';
  const isVerified = profileData?.isVerified || false;

  const handleImageSelect = async (type: 'profile' | 'banner') => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
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
    } catch (err) {
      console.error('Failed to pick image:', err);
    }
  };

  const handleLicenseDocSelect = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.7,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        setLicenseDocUri(result.assets[0].uri);
      }
    } catch (err) {
      console.error('Failed to pick license doc:', err);
    }
  };

  const handleSave = async () => {
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

      const updateData: any = {
        companyName: companyName || undefined,
        businessName: companyName || undefined,
        description: description || undefined,
        zipCodesCovered: serviceArea.split(',').map(s => s.trim()).filter(Boolean),
        licenseNumber: licenseNumber || undefined,
        profilePicture: finalProfilePicUrl || undefined,
        bannerImage: finalCoverImageUrl || undefined,
        servicesOffered: services.map(s => ({
          name: s.name || undefined,
          description: s.description || undefined,
          priceEstimate: s.priceRange || undefined,
        })),
        portfolio: portfolio.map(p => ({
          name: p.title || undefined,
          category: p.category || undefined,
          imageUrl: p.images[0] || undefined,
          images: p.images,
        })),
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
      console.error('Failed to save profile:', err);
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
      const uploadedDocUrl = await uploadToCloudinary(licenseDocUri, CLOUDINARY_FOLDERS.LICENSES);
      await requestVerification({
        licenseNumber: verifLicenseNumber.trim(),
        licenseDocumentUrl: uploadedDocUrl,
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

  // Section toggles
  const toggleSection = (section: EditSection) => {
    setActiveSection(activeSection === section ? null : section);
  };

  const addService = () => setServices([...services, { name: '', description: '', priceRange: '' }]);
  const updateService = (index: number, field: keyof ServiceItem, value: string) => {
    const updated = [...services];
    updated[index] = { ...updated[index], [field]: value };
    setServices(updated);
  };
  const removeService = (index: number) => setServices(services.filter((_, i) => i !== index));

  if (loading) {
    return (
      <View className="flex-1 bg-neutral-50 items-center justify-center">
        <ActivityIndicator size="large" color="#4F46E5" />
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
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 bg-neutral-50">
      {/* Header */}
      <View className="bg-white border-b border-neutral-200 flex-row items-center justify-between px-4" style={{ paddingTop: Math.max(insets.top, 16), paddingBottom: 12, zIndex: 40 }}>
        <TouchableOpacity onPress={() => navigation.goBack()} className="w-8 h-8 items-center justify-center rounded-full bg-neutral-100">
          <FontAwesome5 name="chevron-left" size={16} color="#171717" />
        </TouchableOpacity>
        <Text className="text-base font-bold text-neutral-900">Edit Profile</Text>
        <TouchableOpacity onPress={handleSave} disabled={saving} className="bg-indigo-600 px-3 py-1.5 rounded-lg flex-row items-center">
          {saving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <FontAwesome5 name="save" size={12} color="#fff" solid />
              <Text className="text-white text-xs font-semibold ml-1.5">Save</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
        {/* Cover Image */}
        <View className="relative w-full aspect-video bg-neutral-200">
          <Image source={{ uri: bannerPicUri || coverImage || 'https://via.placeholder.com/1200x400' }} className="w-full h-full" resizeMode="cover" />
          <View className="absolute inset-0 bg-black/30 items-center justify-center">
            <TouchableOpacity onPress={() => handleImageSelect('banner')} className="bg-white rounded-2xl px-5 py-3 shadow-sm items-center">
              <View className="flex-row items-center">
                <FontAwesome5 name="camera" size={14} color="#404040" />
                <Text className="text-sm font-semibold text-neutral-900 ml-2">Change Cover</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* Profile Info */}
        <View className="bg-white px-4 py-4 -mt-6 mx-4 rounded-xl border border-neutral-100 shadow-sm z-10 flex-row items-end">
          <View className="relative -mt-10 mr-3">
            <Image source={{ uri: profilePicUri || profilePicture || 'https://via.placeholder.com/200' }} className="w-16 h-16 rounded-xl border-2 border-white bg-white" />
            <TouchableOpacity onPress={() => handleImageSelect('profile')} className="absolute -bottom-1 -right-1 w-6 h-6 bg-indigo-600 rounded-full items-center justify-center border-2 border-white">
              <FontAwesome5 name="camera" size={10} color="#fff" />
            </TouchableOpacity>
          </View>
          <View className="flex-1 pb-1">
            <View className="flex-row items-center">
              <Text className="text-sm font-bold text-neutral-900">{companyName || 'Your Business'}</Text>
              {isVerified && <FontAwesome5 name="shield-alt" size={12} color="#4F46E5" solid style={{ marginLeft: 6 }} />}
            </View>
            <Text className="text-xs text-neutral-500">{category}{location ? ` · ${location}` : ''}</Text>
          </View>
        </View>

        <View className="px-4 mt-4" style={{ gap: 12 }}>
          {/* Verification Section */}
          <View className="bg-white rounded-xl border border-neutral-100 overflow-hidden">
            <TouchableOpacity onPress={() => toggleSection('verification')} className="px-4 py-3.5 flex-row items-center justify-between">
              <View className="flex-row items-center flex-1">
                <View className={`w-8 h-8 rounded-lg items-center justify-center ${licenseStatus === 'approved' ? 'bg-emerald-50' : 'bg-indigo-50'}`}>
                  <FontAwesome5 name="shield-alt" size={14} color={licenseStatus === 'approved' ? '#059669' : '#4F46E5'} />
                </View>
                <View className="ml-3 flex-1">
                  <View className="flex-row items-center">
                    <Text className="text-sm font-bold text-neutral-900">License Verification</Text>
                    {renderLicenseStatusBadge()}
                  </View>
                  <Text className="text-[11px] text-neutral-500">Get verified to build trust with homeowners</Text>
                </View>
              </View>
              <View className={`w-5 h-5 rounded-full items-center justify-center ${activeSection === 'verification' ? 'bg-indigo-600' : 'bg-neutral-100'}`}>
                <FontAwesome5 name="chevron-down" size={10} color={activeSection === 'verification' ? '#fff' : '#a3a3a3'} />
              </View>
            </TouchableOpacity>

            {activeSection === 'verification' && (
              <View className="px-4 pb-4 pt-3 border-t border-neutral-100" style={{ gap: 12 }}>
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
                    <Text className="text-xs text-amber-700 mt-1">Your document is being reviewed. This usually takes 2-3 business days.</Text>
                  </View>
                )}

                {licenseStatus !== 'approved' && licenseStatus !== 'pending' && (
                  <View style={{ gap: 12 }}>
                    <View>
                      <Text className="text-xs font-semibold text-neutral-500 mb-1">License Number</Text>
                      <TextInput
                        value={verifLicenseNumber || licenseNumber}
                        onChangeText={setVerifLicenseNumber}
                        placeholder="e.g. LIC-2024-123"
                        className="w-full border border-neutral-200 rounded-xl px-3 py-2.5 text-sm"
                      />
                    </View>
                    <View>
                      <Text className="text-xs font-semibold text-neutral-500 mb-1">License Document (Photo)</Text>
                      {licenseDocUri ? (
                        <View className="flex-row items-center bg-indigo-50 p-3 rounded-xl border border-indigo-200">
                          <FontAwesome5 name="file-image" size={16} color="#4F46E5" />
                          <Text className="text-xs font-semibold text-indigo-900 ml-2 flex-1 truncate" numberOfLines={1}>Document selected</Text>
                          <TouchableOpacity onPress={() => setLicenseDocUri(null)} className="p-1">
                            <FontAwesome5 name="times-circle" size={14} color="#a3a3a3" />
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <TouchableOpacity onPress={handleLicenseDocSelect} className="w-full flex-row items-center justify-center py-4 border-2 border-dashed border-neutral-200 rounded-xl">
                          <FontAwesome5 name="upload" size={14} color="#737373" />
                          <Text className="text-sm text-neutral-500 font-medium ml-2">Upload License Document</Text>
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
                        verifLicenseNumber.trim() && licenseDocUri && !isSubmittingVerification ? 'bg-indigo-600' : 'bg-neutral-200'
                      }`}
                    >
                      {isSubmittingVerification ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <>
                          <FontAwesome5 name="shield-alt" size={14} color={verifLicenseNumber.trim() && licenseDocUri ? "#fff" : "#a3a3a3"} />
                          <Text className={`text-sm font-semibold ml-2 ${verifLicenseNumber.trim() && licenseDocUri ? 'text-white' : 'text-neutral-400'}`}>Submit for Verification</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}
          </View>

          {/* About Section */}
          <View className="bg-white rounded-xl border border-neutral-100 overflow-hidden">
            <TouchableOpacity onPress={() => toggleSection('about')} className="px-4 py-3.5 flex-row items-center justify-between">
              <View>
                <Text className="text-sm font-bold text-neutral-900">About Us</Text>
                <Text className="text-[11px] text-neutral-500">Business description, service area, basic details</Text>
              </View>
              <View className={`w-5 h-5 rounded-full items-center justify-center ${activeSection === 'about' ? 'bg-indigo-600' : 'bg-neutral-100'}`}>
                <FontAwesome5 name="chevron-down" size={10} color={activeSection === 'about' ? '#fff' : '#a3a3a3'} />
              </View>
            </TouchableOpacity>

            {activeSection === 'about' && (
              <View className="px-4 pb-4 pt-3 border-t border-neutral-100" style={{ gap: 12 }}>
                <View>
                  <Text className="text-xs font-semibold text-neutral-500 mb-1">Company Name</Text>
                  <TextInput value={companyName} onChangeText={setCompanyName} className="w-full border border-neutral-200 rounded-xl px-3 py-2.5 text-sm" />
                </View>
                <View>
                  <Text className="text-xs font-semibold text-neutral-500 mb-1">Category</Text>
                  <TextInput value={category} onChangeText={setCategory} placeholder="e.g. Plumber" className="w-full border border-neutral-200 rounded-xl px-3 py-2.5 text-sm" />
                </View>
                <View>
                  <Text className="text-xs font-semibold text-neutral-500 mb-1">Business Description</Text>
                  <TextInput value={description} onChangeText={setDescription} multiline numberOfLines={4} className="w-full border border-neutral-200 rounded-xl px-3 py-2.5 text-sm min-h-[80px]" style={{ textAlignVertical: 'top' }} />
                </View>
                <View>
                  <Text className="text-xs font-semibold text-neutral-500 mb-1">Service Area (Zip Codes)</Text>
                  <TextInput value={serviceArea} onChangeText={setServiceArea} placeholder="e.g. 10001, 10002" className="w-full border border-neutral-200 rounded-xl px-3 py-2.5 text-sm" />
                </View>
                <View>
                  <Text className="text-xs font-semibold text-neutral-500 mb-1">Public License Number</Text>
                  <TextInput value={licenseNumber} onChangeText={setLicenseNumber} className="w-full border border-neutral-200 rounded-xl px-3 py-2.5 text-sm" />
                </View>
              </View>
            )}
          </View>

          {/* Services Section */}
          <View className="bg-white rounded-xl border border-neutral-100 overflow-hidden">
            <TouchableOpacity onPress={() => toggleSection('services')} className="px-4 py-3.5 flex-row items-center justify-between">
              <View>
                <Text className="text-sm font-bold text-neutral-900">Services</Text>
                <Text className="text-[11px] text-neutral-500">{services.length} services listed</Text>
              </View>
              <View className={`w-5 h-5 rounded-full items-center justify-center ${activeSection === 'services' ? 'bg-indigo-600' : 'bg-neutral-100'}`}>
                <FontAwesome5 name="chevron-down" size={10} color={activeSection === 'services' ? '#fff' : '#a3a3a3'} />
              </View>
            </TouchableOpacity>

            {activeSection === 'services' && (
              <View className="px-4 pb-4 pt-3 border-t border-neutral-100" style={{ gap: 12 }}>
                {services.map((service, index) => (
                  <View key={index} className="bg-neutral-50 p-3 rounded-xl relative">
                    <TouchableOpacity onPress={() => removeService(index)} className="absolute top-2 right-2 p-1 bg-white rounded-full shadow-sm">
                      <FontAwesome5 name="trash" size={10} color="#ef4444" />
                    </TouchableOpacity>
                    <TextInput 
                      value={service.name} 
                      onChangeText={(v) => updateService(index, 'name', v)} 
                      placeholder="Service Name" 
                      className="font-bold text-sm text-neutral-900 mb-1 w-[90%]" 
                    />
                    <TextInput 
                      value={service.description} 
                      onChangeText={(v) => updateService(index, 'description', v)} 
                      placeholder="Brief description" 
                      className="text-xs bg-white border border-neutral-200 rounded-lg p-2 mb-2" 
                      multiline
                    />
                    <TextInput 
                      value={service.priceRange} 
                      onChangeText={(v) => updateService(index, 'priceRange', v)} 
                      placeholder="Price range e.g. $100 - $500" 
                      className="text-xs bg-white border border-neutral-200 rounded-lg p-2 font-semibold text-indigo-600" 
                    />
                  </View>
                ))}
                <TouchableOpacity onPress={addService} className="w-full py-3 border-2 border-dashed border-neutral-200 rounded-xl items-center flex-row justify-center">
                  <FontAwesome5 name="plus" size={12} color="#737373" />
                  <Text className="text-sm font-semibold text-neutral-500 ml-2">Add Service</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Portfolio Section */}
          <View className="bg-white rounded-xl border border-neutral-100 overflow-hidden">
            <TouchableOpacity onPress={() => toggleSection('portfolio')} className="px-4 py-3.5 flex-row items-center justify-between">
              <View>
                <Text className="text-sm font-bold text-neutral-900">Portfolio</Text>
                <Text className="text-[11px] text-neutral-500">{portfolio.length} projects</Text>
              </View>
              <View className={`w-5 h-5 rounded-full items-center justify-center ${activeSection === 'portfolio' ? 'bg-indigo-600' : 'bg-neutral-100'}`}>
                <FontAwesome5 name="chevron-down" size={10} color={activeSection === 'portfolio' ? '#fff' : '#a3a3a3'} />
              </View>
            </TouchableOpacity>

            {activeSection === 'portfolio' && (
              <View className="px-4 pb-4 pt-3 border-t border-neutral-100" style={{ gap: 12 }}>
                {portfolio.map((project, index) => (
                  <View key={project.id} className="bg-neutral-50 p-3 rounded-xl relative">
                    <TouchableOpacity onPress={() => {
                        const updated = [...portfolio];
                        updated.splice(index, 1);
                        setPortfolio(updated);
                    }} className="absolute top-2 right-2 p-1 bg-white rounded-full shadow-sm z-10">
                      <FontAwesome5 name="trash" size={10} color="#ef4444" />
                    </TouchableOpacity>
                    
                    <View className="flex-row items-center">
                        <View className="w-12 h-12 rounded-lg bg-neutral-200 overflow-hidden mr-3">
                            {project.images[0] && (
                                <Image source={{ uri: project.images[0] }} className="w-full h-full" resizeMode="cover" />
                            )}
                        </View>
                        <View className="flex-1 pr-6">
                            <TextInput 
                            value={project.title} 
                            onChangeText={(v) => {
                                const updated = [...portfolio];
                                updated[index].title = v;
                                setPortfolio(updated);
                            }} 
                            placeholder="Project Title" 
                            className="font-bold text-sm text-neutral-900 mb-1" 
                            />
                            <TextInput 
                            value={project.category} 
                            onChangeText={(v) => {
                                const updated = [...portfolio];
                                updated[index].category = v;
                                setPortfolio(updated);
                            }} 
                            placeholder="Category" 
                            className="text-xs text-neutral-500" 
                            />
                        </View>
                    </View>
                  </View>
                ))}
                <TouchableOpacity onPress={() => setPortfolio([...portfolio, { id: `new-${Date.now()}`, title: '', images: [], category: '' }])} className="w-full py-3 border-2 border-dashed border-neutral-200 rounded-xl items-center flex-row justify-center">
                  <FontAwesome5 name="plus" size={12} color="#737373" />
                  <Text className="text-sm font-semibold text-neutral-500 ml-2">Add Project</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Posts Section */}
          <View className="bg-white rounded-xl border border-neutral-100 overflow-hidden">
            <TouchableOpacity onPress={() => toggleSection('posts')} className="px-4 py-3.5 flex-row items-center justify-between">
              <View>
                <Text className="text-sm font-bold text-neutral-900">Posts</Text>
                <Text className="text-[11px] text-neutral-500">{posts.length} posts</Text>
              </View>
              <View className={`w-5 h-5 rounded-full items-center justify-center ${activeSection === 'posts' ? 'bg-indigo-600' : 'bg-neutral-100'}`}>
                <FontAwesome5 name="chevron-down" size={10} color={activeSection === 'posts' ? '#fff' : '#a3a3a3'} />
              </View>
            </TouchableOpacity>

            {activeSection === 'posts' && (
              <View className="px-4 pb-4 pt-3 border-t border-neutral-100" style={{ gap: 12 }}>
                {posts.map((post) => (
                  <View key={post._id || post.id} className="bg-neutral-50 p-3 rounded-xl flex-row" style={{ gap: 12 }}>
                    <View className="w-14 h-14 rounded-lg bg-neutral-200 overflow-hidden shrink-0">
                      {post.images && post.images[0] && (
                        <Image source={{ uri: post.images[0] }} className="w-full h-full" resizeMode="cover" />
                      )}
                    </View>
                    <View className="flex-1 justify-center">
                      <Text className="text-xs text-neutral-500" numberOfLines={2}>
                        {post.caption || 'No caption'}
                      </Text>
                      <Text className="text-[10px] text-neutral-400 mt-1">
                        {post.likes?.length || 0} likes
                      </Text>
                    </View>
                  </View>
                ))}
                <TouchableOpacity onPress={() => navigation.navigate('ContractorDashboard')} className="w-full py-3 border-2 border-dashed border-neutral-200 rounded-xl items-center flex-row justify-center">
                  <FontAwesome5 name="plus" size={12} color="#737373" />
                  <Text className="text-sm font-semibold text-neutral-500 ml-2">Create New Post</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}