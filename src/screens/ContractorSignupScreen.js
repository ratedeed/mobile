import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  ScrollView,
  Pressable,
  Text,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  StyleSheet,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { FontAwesome5 } from '@expo/vector-icons';
import { contractorSignup } from '../api';
import { auth } from '../firebaseConfig';
import { createUserWithEmailAndPassword, sendEmailVerification, deleteUser } from 'firebase/auth';
import { LinearGradient } from 'expo-linear-gradient';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const CONTRACTOR_CATEGORIES = [
  { label: 'Home Builders', icon: '🏠' },
  { label: 'Plumbers', icon: '🔧' },
  { label: 'Electricians', icon: '⚡' },
  { label: 'Painters', icon: '🎨' },
  { label: 'Landscapers', icon: '🌳' },
  { label: 'Handymen', icon: '🛠️' },
  { label: 'Roofers', icon: '🏗️' },
  { label: 'HVAC', icon: '❄️' },
  { label: 'Carpenters', icon: '🪚' },
  { label: 'Cleaners', icon: '✨' },
];

const DAYS_OF_WEEK = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

const DEFAULT_HOURS = {
  open: '08:00',
  close: '17:00',
  isOpen: true,
};

const ContractorSignupScreen = () => {
  const navigation = useNavigation();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Step 1: Personal info
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Step 2: Business info
  const [companyName, setCompanyName] = useState('');
  const [category, setCategory] = useState('');
  const [businessAddress, setBusinessAddress] = useState('');
  const [zipInput, setZipInput] = useState('');
  const [zipCodes, setZipCodes] = useState([]);
  
  // Address Autocomplete State
  const [addressSuggestions, setAddressSuggestions] = useState([]);
  const [isSearchingAddress, setIsSearchingAddress] = useState(false);
  const searchTimer = useRef(null);

  // Step 3: Business hours
  const [businessHours, setBusinessHours] = useState(
    DAYS_OF_WEEK.reduce((acc, day) => ({
      ...acc,
      [day]: { ...DEFAULT_HOURS, isOpen: day !== 'Saturday' && day !== 'Sunday' }
    }), {})
  );

  // ---- Logic ----

  const formatPhone = (text) => {
    const digits = text.replace(/\D/g, '').slice(0, 10);
    if (digits.length === 0) return '';
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  };

  const setFormattedPhone = (text) => {
    setPhone(formatPhone(text));
  };

  const searchAddress = (text) => {
    setBusinessAddress(text);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (text.length < 3) {
      setAddressSuggestions([]);
      return;
    }

    searchTimer.current = setTimeout(async () => {
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

  const handleSelectAddress = (item) => {
    setBusinessAddress(item.display_name);
    setAddressSuggestions([]);
    if (item.address?.postcode) {
      const zip = item.address.postcode.split('-')[0];
      if (/^\d{5}$/.test(zip) && !zipCodes.includes(zip)) {
        setZipCodes([...zipCodes, zip]);
      }
    }
  };

  const validateStep1 = () => {
    if (!firstName.trim() || !lastName.trim()) {
      Alert.alert('Required', 'Please enter your first and last name.');
      return false;
    }
    if (!email.trim()) {
      Alert.alert('Required', 'Please enter your email address.');
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      Alert.alert('Invalid Email', 'Please enter a valid email address.');
      return false;
    }
    const phoneDigits = phone.replace(/\D/g, '');
    if (phoneDigits.length !== 10) {
      Alert.alert('Invalid Phone', 'Please enter a valid 10-digit phone number.');
      return false;
    }
    if (!password || password.length < 8) {
      Alert.alert('Error', 'Password must be at least 8 characters.');
      return false;
    }
    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match.');
      return false;
    }
    return true;
  };

  const validateStep2 = () => {
    if (!companyName || !category || !businessAddress) {
      Alert.alert('Required', 'Please fill in all business details.');
      return false;
    }
    if (zipCodes.length === 0) {
      Alert.alert('Required', 'Please add at least one ZIP code you serve.');
      return false;
    }
    return true;
  };

  const addZip = () => {
    const zip = zipInput.trim();
    if (!zip) return;
    if (!/^\d{5}$/.test(zip)) {
      Alert.alert('Error', 'Please enter a valid 5-digit ZIP code.');
      return;
    }
    if (zipCodes.includes(zip)) return;
    setZipCodes([...zipCodes, zip]);
    setZipInput('');
  };

  const removeZip = (zip) => {
    setZipCodes(zipCodes.filter(z => z !== zip));
  };

  const toggleDay = (day) => {
    setBusinessHours(prev => ({
      ...prev,
      [day]: { ...prev[day], isOpen: !prev[day].isOpen }
    }));
  };

  const applyToAll = (day) => {
    const hours = businessHours[day];
    const updated = {};
    DAYS_OF_WEEK.forEach(d => {
      updated[d] = { ...hours, isOpen: true };
    });
    setBusinessHours(updated);
    Alert.alert('Success', 'Hours applied to all days.');
  };

  const handleSignup = async () => {
    setLoading(true);
    let userCreated = null;
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      userCreated = userCredential.user;
      await sendEmailVerification(userCreated);

      const hours = {};
      Object.entries(businessHours).forEach(([day, val]) => {
        if (val.isOpen) hours[day] = { start: val.open, end: val.close, isOpen: true };
      });

      await contractorSignup({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim().toLowerCase(),
        companyName: companyName.trim(),
        category,
        firebaseUid: userCreated.uid,
        businessAddress: businessAddress.trim(),
        contactInfo: {
          phoneNumber: phone.trim(),
          email: email.trim().toLowerCase(),
        },
        zipCodesCovered: zipCodes,
        businessHours: hours,
      });

      await auth.signOut();
      Alert.alert('Success', 'Registration successful! Please verify your email before signing in.');
      navigation.navigate('Login');
    } catch (error) {
      if (userCreated) {
        try { await deleteUser(userCreated); } catch {}
      }
      Alert.alert('Registration Failed', error.message);
    } finally {
      setLoading(false);
    }
  };

  // ---- UI Helpers ----

  const renderProgress = () => (
    <View className="px-6 pt-2 pb-6 bg-white dark:bg-neutral-950 border-b border-neutral-100 dark:border-neutral-800">
      <View className="flex-row items-center justify-between">
        {[1, 2, 3].map((num) => (
          <React.Fragment key={num}>
            <View className="items-center" style={{ width: 80 }}>
              <View 
                className={`w-8 h-8 rounded-full items-center justify-center ${
                  step >= num ? 'bg-indigo-600' : 'bg-neutral-200 dark:bg-neutral-800'
                }`}
              >
                {step > num ? (
                  <FontAwesome5 name="check" size={12} color="#fff" />
                ) : (
                  <Text className={`text-xs font-bold ${step >= num ? 'text-white' : 'text-neutral-500'}`}>
                    {num}
                  </Text>
                )}
              </View>
              <Text 
                className={`text-[10px] font-bold mt-1 ${
                  step >= num ? 'text-neutral-900 dark:text-neutral-50' : 'text-neutral-400'
                }`}
              >
                {num === 1 ? 'Personal' : num === 2 ? 'Business' : 'Hours'}
              </Text>
            </View>
            {num < 3 && (
              <View 
                className={`flex-1 h-[2px] -mt-4 ${
                  step > num ? 'bg-indigo-600' : 'bg-neutral-200 dark:bg-neutral-800'
                }`} 
              />
            )}
          </React.Fragment>
        ))}
      </View>
    </View>
  );

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined} 
      className="flex-1 bg-white dark:bg-neutral-950"
    >
      {/* Header */}
      <View className="flex-row items-center px-4 pt-12 pb-2 bg-white dark:bg-neutral-950">
        <Pressable 
          onPress={() => {
            if (step === 1) navigation.goBack();
            else setStep(step - 1);
          }}
          className="w-10 h-10 items-center justify-center rounded-full active:bg-neutral-100 dark:active:bg-neutral-900"
        >
          <FontAwesome5 name="chevron-left" size={18} color="#171717" className="dark:text-neutral-50" />
        </Pressable>
        <Text className="text-lg font-bold text-neutral-900 dark:text-neutral-50 ml-2">Contractor Registration</Text>
      </View>

      {renderProgress()}

      <ScrollView 
        className="flex-1 px-6" 
        contentContainerStyle={{ paddingVertical: 24 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* STEP 1: PERSONAL */}
        {step === 1 && (
          <View style={{ gap: 20 }}>
            <View>
              <Text className="text-2xl font-bold text-neutral-900 dark:text-neutral-50">Personal Information</Text>
              <Text className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">Tell us about yourself to get started</Text>
            </View>

            <View className="flex-row" style={{ gap: 12 }}>
              <View className="flex-1">
                <Text className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5 ml-1">First Name *</Text>
                <TextInput
                  placeholder="John"
                  value={firstName}
                  onChangeText={setFirstName}
                  className="border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm bg-neutral-50 dark:bg-neutral-900 text-neutral-900 dark:text-neutral-50"
                  placeholderTextColor="#a3a3a3"
                />
              </View>
              <View className="flex-1">
                <Text className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5 ml-1">Last Name *</Text>
                <TextInput
                  placeholder="Smith"
                  value={lastName}
                  onChangeText={setLastName}
                  className="border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm bg-neutral-50 dark:bg-neutral-900 text-neutral-900 dark:text-neutral-50"
                  placeholderTextColor="#a3a3a3"
                />
              </View>
            </View>

            <View>
              <Text className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5 ml-1">Email Address *</Text>
              <TextInput
                placeholder="john@company.com"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                className="border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm bg-neutral-50 dark:bg-neutral-900 text-neutral-900 dark:text-neutral-50"
                placeholderTextColor="#a3a3a3"
              />
            </View>

            <View>
              <Text className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5 ml-1">Phone Number *</Text>
              <TextInput
                placeholder="212-555-0123"
                value={phone}
                onChangeText={setFormattedPhone}
                keyboardType="phone-pad"
                maxLength={12}
                className="border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm bg-neutral-50 dark:bg-neutral-900 text-neutral-900 dark:text-neutral-50"
                placeholderTextColor="#a3a3a3"
              />
            </View>

            <View>
              <Text className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5 ml-1">Password *</Text>
              <View className="relative">
                <TextInput
                  placeholder="8+ chars, 1 uppercase, 1 number"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  className="border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm bg-neutral-50 dark:bg-neutral-900 text-neutral-900 dark:text-neutral-50 pr-12"
                  placeholderTextColor="#a3a3a3"
                />
                <Pressable 
                  onPress={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-3.5"
                >
                  <FontAwesome5 name={showPassword ? 'eye-slash' : 'eye'} size={14} color="#737373" />
                </Pressable>
              </View>
            </View>

            <View>
              <Text className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5 ml-1">Confirm Password *</Text>
              <TextInput
                placeholder="Re-enter your password"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                className="border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm bg-neutral-50 dark:bg-neutral-900 text-neutral-900 dark:text-neutral-50"
                placeholderTextColor="#a3a3a3"
              />
            </View>

            <Pressable
              onPress={() => { if (validateStep1()) setStep(2); }}
              className="mt-4 bg-indigo-600 py-4 rounded-xl items-center shadow-lg shadow-indigo-500/20 active:opacity-90 flex-row justify-center"
              style={{ gap: 8 }}
            >
              <Text className="text-white font-bold text-base">Continue to Business Info</Text>
              <FontAwesome5 name="arrow-right" size={14} color="#fff" />
            </Pressable>
          </View>
        )}

        {/* STEP 2: BUSINESS */}
        {step === 2 && (
          <View style={{ gap: 20 }}>
            <View>
              <Text className="text-2xl font-bold text-neutral-900 dark:text-neutral-50">Business Details</Text>
              <Text className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">Tell homeowners about your business</Text>
            </View>

            <View>
              <Text className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5 ml-1">Company Name *</Text>
              <TextInput
                placeholder="Smith & Sons Construction"
                value={companyName}
                onChangeText={setCompanyName}
                className="border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm bg-neutral-50 dark:bg-neutral-900 text-neutral-900 dark:text-neutral-50"
                placeholderTextColor="#a3a3a3"
              />
            </View>

            <View>
              <Text className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5 ml-1">Service Category *</Text>
              <View className="flex-row flex-wrap" style={{ gap: 8 }}>
                {CONTRACTOR_CATEGORIES.map(cat => (
                  <Pressable
                    key={cat.label}
                    onPress={() => setCategory(cat.label)}
                    className={`px-4 py-2 rounded-full border flex-row items-center ${
                      category === cat.label ? 'bg-indigo-600 border-indigo-600' : 'bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800'
                    }`}
                    style={{ gap: 6 }}
                  >
                    <Text className="text-sm">{cat.icon}</Text>
                    <Text className={`text-xs font-semibold ${category === cat.label ? 'text-white' : 'text-neutral-600 dark:text-neutral-400'}`}>
                      {cat.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View className="relative z-50">
              <Text className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5 ml-1">Business Address *</Text>
              <TextInput
                placeholder="Start typing your address..."
                value={businessAddress}
                onChangeText={searchAddress}
                className="border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm bg-neutral-50 dark:bg-neutral-900 text-neutral-900 dark:text-neutral-50"
                placeholderTextColor="#a3a3a3"
              />
              {isSearchingAddress && (
                <View className="absolute right-4 top-10">
                  <ActivityIndicator size="small" color="#4F46E5" />
                </View>
              )}
              {addressSuggestions.length > 0 && (
                <View className="absolute top-[76px] left-0 right-0 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl shadow-lg overflow-hidden z-50">
                  {addressSuggestions.map((item, index) => (
                    <Pressable
                      key={index}
                      onPress={() => handleSelectAddress(item)}
                      className={`px-4 py-3 border-b border-neutral-100 dark:border-neutral-700 active:bg-neutral-50 dark:active:bg-neutral-700 ${
                        index === addressSuggestions.length - 1 ? 'border-b-0' : ''
                      }`}
                    >
                      <Text className="text-xs text-neutral-900 dark:text-neutral-50 font-medium" numberOfLines={1}>
                        {item.display_name}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>

            <View>
              <Text className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5 ml-1">Service Area ZIP Codes *</Text>
              <View className="flex-row mb-3" style={{ gap: 8 }}>
                <TextInput
                  placeholder="Enter 5-digit ZIP"
                  value={zipInput}
                  onChangeText={setZipInput}
                  keyboardType="numeric"
                  maxLength={5}
                  className="flex-1 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm bg-neutral-50 dark:bg-neutral-900 text-neutral-900 dark:text-neutral-50"
                  placeholderTextColor="#a3a3a3"
                />
                <Pressable 
                  onPress={addZip}
                  className="bg-indigo-600 w-12 rounded-xl items-center justify-center shadow-lg shadow-indigo-500/20"
                >
                  <FontAwesome5 name="plus" size={14} color="#fff" />
                </Pressable>
              </View>
              <View className="flex-row flex-wrap" style={{ gap: 8 }}>
                {zipCodes.map(zip => (
                  <View key={zip} className="flex-row items-center bg-indigo-50 dark:bg-indigo-950/30 px-3 py-1.5 rounded-lg border border-indigo-100 dark:border-indigo-900/50">
                    <Text className="text-xs font-bold text-indigo-700 dark:text-indigo-300 mr-2">{zip}</Text>
                    <Pressable onPress={() => removeZip(zip)}>
                      <FontAwesome5 name="times" size={10} color="#4F46E5" />
                    </Pressable>
                  </View>
                ))}
              </View>
            </View>

            <View className="flex-row mt-4" style={{ gap: 12 }}>
              <Pressable
                onPress={() => setStep(1)}
                className="flex-1 border border-neutral-200 dark:border-neutral-800 py-4 rounded-xl items-center"
              >
                <Text className="text-neutral-600 dark:text-neutral-400 font-bold">Back</Text>
              </Pressable>
              <Pressable
                onPress={() => { if (validateStep2()) setStep(3); }}
                className="flex-[2] bg-indigo-600 py-4 rounded-xl items-center shadow-lg shadow-indigo-500/20"
              >
                <Text className="text-white font-bold">Set Business Hours</Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* STEP 3: HOURS */}
        {step === 3 && (
          <View style={{ gap: 20 }}>
            <View>
              <Text className="text-2xl font-bold text-neutral-900 dark:text-neutral-50">Business Hours</Text>
              <Text className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">When can homeowners reach you?</Text>
            </View>

            <View style={{ gap: 10 }}>
              {DAYS_OF_WEEK.map(day => (
                <View key={day} className="flex-row items-center justify-between p-4 bg-neutral-50 dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800 rounded-2xl">
                  <View className="flex-row items-center">
                    <Pressable 
                      onPress={() => toggleDay(day)}
                      className={`w-6 h-6 rounded-md items-center justify-center border ${
                        businessHours[day].isOpen ? 'bg-indigo-600 border-indigo-600' : 'bg-white dark:bg-neutral-800 border-neutral-300 dark:border-neutral-700'
                      }`}
                    >
                      {businessHours[day].isOpen && <FontAwesome5 name="check" size={10} color="#fff" />}
                    </Pressable>
                    <Text className={`ml-3 font-bold ${businessHours[day].isOpen ? 'text-neutral-900 dark:text-neutral-50' : 'text-neutral-400'}`}>
                      {day.slice(0, 3)}
                    </Text>
                  </View>
                  
                  {businessHours[day].isOpen ? (
                    <View className="flex-row items-center" style={{ gap: 8 }}>
                      <Text className="text-sm font-semibold text-neutral-600 dark:text-neutral-400">
                        {businessHours[day].open} - {businessHours[day].close}
                      </Text>
                      {day === 'Monday' && (
                        <Pressable onPress={() => applyToAll(day)} className="bg-indigo-50 dark:bg-indigo-900/30 px-2 py-1 rounded-md">
                          <Text className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase">Apply to all</Text>
                        </Pressable>
                      )}
                    </View>
                  ) : (
                    <Text className="text-sm italic text-neutral-400">Closed</Text>
                  )}
                </View>
              ))}
            </View>

            {/* Summary Card */}
            <View className="bg-indigo-50 dark:bg-indigo-950/20 rounded-2xl p-5 border border-indigo-100 dark:border-indigo-900/30 mt-2">
              <Text className="font-bold text-neutral-900 dark:text-neutral-50 mb-3">Registration Summary</Text>
              <View style={{ gap: 8 }}>
                <View className="flex-row justify-between">
                  <Text className="text-xs text-neutral-500">Name</Text>
                  <Text className="text-xs text-neutral-900 dark:text-neutral-50 font-medium">{firstName} {lastName}</Text>
                </View>
                <View className="flex-row justify-between">
                  <Text className="text-xs text-neutral-500">Company</Text>
                  <Text className="text-xs text-neutral-900 dark:text-neutral-50 font-medium">{companyName}</Text>
                </View>
                <View className="flex-row justify-between">
                  <Text className="text-xs text-neutral-500">Category</Text>
                  <Text className="text-xs text-neutral-900 dark:text-neutral-50 font-medium">{category}</Text>
                </View>
                <View className="flex-row justify-between">
                  <Text className="text-xs text-neutral-500">Service Area</Text>
                  <Text className="text-xs text-neutral-900 dark:text-neutral-50 font-medium">{zipCodes.length} ZIP codes</Text>
                </View>
              </View>
            </View>

            <View className="flex-row mt-4" style={{ gap: 12 }}>
              <Pressable
                onPress={() => setStep(2)}
                className="flex-1 border border-neutral-200 dark:border-neutral-800 py-4 rounded-xl items-center"
              >
                <Text className="text-neutral-600 dark:text-neutral-400 font-bold">Back</Text>
              </Pressable>
              <Pressable
                onPress={handleSignup}
                disabled={loading}
                className="flex-[2] bg-indigo-600 py-4 rounded-xl items-center shadow-lg shadow-indigo-500/20"
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text className="text-white font-bold text-base">Create Account</Text>
                )}
              </Pressable>
            </View>

            <Text className="text-[10px] text-neutral-400 text-center leading-4 px-4 mt-2">
              By creating an account, you agree to Ratedeed's Terms of Service and Privacy Policy.
            </Text>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

export default ContractorSignupScreen;
