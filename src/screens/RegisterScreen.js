import React, { useState } from 'react';
import {
  View,
  ScrollView,
  Pressable,
  Text,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { FontAwesome5 } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { register } from '../api';
import { auth } from '../firebaseConfig';
import { createUserWithEmailAndPassword, sendEmailVerification, deleteUser } from 'firebase/auth';
import Toast from 'react-native-toast-message';

const RegisterScreen = () => {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState('homeowner');
  const [apiError, setApiError] = useState(null);
  const navigation = useNavigation();

  const handleRegister = async () => {
    if (!firstName || !lastName || !email || !password) {
      Toast.show({ type: 'error', text1: 'Error', text2: 'Please fill in all required fields.' });
      return;
    }

    setApiError(null);
    setLoading(true);
    let userCreated = null;
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      userCreated = userCredential.user;
      await sendEmailVerification(userCreated);
      await AsyncStorage.removeItem('userInfo');
      await register({
        firstName,
        lastName,
        email,
        password,
        zipCode,
        firebaseUid: userCreated.uid,
      });
      await auth.signOut();

      Toast.show({
        type: 'success',
        text1: 'Registration Successful',
        text2: 'Verification email sent. Please verify before logging in.',
      });
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
      } else if (error.message) {
        errorMessage = error.message;
      }
      setApiError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      className="flex-1 bg-white"
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 40 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Logo */}
        <View className="items-center mb-8">
          <FontAwesome5 name="hammer" size={48} color="#4F46E5" />
          <Text className="text-2xl font-bold text-indigo-600 mt-3">ratedeed</Text>
        </View>

        {/* Role Toggle */}
        <View className="flex-row bg-neutral-100 rounded-xl p-1 w-full max-w-sm mx-auto mb-6">
          <Pressable
            onPress={() => { setRole('homeowner'); setApiError(null); }}
            className={`flex-1 py-2.5 rounded-lg items-center ${
              role === 'homeowner' ? 'bg-white shadow-sm' : ''
            }`}
            style={{ elevation: role === 'homeowner' ? 2 : 0 }}
          >
            <Text className={`text-sm font-semibold ${role === 'homeowner' ? 'text-neutral-900' : 'text-neutral-500'}`}>
              I'm a Homeowner
            </Text>
          </Pressable>
          <Pressable
            onPress={() => { setRole('contractor'); setApiError(null); }}
            className={`flex-1 py-2.5 rounded-lg items-center ${
              role === 'contractor' ? 'bg-white shadow-sm' : ''
            }`}
            style={{ elevation: role === 'contractor' ? 2 : 0 }}
          >
            <Text className={`text-sm font-semibold ${role === 'contractor' ? 'text-neutral-900' : 'text-neutral-500'}`}>
              I'm a Contractor
            </Text>
          </Pressable>
        </View>

        {role === 'contractor' ? (
          /* Contractor Notice */
          <View className="w-full max-w-sm mx-auto" style={{ gap: 16 }}>
            <View className="bg-neutral-50 border border-neutral-200 rounded-2xl p-6 items-center" style={{ gap: 16 }}>
              <View className="w-12 h-12 bg-neutral-900 rounded-full items-center justify-center">
                <FontAwesome5 name="hammer" size={18} color="#fff" />
              </View>
              <Text className="text-lg font-bold text-neutral-900">Join as a Contractor</Text>
              <Text className="text-sm text-neutral-600 text-center leading-5">
                Contractor registration includes company name, service category, service area, business address, and hours.
              </Text>
              <View className="flex-row items-start bg-white rounded-xl p-3 border border-neutral-100 w-full" style={{ gap: 8 }}>
                <FontAwesome5 name="info-circle" size={14} color="#a3a3a3" style={{ marginTop: 2 }} />
                <Text className="text-xs text-neutral-500 flex-1">
                  Already have a contractor account?{' '}
                  <Text
                    className="font-semibold text-neutral-900 underline"
                    onPress={() => navigation.navigate('Login')}
                  >
                    Log in
                  </Text>
                </Text>
              </View>
            </View>

            <Pressable
              onPress={() => navigation.navigate('ContractorSignup')}
              className="w-full py-3 rounded-xl items-center"
              style={{
                backgroundColor: '#4F46E5',
                shadowColor: '#4F46E5',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.2,
                shadowRadius: 8,
                elevation: 4,
              }}
            >
              <Text className="text-sm font-semibold text-white">
                Continue to Contractor Sign Up
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setRole('homeowner')}
              className="w-full py-3 rounded-xl items-center border border-neutral-300"
            >
              <Text className="text-sm font-medium text-neutral-900">I'm a Homeowner Instead</Text>
            </Pressable>

            <View className="items-center pt-2">
              <Text className="text-sm text-neutral-500">
                Already have an account?{' '}
                <Text
                  className="font-semibold text-neutral-900 underline"
                  onPress={() => navigation.navigate('Login')}
                >
                  Log In
                </Text>
              </Text>
            </View>
          </View>
        ) : (
          /* Homeowner Sign Up Form */
          <View className="w-full max-w-sm mx-auto" style={{ gap: 12 }}>
            {/* Name Fields Row */}
            <View className="flex-row" style={{ gap: 12 }}>
              <TextInput
                placeholder="First name"
                value={firstName}
                onChangeText={setFirstName}
                autoCapitalize="words"
                autoComplete="given-name"
                editable={!loading}
                className="flex-1 border border-neutral-300 rounded-xl px-4 py-3 text-sm bg-white"
                placeholderTextColor="#a3a3a3"
              />
              <TextInput
                placeholder="Last name"
                value={lastName}
                onChangeText={setLastName}
                autoCapitalize="words"
                autoComplete="family-name"
                editable={!loading}
                className="flex-1 border border-neutral-300 rounded-xl px-4 py-3 text-sm bg-white"
                placeholderTextColor="#a3a3a3"
              />
            </View>

            {/* Email */}
            <TextInput
              placeholder="Email"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
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
                autoComplete="new-password"
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
                <Text className="text-xs font-semibold text-neutral-900">
                  {showPassword ? 'Hide' : 'Show'}
                </Text>
              </Pressable>
            </View>

            {/* ZIP Code */}
            <TextInput
              placeholder="ZIP code (optional)"
              value={zipCode}
              onChangeText={setZipCode}
              keyboardType="numeric"
              autoComplete="postal-code"
              maxLength={10}
              editable={!loading}
              className="w-full border border-neutral-300 rounded-xl px-4 py-3 text-sm bg-white"
              placeholderTextColor="#a3a3a3"
            />

            {/* API Error */}
            {apiError && (
              <View className="bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-2.5">
                <Text className="text-xs text-indigo-700">{apiError}</Text>
              </View>
            )}

            {/* Submit */}
            <Pressable
              onPress={handleRegister}
              disabled={loading}
              className="w-full py-3 rounded-xl items-center"
              style={{
                backgroundColor: loading ? '#818cf8' : '#4F46E5',
                shadowColor: '#4F46E5',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.2,
                shadowRadius: 8,
                elevation: 4,
              }}
            >
              {loading ? (
                <View className="flex-row items-center" style={{ gap: 8 }}>
                  <ActivityIndicator size="small" color="#fff" />
                  <Text className="text-sm font-semibold text-white">Creating account...</Text>
                </View>
              ) : (
                <Text className="text-sm font-semibold text-white">Sign Up</Text>
              )}
            </Pressable>

            <View className="items-center pt-4">
              <Text className="text-sm text-neutral-500">
                Already have an account?{' '}
                <Text
                  className="font-semibold text-neutral-900 underline"
                  onPress={() => navigation.navigate('Login')}
                >
                  Log In
                </Text>
              </Text>
            </View>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

export default RegisterScreen;
