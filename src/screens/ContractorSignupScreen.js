import React, { useState } from 'react';
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
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { FontAwesome5 } from '@expo/vector-icons';
import { contractorSignup } from '../api';
import { auth } from '../firebaseConfig';
import { createUserWithEmailAndPassword, sendEmailVerification, deleteUser } from 'firebase/auth';

const ContractorSignupScreen = () => {
  const [businessName, setBusinessName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [category, setCategory] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigation = useNavigation();

  const handleContractorSignup = async () => {
    if (!businessName || !contactPerson || !email || !phone || !password || !confirmPassword || !category) {
      Alert.alert('Error', 'Please fill in all required fields.');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match.');
      return;
    }

    setLoading(true);
    let userCreated = null;
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      userCreated = userCredential.user;
      await sendEmailVerification(userCreated);
      const nameParts = contactPerson.trim().split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';

      await contractorSignup({
        firstName,
        lastName,
        email,
        password,
        contactPhone: phone,
        companyName: businessName,
        category,
        zipCodesCovered: zipCode ? [zipCode] : [],
        businessAddress: 'Not provided', // Required by production API but not in current form
        firebaseUid: userCreated.uid,
      });
      await auth.signOut();
      Alert.alert('Success', 'Registration successful! Please verify your email before signing in.');
      navigation.navigate('Login');
    } catch (error) {
      if (userCreated) {
        try { await deleteUser(userCreated); } catch {}
      }
      let errorMessage = 'An error occurred during registration.';
      if (error.code) {
        const errorMap = {
          'auth/email-already-in-use': 'That email is already in use!',
          'auth/invalid-email': 'That email is invalid!',
          'auth/weak-password': 'The password is too weak.',
        };
        errorMessage = errorMap[error.code] || error.message;
      }
      Alert.alert('Registration Failed', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 bg-white">
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 40 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View className="items-center mb-6">
          <View className="w-14 h-14 bg-neutral-900 rounded-full items-center justify-center mb-3">
            <FontAwesome5 name="briefcase" size={20} color="#fff" />
          </View>
          <Text className="text-2xl font-bold text-neutral-900">Join RateDeed</Text>
          <Text className="text-sm text-neutral-500 mt-1 text-center">
            Showcase your expertise and connect with clients
          </Text>
        </View>

        {/* Form */}
        <View className="w-full max-w-sm mx-auto" style={{ gap: 12 }}>
          <TextInput
            placeholder="Business Name"
            value={businessName}
            onChangeText={setBusinessName}
            editable={!loading}
            className="w-full border border-neutral-300 rounded-xl px-4 py-3 text-sm bg-white"
            placeholderTextColor="#a3a3a3"
          />
          <TextInput
            placeholder="Contact Person"
            value={contactPerson}
            onChangeText={setContactPerson}
            autoCapitalize="words"
            editable={!loading}
            className="w-full border border-neutral-300 rounded-xl px-4 py-3 text-sm bg-white"
            placeholderTextColor="#a3a3a3"
          />
          <TextInput
            placeholder="Business Email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!loading}
            className="w-full border border-neutral-300 rounded-xl px-4 py-3 text-sm bg-white"
            placeholderTextColor="#a3a3a3"
          />
          <TextInput
            placeholder="Phone Number"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            editable={!loading}
            className="w-full border border-neutral-300 rounded-xl px-4 py-3 text-sm bg-white"
            placeholderTextColor="#a3a3a3"
          />
          <TextInput
            placeholder="Category (e.g., Plumber, Electrician)"
            value={category}
            onChangeText={setCategory}
            editable={!loading}
            className="w-full border border-neutral-300 rounded-xl px-4 py-3 text-sm bg-white"
            placeholderTextColor="#a3a3a3"
          />
          <TextInput
            placeholder="Zip Code (Optional)"
            value={zipCode}
            onChangeText={setZipCode}
            keyboardType="numeric"
            maxLength={10}
            editable={!loading}
            className="w-full border border-neutral-300 rounded-xl px-4 py-3 text-sm bg-white"
            placeholderTextColor="#a3a3a3"
          />

          {/* Password */}
          <View className="relative">
            <TextInput
              placeholder="Password (6+ chars, 1 uppercase, 1 number)"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              editable={!loading}
              className="w-full border border-neutral-300 rounded-xl px-4 py-3 text-sm bg-white pr-20"
              placeholderTextColor="#a3a3a3"
            />
            <Pressable
              onPress={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-3 flex-row items-center"
              style={{ gap: 4 }}
            >
              <FontAwesome5 name={showPassword ? 'eye-slash' : 'eye'} size={12} color="#171717" />
              <Text className="text-xs font-semibold text-neutral-900">{showPassword ? 'Hide' : 'Show'}</Text>
            </Pressable>
          </View>

          <TextInput
            placeholder="Confirm Password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            editable={!loading}
            className="w-full border border-neutral-300 rounded-xl px-4 py-3 text-sm bg-white"
            placeholderTextColor="#a3a3a3"
          />

          <Pressable
            onPress={handleContractorSignup}
            disabled={loading}
            className="w-full py-3 rounded-xl items-center"
            style={{
              backgroundColor: loading ? '#818cf8' : '#4F46E5',
              shadowColor: '#4F46E5', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4,
            }}
          >
            {loading ? (
              <View className="flex-row items-center" style={{ gap: 8 }}>
                <ActivityIndicator size="small" color="#fff" />
                <Text className="text-sm font-semibold text-white">Creating account...</Text>
              </View>
            ) : (
              <Text className="text-sm font-semibold text-white">Sign Up as Contractor</Text>
            )}
          </Pressable>

          <View className="items-center pt-4">
            <Text className="text-sm text-neutral-500">
              Already have an account?{' '}
              <Text className="font-semibold text-neutral-900 underline" onPress={() => navigation.navigate('Login')}>
                Sign In
              </Text>
            </Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

export default ContractorSignupScreen;
