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
  Linking,
  useColorScheme,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { FontAwesome5 } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { register, appleSignIn } from '../api';
import { auth } from '../firebaseConfig';
import { createUserWithEmailAndPassword, sendEmailVerification, deleteUser } from 'firebase/auth';
import Toast from 'react-native-toast-message';
import * as AppleAuthentication from 'expo-apple-authentication';
import { useAuth } from '../context/AuthContext';

const RegisterScreen = () => {
  const isDark = useColorScheme() === 'dark';
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [apiError, setApiError] = useState(null);
  const navigation = useNavigation();
  const { updateBackendToken } = useAuth();

  const handleAppleSignIn = async () => {
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      setLoading(true);
      const backendResponse = await appleSignIn({
        identityToken: credential.identityToken,
        appleUserIdentifier: credential.user,
        fullName: credential.fullName,
        email: credential.email,
      });

      if (backendResponse?.token) {
        const { token, refreshToken, ...userData } = backendResponse;
        await updateBackendToken(backendResponse.token, backendResponse.emailVerified, userData);
        Toast.show({ type: 'success', text1: 'Success', text2: 'Signed in with Apple!' });

        setTimeout(() => {
          if (userData.role === 'contractor') {
            navigation.reset({
              index: 0,
              routes: [{ name: 'Main' }, { name: 'ContractorDashboard' }],
            });
          } else if (navigation.canGoBack()) {
            navigation.goBack();
          } else {
            navigation.navigate('Main');
          }
        }, 100);
      } else {
        setApiError('Apple Sign-In failed. Please try again.');
      }
    } catch (error) {
      if (error.code === 'ERR_CANCELED') {
        return;
      }
      setApiError(error.message || 'Apple Sign-In failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    const trimmedFirstName = firstName.trim();
    const trimmedLastName = lastName.trim();
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedZip = zipCode.trim();

    if (!trimmedFirstName || !trimmedLastName || !trimmedEmail || !password) {
      Toast.show({ type: 'error', text1: 'Error', text2: 'Please fill in all required fields.' });
      return;
    }

    if (password.length < 8) {
      Toast.show({ type: 'error', text1: 'Error', text2: 'Password must be at least 8 characters long.' });
      return;
    }

    if (!/[A-Z]/.test(password)) {
      Toast.show({ type: 'error', text1: 'Error', text2: 'Password must contain at least one uppercase letter.' });
      return;
    }

    if (!/[0-9]/.test(password)) {
      Toast.show({ type: 'error', text1: 'Error', text2: 'Password must contain at least one number.' });
      return;
    }

    if (!/[^A-Za-z0-9]/.test(password)) {
      Toast.show({ type: 'error', text1: 'Error', text2: 'Password must contain at least one special character.' });
      return;
    }

    if (trimmedZip && !/^\d{5}$/.test(trimmedZip)) {
      Toast.show({ type: 'error', text1: 'Error', text2: 'Please enter a valid 5-digit ZIP code.' });
      return;
    }

    setApiError(null);
    setLoading(true);
    let userCreated = null;
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, trimmedEmail, password);
      userCreated = userCredential.user;
      await sendEmailVerification(userCreated);
      await AsyncStorage.removeItem('userInfo');
      await AsyncStorage.removeItem('ratedeed-user-data');
      await register({
        firstName: trimmedFirstName,
        lastName: trimmedLastName,
        email: trimmedEmail,
        password: password,
        firebaseUid: userCreated.uid,
        ...(trimmedZip ? { zipCode: trimmedZip } : {}),
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
        try { await deleteUser(userCreated); } catch {/* cleanup failed silently */}
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
      keyboardVerticalOffset={Platform.OS === 'ios' ? 50 : 0}
      className="flex-1 bg-white dark:bg-neutral-950"
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
          <View
            className="flex-1 py-2.5 rounded-lg items-center bg-white shadow-sm"
            style={{ elevation: 2 }}
          >
            <Text className="text-sm font-semibold text-neutral-900">
              I'm a Homeowner
            </Text>
          </View>
          <Pressable
            onPress={() => navigation.navigate('ContractorSignup')}
            className="flex-1 py-2.5 rounded-lg items-center"
            style={{ elevation: 0 }}
          >
            <Text className="text-sm font-semibold text-neutral-500">
              I'm a Contractor
            </Text>
          </Pressable>
        </View>

        {/* Homeowner Sign Up Form */}
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
              className="flex-1 border border-neutral-300 dark:border-neutral-700 rounded-xl px-4 py-3 text-sm bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-50"
              placeholderTextColor={isDark ? "#9ca3af" : "#a3a3a3"}
            />
            <TextInput
              placeholder="Last name"
              value={lastName}
              onChangeText={setLastName}
              autoCapitalize="words"
              autoComplete="family-name"
              editable={!loading}
              className="flex-1 border border-neutral-300 dark:border-neutral-700 rounded-xl px-4 py-3 text-sm bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-50"
              placeholderTextColor={isDark ? "#9ca3af" : "#a3a3a3"}
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
            className="w-full border border-neutral-300 dark:border-neutral-700 rounded-xl px-4 py-3 text-sm bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-50"
            placeholderTextColor={isDark ? "#9ca3af" : "#a3a3a3"}
          />

          {/* Password */}
          <View className="relative">
            <TextInput
              placeholder="Password (8+ chars, 1 uppercase, 1 number, 1 special)"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoComplete="new-password"
              editable={!loading}
              className="w-full border border-neutral-300 dark:border-neutral-700 rounded-xl px-4 py-3 text-sm bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-50 pr-20"
              placeholderTextColor={isDark ? "#9ca3af" : "#a3a3a3"}
            />
            <Pressable
              onPress={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-3 flex-row items-center"
              style={{ gap: 4 }}
            >
              <FontAwesome5 name={showPassword ? 'eye-slash' : 'eye'} size={12} color={isDark ? "#ffffff" : "#171717"} />
              <Text className="text-xs font-semibold text-neutral-900 dark:text-neutral-50">
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
            className="w-full border border-neutral-300 dark:border-neutral-700 rounded-xl px-4 py-3 text-sm bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-50"
            placeholderTextColor={isDark ? "#9ca3af" : "#a3a3a3"}
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

          {/* Apple Sign In */}
          {Platform.OS === 'ios' && (
            <View className="w-full mt-4">
              <AppleAuthentication.AppleAuthenticationButton
                buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
                buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                cornerRadius={12}
                style={{ width: '100%', height: 48 }}
                onPress={handleAppleSignIn}
              />
            </View>
          )}

          <View className="items-center pt-4 flex-row justify-center" style={{ gap: 4 }}>
            <Text className="text-sm text-neutral-500">Already have an account?</Text>
            <Pressable onPress={() => navigation.navigate('Login')}>
              <Text className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 underline">Log In</Text>
            </Pressable>
          </View>

          {/* Legal Links */}
          <View className="items-center pt-4 flex-row justify-center" style={{ gap: 8 }}>
            <Pressable onPress={() => Linking.openURL('https://ratedeed.com/legal/terms')}>
              <Text className="text-xs text-neutral-400 underline">Terms of Service</Text>
            </Pressable>
            <Text className="text-xs text-neutral-400">•</Text>
            <Pressable onPress={() => Linking.openURL('https://ratedeed.com/legal/privacy')}>
              <Text className="text-xs text-neutral-400 underline">Privacy Policy</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

export default RegisterScreen;