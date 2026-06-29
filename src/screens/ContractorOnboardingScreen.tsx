import React, { useState, useEffect } from 'react';
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
  useColorScheme,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { FontAwesome5 } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as WebBrowser from 'expo-web-browser';
import { updateContractorProfile, getStripeConnectUrl, getContractorProfile } from '../api';
import { uploadToCloudinary, CLOUDINARY_FOLDERS } from '../utils/cloudinary';
import { Linking } from 'react-native';
import { requestPhotoLibraryPermission } from '../utils/permissions';
import { parsePriceRange, formatPriceRange } from '../utils/price';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const STEPS = [
  { key: 'welcome', label: 'Welcome', icon: 'briefcase' },
  { key: 'profile', label: 'Profile', icon: 'camera' },
  { key: 'services', label: 'Services', icon: 'dollar-sign' },
  { key: 'portfolio', label: 'Portfolio', icon: 'image' },
  { key: 'payments', label: 'Payments', icon: 'credit-card' },
];

export default function ContractorOnboardingScreen() {
  const navigation = useNavigation<any>();
  const isDark = useColorScheme() === 'dark';
  const [currentStep, setCurrentStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);

  useEffect(() => {
    async function loadProfile() {
      try {
        const profile = await getContractorProfile();
        if (profile) {
          if (profile.description) setDescription(profile.description);
          if (profile.profilePicture) {
            setProfilePictureUrl(profile.profilePicture);
            setProfilePictureUri(profile.profilePicture);
          }
          if (profile.bannerImage) {
            setBannerImageUrl(profile.bannerImage);
            setBannerImageUri(profile.bannerImage);
          }
          if (profile.servicesOffered && profile.servicesOffered.length > 0) {
            setServices(profile.servicesOffered.map((s: any) => {
              const rawRange = s.priceRange || s.priceEstimate || '';
              const parsed = parsePriceRange(rawRange);
              return {
                name: typeof s === 'string' ? s : s.name || '',
                description: s.description || '',
                minPrice: parsed.min || '',
                maxPrice: parsed.max || '',
                contactForQuote: parsed.contactForQuote || false
              };
            }));
          }
          if (profile.portfolio && profile.portfolio.length > 0) {
            setPortfolioItems(profile.portfolio.map(p => ({
              name: p.name || '',
              localUri: '',
              imageUrl: p.imageUrl || ''
            })));
          }
          if (profile.zipCodesCovered && profile.zipCodesCovered.length > 0) {
            setZipCodes(profile.zipCodesCovered.join(', '));
          }
          if (profile.licenseNumber) {
            setLicenseNumber(profile.licenseNumber);
          }
        }
      } catch (err) {
        console.error('Failed to load profile for onboarding hydration:', err);
      } finally {
        setLoadingProfile(false);
      }
    }
    loadProfile();
  }, []);


  // Profile
  const [description, setDescription] = useState('');
  const [profilePictureUri, setProfilePictureUri] = useState('');
  const [profilePictureUrl, setProfilePictureUrl] = useState('');
  const [bannerImageUri, setBannerImageUri] = useState('');
  const [bannerImageUrl, setBannerImageUrl] = useState('');

  // Services
  const [services, setServices] = useState<{
    name: string;
    description: string;
    minPrice: string;
    maxPrice: string;
    contactForQuote: boolean;
  }[]>([
    { name: '', description: '', minPrice: '', maxPrice: '', contactForQuote: false },
  ]);

  // Portfolio
  const [portfolioItems, setPortfolioItems] = useState<{ name: string; localUri: string; imageUrl: string }[]>([]);

  // Location
  const [zipCodes, setZipCodes] = useState('');

  // License
  const [licenseNumber, setLicenseNumber] = useState('');

  const progress = ((currentStep + 1) / STEPS.length) * 100;

  const pickImage = async (type: 'profile' | 'banner') => {
    const hasPermission = await requestPhotoLibraryPermission();
    if (!hasPermission) return;

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: type === 'banner' ? [16, 7] : [1, 1],
        quality: 0.8,
        base64: true,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const uri = result.assets[0].uri;
        if (type === 'profile') setProfilePictureUri(uri);
        else setBannerImageUri(uri);
      }
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to select image');
    }
  };

  const pickPortfolioImage = async (index: number) => {
    const hasPermission = await requestPhotoLibraryPermission();
    if (!hasPermission) return;

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
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
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to select image');
    }
  };

  const uploadImage = async (uri: string, folder: string): Promise<string> => {
    return uri;
  };

  const saveAndNext = async (isSkip = false) => {
    if (isSkip) {
      if (currentStep < STEPS.length - 1) {
        setCurrentStep(currentStep + 1);
      }
      return;
    }
    setSaving(true);
    try {
      const updateData: any = {};

      if (currentStep === 1) {
        if (!description.trim()) {
          Alert.alert('Required', 'Please enter a description about your business.');
          setSaving(false);
          return;
        }
        if (profilePictureUri) {
          const cloudinaryUrl = await uploadToCloudinary(profilePictureUri, CLOUDINARY_FOLDERS.CONTRACTOR_PROFILE);
          updateData.profilePicture = cloudinaryUrl;
        }
        if (bannerImageUri) {
          const cloudinaryUrl = await uploadToCloudinary(bannerImageUri, CLOUDINARY_FOLDERS.CONTRACTOR_BANNER);
          updateData.bannerImage = cloudinaryUrl;
          updateData.bannerUrl = cloudinaryUrl;
        }
        updateData.description = description.trim();
      } else if (currentStep === 2) {
        const valid = services.filter(s => s.name.trim());
        if (valid.length > 0) {
          updateData.servicesOffered = valid.map(s => ({
            name: s.name,
            description: s.description,
            priceEstimate: formatPriceRange(s.minPrice, s.maxPrice, s.contactForQuote)
          }));
        }
      } else if (currentStep === 3) {
        // Use base64 strings directly for portfolio
        const uploaded = [];
        for (const item of portfolioItems) {
          if (!item.name.trim()) continue;
          if (item.localUri) {
            const cloudinaryUrl = await uploadToCloudinary(item.localUri, CLOUDINARY_FOLDERS.PORTFOLIO);
            uploaded.push({ name: item.name, imageUrl: cloudinaryUrl });
          } else if (item.imageUrl) {
            uploaded.push({ name: item.name, imageUrl: item.imageUrl });
          }
        }
        if (uploaded.length > 0) updateData.portfolio = uploaded;
      }

      if (Object.keys(updateData).length > 0) {
        await updateContractorProfile(updateData);
      }

      if (currentStep < STEPS.length - 1) {
        setCurrentStep(currentStep + 1);
      }
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to save. Your changes may not have been saved.');
    } finally {
      setSaving(false);
    }
  };

  const handleFinish = async () => {
    setSaving(true);
    try {
      await updateContractorProfile({ onboardingComplete: true } as any);
      navigation.reset({
        index: 0,
        routes: [{ name: 'Main' }, { name: 'ContractorDashboard' }],
      });
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to complete onboarding. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleStripeConnect = async () => {
    const runStripeConnect = async (businessType: 'individual' | 'company') => {
      try {
        const { url } = await getStripeConnectUrl(businessType);
        if (url) {
          let result;
          try {
            result = await WebBrowser.openAuthSessionAsync(url, 'ratedeed://contractor-onboarding');
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
          if (result.type === 'success' && result.url?.includes('stripe_return=true')) {
            Alert.alert('Success', 'Stripe account connected successfully!');
          }
        }
      } catch (err: any) {
        Alert.alert('Error', err?.message || 'Failed to connect to Stripe. Please try again later.');
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
  };

  const goBack = () => {
    if (currentStep > 0) setCurrentStep(currentStep - 1);
    else navigation.goBack();
  };

  if (loadingProfile) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: isDark ? '#171717' : '#ffffff' }}>
        <ActivityIndicator size="large" color="#4F46E5" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-white dark:bg-neutral-950">
      {/* Progress bar */}
      <View className="pt-12 pb-3 px-6">
        <View className="flex-row items-center justify-between mb-3">
          <Pressable onPress={goBack} className="py-1">
            <FontAwesome5 name="arrow-left" size={16} color={isDark ? "#a3a3a3" : "#737373"} />
          </Pressable>
          <Text className="text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-widest">
            Step {currentStep + 1} of {STEPS.length}
          </Text>
          <View className="w-6" />
        </View>
        <View className="h-1 bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden">
          <View
            className="h-full bg-neutral-900 dark:bg-white rounded-full"
            style={{ width: `${progress}%` }}
          />
        </View>
      </View>

      {/* Content */}
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
        className="flex-1"
      >
        <ScrollView className="flex-1 px-6" showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {/* Step 0: Welcome */}
          {currentStep === 0 && (
            <View className="items-center pt-8 pb-32">
              <View className="w-20 h-20 bg-neutral-900 dark:bg-white rounded-3xl items-center justify-center mb-6">
                <FontAwesome5 name="briefcase" size={28} color={isDark ? "#171717" : "white"} />
              </View>
              <Text className="text-2xl font-bold text-neutral-900 dark:text-white mb-3 text-center">
                Welcome to Ratedeed
              </Text>
              <Text className="text-neutral-500 dark:text-neutral-400 text-sm leading-relaxed mb-8 text-center px-4">
                Set up your contractor profile to start receiving leads and getting hired by homeowners in your area. It takes about 5 minutes.
              </Text>
              <View className="w-full space-y-3">
                {STEPS.slice(1).map((step) => (
                  <View key={step.key} className="flex-row items-center bg-neutral-50 dark:bg-neutral-900 rounded-2xl px-4 py-3" style={{ gap: 12 }}>
                    <View className="w-8 h-8 bg-white dark:bg-neutral-800 rounded-xl items-center justify-center">
                      <FontAwesome5 name={step.icon} size={12} color={isDark ? "#d4d4d4" : "#525252"} />
                    </View>
                    <Text className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">{step.label}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Step 1: Profile */}
          {currentStep === 1 && (
            <View className="pt-2 pb-32">
              <Text className="text-xl font-bold text-neutral-900 dark:text-white mb-1">Your Profile</Text>
              <Text className="text-sm text-neutral-500 dark:text-neutral-400 mb-6">Add a photo and tell homeowners about your business.</Text>

              {/* Banner */}
              <Text className="text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-widest mb-2">Cover Photo</Text>
              <Pressable
                onPress={() => pickImage('banner')}
                className="bg-neutral-100 dark:bg-neutral-800 rounded-2xl overflow-hidden mb-3"
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
                    <FontAwesome5 name="cloud-upload-alt" size={18} color={isDark ? "#737373" : "#a3a3a3"} />
                    <Text className="text-xs text-neutral-400 dark:text-neutral-500">Upload cover photo</Text>
                  </View>
                )}
              </Pressable>

              {/* Profile picture */}
              <Pressable
                onPress={() => pickImage('profile')}
                className="-mt-7 ml-4 mb-4 w-16 h-16 rounded-2xl overflow-hidden border-4 border-white dark:border-neutral-950 bg-neutral-100 dark:bg-neutral-800 items-center justify-center"
                style={{ elevation: 4 }}
              >
                {profilePictureUri || profilePictureUrl ? (
                  <Image
                    source={{ uri: profilePictureUri || profilePictureUrl }}
                    className="w-full h-full"
                    resizeMode="cover"
                  />
                ) : (
                  <FontAwesome5 name="camera" size={18} color={isDark ? "#737373" : "#a3a3a3"} />
                )}
              </Pressable>

              {/* Description */}
              <Text className="text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-widest mb-2">About Your Business</Text>
              <TextInput
                value={description}
                onChangeText={setDescription}
                placeholder="Tell homeowners what makes your business special..."
                placeholderTextColor={isDark ? "#9ca3af" : "#a3a3a3"}
                multiline
                maxLength={1000}
                className="bg-neutral-50 dark:bg-neutral-900 rounded-2xl px-4 py-3 text-sm text-neutral-900 dark:text-white min-h-[100px] text-top"
                style={{ textAlignVertical: 'top' }}
              />
              <Text className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-1 text-right">{description.length}/1000</Text>
            </View>
          )}

          {/* Step 2: Services */}
          {currentStep === 2 && (
            <View className="pt-2 pb-32">
              <Text className="text-xl font-bold text-neutral-900 dark:text-white mb-1">Services You Offer</Text>
              <Text className="text-sm text-neutral-500 dark:text-neutral-400 mb-6">Add the services homeowners can hire you for.</Text>

              <View style={{ gap: 12 }}>
                {services.map((service, i) => (
                  <View key={i} className="bg-neutral-50 dark:bg-neutral-900 rounded-2xl p-4">
                    <View className="flex-row items-center justify-between mb-3">
                      <Text className="text-xs font-bold text-neutral-400 dark:text-neutral-500">Service {i + 1}</Text>
                      {services.length > 1 && (
                        <Pressable onPress={() => setServices(s => s.filter((_, idx) => idx !== i))}>
                          <FontAwesome5 name="times" size={12} color={isDark ? "#737373" : "#a3a3a3"} />
                        </Pressable>
                      )}
                    </View>
                    <TextInput
                      value={service.name}
                      onChangeText={t => setServices(s => s.map((sv, idx) => idx === i ? { ...sv, name: t } : sv))}
                      placeholder="Service name (e.g., Kitchen Remodeling)"
                      placeholderTextColor={isDark ? "#9ca3af" : "#a3a3a3"}
                      className="bg-white dark:bg-neutral-800 rounded-xl px-3 py-2.5 text-sm text-neutral-900 dark:text-white mb-2"
                    />
                    <TextInput
                      value={service.description}
                      onChangeText={t => setServices(s => s.map((sv, idx) => idx === i ? { ...sv, description: t } : sv))}
                      placeholder="Brief description"
                      placeholderTextColor={isDark ? "#9ca3af" : "#a3a3a3"}
                      className="bg-white dark:bg-neutral-800 rounded-xl px-3 py-2.5 text-sm text-neutral-900 dark:text-white mb-2"
                    />
                    <View style={{ gap: 8 }} className="mt-1">
                      <Pressable
                        onPress={() => setServices(s => s.map((sv, idx) => idx === i ? { ...sv, contactForQuote: !sv.contactForQuote } : sv))}
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
                            <Text className="absolute left-3 text-sm text-neutral-400 dark:text-neutral-500 z-10">$</Text>
                            <TextInput
                              value={service.minPrice}
                              onChangeText={t => {
                                const val = t.replace(/[^0-9]/g, '');
                                setServices(s => s.map((sv, idx) => idx === i ? { ...sv, minPrice: val } : sv));
                              }}
                              placeholder="Min price"
                              placeholderTextColor={isDark ? "#737373" : "#a3a3a3"}
                              keyboardType="numeric"
                              className="bg-white dark:bg-neutral-800 rounded-xl pl-7 pr-3 py-2.5 text-sm text-neutral-900 dark:text-white"
                            />
                          </View>
                          <View className="flex-1 relative justify-center">
                            <Text className="absolute left-3 text-sm text-neutral-400 dark:text-neutral-500 z-10">$</Text>
                            <TextInput
                              value={service.maxPrice}
                              onChangeText={t => {
                                const val = t.replace(/[^0-9]/g, '');
                                setServices(s => s.map((sv, idx) => idx === i ? { ...sv, maxPrice: val } : sv));
                              }}
                              placeholder="Max price"
                              placeholderTextColor={isDark ? "#737373" : "#a3a3a3"}
                              keyboardType="numeric"
                              className="bg-white dark:bg-neutral-800 rounded-xl pl-7 pr-3 py-2.5 text-sm text-neutral-900 dark:text-white"
                            />
                          </View>
                        </View>
                      )}
                    </View>
                  </View>
                ))}
              </View>

              <Pressable
                onPress={() => setServices(s => [...s, { name: '', description: '', minPrice: '', maxPrice: '', contactForQuote: false }])}
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
              <Text className="text-xl font-bold text-neutral-900 dark:text-white mb-1">Portfolio</Text>
              <Text className="text-sm text-neutral-500 dark:text-neutral-400 mb-6">Show off your best work. You can add more later.</Text>

              <View className="flex-row flex-wrap" style={{ gap: 12 }}>
                {portfolioItems.map((item, i) => (
                  <View key={i} className="relative" style={{ width: (SCREEN_WIDTH - 48 - 12) / 2 }}>
                    <Pressable
                      onPress={() => pickPortfolioImage(i)}
                      className="aspect-square bg-neutral-100 dark:bg-neutral-800 rounded-2xl overflow-hidden items-center justify-center"
                    >
                      {item.localUri || item.imageUrl ? (
                        <Image
                          source={{ uri: item.localUri || item.imageUrl }}
                          className="w-full h-full"
                          resizeMode="cover"
                        />
                      ) : (
                        <View className="items-center" style={{ gap: 4 }}>
                          <FontAwesome5 name="image" size={20} color={isDark ? "#525252" : "#d4d4d4"} />
                          <Text className="text-[10px] text-neutral-400 dark:text-neutral-500">Upload</Text>
                        </View>
                      )}
                    </Pressable>
                    <TextInput
                      value={item.name}
                      onChangeText={t => setPortfolioItems(p => p.map((it, idx) => idx === i ? { ...it, name: t } : it))}
                      placeholder="Project name"
                      placeholderTextColor={isDark ? "#9ca3af" : "#a3a3a3"}
                      className="mt-1.5 text-xs text-neutral-700 dark:text-neutral-300"
                    />
                  </View>
                ))}
                {portfolioItems.length < 6 && (
                  <Pressable
                    onPress={() => setPortfolioItems(p => [...p, { name: '', localUri: '', imageUrl: '' }])}
                    className="aspect-square border-2 border-dashed border-neutral-200 dark:border-neutral-700 rounded-2xl items-center justify-center"
                    style={{ width: (SCREEN_WIDTH - 48 - 12) / 2, gap: 4 }}
                  >
                    <FontAwesome5 name="plus" size={18} color={isDark ? "#525252" : "#d4d4d4"} />
                    <Text className="text-[10px] text-neutral-400 dark:text-neutral-500">Add Photo</Text>
                  </Pressable>
                )}
              </View>

              <Text className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-4 text-center">
                Optional — you can skip this and add photos later.
              </Text>
            </View>
          )}

          {/* Step 4: Payments */}
          {currentStep === 4 && (
            <View className="pt-2 pb-32">
              <Text className="text-xl font-bold text-neutral-900 dark:text-white mb-1">Get Paid</Text>
              <Text className="text-sm text-neutral-500 dark:text-neutral-400 mb-6">Connect Stripe to receive payments directly to your bank account.</Text>

              <View className="bg-neutral-900 dark:bg-neutral-800 rounded-3xl p-6 items-center mb-6">
                <FontAwesome5 name="credit-card" size={32} color="white" />
                <Text className="text-white font-bold mt-3 mb-1 text-base">Stripe Connect</Text>
                <Text className="text-neutral-400 dark:text-neutral-500 text-xs leading-4 text-center mb-4 px-2">
                  Secure payment processing. Funds are deposited directly to your bank after job completion.
                </Text>
                <Pressable
                  onPress={handleStripeConnect}
                  className="bg-white dark:bg-neutral-950 rounded-xl px-6 py-3"
                >
                  <Text className="text-neutral-900 dark:text-white font-bold text-sm">Set Up Payments</Text>
                </Pressable>
              </View>

              <Text className="text-[10px] text-neutral-400 dark:text-neutral-500 text-center">
                You can complete Stripe setup later from your dashboard.
              </Text>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Bottom Actions */}
      <View className="absolute bottom-0 left-0 right-0 bg-white dark:bg-neutral-950 border-t border-neutral-100 dark:border-neutral-800 px-6 py-4 pb-8">
        <View className="flex-row items-center" style={{ gap: 12 }}>
          {currentStep > 0 && (
            <Pressable
              onPress={goBack}
              className="px-4 py-3 rounded-xl bg-neutral-100 dark:bg-neutral-800"
            >
              <Text className="text-sm font-semibold text-neutral-500 dark:text-neutral-400">Back</Text>
            </Pressable>
          )}
          {currentStep < STEPS.length - 1 ? (
            <Pressable
              onPress={() => saveAndNext(false)}
              disabled={saving}
              className="flex-1 py-3 bg-neutral-900 dark:bg-white rounded-xl flex-row items-center justify-center"
              style={{ gap: 8, opacity: saving ? 0.5 : 1 }}
            >
              {saving ? (
                <ActivityIndicator color={isDark ? "#171717" : "white"} size="small" />
              ) : (
                <>
                  <Text className="text-white dark:text-neutral-900 font-bold text-sm">Continue</Text>
                  <FontAwesome5 name="chevron-right" size={12} color={isDark ? "#171717" : "white"} />
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
          {currentStep > 1 && (
            <Pressable
              onPress={currentStep === STEPS.length - 1 ? handleFinish : () => saveAndNext(true)}
              disabled={saving}
              className="py-3"
            >
              <Text className="text-xs font-semibold text-neutral-400 dark:text-neutral-500">Skip</Text>
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
}
