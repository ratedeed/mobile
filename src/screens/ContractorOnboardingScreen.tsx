import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  Image,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Dimensions,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { FontAwesome5 } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { updateContractorProfile, getStripeConnectUrl } from '../api';
import { uploadToCloudinary, CLOUDINARY_FOLDERS } from '../utils/cloudinary';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const STEPS = [
  { key: 'welcome', label: 'Welcome', icon: 'briefcase' },
  { key: 'profile', label: 'Profile', icon: 'camera' },
  { key: 'services', label: 'Services', icon: 'dollar-sign' },
  { key: 'portfolio', label: 'Portfolio', icon: 'image' },
  { key: 'location', label: 'Area', icon: 'map-marker-alt' },
  { key: 'license', label: 'License', icon: 'shield-alt' },
  { key: 'payments', label: 'Payments', icon: 'credit-card' },
];

export default function ContractorOnboardingScreen() {
  const navigation = useNavigation();
  const [currentStep, setCurrentStep] = useState(0);
  const [saving, setSaving] = useState(false);

  // Profile
  const [description, setDescription] = useState('');
  const [profilePictureUri, setProfilePictureUri] = useState('');
  const [profilePictureUrl, setProfilePictureUrl] = useState('');
  const [bannerImageUri, setBannerImageUri] = useState('');
  const [bannerImageUrl, setBannerImageUrl] = useState('');

  // Services
  const [services, setServices] = useState<{ name: string; description: string; priceEstimate: string }[]>([
    { name: '', description: '', priceEstimate: '' },
  ]);

  // Portfolio
  const [portfolioItems, setPortfolioItems] = useState<{ name: string; localUri: string; imageUrl: string }[]>([]);

  // Location
  const [zipCodes, setZipCodes] = useState('');

  // License
  const [licenseNumber, setLicenseNumber] = useState('');

  const progress = ((currentStep + 1) / STEPS.length) * 100;

  const pickImage = async (type: 'profile' | 'banner') => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: type === 'banner' ? [16, 7] : [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      const uri = result.assets[0].uri;
      if (type === 'profile') setProfilePictureUri(uri);
      else setBannerImageUri(uri);
    }
  };

  const pickPortfolioImage = async (index: number) => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setPortfolioItems(prev => {
        const updated = [...prev];
        updated[index] = { ...updated[index], localUri: result.assets[0].uri, name: updated[index].name || `Project ${index + 1}` };
        return updated;
      });
    }
  };

  const uploadImage = async (uri: string, folder: string): Promise<string> => {
    return uploadToCloudinary(uri, folder);
  };

  const saveAndNext = async () => {
    setSaving(true);
    try {
      const updateData: any = {};

      if (currentStep === 1) {
        // Upload images first
        if (profilePictureUri && !profilePictureUrl) {
          const url = await uploadImage(profilePictureUri, CLOUDINARY_FOLDERS.CONTRACTOR_PROFILE);
          setProfilePictureUrl(url);
          updateData.profilePicture = url;
        } else if (profilePictureUrl) {
          updateData.profilePicture = profilePictureUrl;
        }
        if (bannerImageUri && !bannerImageUrl) {
          const url = await uploadImage(bannerImageUri, CLOUDINARY_FOLDERS.CONTRACTOR_BANNER);
          setBannerImageUrl(url);
          updateData.bannerImage = url;
        } else if (bannerImageUrl) {
          updateData.bannerImage = bannerImageUrl;
        }
        if (description) updateData.description = description;
      } else if (currentStep === 2) {
        const valid = services.filter(s => s.name.trim());
        if (valid.length > 0) updateData.servicesOffered = valid;
      } else if (currentStep === 3) {
        // Upload portfolio images
        const uploaded = [];
        for (const item of portfolioItems) {
          if (!item.name.trim()) continue;
          if (item.localUri && !item.imageUrl) {
            const url = await uploadImage(item.localUri, CLOUDINARY_FOLDERS.PORTFOLIO);
            uploaded.push({ name: item.name, imageUrl: url });
          } else if (item.imageUrl) {
            uploaded.push({ name: item.name, imageUrl: item.imageUrl });
          }
        }
        if (uploaded.length > 0) updateData.portfolio = uploaded;
      } else if (currentStep === 4) {
        if (zipCodes.trim()) {
          updateData.zipCodesCovered = zipCodes.split(',').map(z => z.trim()).filter(Boolean);
        }
      } else if (currentStep === 5) {
        if (licenseNumber.trim()) updateData.licenseNumber = licenseNumber;
      }

      if (Object.keys(updateData).length > 0) {
        await updateContractorProfile(updateData);
      }

      if (currentStep < STEPS.length - 1) {
        setCurrentStep(currentStep + 1);
      }
    } catch {
      if (currentStep < STEPS.length - 1) {
        setCurrentStep(currentStep + 1);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleFinish = async () => {
    setSaving(true);
    try {
      await updateContractorProfile({ onboardingComplete: true } as any);
      navigation.navigate('ContractorDashboard' as never);
    } catch {
      navigation.navigate('ContractorDashboard' as never);
    } finally {
      setSaving(false);
    }
  };

  const handleStripeConnect = async () => {
    try {
      const { url } = await getStripeConnectUrl();
      if (url) {
        Alert.alert('Stripe Connect', 'Opening Stripe setup in your browser.');
        const { Linking } = require('react-native');
        Linking.openURL(url);
      }
    } catch {
      // silent
    }
  };

  const goBack = () => {
    if (currentStep > 0) setCurrentStep(currentStep - 1);
    else navigation.goBack();
  };

  return (
    <View className="flex-1 bg-white">
      {/* Progress bar */}
      <View className="pt-12 pb-3 px-6">
        <View className="flex-row items-center justify-between mb-3">
          <Pressable onPress={goBack} className="py-1">
            <FontAwesome5 name="arrow-left" size={16} color="#737373" />
          </Pressable>
          <Text className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">
            Step {currentStep + 1} of {STEPS.length}
          </Text>
          <View className="w-6" />
        </View>
        <View className="h-1 bg-neutral-100 rounded-full overflow-hidden">
          <View
            className="h-full bg-neutral-900 rounded-full"
            style={{ width: `${progress}%` }}
          />
        </View>
      </View>

      {/* Content */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        <ScrollView className="flex-1 px-6" showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {/* Step 0: Welcome */}
          {currentStep === 0 && (
            <View className="items-center pt-8 pb-32">
              <View className="w-20 h-20 bg-neutral-900 rounded-3xl items-center justify-center mb-6">
                <FontAwesome5 name="briefcase" size={28} color="white" />
              </View>
              <Text className="text-2xl font-bold text-neutral-900 mb-3 text-center">
                Welcome to Ratedeed
              </Text>
              <Text className="text-neutral-500 text-sm leading-relaxed mb-8 text-center px-4">
                Set up your contractor profile to start receiving leads and getting hired by homeowners in your area. It takes about 5 minutes.
              </Text>
              <View className="w-full space-y-3">
                {STEPS.slice(1).map((step) => (
                  <View key={step.key} className="flex-row items-center bg-neutral-50 rounded-2xl px-4 py-3" style={{ gap: 12 }}>
                    <View className="w-8 h-8 bg-white rounded-xl items-center justify-center">
                      <FontAwesome5 name={step.icon} size={12} color="#525252" />
                    </View>
                    <Text className="text-sm font-semibold text-neutral-700">{step.label}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Step 1: Profile */}
          {currentStep === 1 && (
            <View className="pt-2 pb-32">
              <Text className="text-xl font-bold text-neutral-900 mb-1">Your Profile</Text>
              <Text className="text-sm text-neutral-500 mb-6">Add a photo and tell homeowners about your business.</Text>

              {/* Banner */}
              <Text className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-2">Cover Photo</Text>
              <Pressable
                onPress={() => pickImage('banner')}
                className="bg-neutral-100 rounded-2xl overflow-hidden mb-3"
                style={{ aspectRatio: 16 / 7 }}
              >
                {bannerImageUri || bannerImageUrl ? (
                  <Image
                    source={{ uri: bannerImageUri || bannerImageUrl }}
                    className="w-full h-full"
                    resizeMode="cover"
                  />
                ) : (
                  <View className="flex-1 items-center justify-center" style={{ gap: 4 }}>
                    <FontAwesome5 name="cloud-upload-alt" size={18} color="#a3a3a3" />
                    <Text className="text-xs text-neutral-400">Upload cover photo</Text>
                  </View>
                )}
              </Pressable>

              {/* Profile picture */}
              <Pressable
                onPress={() => pickImage('profile')}
                className="-mt-7 ml-4 mb-4 w-16 h-16 rounded-2xl overflow-hidden border-4 border-white bg-neutral-100 items-center justify-center"
                style={{ elevation: 4 }}
              >
                {profilePictureUri || profilePictureUrl ? (
                  <Image
                    source={{ uri: profilePictureUri || profilePictureUrl }}
                    className="w-full h-full"
                    resizeMode="cover"
                  />
                ) : (
                  <FontAwesome5 name="camera" size={18} color="#a3a3a3" />
                )}
              </Pressable>

              {/* Description */}
              <Text className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-2">About Your Business</Text>
              <TextInput
                value={description}
                onChangeText={setDescription}
                placeholder="Tell homeowners what makes your business special..."
                placeholderTextColor="#a3a3a3"
                multiline
                maxLength={1000}
                className="bg-neutral-50 rounded-2xl px-4 py-3 text-sm text-neutral-900 min-h-[100px] text-top"
                style={{ textAlignVertical: 'top' }}
              />
              <Text className="text-[10px] text-neutral-400 mt-1 text-right">{description.length}/1000</Text>
            </View>
          )}

          {/* Step 2: Services */}
          {currentStep === 2 && (
            <View className="pt-2 pb-32">
              <Text className="text-xl font-bold text-neutral-900 mb-1">Services You Offer</Text>
              <Text className="text-sm text-neutral-500 mb-6">Add the services homeowners can hire you for.</Text>

              <View style={{ gap: 12 }}>
                {services.map((service, i) => (
                  <View key={i} className="bg-neutral-50 rounded-2xl p-4">
                    <View className="flex-row items-center justify-between mb-3">
                      <Text className="text-xs font-bold text-neutral-400">Service {i + 1}</Text>
                      {services.length > 1 && (
                        <Pressable onPress={() => setServices(s => s.filter((_, idx) => idx !== i))}>
                          <FontAwesome5 name="times" size={12} color="#a3a3a3" />
                        </Pressable>
                      )}
                    </View>
                    <TextInput
                      value={service.name}
                      onChangeText={t => setServices(s => s.map((sv, idx) => idx === i ? { ...sv, name: t } : sv))}
                      placeholder="Service name (e.g., Kitchen Remodeling)"
                      placeholderTextColor="#a3a3a3"
                      className="bg-white rounded-xl px-3 py-2.5 text-sm text-neutral-900 mb-2"
                    />
                    <TextInput
                      value={service.description}
                      onChangeText={t => setServices(s => s.map((sv, idx) => idx === i ? { ...sv, description: t } : sv))}
                      placeholder="Brief description"
                      placeholderTextColor="#a3a3a3"
                      className="bg-white rounded-xl px-3 py-2.5 text-sm text-neutral-900 mb-2"
                    />
                    <TextInput
                      value={service.priceEstimate}
                      onChangeText={t => setServices(s => s.map((sv, idx) => idx === i ? { ...sv, priceEstimate: t } : sv))}
                      placeholder="Price range (e.g., $500 - $2,000)"
                      placeholderTextColor="#a3a3a3"
                      className="bg-white rounded-xl px-3 py-2.5 text-sm text-neutral-900"
                    />
                  </View>
                ))}
              </View>

              <Pressable
                onPress={() => setServices(s => [...s, { name: '', description: '', priceEstimate: '' }])}
                className="flex-row items-center mt-4"
                style={{ gap: 8 }}
              >
                <FontAwesome5 name="plus" size={12} color="#4F46E5" />
                <Text className="text-sm font-semibold text-indigo-600">Add another service</Text>
              </Pressable>
            </View>
          )}

          {/* Step 3: Portfolio */}
          {currentStep === 3 && (
            <View className="pt-2 pb-32">
              <Text className="text-xl font-bold text-neutral-900 mb-1">Portfolio</Text>
              <Text className="text-sm text-neutral-500 mb-6">Show off your best work. You can add more later.</Text>

              <View className="flex-row flex-wrap" style={{ gap: 12 }}>
                {portfolioItems.map((item, i) => (
                  <View key={i} className="relative" style={{ width: (SCREEN_WIDTH - 48 - 12) / 2 }}>
                    <Pressable
                      onPress={() => pickPortfolioImage(i)}
                      className="aspect-square bg-neutral-100 rounded-2xl overflow-hidden items-center justify-center"
                    >
                      {item.localUri || item.imageUrl ? (
                        <Image
                          source={{ uri: item.localUri || item.imageUrl }}
                          className="w-full h-full"
                          resizeMode="cover"
                        />
                      ) : (
                        <View className="items-center" style={{ gap: 4 }}>
                          <FontAwesome5 name="image" size={20} color="#d4d4d4" />
                          <Text className="text-[10px] text-neutral-400">Upload</Text>
                        </View>
                      )}
                    </Pressable>
                    <TextInput
                      value={item.name}
                      onChangeText={t => setPortfolioItems(p => p.map((it, idx) => idx === i ? { ...it, name: t } : it))}
                      placeholder="Project name"
                      placeholderTextColor="#a3a3a3"
                      className="mt-1.5 text-xs text-neutral-700"
                    />
                  </View>
                ))}
                {portfolioItems.length < 6 && (
                  <Pressable
                    onPress={() => setPortfolioItems(p => [...p, { name: '', localUri: '', imageUrl: '' }])}
                    className="aspect-square border-2 border-dashed border-neutral-200 rounded-2xl items-center justify-center"
                    style={{ width: (SCREEN_WIDTH - 48 - 12) / 2, gap: 4 }}
                  >
                    <FontAwesome5 name="plus" size={18} color="#d4d4d4" />
                    <Text className="text-[10px] text-neutral-400">Add Photo</Text>
                  </Pressable>
                )}
              </View>

              <Text className="text-[10px] text-neutral-400 mt-4 text-center">
                Optional — you can skip this and add photos later.
              </Text>
            </View>
          )}

          {/* Step 4: Location */}
          {currentStep === 4 && (
            <View className="pt-2 pb-32">
              <Text className="text-xl font-bold text-neutral-900 mb-1">Service Area</Text>
              <Text className="text-sm text-neutral-500 mb-6">Where do you offer your services?</Text>

              <Text className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-2">ZIP Codes You Cover</Text>
              <TextInput
                value={zipCodes}
                onChangeText={setZipCodes}
                placeholder="Enter ZIP codes separated by commas (e.g., 10001, 10002, 10003)"
                placeholderTextColor="#a3a3a3"
                multiline
                className="bg-neutral-50 rounded-2xl px-4 py-3 text-sm text-neutral-900 min-h-[80px]"
                style={{ textAlignVertical: 'top' }}
              />
              <Text className="text-[10px] text-neutral-400 mt-1">Homeowners in these areas will see your profile.</Text>
            </View>
          )}

          {/* Step 5: License */}
          {currentStep === 5 && (
            <View className="pt-2 pb-32">
              <Text className="text-xl font-bold text-neutral-900 mb-1">License Verification</Text>
              <Text className="text-sm text-neutral-500 mb-6">Get a verified badge on your profile. Optional but recommended.</Text>

              <View className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 flex-row mb-6" style={{ gap: 12 }}>
                <FontAwesome5 name="shield-alt" size={24} color="#059669" />
                <View className="flex-1">
                  <Text className="text-sm font-bold text-emerald-900">Why verify?</Text>
                  <Text className="text-xs text-emerald-700 mt-0.5 leading-4">
                    Verified contractors get 3x more leads. Build trust with homeowners instantly.
                  </Text>
                </View>
              </View>

              <Text className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-2">License Number</Text>
              <TextInput
                value={licenseNumber}
                onChangeText={setLicenseNumber}
                placeholder="e.g., #ABC-12345"
                placeholderTextColor="#a3a3a3"
                className="bg-neutral-50 rounded-2xl px-4 py-3 text-sm text-neutral-900"
              />
              <Text className="text-[10px] text-neutral-400 mt-2">Verification typically takes 1-2 business days.</Text>
            </View>
          )}

          {/* Step 6: Payments */}
          {currentStep === 6 && (
            <View className="pt-2 pb-32">
              <Text className="text-xl font-bold text-neutral-900 mb-1">Get Paid</Text>
              <Text className="text-sm text-neutral-500 mb-6">Connect Stripe to receive payments directly to your bank account.</Text>

              <View className="bg-neutral-900 rounded-3xl p-6 items-center mb-6">
                <FontAwesome5 name="credit-card" size={32} color="white" />
                <Text className="text-white font-bold mt-3 mb-1 text-base">Stripe Connect</Text>
                <Text className="text-neutral-400 text-xs leading-4 text-center mb-4 px-2">
                  Secure payment processing. Funds are deposited directly to your bank after job completion.
                </Text>
                <Pressable
                  onPress={handleStripeConnect}
                  className="bg-white rounded-xl px-6 py-3"
                >
                  <Text className="text-neutral-900 font-bold text-sm">Set Up Payments</Text>
                </Pressable>
              </View>

              <Text className="text-[10px] text-neutral-400 text-center">
                You can complete Stripe setup later from your dashboard.
              </Text>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Bottom Actions */}
      <View className="absolute bottom-0 left-0 right-0 bg-white border-t border-neutral-100 px-6 py-4 pb-8">
        <View className="flex-row items-center" style={{ gap: 12 }}>
          {currentStep > 0 && (
            <Pressable
              onPress={goBack}
              className="px-4 py-3 rounded-xl bg-neutral-100"
            >
              <Text className="text-sm font-semibold text-neutral-500">Back</Text>
            </Pressable>
          )}
          {currentStep < STEPS.length - 1 ? (
            <Pressable
              onPress={saveAndNext}
              disabled={saving}
              className="flex-1 py-3 bg-neutral-900 rounded-xl flex-row items-center justify-center"
              style={{ gap: 8, opacity: saving ? 0.5 : 1 }}
            >
              {saving ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <>
                  <Text className="text-white font-bold text-sm">Continue</Text>
                  <FontAwesome5 name="chevron-right" size={12} color="white" />
                </>
              )}
            </Pressable>
          ) : (
            <Pressable
              onPress={handleFinish}
              disabled={saving}
              className="flex-1 py-3 bg-emerald-600 rounded-xl flex-row items-center justify-center"
              style={{ gap: 8, opacity: saving ? 0.5 : 1 }}
            >
              {saving ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <>
                  <FontAwesome5 name="check" size={14} color="white" />
                  <Text className="text-white font-bold text-sm">Go to Dashboard</Text>
                </>
              )}
            </Pressable>
          )}
          {currentStep < STEPS.length - 1 && currentStep > 0 && (
            <Pressable
              onPress={saveAndNext}
              disabled={saving}
              className="py-3"
            >
              <Text className="text-xs font-semibold text-neutral-400">Skip</Text>
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
}
